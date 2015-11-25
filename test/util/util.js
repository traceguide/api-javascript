var fs            = require("fs");
var deepClone     = require("clone");
var _             = require("underscore");
var FileTransport = require("./file_transport");
var TestRequests  = require("./test_requests");

function Util() {
}

Util.prototype.runtimeReportToFile = function (runtime, filename) {
    // This is a unit testing utility: unabashedly reach into the object and
    // change what we need to change for testing purposes!
    runtime._imp._transport = new FileTransport(filename);
};

Util.prototype.requestsFromFile = function (filename) {
    var content = JSON.parse(fs.readFileSync(filename, "utf8"));
    return new TestRequests(content);
};

module.exports = new Util();
