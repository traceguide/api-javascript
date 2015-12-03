

let startTimeMicros = computeStartMicros();

export default class PlatformNode {
    name() {
        return "node";
    }

    nowMicros() {
        let hrTime = process.hrtime();
        return Math.floor(startTimeMicros + hrTime[0] * 1000000.0 + hrTime[1] / 1000.0);
    }

    generateUUID() {
        return require("crypto").randomBytes(8).toString('hex');
    }


    onBeforeExit(...args) {
        process.on('beforeExit', ...args);
    }

    options() {
        if (!(process && process.argv)) {
            return;
        }

        let opts = {};
        for (let value of process.argv) {
            switch (value.toLowerCase()) {
            case "--traceguide-log_to_console":
            case "--traceguide-log_to_console=true":
            case "--traceguide-log_to_console=1":
                opts.log_to_console = true;
                break;

            case "--traceguide-debug":
            case "--traceguide-debug=true":
            case "--traceguide-debug=1":
                opts.debug = true;
                break;

            case "--traceguide-verbosity=2":
                opts.verbosity = 2;
                break;
            case "--traceguide-verbosity=1":
                opts.verbosity = 1;
                break;
            }
        }
        return opts;
    }

    runtimeAttributes() {
        return {
            node_version  : process.version,
            node_platform : process.platform,
            node_arch     : process.arch,
        };
    }

    fatal(message) {
        console.error(message);
        process.exit(1);
    }
}

function computeStartMicros() {
    let startTimeMs = Date.now();
    let startHrTime = process.hrtime();
    let baseHrMicros = (startHrTime[0] * 1000000.0 + startHrTime[1] / 1000.0);

    let startTimeMicros = (startTimeMs * 1000.0) - baseHrMicros;
    return startTimeMicros;
}
