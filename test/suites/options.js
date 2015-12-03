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

describe("options()", function() {

    it("should throw a UserError on invalid options", function() {

        expect(function () {
            traceguide.options({ });
        }).to.not.throw();

        expect(function () {
            traceguide.options({ not_a_real_option : 100 });
        }).to.throw();

        expect(function () {
            traceguide.options({
                invalid_option_name    : "test",
                another_invalid_option : "test",
            });
        }).to.throw();
    });

    it("should allow the group_name and access_token to be set only once", function() {

        expect(function () {
            var rt = traceguide.createRuntime();
            rt.options({
                group_name   : "my_group",
                access_token : "1",
            });
            rt.options({
                group_name  : "your_group",
            });
        }).to.throw();

        expect(function () {
            var rt = traceguide.createRuntime();
            rt.options({
                group_name   : "my_group",
                access_token : "1",
            });
            rt.options({
                access_token : "2",
            });
        }).to.throw();
    });

    it("should allow the service_host to be set only once", function() {
        expect(function () {
            var rt = traceguide.createRuntime();
            rt.options({
                service_host : "example.com",
                service_port : 80,
                secure       : false,
            });
        }).to.not.throw();

        expect(function () {
            var rt = traceguide.createRuntime();
            rt.options({
                service_host : "example.com",
            });
        }).to.not.throw();

        expect(function () {
            var rt = traceguide.createRuntime();
            rt.options({
                service_port : 80,
            });
        }).to.not.throw();

        expect(function () {
            var rt = traceguide.createRuntime();
            rt.options({
                secure      : false,
            });
        }).to.not.throw();

        // Changing connection info after it has been set is not supported
        expect(function () {
            var rt = traceguide.createRuntime();
            rt.options({
                access_token : "top_secret",
                group_name   : "unit/tests",
                service_host : "example.com",
                service_port : 80,
            });
            rt.options({
                service_host : "example2.com",
            });
        }).to.throw();

        // Changing connection info after it has been set, even implicitlyl,
        // is not supported
        expect(function () {
            var rt = traceguide.createRuntime();
            rt.options({
                access_token : "top_secret",
                group_name   : "unit/tests",
            });
            rt.options({
                service_host : "example2.com",
            });
        }).to.throw();
    });
});
