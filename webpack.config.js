///@ts-check

"use strict";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-var-requires
//const webpack = require("webpack");

/**
 * @type {import("webpack").Configuration}
 */
const webConfig = /** @type WebpackConfig */ {
	context: __dirname,
	mode: "none", // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
	target: "webworker", // web extensions run in a webworker context
	entry: {
		"extension-web": "./src/extension/web/extension.ts", // source of the web extension main file
		//"test/suite/index-web": "./src/test/suite/index-web.ts", // source of the web extension test runner
	},
	output: {
		filename: "[name].js",
		path: path.join(__dirname, "./out/dist"),
		libraryTarget: "commonjs",
	},
	resolve: {
		mainFields: ["browser", "module", "main"], // look for `browser` entry point in imported node modules
		extensions: [".ts", ".js"], // support ts-files and js-files
		alias: {
			// provides alternate implementation for node module and source files
		},
		fallback: {
			// Webpack 5 no longer polyfills Node.js core modules automatically.
			// see https://webpack.js.org/configuration/resolve/#resolvefallback
			// for the list of Node.js core module polyfills.
			assert: require.resolve("assert"),
			//path: require.resolve("path-browserify"),
			//url: require.resolve('url'),
			//os: require.resolve('os-browserify/browser'),
			//fs: false,
			//child_process: false,
		},
	},
	ignoreWarnings: [
		{
			// Ignore dart2js module warnings
			module: /dart-polisher\/index.js/,
			message: /Critical dependency/,
		},
	],
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: "ts-loader",
					},
				],
			},
		],
	},
	plugins: [
		//   new webpack.ProvidePlugin({
		// 	process: "process/browser", // provide a shim for the global `process` variable
		//   }),
	],
	externals: {
		vscode: "commonjs vscode", // ignored because it doesn't exist
	},
	performance: {
		hints: false,
	},
	devtool: "nosources-source-map", // create a source map that points to the original source file
};

const nodeConfig = {
	target: "node", // vscode extensions run in webworker context for VS Code web 📖 -> https://webpack.js.org/configuration/target/#target

	// the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
	entry: {
		extension: "./src/extension/extension.ts",
		//"test/suite/index-node": "./src/test/suite/index-node.ts", // source of the node extension test runner
		//"test/suite/extension.test": "./src/test/suite/extension.test.ts", // create a separate file for the tests, to be found by glob
		//"test/runTest": "./src/test/runTest", // used to start the VS Code test runner (@vscode/test-electron)
	},
	output: {
		// the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
		path: path.resolve(__dirname, "out/dist"),
		filename: "[name].js",
		libraryTarget: "commonjs2",
		// breakpoints will be unbound if we don't specify the correct path from source-map back to original ts files.
		devtoolModuleFilenameTemplate: "../../[resource-path]",
	},
	optimization: {
		minimize: false,
	},
	devtool: "source-map",
	externals: {
		vscode: "commonjs vscode", // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
	},
	resolve: {
		// support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
		mainFields: ["module", "main"],
		extensions: [".ts", ".js"], // support ts-files and js-files
		alias: {
			// provides alternate implementation for node module and source files
		},
		fallback: {
			// Webpack 5 no longer polyfills Node.js core modules automatically.
			// see https://webpack.js.org/configuration/resolve/#resolvefallback
			// for the list of Node.js core module polyfills.
		},
	},
	ignoreWarnings: [
		{
			// Ignore dart2js module warnings
			module: /dart-polisher\/index.js/,
			message: /Critical dependency/,
		},
	],
	module: {
		rules: [
			{
				test: /\.ts$/,
				exclude: /node_modules/,
				use: [
					{
						loader: "ts-loader",
					},
				],
			},
		],
	},
};
module.exports = [nodeConfig, webConfig];
