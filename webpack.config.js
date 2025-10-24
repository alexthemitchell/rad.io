/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: "./src/index.tsx",
  devtool: "inline-source-map",
  mode: "development",
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
    filename: "main.js",
    path: path.resolve(__dirname, "dist"),
  },
  plugins: [
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
};
