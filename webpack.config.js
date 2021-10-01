// Generated using webpack-cli https://github.com/webpack/webpack-cli

const path = require('path');

const config = {
    mode: 'development',
    entry: './viewer.ts',
    output: {
        filename: "vim-webgl-viewer.js",
        path: path.resolve(__dirname, 'public'),
        library: 'vim',
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    devtool: 'source-map',  // generate source map
};

module.exports = () => {
    return config;
}
