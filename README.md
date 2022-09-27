# VSCode Dart polisher 
[![VScode Formatter](https://shields.io/badge/dart-VScode_Formatter-blue?logo=dart&style=flat-square)](https://github.com/xnfo-dart/dart-polisher-vscode)

Last Version: v0.9.0

A code formatter for [Dart](https://dart.dev/).<br>
Uses a forked version from the official `dart_style` as the [formatter](https://github.com/xnfo-dart/dart_polisher).<br>

A nice GIF is better than text:

TODO: MEGAGIF

## Initial Configuration

Inside your `settings.json`
```json
"[dart]": {
		"editor.defaultFormatter": "xnfo.dart-polisher",
		"editor.formatOnSave": true, // optional
		"editor.formatOnType": true, // optional
		...
}
```
> Works on ranges too.
----
## Features

### **Uses editor indent sizes when formatting:**
```json
"[dart]": {
		"editor.tabSize": 4,
		"editor.insertSpaces": false // optional: use Tab indents
}
```
> The formatter internally works with space indents, `dart-polisher.blockIndent` or `editor.tabSize` will be used for tab conversion, in that order.

>*Uneven indents will be filled with spaces.

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
Search for `dart polisher` in the [VS Code Extension Gallery](https://code.visualstudio.com/docs/editor/extension-marketplace) and install it!

## Requirements

Works on Windows, Linux and Mac versions of local installations of VScode.



## Known Issues

Beta version.

## Release Notes

Please check CHANGELOG.md TODO: link
