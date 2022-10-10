///@ts-check

"use strict";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");
// eslint-disable-next-line @typescript-eslint/no-var-requires
//const webpack = require("webpack");

/**
 * @type {import("webpack").Configuration}
 */
const config = {
	//target: "webworker", // vscode extensions run in webworker context for VS Code web 📖 -> https://webpack.js.org/configuration/target/#target
	target: "node", // vscode extensions run in webworker context for VS Code web 📖 -> https://webpack.js.org/configuration/target/#target

	// the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
	entry: {
		extension: "./src/extension/extension.ts",
		//test: "./src/test/suite/index.ts", // source of the web extension test runner
	},
	output: {
		// the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
		path: path.resolve(__dirname, "out/dist"),
		filename: "extension.js",
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
		//mainFields: ["browser", "module", "main"], // look for `browser` entry point in imported node modules
		extensions: [".ts", ".js"],
		alias: {
			// provides alternate implementation for node module and source files
		},
		fallback: {
			// Webpack 5 no longer polyfills Node.js core modules automatically.
			// see https://webpack.js.org/configuration/resolve/#resolvefallback
			// for the list of Node.js core module polyfills.
		},
	},
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
module.exports = config;
