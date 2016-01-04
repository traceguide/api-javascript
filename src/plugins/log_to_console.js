const constants = require('../constants');

class LogToConsole {
    constructor() {
        this._enabled = false;
        this._runtime = null;
        this._optionsCb = this._handleOptions.bind(this);
        this._logAddedCb = this._handleLogAdded.bind(this);
    }

    name() {
        return "log_to_console";
    }
    start(runtime) {
        this._runtime = runtime;
        this._runtime.addOption("log_to_console", {
            type         : "boolean",
            defaultValue : false,
        });
        this._runtime.on('options', this._optionsCb);
    }
    stop(runtime) {
        this._runtime.removeListener('options', this._optionsCb);
    }

    _handleOptions(modified, current) {
        let enabled = current.log_to_console;
        if (this._enabled == enabled) {
            return;
        }
        this._enabled = enabled;
        if (this._enabled) {
            this._runtime.on('log_added', this._logAddedCb);
        } else {
            this._runtime.removeListener('log_added', this._logAddedCb);
        }
    }

    _handleLogAdded(record) {
        let level = record.level;
        let message  = record.message;

        // Ignore records without a message (e.g. a stable_name log record)
        if (!message) {
            return;
        }

        if (level === constants.LOG_INFO) {
            console.log(message);
        } else if (level === constants.LOG_WARN) {
            console.warn(message);
        } else {
            console.error(message);
        }
    }
}

module.exports = new LogToConsole();
