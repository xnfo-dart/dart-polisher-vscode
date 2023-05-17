import * as dp from "dart-polisher";
import { CancellationToken, DocumentFormattingEditProvider, DocumentRangeFormattingEditProvider, DocumentSelector, FormattingOptions, languages, OnTypeFormattingEditProvider, Position, Range, TextDocument, TextEdit, Uri, window, workspace } from "vscode";
import { Context } from "../../shared/vscode/workspace";
import { config } from "../config";
import { isDartException, isPolisherException } from "../dart-polisher/exceptions";
import { isDefined, isError } from "../utils";

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
		return await this.doFormat(document, true, options, undefined); // await is important for catch to work.
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

		return await this.doFormat(document, false, options, range);
	}

	public async provideDocumentRangeFormattingEdits(document: TextDocument, range: Range, options: FormattingOptions
		, token: CancellationToken): Promise<TextEdit[] | undefined> {
		return await this.doFormat(document, true, options, range); // await is important for catch to work.
	}

	private async doFormat(document: TextDocument, doLogError = true, options: FormattingOptions, range: Range | undefined)
		: Promise<TextEdit[] | undefined> {
		const debug = false; // set to true for debugging. //TODO: setting

		if (debug) {
			console.log("[DEBUG] doFormat called:");
			console.log("[DEBUG] Document uri:", document.uri.toString());
			console.log("[DEBUG] Document size:", (await workspace.fs.stat(document.uri)).size, "bytes");
			if (range)
				console.log("[DEBUG] Selection:", document.offsetAt(range.start), ":", document.offsetAt(range.end));
		}

		const formatStartTime = new Date();

		// NOTE: there are two ways to do this:
		// A: Format by sending the substring to be formatted and let vscode edit the range.
		// B: Format by sending the whole document and use selection offsets to edit the formatted range.
		//
		// Option B let you format any range but needs to format the whole page on every selection format.
		// Option A will throw errors when formatting substrings that are not complete blocks, but its a bit faster.
		// Using option A for now.
		const optA = true; // set to false to use option B.

		try {

			// If we are formatting whole document set compilationUnit
			let isCompilationUnit: boolean = false;
			const lineCount = document.lineCount - 1;
			const documentRange = new Range(0, 0, lineCount, document.lineAt(lineCount).text.length);
			// set range to cover whole document if undefined.
			if (range === undefined)
				range = documentRange;
			if (range.isEqual(documentRange) && optA)
				isCompilationUnit = true;
			if (!optA)
				isCompilationUnit = true;

			// Range from {start, end} zero based offsets.
			const offsets = {
				start: document.offsetAt(range.start),
				end: document.offsetAt(range.end),
			};

			if (!options)
				options = { insertSpaces: true, tabSize: 4 };

			// Set formatting settings
			const editorTabSize = options.tabSize;
			let frange: dp.FRange | undefined;
			if (!optA) frange = { offset: offsets.start, length: offsets.end - offsets.start };
			const findents: dp.FIndent = {
				block: config.for(document.uri).blockIndent ?? editorTabSize,
				cascade: config.for(document.uri).cascadeIndent ?? editorTabSize,
				expression: config.for(document.uri).expressionIndent ?? editorTabSize,
				constructorInitializer: config.for(document.uri).constructorInitializerIndent ?? editorTabSize,
			};
			const foptions: dp.FOptions = {
				style: config.for(document.uri).styleNumber,
				tabSizes: findents,
				indent: 0,
				pageWidth: config.for(document.uri).lineLength,
				insertSpaces: options.insertSpaces,
				selection: frange,
			};

			// Format whole text or just part of it.
			const content = optA ? document.getText(range) : document.getText();

			if (debug) console.log("[DEBUG] Formatting...");
			const result = dp.formatCode(content, foptions, isCompilationUnit);

			const r: TextEdit[] = [];
			if (optA)
				r.push(new TextEdit(range, result.code));
			else {
				if (!isDefined(result.selection.offset) || !isDefined(result.selection.length))
					throw Error("Selection result is null, check if selection was given in 'FOptions'");
				const formattedRange = result.code.substring(result.selection.offset,
					result.selection.offset + result.selection.length);
				r.push(new TextEdit(range, formattedRange));
			}

			if (debug) console.log("[DEBUG] Source Code formatted succesfully.");

			if (false) console.log("[DEBUG] Format edits: ", r.length);
			if (false) {
				console.log("[DEBUG] Format content: '", content);
				console.log("[DEBUG] Format result.code: '", result.code);
			}
			return r;

		} catch (e) {

			// Formatter Errors:
			if (isDartException(e)) {
				const perror = e.dartException;
				if (isPolisherException(perror)) {
					if (doLogError) {
						console.log("[FORMATTER ERROR] ", perror.message);
						this.showErrorMesages(perror);
					}
				} else {
					console.log("[DART EXCEPTION] ", e.message); // Dart2js hooks message => dartException.toString()
				}
				// Other Errors:
			} else if (isError(e)) {
				console.log("[JS ERROR] ", e);
			} else {
				console.log("[UNKNOWN ERROR] ", e);
				throw e;
			}

			return undefined;

		} finally {
			if (debug) {
				const formatEndTime = new Date();
				const time = formatEndTime.getTime() - formatStartTime.getTime();
				console.log("[DEBUG] Format performance:", time, "ms");
			}
			// Production tests
			// [RELEASE]Chrome: 10k lines file took ~850-1150ms (best-worst) on DEV-PC1 using: dart-polisher 0.9.3/Dart 2.18
			// [RELEASE]Node with FServer: 10k lines file took ~390-410ms (best-worst) on DEV-PC1 using: dart-polisher 0.9.3/Dart 2.18

			// Debug tests
			// [DEBUG]Chrome: 10k lines file took ~850-1150ms (best-worst) on DEV-PC1 using: dart-polisher 0.9.5-dev/Dart 3.00
			// [DEBUG]Node with FServer: 10k lines file took ~290-350ms (best-worst) on DEV-PC1 using: dart-polisher 0.9.5-dev/Dart 3.00
		}
	}
	/*
	private pad(str: string, length: number) {
		while (str.length < length)
			str = "0" + str;
		return str;
	}

	private logTime = (start: bigint, taskFinished?: string) => {
		const end = process.hrtime.bigint();
		console.log(`${this.pad((end - start).toString(), 15)} ${taskFinished ? "<== " + taskFinished : ""}`);
	};
*/
	private showErrorMesages(perror: dp.FException) {

		switch (perror.code) {
			case "FORMAT_WITH_ERRORS":
				if (!this.context.hasWarnedAboutFormatterSyntaxLimitation) {
					this.context.hasWarnedAboutFormatterSyntaxLimitation = true;
					window.showInformationMessage("Dart Polisher formatter will not run if the file has syntax errors");
				}
				break;
			case "FORMAT_RANGE_ERROR":
				const message: string = perror.message;
				window.showInformationMessage("Error: Dart Polisher formatter will not run if the selected range is invalid: " + message);
				break;
		}

		return undefined;
	}

	public dispose() {
		this.unregisterAllFormatters();
	}
}
