import * as jsdartpolisher from "dart-polisher";
import { CancellationToken, DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider, DocumentSelector, FormattingOptions, languages, OnTypeFormattingEditProvider, Position, Range, TextDocument, TextEdit, window, workspace } from "vscode";
import { CodeStyle, TabSize } from "../../shared/formatter_server_types";
import { Context } from "../../shared/vscode/workspace";
import { config } from "../config";

export interface IAmDisposable {
	dispose(): void | Promise<void>;
}

export function disposeAll(disposables: IAmDisposable[]) {
	const toDispose = disposables.slice();
	disposables.length = 0;
	for (const d of toDispose) {
		try {
			d.dispose();
		} catch (e) {
			console.warn(e);
		}
	}
}

export class DartFormattingEditProvider implements DocumentFormattingEditProvider, OnTypeFormattingEditProvider, DocumentRangeFormattingEditProvider, IAmDisposable {
	constructor(private readonly logger: undefined, private readonly formatter: undefined, private readonly context: Context) {
		workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("dart-polisher.enableFormatter")) {
				if (true)
					this.registerAllFormatters();
				else
					this.unregisterAllFormatters();
			}
		});

		const ind: jsdartpolisher.FIndent = { block: 9, cascade: 9, expression: 9, constructorInitializer: 9 };
		const opt: jsdartpolisher.FOptions = { style: 1, tabSizes: ind, indent: 0, pageWidth: 80, insertSpaces: true };
		const result1 = jsdartpolisher.formatCode("void a(){int a;}", opt);
		const a = 1;

		console.log("DartFormattingEditProvider instanced.\n");
	}

	private readonly registeredFormatters: IAmDisposable[] = [];
	private readonly formatterRegisterFuncs: Array<() => void> = [];

	public registerDocumentFormatter(filter: DocumentSelector): void {
		this.registerFormatter(() => {
			console.log("Document Formatting Edit Provider registered.\n");
			return languages.registerDocumentFormattingEditProvider(filter, this);
		});
	}

	public registerTypingFormatter(filter: DocumentSelector, firstTriggerCharacter: string, ...moreTriggerCharacters: string[]): void {
		this.registerFormatter(() => {
			console.log("On Type Formatting Edit Provider registered.\n");
			return languages.registerOnTypeFormattingEditProvider(filter, this, firstTriggerCharacter, ...moreTriggerCharacters);
		});
	}

	public registerDocumentRangeFormatter(filter: DocumentSelector): void {
		this.registerFormatter(() => {
			console.log("Range Formatting Edit Provider registered.\n");
			return languages.registerDocumentRangeFormattingEditProvider(filter, this);
		});
	}

	private registerFormatter(reg: () => IAmDisposable) {
		const registerAndTrack = () => this.registeredFormatters.push(reg());

		// Register the formatter immediately if enabled.
		//if (config.enableFormatter)
		registerAndTrack();

		console.log("Registered: " + registerAndTrack.name + "\n");

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
			return await this.doFormat(document, true, options, undefined); // await is important for catch to work.
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

	private async doFormat(document: TextDocument, doLogError = true, options: FormattingOptions, range: Range | undefined)
		: Promise<TextEdit[] | undefined> {

		console.log("[STATUS] doFormat called\n");
		console.log("[STATUS] File uri fspath: " + document.uri.fsPath + "\n");
		console.log("[STATUS] Scheme: " + document.uri.scheme + "\n");

		try {

			let selectionOnly = false;
			let offsets = { start: 0, end: 0 }; // [start, end] zero-based
			if (range) {

				offsets = this.fromRange(document, range);
				selectionOnly = true;
			}

			// Space Indent sizes, if config is not set, use editor's default.
			const insertSpaces = options.insertSpaces;
			const editorTabSize = options.tabSize;
			const tabSizes = new TabSize();
			tabSizes.block = config.for(document.uri).blockIndent ?? editorTabSize;
			tabSizes.cascade = config.for(document.uri).cascadeIndent ?? editorTabSize;
			tabSizes.expression = config.for(document.uri).expressionIndent ?? editorTabSize;
			tabSizes.constructorInitializer = config.for(document.uri).constructorInitializerIndent ?? editorTabSize;

			// Get selected code style
			const style: CodeStyle = new CodeStyle();
			style.code = config.for(document.uri).codeStyleCode;

			const pageWidth = config.for(document.uri).lineLength;

			const ind: jsdartpolisher.FIndent = { block: tabSizes.block, cascade: tabSizes.cascade, expression: tabSizes.expression, constructorInitializer: tabSizes.constructorInitializer };
			const opt: jsdartpolisher.FOptions = { style: style.code, tabSizes: ind, indent: 0, pageWidth: pageWidth, insertSpaces: insertSpaces };

			// Use web version if we dont have a formatter server.
			// TODO (tekert): experiment, do error checking etc.
			if (range === undefined) {
				const start = new Position(0, 0);
				const end = new Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
				range = new Range(start, end);
			}
			console.log("[STATUS] Formatting...");

			const content = document.getText(range);
			const r: TextEdit[] = [];

			// TODO(tekert): sections, ranges.
			const result = jsdartpolisher.formatCode(content, opt);
			if (!result.error) {
				r.push(new TextEdit(range, result.code!));
			} else {
				console.log("[ERROR] Dart Polisher formatter will not run if the file has syntax errors.\n");
				throw result.error;
			}
			console.log("[STATUS] Format edits: " + r.length.toString() + "\n");
			return r;

		} catch (e) {
			console.log(e);
			throw e;
		}
	}

	private showErrorMesages(error: any) {
		if (!this.context.hasWarnedAboutFormatterSyntaxLimitation) {
			this.context.hasWarnedAboutFormatterSyntaxLimitation = true;
			window.showInformationMessage("Dart Polisher formatter will not run if the file has syntax errors");
		}
		/*
		if (error.code === "FORMAT_WITH_ERRORS") {
			if (!this.context.hasWarnedAboutFormatterSyntaxLimitation) {
				this.context.hasWarnedAboutFormatterSyntaxLimitation = true;
				window.showInformationMessage("Dart Polisher formatter will not run if the file has syntax errors");
			}
		} else if (error.code === "FORMAT_RANGE_ERROR") {
			const message: string = error.message;
			window.showInformationMessage("Error: Dart Polisher formatter will not run if the selected range is invalid: " + message);
		}
		*/
		return undefined;
	}

	// Range to {start, end} zero based offsets.
	private fromRange(document: TextDocument, range: Range): { start: number, end: number } {
		return { start: document.offsetAt(range.start), end: document.offsetAt(range.end) };
	}

	public dispose() {
		this.unregisterAllFormatters();
	}
}
