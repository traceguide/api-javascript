let optionsParser = require('./options_parser.js');
let util = require('./util');

const kRuntimeGUIDCookiePrefix = `traceguide_guid`;
const kSessionIDCookieKey = `traceguide_session_id`;
const kCookieTimeToLiveSeconds = 7 * 24 * 60 * 60;

let nowMicrosImp = (function() {
    // Is a hi-res timer available?
    if (performance &&
        performance.now &&
        performance.timing &&
        performance.timing.navigationStart) {

        var start = performance.timing.navigationStart;
        return function() {
            return Math.floor((start + performance.now()) * 1000.0);
        };
    } else {
        // The low-res timer is the best we can do
        return function() {
            return Date.now() * 1000.0;
        };
    }
})();

class PlatformBrowser {

    constructor(imp) {
    }

    name() {
        return 'browser';
    }

    nowMicros() {
        return nowMicrosImp();
    }

    // Return the GUID to use for the runtime. The intention is to reuse the
    // GUID so that logically a single browser session looks like a single
    // runtime.
    runtimeGUID(groupName) {
        // Account for the groupName in the same that multiple apps or services
        // are running on the same domain (and should not share the same
        // runtime GUID).
        let cookieKey = `${kRuntimeGUIDCookiePrefix}/${groupName}`;
        let uuid = util.cookie(cookieKey) || this._generateLongUUID();
        util.cookie(cookieKey, uuid, kCookieTimeToLiveSeconds, '/');

        // Also create a session ID as well to give the server more information
        // to coordinate with.
        let sessionID = util.cookie(kSessionIDCookieKey) || this._generateLongUUID();
        util.cookie(kSessionIDCookieKey, sessionID, kCookieTimeToLiveSeconds, '/');

        return uuid;
    }

    // A low-quality UUID: this is just a 53-bit random integer! (53 bits since the
    // backing store for the number is a 64-bit float).
    generateUUID() {
        return Math.floor(Math.random() * 9007199254740992).toString(16);
    }

    _generateLongUUID() {
        let a = Math.floor(Math.random() * 0xFFFFFFFF).toString(16);
        let b = Math.floor(Math.random() * 0xFFFFFFFF).toString(16);
        while (b.length < 8) {
            b = '0' + b;
        }
        return a + b;
    }

    onBeforeExit(...args) {
        if (window) {
            window.addEventListener('beforeunload', ...args);
        }
    }

    plugins() {
        return [
            require('../../../plugins/instrument_xhr'),
            require('../../../plugins/instrument_document_load'),
        ];
    }

    options() {
        let opts = {};
        optionsParser.parseScriptElementOptions(opts);
        optionsParser.parseURLQueryOptions(opts);
        return opts;
    }

    runtimeAttributes() {
        return {
            cruntime_platform : 'browser',
        };
    }

    // There's no way to truly "fatal" on the browser; the best approximation
    // is an Error exception.
    fatal(message) {
        throw new Error(message);
    }

    localStoreGet(key) {
        if (!window.localStorage) {
            return null;
        }
        try {
            return JSON.parse(localStorage.getItem(`traceguide/${key}`));
        } catch (_ignored) {
            return null;
        }
    }

    localStoreSet(key, value) {
        if (!window.localStorage) {
            return;
        }
        try {
            localStorage.setItem(`traceguide/${key}`, JSON.stringify(value));
        } catch (_ignored) {}
    }
}




module.exports = PlatformBrowser;
