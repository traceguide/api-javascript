it("should behave sanely with excessively large log messages", function() {
    var msg = (new Array(8*1024*1024)).join("x");
    traceguide.infof("%s", msg);
    traceguide.warnf("%s", msg);
    traceguide.errorf("%s", msg);
});

it("should behave sanely with excessively large log payloads", function() {
    var arr =  [];
    for (var i = 0; i < 1024; i++) {
        arr.push((new Array(8*1024)).join("x"));
    }
    traceguide.infof("%j", arr);
    traceguide.warnf("%j", arr);
    traceguide.errorf("%j", arr);
});
