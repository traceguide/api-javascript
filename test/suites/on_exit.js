var path = require("path");
var fs   = require("fs");
var child_process = require("child_process");

describe("On Exit Behavior", function () {
    it("flush on exit", function (done) {
        var script = path.join(__dirname, "on_exit/child.js");
        var reportFile = "on_exit.child.json";

        var child = child_process.fork(script, [ reportFile ]);
        child.on('close', function() {
            var reqs = util.requestsFromFile(reportFile);

            expect(reqs.logRecordCount()).to.be.at.least(10);
            expect(reqs.hasLogMessage("log0")).to.be.true;
            expect(reqs.hasLogMessage("log1")).to.be.true;
            expect(reqs.hasLogMessage("log2")).to.be.true;
            expect(reqs.hasLogMessage("log3")).to.be.true;
            expect(reqs.hasLogMessage("log4")).to.be.true;
            expect(reqs.hasLogMessage("log5")).to.be.true;
            expect(reqs.hasLogMessage("log6")).to.be.true;
            expect(reqs.hasLogMessage("log7")).to.be.true;
            expect(reqs.hasLogMessage("log8")).to.be.true;
            expect(reqs.hasLogMessage("log9")).to.be.true;

            expect(reqs.spanRecordCount()).to.be.at.least(1);

            done();
        });
    });
});
