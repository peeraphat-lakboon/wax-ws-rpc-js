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
    ws: 'commonjs ws',
    'eosjs': 'eosjs',
    '@wharfkit/antelope': '@wharfkit/antelope'
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
    library: {
      type: 'umd',
      name: 'WaxWebsocketRpc',
    },
    globalObject: 'this'
  }
});



module.exports = nodeConfig;