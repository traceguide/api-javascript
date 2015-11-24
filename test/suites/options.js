
it("should throw a UserError on invalid options", function() {

    expect(() => {
        traceguide.options({ });
    }).to.not.throw();

    expect(() => {
        traceguide.options({ not_a_real_option : 100 });
    }).to.throw();

    expect(() => {
        traceguide.options({
            invalid_option_name    : "test",
            another_invalid_option : "test",
        });
    }).to.throw();
});
