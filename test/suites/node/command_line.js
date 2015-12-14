var path = require("path");
var child_process = require("child_process");

describe("Command-line arguments", function() {
    it("--traceguide-debug=true", function (done) {
        var script = path.join(__dirname, "child_process/cmdline_args.js");
        var reportFile = "cmdline_args.json";

        var child = child_process.fork(script, [
            reportFile, "--traceguide-debug=true", "--traceguide-verbosity=1",
        ]);
        child.on('close', function() {
            var reqs = util.requestsFromFile(reportFile);
            expect(reqs.logRecordCount()).to.be.at.least(5);
            done();
        });
    });
});
