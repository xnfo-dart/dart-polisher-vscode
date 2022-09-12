import { start } from "repl";
import * as vs from "vscode";
import { CodeActionKind, env as vsEnv, ExtensionKind, extensions, Position, Range, Selection, TextDocument, TextEditor, TextEditorRevealType, Uri, workspace, WorkspaceFolder } from "vscode";
import { dartFormatterExtensionIdentifier } from "../constants";
import { Location, Logger } from "../interfaces";


export const isTheia = vs.env.appName?.includes("Theia") ?? false;
export const isCloudShell = vs.env.appName?.includes("Cloud Shell") ?? false;
export const isKnownCloudIde = isTheia || isCloudShell;

const formatterExtension = extensions.getExtension(dartFormatterExtensionIdentifier);

// The extension kind is declared as Workspace, but VS Code will return UI in the
// case that there is no remote extension host.
export const isRunningLocally =
	// Some cloud IDEs mis-report the extension kind, so if we _know_ something is a cloud IDE,
	// override that.
	!isKnownCloudIde
	&& (!formatterExtension || formatterExtension.extensionKind === ExtensionKind.UI);


	export function toRange(document: TextDocument, offset: number, length: number): Range {
		return new Range(document.positionAt(offset), document.positionAt(offset + length));
	}

	export function toPosition(location: Location): Position {
		return new Position(location.startLine - 1, location.startColumn - 1);
	}

	// Translates an offset/length to a Range.
	// NOTE: Does not wrap lines because it does not have access to a TextDocument to know
	// where the line ends.
	export function toRangeOnLine(location: Location): Range {
		const startPos = toPosition(location);
		return new Range(startPos, startPos.translate(0, location.length));
	}

	// Range to {start, end} zero based offsets.
	export function fromRange(document: TextDocument, range: Range): {start : number, end : number} {
		return {start: document.offsetAt(range.start), end: document.offsetAt(range.end)}
	}

export function showCode(editor: TextEditor, displayRange: Range, highlightRange: Range, selectionRange?: Range): void {
	if (selectionRange)
		editor.selection = new Selection(selectionRange.start, selectionRange.end);

	// Ensure the code is visible on screen.
	editor.revealRange(displayRange, TextEditorRevealType.InCenterIfOutsideViewport);

	// TODO: Implement highlighting
	// See https://github.com/Microsoft/vscode/issues/45059
}

export function trimTrailingSlashes(s: string) {
	return s.replace(/[\/\\]+$/, "");
}
