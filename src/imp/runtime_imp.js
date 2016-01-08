//============================================================================//
// Imports
//============================================================================//

import { sprintf } from 'sprintf-js';
import EventEmitter from 'eventemitter3';
import { Platform, Transport, thrift, crouton_thrift } from '../platform_abstraction_layer';
import { UserException, InternalException } from './exceptions';
import SpanImp from './span_imp';
const _             = require('underscore');
const constants     = require('../constants');
const coerce        = require('./coerce');
const util          = require('./util/util');
const LogBuilder    = require('./log_builder');
const ClockState    = require('./util/clock_state');
const packageObject = require('../../package.json');

export default class RuntimeImp extends EventEmitter {

    constructor(api, config) {
        super();

        // Platform abstraction layer
        this._platform = new Platform(this);
        this._runtimeGUID = null;  // Set once the group name is set
        this._pluginNames = {};
        this._options = {};
        this._optionDescs = [];

        // Core options
        //
        this.addOption('access_token',                  { type: 'string',  defaultValue: '' });
        this.addOption('group_name',                    { type: 'string',  defaultValue: '' });
        this.addOption('disabled',                      { type: 'bool',    defaultValue: false });
        this.addOption('service_host',                  { type: 'string',  defaultValue: 'api.traceguide.io' });
        this.addOption('service_port',                  { type: 'int',     defaultValue: 9997 });
        this.addOption('secure',                        { type: 'bool',    defaultValue: true });
        this.addOption('report_period_millis',          { type: 'int',     defaultValue: 2500 });
        this.addOption('max_log_records',               { type: 'int',     defaultValue: 4096 });
        this.addOption('max_span_records',              { type: 'int',     defaultValue: 4096 });
        this.addOption('join_ids',                      { type: 'any',     defaultValue: {} });

        // Debugging options
        //
        // If false, SSL certificate verification is skipped. Useful for testing.
        this.addOption('certificate_verification',      { type: 'bool',    defaultValue: true });
        // If true, internal logs will be included in the reports
        this.addOption('debug',                         { type: 'bool',    defaultValue: false });
        // I.e. report only on explicit calls to flush()
        this.addOption('disable_reporting_loop',        { type: 'bool',    defaultValue: false });
        // Log verbosity level
        this.addOption('verbosity',                     { type: 'int', min: 0, max: 2, defaultValue: 0 });

        // Hard upper limits to protect against worst-case scenarios
        this.addOption('log_message_length_hard_limit', { type: 'int',     defaultValue: 512 * 1024 });
        this.addOption('log_payload_length_hard_limit', { type: 'int',     defaultValue: 512 * 1024 });

        let now = this._platform.nowMicros();

        // The thrift authentication and runtime struct are created as soon as
        // the necessary initialization options are available.
        this._startMicros = now;
        this._thriftAuth = null;
        this._thriftRuntime = null;
        this._transport = new Transport();

        this._reportingLoopActive = false;
        this._reportYoungestMicros = now;
        this._reportTimer = null;
        this._reportErrorStreak = 0;    // Number of consecuetive errors

        // For clock skew adjustment.
        this._useClockState = true;
        this._clockState = new ClockState({
            nowMicros : () => this._platform.nowMicros(),
            localStoreGet : () => {
                let key = `clock_state/${this._options.service_host}`;
                return this._platform.localStoreGet(key);
            },
            localStoreSet : (value) => {
                let key = `clock_state/${this._options.service_host}`;
                return this._platform.localStoreSet(key, value);
            },
        })

        // Report buffers and per-report data
        // These data are reset on every successful report.
        this._logRecords = [];
        this._spanRecords = [];
        this._counters = {
            dropped_logs         : 0,
            dropped_spans        : 0,
            flush_with_no_data   : 0,
            flush_errors         : 0,
            flush_exceptions     : 0,
        };

        // Current runtime state / status
        this._flushIsActive = false;
    }


    //-----------------------------------------------------------------------//
    // Options
    //-----------------------------------------------------------------------//

    guid() {
        return this._runtimeGUID;
    }

    initialize(opts) {
        this.options(opts || {});
    }

    setPlatformOptions() {
        this.options(this._platform.options());
    }

