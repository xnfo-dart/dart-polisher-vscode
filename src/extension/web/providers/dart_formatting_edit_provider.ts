import { CancellationToken, DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider, DocumentSelector, FormattingOptions, languages, OnTypeFormattingEditProvider, Position, Range, TextDocument, TextEdit, window, workspace } from "vscode";
//import { CodeStyle, TabSize } from "../../../shared/formatter_server_types";
import { Context } from "../../../shared/vscode/workspace";
//import { config } from "../../config";

import * as jsdartpolisher from "dart-polisher";

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

		const ind : jsdartpolisher.FIndent = {block: 9, cascade: 9,  expression: 9, constructorInitializer: 9};
		const opt : jsdartpolisher.FOptions = {style: 1, tabSizes: ind, indent: 0, pageWidth: 80, insertSpaces: true};
		const result1 = jsdartpolisher.formatCode("void a(){int a;}", opt);
		const a = 1;
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
		//if (config.enableFormatter)
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

		if (!this.shouldFormat(document))
			return undefined;

		try {

			let selectionOnly = false;
			let offsets = { start: 0, end: 0 }; // [start, end] zero-based
			if (range) {

				offsets = this.fromRange(document, range);
				selectionOnly = true;
			}

			const tabSize = options.tabSize;


			const ind: jsdartpolisher.FIndent = { block: tabSize, cascade: tabSize, expression: tabSize, constructorInitializer: tabSize };
			const opt: jsdartpolisher.FOptions = { style: 1, tabSizes: ind, indent: 0, pageWidth: 90, insertSpaces: options.insertSpaces };

			// Space Indent sizes, if config is not set, use editor's default.
			// const tabSizes = new TabSize();
			// tabSizes.block = config.for(document.uri).blockIndent ?? options.tabSize;
			// tabSizes.cascade = config.for(document.uri).cascadeIndent ?? options.tabSize;
			// tabSizes.expression = config.for(document.uri).expressionIndent ?? options.tabSize;
			// tabSizes.constructorInitializer = config.for(document.uri).constructorInitializerIndent ?? options.tabSize;

			// Get selected code style
			// const style: CodeStyle = new CodeStyle();
			// style.code = config.for(document.uri).codeStyleCode;

			// Use web version if we dont have a formatter server.
			// TODO (tekert): experiment, do error checking etc.
			if (range === undefined) {
				const start = new Position(0, 0);
				const end = new Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
				range = new Range(start, end);
			}

			const content = document.getText(range);
			const r: TextEdit[] = [];
			const result = jsdartpolisher.formatCode(content, opt);
			if (!result.error) {
				r.push(new TextEdit(range, result.code!));
			}
			return r;

		} catch (e) {
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

	private shouldFormat(document: TextDocument): boolean {
		if (!document || !document.uri || document.uri.scheme !== "file")
			return false;

		return true;
	}

	// Range to {start, end} zero based offsets.
	private fromRange(document: TextDocument, range: Range): { start: number, end: number } {
		return { start: document.offsetAt(range.start), end: document.offsetAt(range.end) };
	}

	public dispose() {
		this.unregisterAllFormatters();
	}
}
