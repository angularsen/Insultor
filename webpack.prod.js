const path = require('path')
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')
const webpack = require('webpack')
const srcDir = path.resolve(__dirname, "src")

module.exports = {
  plugins: [
    new UglifyJSPlugin({
      sourceMap: false
    })
  ],
  context: path.join(__dirname, 'src'),
  devtool: 'source-map',
  entry: [
    'babel-polyfill',
    './index.tsx',
  ],
  output: {
    path: path.join(__dirname, 'www'),
    filename: 'bundle.js',
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  module: {
    rules: [
      // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
      { test: /\.tsx?$/, include: srcDir, loader: "awesome-typescript-loader" },
      // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
      { test: /\.js$/, include: srcDir, loader: ['babel-loader', 'source-map-loader'], enforce: 'pre' },
      {
        test: /\.css$/,
        include: srcDir,
        loader: [
          'style-loader',
          'typings-for-css-modules-loader?modules&importLoaders=1&localIdentName=[name]__[local]___[hash:base64:5]&namedExport&camelCase',
        ]
      }
    ]
  }
}
