import * as dp from "dart-polisher";
import { CancellationToken, DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider, DocumentSelector, FormattingOptions, languages, OnTypeFormattingEditProvider, Position, Range, TextDocument, TextEdit, window, workspace } from "vscode";
import { CodeStyle, TabSize } from "../../shared/formatter_server_types";
import { Context } from "../../shared/vscode/workspace";
import { config } from "../config";
import { getPolisherException } from "../dart-polisher/exceptions";
import { getErrorMessage } from "../utils";

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
				if (config.enableFormatter)
					this.registerAllFormatters();
				else
					this.unregisterAllFormatters();
			}
		});

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

		console.log("[STATUS] doFormat called: ");
		console.log("Document uri.fspath: " + document.uri.fsPath + " ");
		console.log("uri.scheme: " + document.uri.scheme + "\n");

		// NOTE: there are two ways to do this:
		// A: Format by sending the substring to be formatted and let vscode edit the range.
		// B: Format by sending the whole document and use selection offsets to edit the formatted range.
		//
		// Option B let you format any range but needs to format the whole page on every selection format.
		// Option A will throw errors when formatting substrings that are not complete blocks, but its a bit faster.
		// Using option A for now.
		const optA = true; // set to false to use option B.

		try {

			// If formatting whole text set compilationUnit
			let isCompilationUnit: boolean = false;
			const start = new Position(0, 0);
			const end = new Position(document.lineCount - 1, document.lineAt(document.lineCount - 1).text.length);
			const documentRange = new Range(start, end);
			// set range to cover whole document if undefined.
			if (range === undefined)
				range = documentRange;
			if (optA) {
				if (range.isEqual(documentRange))
					isCompilationUnit = true;
			} else
				isCompilationUnit = true;

			// Range from {start, end} zero based offsets.
			const offsets = { start: document.offsetAt(range.start), end: document.offsetAt(range.end) };

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

			// Max page width from configured setting.
			const pageWidth = config.for(document.uri).lineLength;

			// Set formatting settings
			let frange: dp.FRange | undefined;
			if (!optA) frange = { offset: offsets.start, length: offsets.end - offsets.start };
			const findents: dp.FIndent = { block: tabSizes.block, cascade: tabSizes.cascade, expression: tabSizes.expression, constructorInitializer: tabSizes.constructorInitializer };
			const foptions: dp.FOptions = { style: style.code, tabSizes: findents, indent: 0, pageWidth: pageWidth, insertSpaces: insertSpaces, selection: frange };

			// Format whole text or just part of it.
			let content : string;
			if (optA)
				content = document.getText(range);
			else
				content = document.getText();

			console.log("[STATUS] Formatting...\n");
			const result = dp.formatCode(content, foptions, isCompilationUnit);

			const r: TextEdit[] = [];
			if (optA)
				r.push(new TextEdit(range, result.code));
			else {
				if (result.selection.offset === undefined || result.selection.length === undefined)
					throw Error("Selection result is null, check if selection was given in formatter 'FOptions'");
				const formattedRange = result.code.substring(result.selection.offset, result.selection.offset + result.selection.length);
				r.push(new TextEdit(range, formattedRange));
			}

			console.log("[STATUS] Source Code formatted succesfully.\n");

			if (false) console.log("[STATUS] Format edits: ", r.length, "\n");
			if (false) {
				console.log("[STATUS] Format content: '", content, "'\n");
				console.log("[STATUS] Format result.code: '", result.code, "'\n");
			}
			return r;

		} catch (e) {
			const perror = getPolisherException(e);
			if (perror && doLogError)
				console.log(perror.message, "\n");

			if (perror === undefined) {
				console.log("[ERROR] ", e, "\n");
				return undefined;
			}

			throw perror;
		}
	}

	private showErrorMesages(perror: any) {
		if (perror.code === "FORMAT_WITH_ERRORS") {
			if (!this.context.hasWarnedAboutFormatterSyntaxLimitation) {
				this.context.hasWarnedAboutFormatterSyntaxLimitation = true;
				window.showInformationMessage("Dart Polisher formatter will not run if the file has syntax errors");
				console.log("[ERROR] Dart Polisher formatter will not run if the file has syntax errors.\n");
			}
		} else if (perror.code === "FORMAT_RANGE_ERROR") {
			const message: string = perror.message;
			window.showInformationMessage("Error: Dart Polisher formatter will not run if the selected range is invalid: " + message);
			console.log("[ERROR]" + "Error: Dart Polisher formatter will not run if the selected range is invalid: " + message + "\n");
		}
		return undefined;
	}

	public dispose() {
		this.unregisterAllFormatters();
	}
}
