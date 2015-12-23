import ActiveSpan from '../active_span';
import * as coerce from './coerce.js';
import * as constants from './constants';
import { crouton_thrift } from  '../platform_abstraction_layer';

export default class SpanImp extends ActiveSpan {

    constructor(runtime) {
        super();
        this._runtime = runtime;

        this._guid = this._runtime._platform.generateUUID();
        this._operation = '';
        this._joinIDs = {};
        this._attributes = {};
        this._beginMicros = this._runtime._platform.nowMicros();
        this._endMicros = 0;
        this._errorFlag = 0;
    }

    operation(name) {
        this._operation = coerce.toString(name);
    }

    guid() {
        return this._guid;
    }

    attributes(attrsMap) {
        if (arguments.length === 0) {
            return this._attributes;
        }

        if (arguments.length !== 1 || typeof attrsMap !== 'object') {
            this._runtime._internalWarnf("Bad arguments to attributes()", arguments);
            return;
        }

    }

    parent(span) {
        if (!span) {
            return;
        }
        this._attributes['parent_span_guid'] = span._guid;

        for (let key in span._attributes) {
            if (this._attributes[key] === undefined) {
                this._attributes[key] = span._attributes[key];
            }
        }
        for (let key in span._joinIDs) {
            if (this._joinIDs[key] === undefined) {
                this._joinIDs[key] = span._joinIDs[key];
            }
        }
    }

    joinIDs(map) {
        for (let key in map) {
            this._joinIDs[key] = map[key];
        }
    }

    endUserID(value) {
        return this.joinIDs({
            'end_user_id' : value,
        });
    }

    span(operation) {
        let child = new SpanImp(this._runtime);
        child.parent(this);
        child.operation(operation);
        return child;
    }

    end() {
        this._endMicros = this._runtime._platform.nowMicros();
        this._runtime._addSpanRecord(this._toThrift());
    }

    infof(fmt, ...args) {
        this._runtime.logFmt(constants.LOG_INFO, this._guid, fmt, ...args);
        return this;
    }
    warnf(fmt, ...args) {
        this._runtime.logFmt(constants.LOG_WARN, this._guid, fmt, ...args);
        return this;
    }
    errorf(fmt, ...args) {
        this._runtime.logFmt(constants.LOG_ERROR, this._guid, fmt, ...args);
        return this;
    }
    fatalf(fmt, ...args) {
        this._runtime.logFmt(constants.LOG_FATAL, this._guid, fmt, ...args);
        return this;
    }

    _toThrift() {
        let joinIDs = [];
        for (let key in this._joinIDs) {
            joinIDs.push(new crouton_thrift.TraceJoinId({
                TraceKey : coerce.toString(key),
                Value    : coerce.toString(this._joinIDs[key]),
            }));
        }

        let attributes = [];
        for (let key in this._attributes) {
            attributes.push(new crouton_thrift.KeyValue({
                Key   : coerce.toString(key),
                Value : coerce.toString(this._attributes[key]),
            }));
        }

        let record = new crouton_thrift.SpanRecord({
            span_guid       : this._guid,
            runtime_guid    : this._runtimeGUID,
            span_name       : this._operation,
            join_ids        : joinIDs,
            oldest_micros   : this._beginMicros,
            youngest_micros : this._endMicros,
            attributes      : attributes,
            error_flag      : null,
        });
        return record;
    }
}
