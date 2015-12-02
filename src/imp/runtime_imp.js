import _ from 'underscore';
import { sprintf } from 'sprintf-js';
import EventEmitter from 'eventemitter3';

import { Platform, Transport, thrift, crouton_thrift } from '../platform_abstraction_layer';
import { UserException, InternalException } from './exceptions';
import SpanImp from './span_imp';
import * as constants from './constants';
import * as coerce from './coerce';
const util = require('./util');

const kDefaultOptions = {
    access_token            : '',
    group_name              : '',
    service_host            : 'api.traceguide.io',
    service_port            : 9997,
    secure                  : true,
    disabled                : false,

    max_log_records         : 2048,
    max_span_records        : 2048,
    report_period_millis    : 2500,

    // If true, log records are echoed to the console
    log_to_console          : false,

    // If true, internal logs will be included in the reports
    debug                   : false,

    // glog-ish verbosity level for internal logs
    verbosity               : 0,

    // Do not create a interval-based reporting loop. Useful for unit testing.
    disable_reporting_loop  : false,

    // If false, SSL certificate verification is skipped. Useful for localhost
    // testing.
    certificate_verification: true,
};

export default class RuntimeImp extends EventEmitter {

    constructor() {
        super();

        // Platform abstraction layer
        this._platform = new Platform();
        this._runtimeGUID = this._platform.generateUUID();
        this._options = _.clone(kDefaultOptions);

        let now = this._platform.nowMicros();

        // Created as soon as the necessary initialization options are available
        this._startMicros = now;
        this._thriftAuth = null;
        this._thriftRuntime = null;
        this._transport = new Transport();

        this._reportingLoopActive = false;
        this._reportYoungestMicros = now;
        this._reportTimer = null;

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

        // Set any platform-specific options.  E.g. the --traceguide-debug=true
        // flag on Node.
        this.options(this._platform.options());
    }


    //-----------------------------------------------------------------------//
    // Options
    //-----------------------------------------------------------------------//

    initialize(opts) {
        this.options(opts);
    }

    options(opts) {
        if (typeof opts !== 'object') {
            throw new UserException('options() must be called with an object');
        }

        // Update the options data
        // Track what options have been modified
        let modified = {};
        this._setOptionString(modified,  opts, 'access_token');
        this._setOptionString(modified,  opts, 'group_name');
        this._setOptionBoolean(modified, opts, 'disabled');
        this._setOptionBoolean(modified, opts, 'log_to_console');
        this._setOptionBoolean(modified, opts, 'debug');
        this._setOptionInt(modified,     opts, 'verbosity', 0, 2);
        this._setOptionBoolean(modified, opts, 'disable_reporting_loop');
        this._setOptionInt(modified,     opts, 'report_period_millis');

        // Check for any unhandled options
        for (let key in opts) {
            if (modified[key] === undefined) {
                throw new UserException("Invalid option '%s'", key);
            }
        }

        //
        // Update the state information based on the changes
        //
        if (opts.access_token || opts.group_name) {
            this._initReportingDataIfNeeded(modified);
        }
        if (!this._reportingLoopActive) {
            this._startReportingLoop();
        }

        this._internalInfofV2("Options modified: %j", modified);
        this.emit('options', modified, this._options);
    }

    _setOptionInt(modified, opts, name, min, max) {
        let value = opts[name];
        let valueType = typeof value;
        if (value === undefined) {
            return;
        }
        if (valueType !== "number" || Math.floor(value) != value) {
            this._internalWarnf("Invalid int option '%s' '%j'", name, value);
            return;
        }
        if (min !== undefined && max !== undefined ) {
            if (!(value >= min && value <= max)) {
                this._internalWarnf("Option '%s' out of range '%j' is not between %j and %j", name, value, min, max);
            }
        }
        this._setOptionValue(modified, opts, name, value);
    }

    _setOptionString(modified, opts, name) {
        let value = opts[name];
        let valueType = typeof value;
        if (value === undefined) {
            return;
        }
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
        this._setOptionValue(modified, opts, name, value);
    }

    _setOptionBoolean(modified, opts, name) {
        let value = opts[name];
        if (value === undefined) {
            return;
        }
        if (value !== true && value !== false) {
            this._internalWarnf("Invalid boolean option '%s' '%j'", name, value);
            return;
        }
        this._setOptionValue(modified, opts, name, value);
    }

    _setOptionValue(modified, opts, name, newValue) {
        let oldValue = this._options[name];
        if (oldValue === undefined) {
            throw this._internalException("Attempt to set unknown option '%s'", name);
        }

        modified[name] = {
            oldValue : oldValue,
            newValue : newValue,
        };
        this._options[name] = newValue;
    }

