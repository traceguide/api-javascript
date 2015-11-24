
import thrift from './thrift.js';
import crouton_thrift from './crouton_thrift';

export default class TransportBrowser {

    constructor() {
        this._transport = null;
        this._protocol = null;
        this._client = null;
    }

    ensureConnection (opts) {
        // Already set up
        if (this._client) {
            return;
        }

        let host = opts.service_host;
        let port = opts.service_port;
        let scheme = opts.secure ? "https" : "http";

        // Currently the only support Thrift browser protocol is JSON.
        let serviceUrl = `${scheme}://${host}:${port}/_rpc/v1/reports/json`;
        this._transport  = new thrift.Transport(serviceUrl);
        this._protocol   = new thrift.Protocol(transport);
        this._client     = new crouton_thrift.ReportingServiceClient(protocol);
    }

    report (detached, auth, report, done) {
        done(null);
    }

}
