var webpack = require("webpack");

const CONFIG   = process.env.BUILD_CONFIG
const PLATFORM = process.env.BUILD_PLATFORM;


//
// Modulate the webpack settings based on the configuration
//
var plugins = [];
var defines = {
    DEBUG            : false,
    PLATFORM_NODE    : false,
    PLATFORM_BROWSER : false,
};

var bundlePlatform = "";
var bundleSuffix = "";
var libraryTarget = "";
var target = "";
var devtool = undefined;

switch (CONFIG) {
    case "debug":
        defines.DEBUG = true;
        bundleSuffix = "-debug";
        devtool = "source-map";
        plugins.push(new webpack.BannerPlugin('require("source-map-support").install();', {
            raw: true,
            entryOnly: false
        }));
        break;
    case "prod":
        plugins.push(new webpack.optimize.UglifyJsPlugin({
            minimize: true,
            compress : {
                dead_code : true,
                unused : true,
                // Hide the dead code warnings. The defines intentionally create
                // dead code paths.
                warnings  : false,
            }
        }));
        plugins.push(new webpack.optimize.DedupePlugin());
        break;
    default:
        console.error("Unexpected BUILD_CONFIG!");
        process.exit(1);
}
switch (PLATFORM) {
    case "node":
        bundlePlatform = "-node";
        defines.PLATFORM_NODE = true;
        target = "node";
        libraryTarget = "commonjs2";
        break;
    case "browser":
        bundlePlatform = "-browser";
        defines.PLATFORM_BROWSER = true;
        target = "web";
        libraryTarget = "var";
        break;
    default:
        console.error("Unexpected BUILD_PLATFORM!");
        process.exit(1);
}

//
// Webpack configuration
//
var bundleName = "traceguide" + bundlePlatform + bundleSuffix;

module.exports = {
    entry   : "./src/lib.js",
    target  : target,
    devtool : devtool,
    output  : {
        path          : "dist/",
        filename      : bundleName + ".js",
        library       : "Traceguide",
        libraryTarget : libraryTarget,
    },
    plugins :[
        new webpack.DefinePlugin(defines),
    ].concat(plugins),
    resolve : {
        alias : { }
    },
    module  : {
        loaders : [
            {
                test    : /\.js$/,
                loader  : "babel",
                include : /src\//,
                excluse : /node_modules/,
                query   : {
                    cacheDirectory : true,
                    presets : [ "es2015" ],
                    plugins : [ "add-module-exports" ],
                }
            },
        ]
    },
};