    // Register a new option.  Used by plug-ins.
    addOption(name, desc) {
        this._internalInfofV2(`Adding options ${desc.name} with value = ${desc.defaultValue}`);

        desc.name = name;
        this._optionDescs.push(desc);
        this._options[desc.name] = desc.defaultValue;
    }

    options(opts) {
        if (arguments.length === 0) {
            console.assert(typeof this._options === "object", "Internal error: _options field incorrect");
            return this._options;
        }
        if (typeof opts !== 'object') {
            throw new UserException('options() must be called with an object: type was ' + typeof opts);
        }

        // Track what options have been modified
        let modified = {};
        for (let desc of this._optionDescs) {
            this._setOptionInternal(modified, opts, desc);
        }
        // Check for any invalid options
        for (let key in opts) {
            if (modified[key] === undefined) {
                throw new UserException("Invalid option '%s'", key);
            }
        }

        //
        // Update the state information based on the changes
        //
        this._initReportingDataIfNeeded(modified);

        if (!this._reportingLoopActive) {
            this._startReportingLoop();
        }

        if (this._options.debug) {
            let optionsString = _.map(modified, (val, key) => {
                return "\t" + JSON.stringify(key) + " : " + JSON.stringify(val);
            }).join("\n");
            this._internalInfofV2("Options modified:\n%s", optionsString);
        }
        this.emit('options', modified, this._options);
    }

    _setOptionInternal(modified, opts, desc) {
        let name = desc.name;
        let value = opts[name];
        let valueType = typeof value;
        if (value === undefined) {
            return;
        }

        // Parse the option (and check constraints)
        switch (desc.type) {

        case "any":
            break;

        case "bool":
            if (value !== true && value !== false) {
                this._internalWarnf("Invalid boolean option '%s' '%j'", name, value);
                return;
            }
            break;

        case "int":
            if (valueType !== "number" || Math.floor(value) != value) {
                this._internalWarnf("Invalid int option '%s' '%j'", name, value);
                return;
            }
            if (desc.min !== undefined && desc.max !== undefined ) {
                if (!(value >= desc.min && value <= desc.max)) {
                    this._internalWarnf("Option '%s' out of range '%j' is not between %j and %j", name, value, min, max);
                    return;
                }
            }
            break;

        case "string":
            switch (valueType) {
            case "string":
                break;
            case "number":
                value = coerce.toString(value);
                break;
            default:
                this._internalWarnf("Invalid string option '%s' '%j'", name, value);
                return;
            }
            break;

        default:
            this._internalWarnf(`Unknown option type '${desc.type}'`);
            return;
        }

        // Set the new value, recording any modifications
        let oldValue = this._options[name];
        if (oldValue === undefined) {
            throw this._internalException("Attempt to set unknown option '%s'", name);
        }
        modified[name] = {
            oldValue : oldValue,
            newValue : value,
        };
        this._options[name] = value;
    }

    // The Thrift authorization and runtime information is initializaed as soon
    // as it is available.  This allows logs and spans to be buffered before
    // the library is initialized, which can be helpul in a complex setup with
    // many subsystems.
    //
    _initReportingDataIfNeeded(modified) {
        // Ignore redundant initialization; complaint on inconsistencies
        if (this._thriftAuth !== null) {

            if (!this._thriftRuntime) {
                return this._internalErrorf("Inconsistent state: thrift auth initialized without runtime.")
            }
            if (modified.access_token) {
                throw new UserException("Cannot change access_token after it has been set.");
            }
            if (modified.group_name) {
                throw new UserException("Cannot change group_name after it has been set.");
            }
            if (modified.service_host) {
                throw new UserException("Cannot change service_host after the connection is established");
            }
            if (modified.service_port) {
                throw new UserException("Cannot change service_host after the connection is established");
            }
            if (modified.secure) {
                throw new UserException("Cannot change service_host after the connection is established");
            }
            return;
        }

        // See if the Thrift data can be initialized
        if (this._options.access_token.length > 0 && this._options.group_name.length > 0) {
            this._internalInfofV2("Initializing thrift reporting data");

            this._runtimeGUID = this._platform.runtimeGUID(this._options.group_name);

            this._thriftAuth = new crouton_thrift.Auth({
                access_token : this._options.access_token,
            });

            let attrs = {
                cruntime_name    : packageObject.name,
                cruntime_version : packageObject.version,
            };
            let platformAttrs = this._platform.runtimeAttributes();
            for (let key in platformAttrs) {
                attrs[key] = platformAttrs[key];
            }

            let thriftAttrs = [];
            for (let key in attrs) {
                thriftAttrs.push(new crouton_thrift.KeyValue({
                    Key   : coerce.toString(key),
                    Value : coerce.toString(attrs[key]),
                }));
            }
            this._thriftRuntime = new crouton_thrift.Runtime({
                guid         : this._runtimeGUID,
                start_micros : this._startMicros,
                group_name   : this._options.group_name,
                attrs        : thriftAttrs,
            });

            this.emit('reporting_initialized');
        }
    }

