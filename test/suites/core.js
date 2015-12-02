var path = require("path");
var child_process = require("child_process");

describe("Library has the expected logging methods", function () {
    expectToBeFunctions("infof warnf errorf fatalf");
});

describe("Library has only the expected EventEmitter methods", function () {
    expectToBeFunctions("on once");
    expectToBeUndefined("emit");
});

describe("Basic usage", function () {

    it("should not throw an exception on simple operations", function () {
        traceguide.infof("Hello World %d", 42);
        traceguide.warnf("Hello World %d", 42);
        traceguide.errorf("Hello World %d", 42);

        var span = traceguide.span("test_operation");
            var subspan = span.span("test_subspan");
            subspan.end();
        span.end();

        traceguide.flush();
    });

    it("should not throw an exception on lots of logs and spans", function () {
        this.timeout(2000);
        for (var i = 0; i < 10000; i++) {
            traceguide.infof("Hello World %d", 42);

            var span = traceguide.span("test_operation");
                var subspan = span.span("test_subspan");
                subspan.end();
            span.end();
        }
        traceguide.flush();
    });
});

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

describe("Report flush loop", function() {
    it("should flush at a regular interval", function(done) {
        this.timeout(2000);
        var runtime = traceguide.createRuntime();
        util.runtimeReportToFile(runtime, "report_flush_loop.json");
        runtime.options({
            access_token           : "{your_access_token}",
            group_name             : "api-javascript/unit-test/report_flush_loop",
            report_period_millis   : 10,
        });

        var count = 0;
        var timer = setInterval(function() {
            runtime.infof("Count = %d", count);
            count++;
            if (count === 20) {
                clearInterval(timer);
                var reqs = util.requestsFromFile("report_flush_loop.json");

                // Conservatively check below the theoretical values since this
                // test inherent has timing issues.
                expect(reqs.logRecordCount()).to.be.at.least(10);
                expect(reqs.reportCount()).to.be.at.least(2);
                return done();
            }
        }, 10);
    });
});


function expectToBeUndefined(list) {
    _.each(list.split(/\s+/), function (name) {
        it("should not have a property named " + name, function() {
            expect(traceguide[name]).to.be.a("undefined");
        });
    });
}

function expectToBeFunctions(list) {
    _.each(list.split(/\s+/), function (name) {
        it("should have a method named " + name, function () {
            expect(traceguide[name]).to.be.a("function");
        });
    });
}
