import * as vs from "vscode";
import * as fs from "../../shared/formatter_server_types";
import { disposeAll } from "../../shared/utils";
import { fsPath } from "../../shared/utils/fs";
import * as util from "../utils";
import { DfsFormatterClient } from "./formatter_dfs";

export class FileChangeHandler implements vs.Disposable {
	private readonly disposables: vs.Disposable[] = [];
	private readonly filesWarnedAbout = new Set<string>();
	constructor(private readonly formatter: DfsFormatterClient) {
		this.disposables.push(
			vs.workspace.onDidOpenTextDocument((td) => this.onDidOpenTextDocument(td)),
			vs.workspace.onDidChangeTextDocument((e) => this.onDidChangeTextDocument(e)),
			vs.workspace.onDidCloseTextDocument((td) => this.onDidCloseTextDocument(td)),
		);
		// Handle already-open files.
		vs.workspace.textDocuments.forEach((td) => this.onDidOpenTextDocument(td));
		//TODO (tekert): try to send only first modified files.
		// for example if change fails with no overlay, send whole contents to sync, the send change again.
		// the error type is INVALID_OVERLAY_CHANGE (with edit range error or no overlay) TODO: create INVALID_OVERLAY_RANGE
	}

	public onDidOpenTextDocument(document: vs.TextDocument) {
		if (!util.isFormattable(document))
			return;

		const files: { [key: string]: fs.AddContentOverlay } = {};

		files[fsPath(document.uri)] = {
			content: document.getText(),
			type: "add",
		};

		// tslint:disable-next-line: no-floating-promises
		this.formatter.serverUpdateContent({ files });
	}

	public onDidChangeTextDocument(e: vs.TextDocumentChangeEvent) {
		if (!util.isFormattable(e.document))
			return;

		if (e.contentChanges.length === 0) // This event fires for metadata changes (dirty?) so don't need to notify the server then.
			return;

		const files: { [key: string]: fs.ChangeContentOverlay } = {};

		files[fsPath(e.document.uri)] = {
			edits: e.contentChanges.map((c) => this.convertChange(e.document, c)),
			type: "change",
		};

		// tslint:disable-next-line: no-floating-promises
		this.formatter.serverUpdateContent({ files });
	}

	public onDidCloseTextDocument(document: vs.TextDocument) {
		if (!util.isFormattable(document))
			return;

		const files: { [key: string]: fs.RemoveContentOverlay } = {};

		files[fsPath(document.uri)] = {
			type: "remove",
		};

		// tslint:disable-next-line: no-floating-promises
		this.formatter.serverUpdateContent({ files });
	}

	private convertChange(document: vs.TextDocument, change: vs.TextDocumentContentChangeEvent): fs.SourceEdit {
		return {
			id: "",
			length: change.rangeLength,
			offset: change.rangeOffset,
			replacement: change.text,
		};
	}

	public dispose(): any {
		disposeAll(this.disposables);
	}
}
