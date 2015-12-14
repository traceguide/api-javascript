var traceguide = require("../../../../dist/traceguide-node-debug");
var util = require("../../../util/util");

util.runtimeReportToFile(traceguide, process.argv[2]);
traceguide.options({
    access_token           : "{your_access_token}",
    group_name             : "api-javascript/unit-test/on_exit",
});

var span = traceguide.span("test_span");
for (var i = 0; i < 10; i++) {
    traceguide.infof("log%d", i);
}
span.end();