    //-----------------------------------------------------------------------//
    // Plugins
    //-----------------------------------------------------------------------//

    addPlatformPlugins(api) {
        for (let plugin of this._platform.plugins()) {
            this.addPlugin(api, plugin);
        }
    }

    addPlugin(api, plugin) {
        let name = plugin.name();
        if (this._pluginNames[name]) {
            return;
        }
        this._pluginNames[name] = true;

        plugin.start(api);
    }

    //-----------------------------------------------------------------------//
    // Spans
    //-----------------------------------------------------------------------//

    span(name) {
        let handle = new SpanImp(this);
        handle.operation(name);

        this.emit('span_started', handle);

        return handle;
    }

    //-----------------------------------------------------------------------//
    // Logging
    //-----------------------------------------------------------------------//

    log() {
        let b = new LogBuilder(this);
        return b;
    }

    logStable(stableName, payload) {
        this.log()
            .name(stableName)
            .payload(payload)
            .end();
    }

    // Create a thrift log record and add it to the internal buffer
    logFmt(level, spanGUID, fmt, ...args) {
        let log = this.log()
            .level(level)
            .span(spanGUID)
            .logf(fmt, ...args);
        if (args.length > 0) {
            log.payload({
                "arguments" : args,
            });
        }
        log.end();
    }

    //-----------------------------------------------------------------------//
    // Buffers
    //-----------------------------------------------------------------------//

    _clearBuffers() {
        this._logRecords = [];
        this._spanRecords = [];

        for (let key in this._counters) {
            this._counters[key] = 0;
        }
    }

    _buffersAreEmpty() {
        if (this._logRecords.length > 0) {
            return false;
        }
        if (this._spanRecords.length > 0) {
            return false;
        }

        // `let <value> of <object>` is problematic in Node v4.1.
        // https://github.com/babel/babel-loader/issues/84
        for (let value of Object.entries(this._counters)) {
            if (value > 0) {
                return false;
            }
        }
        return true;
    }

    // Adds a completed record into the log buffer
    _addLogRecord(record) {
        // Check record content against the hard-limits
        if (record.message && record.message.length > this._options.log_message_length_hard_limit) {
            record.message = record.message.substr(0, this._options.log_message_length_hard_limit - 1) + "…";
        }
        if (record.payload_json && record.payload_json.length > this._options.log_payload_length_hard_limit) {
            record.payload_json = '{"error":"payload exceeded maximum size"}';
        }

        this._internalAddLogRecord(record);
        this.emit('log_added', record);

        if (record.level === constants.LOG_FATAL) {
            this._platform.fatal(message);
        }
    }

    // Internal worker for adding the log record to the buffer.
    //
    // Note: this is also used when a failed report needs to restores records
    // back to the buffer, therefore it should not do things like echo the
    // log message to the console with the assumption this is a new record.
    _internalAddLogRecord(record) {
        if (!record) {
            this._internalErrorf("Attempt to add null record to buffer");
            return;
        }

        if (this._logRecords.length >= this._options.max_log_records) {
            let index = Math.floor(this._logRecords.length * Math.random());
            this._logRecords[index] = record;
            this._counters.dropped_logs++;
        } else {
            this._logRecords.push(record);
        }
    }

    _addSpanRecord(record) {
        this._internalAddSpanRecord(record);
        this.emit('span_added', record);
    }

    _internalAddSpanRecord(record) {
        if (!record) {
            this._internalErrorf("Attempt to add null record to buffer");
            return;
        }

        if (this._spanRecords.length >= this._options.max_span_records) {
            let index = Math.floor(this._spanRecords.length * Math.random());
            this._spanRecords[index] = record;
            this._counters.dropped_spans++;
        } else {
            this._spanRecords.push(record);
        }
    }

