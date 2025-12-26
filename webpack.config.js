const path = require('path');

module.exports = {
  mode: 'production',
  entry: './src/index.ts',
  target: 'node', // เพิ่มเพื่อให้เข้าใจสภาพแวดล้อม node
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
  // สำคัญที่สุด: บอก Webpack ว่าไม่ต้อง Bundle แพ็คเกจ 'ws' เข้าไปในไฟล์ index.js
  externals: {
    ws: 'commonjs ws'
  },
  output: {
    filename: 'index.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    library: {
      type: 'umd',        // รองรับทั้ง require และ import
      name: 'WaxWsRpc',
    },
    globalObject: 'this'  // ป้องกัน error window is not defined
  }
};