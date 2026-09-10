const path = require('node:path');
const { createRequire } = require('node:module');

const root = path.resolve(__dirname, '..');
const vendorModules = path.join(root, 'vendor/toubkal/node_modules');
const vendorRequire = createRequire(path.join(root, 'vendor/toubkal/package.json'));
const { HtmlRspackPlugin } = vendorRequire('@rspack/core');
const fileLoader = vendorRequire.resolve('file-loader');
const isDev = process.argv.includes('serve');

module.exports = {
  mode: isDev ? 'development' : 'production',
  entry: path.join(root, 'src/web/index.tsx'),
  output: {
    path: path.join(root, 'dist/asa'),
    filename: isDev ? '[name].js' : '[name].[contenthash:8].js',
    chunkFilename: isDev ? '[name].js' : '[name].[contenthash:8].js',
    cssFilename: isDev ? '[name].css' : '[name].[contenthash:8].css',
    cssChunkFilename: isDev ? '[name].css' : '[name].[contenthash:8].css',
    publicPath: 'auto',
    clean: true,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    modules: [vendorModules],
    fallback: {
      fs: false,
      path: false,
      crypto: false,
      os: false,
      stream: false,
      perf_hooks: false,
      worker_threads: false,
      module: false,
      url: false,
    },
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              parser: { syntax: 'typescript', tsx: true },
              transform: { react: { runtime: 'automatic' } },
              target: 'es2020',
            },
          },
        },
        type: 'javascript/auto',
      },
      {
        test: /\.wasm$/,
        type: 'javascript/auto',
        loader: fileLoader,
        options: {
          name: 'wasm/[name].[contenthash:8].[ext]',
        },
      },
      { test: /\.css$/, type: 'css' },
      { test: /\.(svg|png|jpg|jpeg|gif|ico)$/i, type: 'asset/resource' },
    ],
  },
  plugins: [
    new HtmlRspackPlugin({ template: path.join(root, 'src/web/index.html') }),
  ],
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        react: {
          test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
          name: 'vendor-react',
          priority: 20,
        },
      },
    },
  },
  devServer: {
    port: 8090,
    host: '0.0.0.0',
    historyApiFallback: true,
    hot: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    static: false,
  },
};
