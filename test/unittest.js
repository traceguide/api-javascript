// For the convenience of unit testing, add these to the global namespace
global.expect = require("chai").expect;
global.traceguide = require("../dist/traceguide-node-debug");
global._ = require("underscore");
global.util = require("./util/util");
global.requireES6 = requireES6;

// Send reports to a file, not to the internet
util.runtimeReportToFile(traceguide, "unittest.json");

describe("Traceguide", function() {
    describe("Core", function() {
        require("./suites/core.js");
    });
    describe("API", function() {
        describe("options()", function() {
            require("./suites/options.js");
        });
    });
    describe("General", function() {
        require("./suites/on_exit.js");
    });
    describe("Internals", function() {
        describe("coerce", function() {
            require("./suites/coerce.js");
        });
    });
    describe("Regression Testing", function() {
        require("./suites/regress.js");
    });
});


// Dynamically transform a ES6 file
function requireES6(filename) {
    var loaded = require("babel-core").transformFileSync(filename, { presets : ["es2015"] });
    var exports = {};
    var module = { exports : exports };
    var f = new Function("module", "exports", loaded.code);
    f(module, exports);
    return module.exports;
}
