# api-javascript

Traceguide instrumentation library for JavaScript.

## Installation

```
npm install --save api-javascript
```

## Getting Started

```javascript
var trace = require('api-javascript');
trace.options({
    group_name   : "my_server",
    access_token : "{your_access_token}"
});

// Send a regular global log along with a data payload
trace.infof('Hello Runtime %d!', 42);

// Send a span record for a given operation
span = trace.span('trivial/sample_span');
span.joinIDs('end_user_id', 'john_smith');
span.infof('Hello Span %d!', 42);
span.end();
```

See `example/hello_world` for a longer example.

## Supported Platforms

* **Node**: Node versions >= 0.12 are supported.

## License

[The MIT License](LICENSE).

Copyright (c) 2015, Resonance Labs.
