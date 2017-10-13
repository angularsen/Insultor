const path = require('path');
const webpack = require('webpack');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')

module.exports = {
  context: path.join(__dirname, 'src'),
  devtool: 'source-map',
  entry: [
    'babel-polyfill',
    './index.js',
  ],
  output: {
    path: path.join(__dirname, 'www'),
    filename: 'bundle.js',
  },
  plugins: [
  new UglifyJSPlugin({
    sourceMap: true
  })
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader'
        }
      },
    ],
  },
};
