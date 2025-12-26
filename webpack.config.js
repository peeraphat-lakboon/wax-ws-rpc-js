const path = require('path');

const commonConfig = {
  mode: 'production',
  entry: './src/index.ts',
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
};

const nodeConfig = Object.assign({}, commonConfig, {
  name: 'server',
  target: 'node',
  externals: {
    ws: 'commonjs ws'
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
    library: {
      type: 'umd',
      name: 'WaxWsRpc',
    },
    globalObject: 'this'
  }
});

const browserConfig = Object.assign({}, commonConfig, {
  name: 'client',
  target: 'web',
  resolve: {
    ...commonConfig.resolve,
    fallback: {
      "ws": false
    }
  },
  output: {
    filename: 'wax-ws-rpc.min.js',
    path: path.resolve(__dirname, 'dist'),
    library: {
      name: 'WebsocketJsonRpc',
      type: 'umd',
    },
    globalObject: 'this'
  }
});

module.exports = [nodeConfig, browserConfig];