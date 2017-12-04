const webpack = require('webpack')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const path = require('path');
const srcDir = path.join(__dirname, "src")
const buildPath = path.join(__dirname, 'www')

module.exports = {
  context: srcDir,
  devtool: 'source-map',
  entry: [
    'babel-polyfill',
    './index.tsx',
  ],
  output: {
    path: buildPath,
    filename: '[name].[chunkhash].js',
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
        test: /\.css$/, // for application CSS
        include: [srcDir],
        loader: [
          'style-loader',
          'typings-for-css-modules-loader?modules&importLoaders=1&localIdentName=[name]__[local]___[hash:base64:5]&namedExport&camelCase',
        ]
      },
      {
        test: /\.css$/, // for node_modules CSS
        exclude: [srcDir],
        loader: [
          'style-loader',
          'css-loader?modules&importLoaders=1&localIdentName=[name]__[local]___[hash:base64:5]&namedExport&camelCase',
        ]
      },
      { test: /\.woff(\?.+)?$/, use: 'url-loader?limit=10000&mimetype=application/font-woff' },
      { test: /\.woff2(\?.+)?$/, use: 'url-loader?limit=10000&mimetype=application/font-woff' },
      { test: /\.ttf(\?.+)?$/, use: 'file-loader' },
      { test: /\.eot(\?.+)?$/, use: 'file-loader' },
      { test: /\.svg(\?.+)?$/, use: 'file-loader' },
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.join(__dirname, 'index.ejs'),
      path: buildPath,
      // excludeChunks: ['base'],
      filename: 'index.html',
      minify: {
          collapseWhitespace: true,
          collapseInlineTagWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true
      }
  }),
    new webpack.WatchIgnorePlugin([/css\.d\.ts$/]) // To avoid build loop for generated css.d.ts files by typings-for-css-modules-loader
  ]
};
