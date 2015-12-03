
it("should not throw an exception on simple operations", function () {
    traceguide.infof("Hello World %d", 42);
    traceguide.warnf("Hello World %d", 42);
    traceguide.errorf("Hello World %d", 42);

    var span = traceguide.span("test_operation");
        var subspan = span.span("test_subspan");
        subspan.infof("Hello World %d", 42);
        subspan.warnf("Hello %s %d", "World", 42);
        subspan.errorf("%s World %f", "Hello", 42.0);
        subspan.end();
    span.end();

    traceguide.flush();
});

it ("should safely log all types of values", function() {
    traceguide.infof("",
        undefined,
        null,
        true,
        false,
        0, 1, -1,
        0.0, 1.0, -1.0,
        "", "\t\n\r",
        [],
        [undefined],
        {},
        {field:undefined},
        function() {}
    );
});

it("should safely log circular data structures", function () {
    var a = { b : null };
    var b = { a : a };
    a.b = b;

    traceguide.infof("%j", a);
    traceguide.warnf("%j", a);
    traceguide.errorf("%j", a);

    var span = traceguide.span("test_operation");
    span.infof("%j", a);
    span.warnf("%j", a);
    span.errorf("%j", a);
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
