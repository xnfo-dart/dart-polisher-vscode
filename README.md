# Xnfo Dart Formatter

A less opitionated code formatter for `Dart`.<br>
For people who want a customizable formatting experience.<br>
The server uses a modified version of the oficial dart formatter TODO:LINK`dart_style` package.


## Initial Configuration

IMAGE

Inside your `settings.json`
```json
"[dart]": {
		"editor.defaultFormatter": "xnfo.dart-formatter",
		"editor.formatOnSave": true, // optional
		"editor.formatOnType": true, // optional
}
```
> Works on ranges too.
----
## Features
TODO: MEGAGIF

### **Uses editor indent sizes when formatting:**
```json
"[dart]": {
		"editor.tabSize": 4,
		"editor.insertSpaces": false // use Tab indents
}
```
> The formatter internally works with space indents, `dart-formatter.blockIndent` or `editor.tabSize` will be used for tab conversion, in that order.

<br>

### **Unlocked indent sizes:**
```json
{
	// The number of spaces in a single level of expression nesting.
	"dart-formatter.expressionIndent": 4,

	// The number of spaces in a block or collection body.
	"dart-formatter.blockIndent": 4,

	// How much wrapped cascade sections indent.
	"dart-formatter.cascadeIndent": 4,

	// The ":" on a wrapped constructor initialization list.
	"dart-formatter.constructorInitializerIndent": 4
}
```
> These are all defaulted to `editor.tabSize` if not set.

<br>

### **Code Styles**
```json
{
	// Dart style (default) is the original dart style
	//   but with customizable indent sizes.
	"dart-formatter.codeStyle": "Dart Style",

	// Expanded style is inspired by an outer braces style
	//   on block-like sintax.
	"dart-formatter.codeStyle": "Expanded Style",
}
```
----


<br>
<br>
For example if there is an image subfolder under your extension project workspace:

\!\[feature X\]\(images/feature-x.png\)

> Tip: Many popular extensions utilize animations. This is an excellent way to show off your extension! We recommend short, focused animations that are easy to follow.

## Installation
Search for `xnfo formatter` in the [VS Code Extension Gallery](https://code.visualstudio.com/docs/editor/extension-marketplace) and install it!

## Requirements

Works only on local installations of VScode.



## Known Issues

Beta version.

## Release Notes

Please check CHANGELOG.md TODO: link
