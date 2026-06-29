const path = require("node:path");

module.exports = (options, _webpack) => {
  // Remove ForkTsCheckerWebpackPlugin — we use transpileOnly and handle type-checking separately
  const plugins = (options.plugins || []).filter(
    (p) => p.constructor.name !== "ForkTsCheckerWebpackPlugin",
  );

  return {
    ...options,
    plugins,
    output: {
      ...options.output,
      libraryTarget: "commonjs2",
    },
    // Include workspace packages in the bundle, but externalize SDK that uses dynamic import
    externals: [
      { "@anthropic-ai/claude-agent-sdk": "commonjs @anthropic-ai/claude-agent-sdk" },
      { sharp: "commonjs sharp" },
    ],
    module: {
      ...options.module,
      rules: [
        {
          test: /\.tsx?$/,
          loader: "ts-loader",
          options: {
            transpileOnly: true,
          },
          exclude: /node_modules\/(?!@repo)/,
        },
      ],
    },
    resolve: {
      ...options.resolve,
      extensions: [".ts", ".tsx", ".js"],
      // Webpack 5+ extensionAlias lets `.js` import specifiers resolve to
      // TypeScript source under workspace packages when the literal file is absent.
      extensionAlias: {
        ".js": [".ts", ".tsx", ".js"],
      },
      alias: {
        "@repo/drizzle": path.resolve(__dirname, "../../packages/drizzle/src"),
        "@repo/core": path.resolve(__dirname, "../../packages/core"),
        "@repo/features": path.resolve(__dirname, "../../packages/features"),
        "@repo/shared": path.resolve(__dirname, "../../packages/shared"),
      },
    },
  };
};
