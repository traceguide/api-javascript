it("should capture parent span guids", function () {

    var parent = traceguide.span("A");
    var child = parent.span("B");
    child.end();
    parent.end();

    expect(parent.guid()).not.to.be.undefined;
    expect(parent.attributes()['parent_span_guid']).to.be.undefined;
    
    expect(child.guid()).not.to.be.undefined;
    expect(child.attributes()['parent_span_guid']).to.equal(parent.guid());

    traceguide.flush();
});
