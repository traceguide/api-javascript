class InstrumentPageLoad {

    constructor() {
        this._inited = false;
        this._runtime = null;
        this._span = null;
    }

    name() {
        return 'instrument_page_load';
    }

    start(runtime) {
        if (this._inited) {
            return;
        }
        this._inited = true;

        if (typeof window !== 'object' || typeof document !== 'object') {
            return;
        }

        this._runtime = runtime;
        this._span = runtime.span('document/load');
        document.addEventListener('readystatechange', this._handleReadyStateChange.bind(this));
    }

    stop(runtime) {
    }

    _handleReadyStateChange() {
        let span = this._span;
        let state = document.readyState;
        let payload = undefined;

        if (state === 'complete') {
            payload = {};
            if (window.performance && performance.timing) {
                this._addTimingSpans(span, performance.timing);
                payload['window.performance.timing'] = performance.timing;
            }
        }

        span.info(`document readystatechange ${state}`, payload);

        if (state === 'complete') {
            span.end();
        }
    }

    _copyNavigatorProperties(nav) {
        let dst = {};
        for (let key in nav) {
            try {
                let value = nav[key];
                switch (key) {

                case "plugins": {
                    let p = [];
                    for (let i = 0; i < value.length; i++) {
                        let item = value.item(i);
                        p.push({
                            name : item.name,
                            description : item.description,
                        });
                    }
                    dst[key] = p;
                } break;

                case "mimeTypes": {
                    let p = [];
                    for (let i = 0; i < value.length; i++) {
                        let item = value.item(i);
                        p.push({
                            type        : item.type,
                            description : item.description,
                            suffixes    : item.suffixes,
                        });
                    }
                    dst[key] = p;
                } break;

                default:
                    dst[key] = value;
                    break;
                }
            } catch (e) {
                // Skip, just in case
            }
        }
        return dst;
    }

    // Retroactively create the appropriate spans and logs
    _addTimingSpans(parent, timing) {

        for (let key in timing) {
            let value = timing[key];

            // e.g. secureConnectionStart is not always set
            if (typeof value !== 'number' || value === 0) {
                continue;
            }



            let micros = value * 1000.0;
            let payload = undefined;

            if (key === 'navigationStart' && typeof navigator === 'object') {
                payload = {
                    navigator : this._copyNavigatorProperties(navigator),
                };
            }
            parent.log({
                message          : `document ${key}`,
                timestamp_micros : micros,
                payload          : payload,
            });
        }

        parent.modify({
            begin_micros : timing.navigationStart * 1000.0,
        });
        parent.span('document/time_to_first_byte').modify({
            begin_micros : timing.requestStart * 1000.0,
            end_micros   : timing.responseStart * 1000.0,
        }).end();
        parent.span('document/response_transfer').modify({
            begin_micros : timing.responseStart * 1000.0,
            end_micros   : timing.responseEnd * 1000.0,
        }).end();
        parent.span('document/dom_load').modify({
            begin_micros : timing.domLoading * 1000.0,
            end_micros   : timing.domInteractive * 1000.0,
        }).end();
    }
}

module.exports = new InstrumentPageLoad();
