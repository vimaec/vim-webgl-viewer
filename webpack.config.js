// Generated using webpack-cli https://github.com/webpack/webpack-cli

const path = require('path');

module.exports = {

    mode: 'development',
    entry: './viewer.ts',
    output: {
        filename: "vim-webgl-viewer.js",
        path: path.resolve(__dirname, 'public'),
        library: 'vim',
    },
    resolve: {
        // look for ts and js files
        extensions: ['.ts', '.js'],
    },
    module: {
        // load and compile ts files using ts-loader
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },

    // generate source map for debug
    devtool: 'source-map',  
};

