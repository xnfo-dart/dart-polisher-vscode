// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vs from "vscode";

import { Context } from "../shared/vscode/workspace";
import { DartFormattingEditProvider } from "./providers/dart_formatting_edit_provider";

// no schema
export const DART_MODE = { language: "dart" };

//export const outc = vs.window.createOutputChannel("Dart Polisher", "dart");

export function activate(context: vs.ExtensionContext) {

	console.log("CONSOLE: Extension Started");

	const extContext = Context.for(context);
	extContext.hasWarnedAboutFormatterSyntaxLimitation = false;
	// Setup formatting providers.
	const activeFileFilters: vs.DocumentFilter[] = [DART_MODE];
	const formattingEditProvider = new DartFormattingEditProvider(undefined, undefined, extContext);
	context.subscriptions.push(formattingEditProvider);
	//formattingEditProvider.registerDocumentFormatter(activeFileFilters); // Range already provides this.
	formattingEditProvider.registerDocumentRangeFormatter(activeFileFilters);
	formattingEditProvider.registerTypingFormatter(activeFileFilters, "}", ";");

	console.log("CONSOLE: Web Extension finished loading.");
}

// this method is called when your extension is deactivated
// export function deactivate() {}
export async function deactivate(isRestart: boolean = false): Promise<void> {

}
