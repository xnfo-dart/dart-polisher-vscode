import * as minimatch from "minimatch";
import { CancellationToken, DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider, DocumentSelector, FormattingOptions, languages, OnTypeFormattingEditProvider, Position, Range, TextDocument, TextEdit, window, workspace } from "vscode";
import { LogCategory } from "../../shared/enums";
import * as fs from "../../shared/formatter_server_types";
import { CodeStyle, TabSize } from "../../shared/formatter_server_types";
import { IAmDisposable, Logger } from "../../shared/interfaces";
import { disposeAll } from "../../shared/utils";
import { fsPath } from "../../shared/utils/fs";
import { fromRange } from "../../shared/vscode/utils";
import { Context } from "../../shared/vscode/workspace";
import { config } from "../config";
import { DfsFormatterClient } from "../formatter/formatter_dfs";

export class DartFormattingEditProvider implements DocumentFormattingEditProvider, OnTypeFormattingEditProvider, DocumentRangeFormattingEditProvider, IAmDisposable {
	constructor(private readonly logger: Logger, private readonly formatter: DfsFormatterClient, private readonly context: Context) {
		workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("dart-polisher.enableFormatter")) {
				if (config.enableFormatter)
					this.registerAllFormatters();
				else
					this.unregisterAllFormatters();
			}
		});
		//TODO(tekert): Use dart_polisher js compilation as an alternative over stdio.
	}

	private readonly registeredFormatters: IAmDisposable[] = [];
	private readonly formatterRegisterFuncs: Array<() => void> = [];

	public registerDocumentFormatter(filter: DocumentSelector): void {
		this.registerFormatter(() => {
			this.logger.info("Document Formatting Edit Provider registered.");
			return languages.registerDocumentFormattingEditProvider(filter, this);
		});
	}

	public registerTypingFormatter(filter: DocumentSelector, firstTriggerCharacter: string, ...moreTriggerCharacters: string[]): void {
		this.registerFormatter(() => {
			this.logger.info("On Type Formatting Edit Provider registered.");
			return languages.registerOnTypeFormattingEditProvider(filter, this, firstTriggerCharacter, ...moreTriggerCharacters);
		});
	}

	public registerDocumentRangeFormatter(filter: DocumentSelector): void {
		this.registerFormatter(() => {
			this.logger.info("Range Formatting Edit Provider registered.");
			return languages.registerDocumentRangeFormattingEditProvider(filter, this);
		});
	}

	private registerFormatter(reg: () => IAmDisposable) {
		const registerAndTrack = () => this.registeredFormatters.push(reg());

		// Register the formatter immediately if enabled.
		if (config.enableFormatter)
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
		try {
			return await this.doFormat(document, true, options); // await is important for catch to work.
		} catch (e) {
			this.showErrorMesages(e);
			return undefined;
		}
	}

	// TODO (tekert): Use workspace settings to include or exclude formatting onType.
	public async provideOnTypeFormattingEdits(document: TextDocument, position: Position, ch: string, options: FormattingOptions
		, token: CancellationToken): Promise<TextEdit[] | undefined> {
		// TODO (tekert): from last ;
		let range: Range | undefined;

		//document.getWordRangeAtPosition(position, RegExp("")); // DEBUG: Throw exception, for testing.

		if (ch === ";") {
			//range = document.lineAt(position).range;
		}

		// TODO (tekert): matching {
		// eslint-disable-next-line no-empty
		if (ch === "}") { }

		try {
			return await this.doFormat(document, false, options, range);
		} catch {
			return undefined;
		}
	}

	public async provideDocumentRangeFormattingEdits(document: TextDocument, range: Range, options: FormattingOptions
		, token: CancellationToken): Promise<TextEdit[] | undefined> {
		try {
			return await this.doFormat(document, true, options, range); // await is important for catch to work.
		} catch (e) {
			this.showErrorMesages(e);
			return undefined;
		}
	}

	private async doFormat(document: TextDocument, doLogError = true, options: FormattingOptions, range?: Range | undefined)
		: Promise<TextEdit[] | undefined> {

		if (!this.shouldFormat(document))
			return undefined;

		try {

			let selectionOnly = false;
			let offsets = { start: 0, end: 0 }; // [start, end] zero-based
			if (range) {

				offsets = fromRange(document, range);
				selectionOnly = true;
			}

			// Space Indent sizes, if config is not set, use editor's default.
			const tabSizes = new TabSize();
			tabSizes.block = config.for(document.uri).blockIndent ?? options.tabSize;
			tabSizes.cascade = config.for(document.uri).cascadeIndent ?? options.tabSize;
			tabSizes.expression = config.for(document.uri).expressionIndent ?? options.tabSize;
			tabSizes.constructorInitializer = config.for(document.uri).constructorInitializerIndent ?? options.tabSize;

			// Get selected code style
			const style: CodeStyle = new CodeStyle();
			style.code = config.for(document.uri).codeStyleCode;

			// Send edit.format request (undefined params are just discarded) and await for response.
			const resp = await this.formatter.editFormat({
				file: fsPath(document.uri),
				lineLength: config.for(document.uri).lineLength,
				selectionLength: offsets.end - offsets.start, // API needs this to be 0 instead of null.
				selectionOffset: offsets.start,
				selectionOnly: selectionOnly,
				insertSpaces: options.insertSpaces,
				tabSize: tabSizes,
				codeStyle: style,
			});
			if (resp.edits.length === 0)
				return undefined;
			else {
				return resp.edits.map((e) => this.convertData(document, e));
			}

		} catch (e) {
			if (doLogError)
				this.logger.error(e);
			throw e;
		}
	}

	private showErrorMesages(error: any) {
		if (error.code === "FORMAT_WITH_ERRORS") {
			if (!this.context.hasWarnedAboutFormatterSyntaxLimitation) {
				this.context.hasWarnedAboutFormatterSyntaxLimitation = true;
				window.showInformationMessage("Dart Polisher formatter will not run if the file has syntax errors");
			}
		} else if (error.code === "FORMAT_RANGE_ERROR") {
			const message: string = error.message;
			window.showInformationMessage("Error: Dart Polisher formatter will not run if the selected range is invalid: " + message);
		}
		return undefined;
	}

	private async saveSyncDocument(document: TextDocument): Promise<boolean> {
		if (document.isDirty) {
			const result = await document.save();
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

		return undefined === resourceConf.doNotFormat.find((p) => minimatch(path, p, { dot: true }));
	}

	private convertData(document: TextDocument, edit: fs.SourceEdit): TextEdit {
		return new TextEdit(
			new Range(document.positionAt(edit.offset), document.positionAt(edit.offset + edit.length)),
			edit.replacement,
		);
	}

	public dispose() {
		this.unregisterAllFormatters();
	}
}
