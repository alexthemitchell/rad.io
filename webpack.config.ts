import path from "path";
import { fileURLToPath } from "url";
import CopyPlugin from "copy-webpack-plugin";
import HtmlWebpackPlugin from "html-webpack-plugin";
import type { Configuration } from "webpack";
import "webpack-dev-server";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default (_env: unknown, argv: { mode?: string }): Configuration => {
  const isDevelopment = argv.mode === "development";

  return {
    cache: {
      type: "filesystem",
      buildDependencies: {
        config: [__filename],
      },
    },
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
        chunks: "all",
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/](?!(react|react-dom|react-router-dom)[\\/])/,
            name: "vendors",
            chunks: "all",
            priority: 10,
            reuseExistingChunk: true,
          },
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom|react-router-dom)[\\/]/,
            name: "react-vendors",
            chunks: "all",
            priority: 20,
            reuseExistingChunk: true,
          },
        },
      },
      minimizer: isDevelopment ? [] : undefined, // Use defaults in production
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
          {
            from: "build/release-simd.wasm",
            to: "release-simd.wasm",
            noErrorOnMissing: true,
          },
          {
            from: "build/release-simd.wasm",
            to: "dsp-simd.wasm",
            noErrorOnMissing: true,
          },
          {
            from: "build/release-simd.js",
            to: "release-simd.js",
            noErrorOnMissing: true,
          },
          {
            from: "build/release-simd.js",
            to: "dsp-simd.js",
            noErrorOnMissing: true,
          },
          {
            from: "public/_headers",
            to: "",
            noErrorOnMissing: true,
          },
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
      headers: {
        // Enable SharedArrayBuffer support (ADR-0027)
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cross-Origin-Embedder-Policy": "require-corp",
      },
    },
    performance: {
      maxEntrypointSize: 630000,
      maxAssetSize: 630000,
      hints: isDevelopment ? false : "warning",
    },
  };
};
