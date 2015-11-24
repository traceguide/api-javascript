
import RuntimeImp from './imp/runtime_imp';
import * as Constants from './imp/constants';

export default class Runtime {

    constructor() {
        this._imp = new RuntimeImp();
    }

    initialize(opts) {
        return this._imp.initialize(opts);
    }

    options(opts) {
        return this._imp.options(opts);
    }

    span(operation) {
        return this._imp.span(operation);
    }

    infof(fmt, ...args) {
        return this._imp.logFmt(Constants.LOG_INFO, fmt, ...args);
    }
    warnf(fmt, ...args) {
        return this._imp.logFmt(Constants.LOG_WARN, fmt, ...args);
    }
    errorf(fmt, ...args) {
        return this._imp.logFmt(Constants.LOG_ERROR, fmt, ...args);
    }
    fatalf(fmt, ...args) {
        return this._imp.logFmt(Constants.LOG_FATAL, fmt, ...args);
    }

    flush(doneCallback) {
        return this._imp.flush(doneCallback);
    }

    on() {
        return this._imp.on(this._imp, ...arguments);
    }
    once() {
        return this._imp.once(this._imp, ...arguments);
    }
}
