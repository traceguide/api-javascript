describe("Library has the expected logging methods", ()=> {
    expectToBeFunctions("infof warnf errorf fatalf");
});

describe("Library has only the expected EventEmitter methods", ()=> {
    expectToBeFunctions("on once");
    expectToBeUndefined("emit");
});

describe("Basic usage", ()=> {

    it("should not throw an exception on simple operations", () => {
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


function expectToBeUndefined(list) {
    _.each(list.split(/\s+/), (name) => {
        it("should not have a property named " + name, () => {
            expect(traceguide[name]).to.be.a("undefined");
        });
    });
}

function expectToBeFunctions(list) {
    _.each(list.split(/\s+/), (name) => {
        it("should have a method named " + name, () => {
            expect(traceguide[name]).to.be.a("function");
        });
    });
}
