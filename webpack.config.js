// Generated using webpack-cli https://github.com/webpack/webpack-cli

const path = require('path');

const config = {
    mode: 'development',
    entry: './viewer.js',
    output: {
        filename: "vim-webgl-viewer.js",
        path: path.resolve(__dirname, 'public'),
        library: 'vim',
    },
};

module.exports = () => {return config;}
