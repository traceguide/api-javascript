
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
