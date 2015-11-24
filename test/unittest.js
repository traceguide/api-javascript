var expect = require("chai").expect;
var traceguide = require("../dist/traceguide-node-debug");
var _ = require("underscore");

// For the convenience of unit testing, add these to the global namespace
global.expect = expect;
global.traceguide = traceguide;
global._ = _;
global.requireES6 = requireES6;

describe("Traceguide", function() {
    describe("Core", function() {
        require("./suites/core.js");
    });
    describe("API", function() {
        describe("options()", function() {
            require("./suites/options.js");
        });
    });
    describe("Internals", function() {
        describe("coerce", function() {
            require("./suites/coerce.js");
        });
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
