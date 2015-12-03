


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


export default class PlatformBrowser {
    name() {
        return 'browser';
    }

    nowMicros() {
        return nowMicrosImp();
    }

    // A low-quality UUID: this is just a 53-bit random integer! (53 bits since the
    // backing store for the number is a 64-bit float).
    generateUUID() {
        return Math.floor(Math.random() * 9007199254740992).toString(10);
    }

    onBeforeExit(...args) {
        if (window) {
            window.addEventListener('beforeunload', ...args);
        }
    }

    options() {
        let opts = {};
        if (window) {
            let params = urlQueryParameters();
            if (params.traceguide_debug) {
                opts.debug = true;
            }
            if (params.traceguide_verbosity) {
                try {
                    opts.verbosity = parseInt(params.traceguide_verbosity);
                } catch (_ignored) {}
            }
        }
        return opts;
    }

    runtimeAttributes() {
        return {};
    }

    fatal(message) {
        throw new Error(message);
    }    
}


function urlQueryParameters(defaults) {
    let vars = {};
    let qi = window.location.href.indexOf('?');
    if (qi < 0) {
        return vars;
    }
    let slice = window.location.href.slice(qi + 1);
    if (slice.indexOf("#") >= 0) {
        slice = slice.slice(0, slice.indexOf("#"));
    }
    let hashes = slice.replace(/\+/, "%20").split('&');
    for (let i = 0; i < hashes.length; i++) {
        let hash = hashes[i].split('=');
        vars[decodeURIComponent(hash[0])] = decodeURIComponent(hash[1]);
    }
    return vars;
}