    _restoreRecords(logs, spans, counters) {
        for (let record of logs) {
            this._internalAddLogRecord(record);
        }
        for (let record of spans) {
            this._internalAddSpanRecord(record);
        }
        for (let record of counters) {
            if (this._counters[record.Name]) {
                this._counters[record.Name] += record.Value;
            } else {
                this._internalErrorf("Bad counter name: '%s'", record.Name);
            }
        }
    }

    //-----------------------------------------------------------------------//
    // Reporting loop
    //-----------------------------------------------------------------------//

    // flush()
    //
    // detached bool - indicates the report should assume the script is about
    //      to exit or otherwise wants the report to be sent as quickly and
    //      low-overhead as possible.
    //
    flush(detached) {
        detached = detached || false;

        if (this._options.disabled) {
            return;
        }
        this._flushReport(detached, (err) => {});
    }

    _startReportingLoop() {
        if (this._options.disabled) {
            this._internalInfof("Not starting reporting loop: instrumentation is disabled.");
            return;
        }
        if (this._options.disable_reporting_loop) {
            this._internalInfof("Not starting reporting loop: reporting loop is disabled.");
            return;
        }
        if (this._thriftAuth === null) {
            // Don't start the loop until the thrift data necessary to do the
            // report is set up.
            return;
        }
        if (this._reportingLoopActive) {
            this._internalErrorf("Reporting loop already started!");
            return;
        }

        this._internalInfofV1("Starting reporting loop: %j", this._thriftRuntime);
        this._reportingLoopActive = true;

        // Set up the script exit clean-up: stop the reporting loop (so it does
        // not turn a Node process into a zombie) and do a final explicit flush.
        // Note that the final flush may enqueue asynchronous callbacks that cause
        // the 'beforeExit' event to be re-emitted when those callbacks finish.
        let finalFlush = () => {
            this._internalInfof("Final flush before exit.");
            this.flush(true);
        };
        let stopReporting = () => { this._stopReportingLoop() };
        this._platform.onBeforeExit(_.once(stopReporting));
        this._platform.onBeforeExit(_.once(finalFlush));

        // Begin the asynchronous reporting loop
        let loop = ()=>{
            this._enqueueNextReport((err) => {
                if (this._reportingLoopActive) {
                    loop();
                }
            });
        }
        loop();
    }

    _stopReportingLoop() {
        this._internalInfofV2("Stopping reporting loop");

        this._reportingLoopActive = false;
        clearTimeout(this._reportTimer);
        this._reportTimer = null;
    }

    _enqueueNextReport(done) {
        // If there's already a report request enqueued, ignore this new
        // request.
        if (this._reportTimer) {
            return;
        }

        // If the clock state is still being primed, potentially use the
        // shorted report interval
        let reportPeriod = this._options.report_period_millis;
        if (!this._clockState.isReady()) {
            reportPeriod = Math.min(constants.CLOCK_STATE_REFRESH_INTERVAL_MS, reportPeriod);
        }

        // After 3 consecutive errors, expand the retry delay up to 8x the
        // normal interval. Also, jitter the delay by +/- 10%
        let backOff = 1 + Math.min(7, Math.max(0, this._reportErrorStreak - 3));
        let basis = backOff * reportPeriod;
        let jitter = 1.0 + (Math.random() * 0.2 - 0.1);
        let delay = Math.floor(Math.max(0, jitter * basis));

        this._internalInfofV2("Delaying next flush for %dms", delay);
        this._reportTimer = util.detachedTimeout(()=> {
            this._reportTimer = null;
            this._flushReport(false, done);
        }, delay);
    }

