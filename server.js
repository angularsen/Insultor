const express = require('express');
const webpackDevMiddleware = require('webpack-dev-middleware');
const webpack = require('webpack');

const isProduction = process.env.NODE_ENV === 'production'
const webpackConfig = require(isProduction ? './webpack.dev.js' : './webpack.prod.js');

if (isProduction) {
  console.log('=========PRODUCTION=========')
} else {
  console.log('=========DEV=========')
}

const app = express();
const compiler = webpack(webpackConfig);

app.use(webpackDevMiddleware(compiler, {
  hot: true,
  filename: 'bundle.js',
  publicPath: '/',
  stats: {
    colors: true,
  },
  historyApiFallback: true,
}));

app.use(express.static(__dirname + '/www'));

const server = app.listen(3000, function() {
  const host = server.address().address;
  const port = server.address().port;
  console.log('Example app listening at http://%s:%s', host, port);
});