    // The Thrift authorization and runtime information is initializaed as soon
    // as it is available.  This allows logs and spans to be buffered before
    // the library is initialized, which can be helpul in a complex setup with
    // many subsystems.
    //
    _initReportingDataIfNeeded() {
        // Ignore redundant initialization; complaint on inconsistencies
        if (this._thriftAuth !== null) {
            if (!this._thriftRuntime) {
                return this._internalErrorf("Inconsistent state: thrift auth initialized without runtime.")
            }
            if (this._options.access_token != this._thriftAuth.access_token) {
                throw new Error("Cannot change access_token after it has been set.");
            }
            if (this._options.group_name != this._thriftRuntime.group_name) {
                throw new Error("Cannot change group_name after it has been set.");
            }
            return;
        }

        // See if the Thrift data can be initialized
        if (this._options.access_token.length > 0 && this._options.group_name.length > 0) {
            this._thriftAuth = new crouton_thrift.Auth({
                access_token : this._options.access_token,
            });
            this._thriftRuntime = new crouton_thrift.Runtime({
                guid         : this._runtimeGUID,
                start_micros : this._startMicros,
                group_name   : this._options.group_name,
            });

        }
    }

    //-----------------------------------------------------------------------//
    // Spans
    //-----------------------------------------------------------------------//

    span(name) {
        let span = new SpanImp(this);
        span.operation(name);
        return span;
    }

    //-----------------------------------------------------------------------//
    // Logging
    //-----------------------------------------------------------------------//

    // Create a thrift log record and add it to the internal buffer
    logFmt(level, fmt, ...args) {

        let now = this._platform.nowMicros();
        let message = sprintf(fmt, ...args);

        let payloadJSON = null;
        if (args.length > 0) {
            let payload = {
                "arguments" : args,
            };
            try {
                payloadJSON = JSON.stringify(payload);
            } catch (_ignored) {
            }
        }
        let errorFlag = (level >= constants.LOG_ERROR);

        // Note: the Thrift JS code writes neither null nor undefined field
        // values so there is message overhead in these null fields.
        let record = new crouton_thrift.LogRecord({
            timestamp_micros : now,
            runtime_guid     : this._runtimeGUID,
            span_guid        : null,
            stable_name      : null,
            message          : message,
            level            : constants.LOG_LEVEL_TO_STRING[level] || null,
            thread_id        : null,
            filename         : null,
            line_number      : null,
            stack_frames     : null,
            payload_json     : payloadJSON,
            error_flag       : errorFlag,
        });

        this._addLogRecord(record);

        if (this._options.log_to_console) {
            this._logToConsole(level, message);
        }
    }

    _logToConsole(level, text) {
        if (level === constants.LOG_INFO) {
            console.log(text);
        } else if (level === constants.LOG_WARN) {
            console.warn(text);
        } else {
            console.error(text);
        }
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

    _addLogRecord(record) {
        if (this._logRecords.length >= this._options.max_log_records) {
            let index = Math.floor(this._logRecords.length * Math.random());
            this._logRecords[index] = record;
            this._counters.dropped_logs++;
        } else {
            this._logRecords.push(record);
        }
    }

    _addSpanRecord(record) {
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
            this._addLogRecord(record);
        }
        for (let record of spans) {
            this._addSpanRecord(record);
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
        let finalFlush = () => { this.flush(true) };
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

        // Jitter the report delay by +/- 10%
        let basis = this._options.report_period_millis;
        let jitter = 1.0 + (Math.random() * 0.2 - 0.1);
        let delay = Math.floor(Math.max(0, jitter * basis));

        this._reportTimer = util.detachedTimeout(()=> {
            this._reportTimer = null;
            this._flushReport(done);
        }, delay);
    }

    _flushReport(detached, done) {
        done = done || function(err) {};

        // Early out if we can
        if (this._buffersAreEmpty()) {
            this._internalInfofV2("Skipping empty report");
            done(null);
            return;
        }

        this._internalInfofV2("Flushing report");

        this._transport.ensureConnection(this._options);

        let thriftCounters = [];
        for (let key in this._counters) {
            let value = this._counters[key];
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
            log_records     : this._logRecords,
            span_records    : this._spanRecords,
            counters        : thriftCounters,
        });
        this._clearBuffers();

        this._transport.report(detached, this._thriftAuth, report,  (err) => {
            if (err) {
                // On a failed report, re-enqueue the data that was going to be
                // sent.
                this._internalErrorf("Error in report: %j", err);
                this._internalInfofV1("Report: %j", report);
                this._restoreRecords(report.log_records, report.span_records, report.counters);
            } else {
                if (this._options.debug) {
                    let reportWindowSeconds = (now - report.oldest_micros) / 1e6;
                    this._internalInfof("Report flushed for last %0.3f seconds", reportWindowSeconds);
                }

                // Update the report timestamp
                this._reportYoungestMicros = now;
            }
            done(err);
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
            this.logFmt(level, prefix + fmt, ...args);
        }
    }
}