    _flushReport(detached, done) {
        done = done || function(err) {};

        let clockReady = this._clockState.isReady();
        let clockOffsetMicros = this._clockState.offsetMicros();

        // Diagnostic information on the clock correction
        this.logStable("cr/time_correction_state", {
            offset_micros  : clockOffsetMicros,
            active_samples : this._clockState.activeSampleCount(),
            ready          : clockReady,
        });

        let logRecords = this._logRecords;
        let spanRecords = this._spanRecords;
        let counters = this._counters;

        // If the clock is not ready, do an "empty" flush to build more clock
        // samples before the real data is reported.
        // A detached flush (i.e. one intended to fire at exit or other "last
        // ditch effort" event) should always use the real data.
        if (this._useClockState && !clockReady && !detached) {
            this._internalInfofV2("Flushing empty report to prime clock state");
            logRecords  = [];
            spanRecords = [];
            counters    = {};
        } else {
            // Early out if we can.
            if (this._buffersAreEmpty()) {
                this._internalInfofV2("Skipping empty report");
                return done(null);;
            }

            // Clear the object buffers as the data is now in the local
            // variables
            this._clearBuffers();

            this._internalInfofV2("Flushing report (%d logs, %d spans)", logRecords.length, spanRecords.length);
        }

        this._transport.ensureConnection(this._options);

        // Ensure the runtime GUID is set as it is possible buffer logs and
        // spans before the GUID is necessarily set.
        console.assert(this._runtimeGUID !== null);

        for (let record of logRecords) {
            record.runtime_guid = this._runtimeGUID;
        }
        for (let record of spanRecords) {
            record.runtime_guid = this._runtimeGUID;
        }

        let thriftCounters = [];
        for (let key in counters) {
            let value = counters[key];
            if (value === 0) {
                continue;
            }
            thriftCounters.push(new crouton_thrift.NamedCounter({
                Name  : coerce.toString(key),
                Value : coerce.toNumber(value),
            }));
        }

        let now = this._platform.nowMicros();
        let report = new crouton_thrift.ReportRequest({
            runtime         : this._thriftRuntime,
            oldest_micros   : this._reportYoungestMicros,
            youngest_micros : now,
            log_records     : logRecords,
            span_records    : spanRecords,
            counters        : thriftCounters,
        });

        this.emit("prereport", report);
        let originMicros = this._platform.nowMicros();

        this._transport.report(detached, this._thriftAuth, report,  (err, res) => {

            let destinationMicros = this._platform.nowMicros();
            if (err) {
                // How many errors in a row?
                this._reportErrorStreak++;

                // On a failed report, re-enqueue the data that was going to be
                // sent.
                if (err.message) {
                    this._internalErrorf("Error in report: %s (%j)", err.message, err);
                } else {
                    this._internalErrorf("Error in report: %j", err);
                }
                this._restoreRecords(report.log_records, report.span_records, report.counters);

                this.emit('report_error', err, {
                    error    : err,
                    streak   : this._reportErrorStreak,
                    detached : detached,
                });

            } else {

                if (this._options.debug) {
                    let reportWindowSeconds = (now - report.oldest_micros) / 1e6;
                    this._internalInfof("Report flushed for last %0.3f seconds", reportWindowSeconds);
                }

                // Update internal data after the successful report
                this._reportErrorStreak = 0;
                this._reportYoungestMicros = now;

                // Update the clock state if there's info from the report
                if (res && res.timing && res.timing.receive_micros && res.timing.transmit_micros) {
                    this._clockState.addSample(
                        originMicros,
                        res.timing.receive_micros,
                        res.timing.transmit_micros,
                        destinationMicros);
                } else {
                    // The response does not have timing information. Disable
                    // the clock state assuming there'll never be timing data
                    //to use.
                    this._useClockState = false;
                }

                this.emit('report', report, res);
            }
            return done(err);
        });
    }

    //-----------------------------------------------------------------------//
    // Internal logging & errors
    //-----------------------------------------------------------------------//

    _internalInfofV2(fmt, ...args) {
        if (this._options.verbosity < 2) {
            return;
        }
        this._internalLog("[traceguide:V2] ", constants.LOG_INFO, fmt, ...args);
    }
    _internalInfofV1(fmt, ...args) {
        if (this._options.verbosity < 1) {
            return;
        }
        this._internalLog("[traceguide:V1] ", constants.LOG_INFO, fmt, ...args);
    }
    _internalInfof(fmt, ...args) {
        this._internalLog("[traceguide:I] ", constants.LOG_INFO, fmt, ...args);
    }
    _internalWarnf(fmt, ...args) {
        this._internalLog("[traceguide:W] ", constants.LOG_WARN, fmt, ...args);
    }
    _internalErrorf(fmt, ...args) {
        this._internalLog("[traceguide:E] ", constants.LOG_ERROR, fmt, ...args);
    }
    _internalLog(prefix, level, fmt, ...args) {
        if (this._options.debug) {
            this.logFmt(level, null, prefix + fmt, ...args);
        }
    }
}
