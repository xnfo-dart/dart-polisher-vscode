# VSCode Dart Polisher Extension
[![VScode Formatter](https://shields.io/badge/dart-VScode_Formatter-blue?logo=dart&style=flat-square)](https://github.com/xnfo-dart/dart-polisher-vscode)

<br>

A code formatter for [Dart](https://dart.dev/).<br>
Forked version from the official `dart_style` [formatter](https://github.com/xnfo-dart/dart_polisher).<br>

----
## Initial Configuration

Inside your `settings.json`
```json
"[dart]": {
		"editor.defaultFormatter": "xnfo.dart-polisher",
		"editor.formatOnSave": true, // optional
		"editor.formatOnType": true, // optional
}
```
> Works on ranges too.
----
## Features

### **Uses editor indent sizes when formatting:**
```json
"[dart]": {
		"editor.tabSize": 4,
		"editor.insertSpaces": false // optional: use Tab as indent
}
```
> The formatter internally works with space indents, `dart-polisher.blockIndent` or `editor.tabSize` will be used for tab conversion, in that order.


<br>

### **Unlocked indent sizes:**
```json
{
	// The number of spaces in a single level of expression nesting.
	"dart-polisher.expressionIndent": 4,

	// The number of spaces in a block or collection body.
	"dart-polisher.blockIndent": 4,

	// How much wrapped cascade sections indent.
	"dart-polisher.cascadeIndent": 4,

	// The ":" on a wrapped constructor initialization list.
	"dart-polisher.constructorInitializerIndent": 4
}
```
> These are all defaulted to `editor.tabSize` if not set.

> NOTE: when using tabs uneven indent sizes will be filled with spaces.

<br>

### **Code Styles**
```json
{
	// Dart style (default) is the original dart style
	//   but with customizable indent sizes.
	"dart-polisher.codeStyle": "Dart Style",

	// Expanded style is inspired by an outer braces style
	//   on block-like sintax. [beta]
	"dart-polisher.codeStyle": "Expanded Style",
}
```
----


<br>

## Installation
Search for `dart polisher` in the [VS Code Extension Marketplace](https://code.visualstudio.com/docs/editor/extension-marketplace) and install it!
or  
Install latests vsix manually from [Github Releases](https://github.com/xnfo-dart/dart-polisher-vscode/releases)

## Requirements

Works on Windows x64, Linux and Mac versions of VScode.  
Compatible with web version of [vscode](https://vscode.dev)

## Known Issues

Beta version.

## Release Notes

Please check CHANGELOG tab
