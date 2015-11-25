
import Runtime from './runtime';

require('babel-polyfill');

/**
    For convenience, the library can be used directly as a singleton or Runtime
    objects can be explicitly created.
 */
class Lib extends Runtime {

    createRuntime() {
        let runtime = new Runtime();
        runtime.initialize(...arguments);
        return runtime;
    }
}

// For ES5 compatibility, use `module.exports` instead of `export default` on
// the outermost package export.
module.exports = new Lib();
