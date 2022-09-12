import * as minimatch from "minimatch";
import { CancellationToken, DocumentFormattingEditProvider, DocumentSelector, FormattingOptions, languages, OnTypeFormattingEditProvider, Position, Range, TextDocument, TextEdit, window, workspace } from "vscode";
import * as as from "../formatter/formatter_server_types";
import { IAmDisposable, Logger } from "../shared/interfaces";
import { disposeAll } from "../shared/utils";
import { fsPath } from "../shared/utils/fs";
import { Context } from "../shared/vscode/workspace";
import { config } from "../config";
import { DasFormatterClient } from "../formatter/formatter_das";
import { LogCategory } from "../shared/enums";
import { fromRange } from "../shared/vscode/utils";

export class DartFormattingEditProvider implements DocumentFormattingEditProvider, OnTypeFormattingEditProvider, IAmDisposable {
	constructor(private readonly logger: Logger, private readonly formatter: DasFormatterClient, private readonly context: Context) {
		workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("dart-custom-formatter.enableCustomFormatter")) {
				if (config.enableCustomFormatter)
					this.registerAllFormatters();
				else
					this.unregisterAllFormatters();
			}
		});
	}

	private readonly registeredFormatters: IAmDisposable[] = [];
	private readonly formatterRegisterFuncs: Array<() => void> = [];

	public registerDocumentFormatter(filter: DocumentSelector): void {
		this.registerFormatter(() => languages.registerDocumentFormattingEditProvider(filter, this));
	}

	public registerTypingFormatter(filter: DocumentSelector, firstTriggerCharacter: string, ...moreTriggerCharacters: string[]): void {
		this.registerFormatter(() => languages.registerOnTypeFormattingEditProvider(filter, this, firstTriggerCharacter, ...moreTriggerCharacters));
	}

	public registerDocumentRangeFormatter(filter: DocumentSelector): void {
		this.registerFormatter(() => languages.registerDocumentRangeFormattingEditProvider(filter, this));
	}

	private registerFormatter(reg: () => IAmDisposable) {
		const registerAndTrack = () => this.registeredFormatters.push(reg());

		// Register the formatter immediately if enabled.
		if (config.enableCustomFormatter)
			registerAndTrack();

		// Add it to our list so we can re-register later..
		this.formatterRegisterFuncs.push(registerAndTrack);
	}

	private registerAllFormatters() {
		for (const formatterReg of this.formatterRegisterFuncs) {
			formatterReg();
		}
	}

	private unregisterAllFormatters() {
		disposeAll(this.registeredFormatters);
	}

	public async provideDocumentFormattingEdits(document: TextDocument, options: FormattingOptions, token: CancellationToken): Promise<TextEdit[] | undefined> {
		//TODO: use [options: FormattingOptions] for edit insertspace and tabsize
		try {
			return await this.doFormat(document, true); // await is important for catch to work.
		} catch
		{	//TODO: check, when does this gets initialized?
			if (!this.context.hasWarnedAboutFormatterSyntaxLimitation) {
				this.context.hasWarnedAboutFormatterSyntaxLimitation = true;
				window.showInformationMessage("The Dart Custom Formatter will not run if the file has syntax errors");
			}
			return undefined;
		}
	}

	public async provideOnTypeFormattingEdits(document: TextDocument, position: Position, ch: string, options: FormattingOptions,
		token: CancellationToken): Promise<TextEdit[] | undefined> {
		//TODO: use [options: FormattingOptions] for edit insertspace and tabsize
		//! TODO: ch (last typed char that triggers this is deleted when formatted text arrives from response)
		// make it only format a line.
		try {
			return await this.doFormat(document, false);
		} catch {
			return undefined;
		}
	}

	public async provideDocumentRangeFormattingEdits(document: TextDocument, range: Range, options: FormattingOptions,
		token: CancellationToken): Promise<TextEdit[] | undefined> {
		//TODO: use [options: FormattingOptions] for edit insertspace and tabsize
		try {
			return await this.doFormat(document, true, range); // await is important for catch to work.
		} catch {
			return undefined;
		}
	}

	private async doFormat(document: TextDocument, doLogError = true, range?: Range): Promise<TextEdit[] | undefined> {

		if (!this.shouldFormat(document))
			return undefined;

		// Force save if dirty,
		//TODO (tekert): or make new protocol accepting source contents (new and modified parts) instead of file paths.
		//! is causing timeout on vscode, save hangs after using context menu to Format Document.
		//let r = await this.saveSyncDocument(document);
		//if (!r)
		//return undefined;

		if (document.isDirty)
			return undefined;

		try {

			let selectionOnly = false;
			let offsets = {start: 0, end: 0}; // [start, end] zero-based
			if (range) {

				offsets = fromRange(document, range);
				selectionOnly = true;
			}

			const resp = await this.formatter.editFormat({
				file: fsPath(document.uri),
				lineLength: config.for(document.uri).lineLength,
				selectionLength: offsets.end - offsets.start,
				selectionOffset: offsets.start,
				selectionOnly: selectionOnly,
			});
			if (resp.edits.length === 0)
				return undefined;
			else {
				let a = resp.edits.map((e) => this.convertData(document, e));
				return a;
			}

		} catch (e) {
			if (doLogError)
				this.logger.error(e);
			throw e;
		}
	}

	private async saveSyncDocument(document: TextDocument): Promise<boolean> {
		if (document.isDirty) {
			let result = await document.save();
			if (!result) {
				this.logger.error(`Could not save file: ${document.uri}`, LogCategory.General);
				return false;
			}
		}
		return true;
	}

	private shouldFormat(document: TextDocument): boolean {
		if (!document || !document.uri || document.uri.scheme !== "file")
			return false;

		const resourceConf = config.for(document.uri);
		const path = fsPath(document.uri);

		return undefined === resourceConf.doNotFormat.find((p: any) => minimatch(path, p, { dot: true }));
	}

	private convertData(document: TextDocument, edit: as.SourceEdit): TextEdit {
		return new TextEdit(
			new Range(document.positionAt(edit.offset), document.positionAt(edit.offset + edit.length)),
			edit.replacement,
		);
	}

	public dispose() {
		this.unregisterAllFormatters();
	}
}
