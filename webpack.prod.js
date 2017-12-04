const path = require('path')
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin
const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')
const srcDir = path.join(__dirname, 'src')
const buildPath = path.join(__dirname, 'www')

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('production') // Reduce size of things like React by removing development related warnings and assisting code
    }),
    new webpack.optimize.ModuleConcatenationPlugin(), // Scope hoisting to inline pieces of code only used in a single place or few places, to save size
    new webpack.HashedModuleIdsPlugin(), // Optimize size by identifiers instead of module names
    new webpack.optimize.CommonsChunkPlugin({ // Split node_modules code into a vendor bundle (rarely changes and is cached by browser)
      name: 'vendor',
      filename: 'vendor.[chunkhash].js',
      minChunks (module) {
        return module.context &&
               module.context.indexOf('node_modules') >= 0;
      }
    }),
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
    new UglifyJSPlugin({
      sourceMap: false
    })//,
    // new BundleAnalyzerPlugin({
    //   analyzerMode: 'server',
    //   analyzerHost: '127.0.0.1',
    //   analyzerPort: 8888,
    //   reportFilename: 'reports/bundle-size.html',
    //   defaultSizes: 'parsed',
    //   openAnalyzer: true,
    //   generateStatsFile: false,
    //   statsFilename: 'stats.json',
    //   statsOptions: null,
    //   logLevel: 'info',
    // })
  ],
  context: path.join(__dirname, 'src'),
  devtool: 'cheap-module-source-map',
  entry: [
    'babel-polyfill',
    './index.tsx',
  ],
  output: {
    path: path.join(__dirname, 'www'),
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
  }
}
