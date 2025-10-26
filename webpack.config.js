/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = (env, argv) => {
  const isDevelopment = argv.mode === "development";

  return {
    entry: "./src/index.tsx",
    devtool: isDevelopment ? "inline-source-map" : "source-map",
    mode: isDevelopment ? "development" : "production",
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: "swc-loader",
          },
          exclude: [
            /node_modules/,
            /__tests__/,
            /\.test\./,
            /\.spec\./,
            /jest\.setup/,
            /jest\.config/,
            /playwright\.config/,
            /\/e2e\//,
          ],
        },
        {
          test: /\.css$/,
          use: ["style-loader", "css-loader"],
        },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js", ".css"],
    },
    output: {
      filename: isDevelopment ? "[name].js" : "[name].[contenthash].js",
      path: path.resolve(__dirname, "dist"),
      clean: true,
    },
    optimization: {
      moduleIds: "deterministic",
      runtimeChunk: "single",
      splitChunks: {
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            chunks: "all",
            priority: 10,
          },
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/,
            name: "react-vendors",
            chunks: "all",
            priority: 20,
          },
        },
      },
    },
    plugins: [
      new HtmlWebpackPlugin({
        title: "rad.io",
        template: "./src/index.html",
        inject: "body",
        scriptLoading: "defer",
      }),
      new CopyPlugin({
        patterns: [
          { from: "build/release.wasm", to: "release.wasm" },
          { from: "build/release.wasm", to: "dsp.wasm" },
          { from: "build/release.js", to: "release.js" },
          { from: "build/release.js", to: "dsp.js" },
        ],
      }),
    ],
    devServer: {
      static: {
        directory: path.resolve(__dirname, "dist"),
      },
      historyApiFallback: true,
      hot: true,
      server: "https",
    },
    performance: {
      // Updated to match documented bundle sizes: main chunk ~367 KB, total ~586 KB
      maxEntrypointSize: 600000,
      maxAssetSize: 600000,
    },
  };
};
