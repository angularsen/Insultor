const path = require('path');

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
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx']
  },
  module: {
    rules: [
        // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
        { test: /\.tsx?$/, exclude: /node_modules/, loader: "awesome-typescript-loader" },
        // All output '.js' files will have any sourcemaps re-processed by 'source-map-loader'.
        { test: /\.js$/, exclude: /node_modules/, loader: ['babel-loader', 'source-map-loader'], enforce: 'pre' }
    ]
  },
  // module: {
  //   loaders: [
  //     {
  //       test: /\.tsx?$/,
  //       loader: 'awesome-typescript-loader'
  //     }
  //   ],
  //   preLoaders: [
  //     {
  //       test: /\.js$/,
  //       exclude: /node_modules/,
  //       use: ['babel-loader', 'source-map-loader']
  //     },
  //   ],
  // },
};
