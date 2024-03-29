import { ConfigurationTarget, Uri, workspace, WorkspaceConfiguration } from "vscode";
import { NullAsUndefined, nullToUndefined } from "./utils";

class Config {
	private config: WorkspaceConfiguration;

	private dartDefaultFormatter = getAppliedConfig("editor", "defaultFormatter", false); // default configured dart formatter
	private dartSdkFormatterEnabled = getAppliedConfig("dart", "enableSdkFormatter", false); // dart SDK formatter

	constructor() {
		workspace.onDidChangeConfiguration((e) => {
			this.reloadConfig();
			// Dart SDK formatter boolean got changed.
			if (e.affectsConfiguration("dart.enableSdkFormatter")) {
				this.dartSdkFormatterEnabled = getAppliedConfig("dart", "enableSdkFormatter", false);
			}
			// A default formatter string got changed.
			if (e.affectsConfiguration("editor.defaultFormatter", { languageId: "dart" })) {
				this.dartDefaultFormatter = getAppliedConfig("editor", "defaultFormatter", false);
			}
		});

		this.config = workspace.getConfiguration("dart-polisher");
	}

	private reloadConfig() {
		this.config = workspace.getConfiguration("dart-polisher");
	}

	private getConfig<T>(key: string, defaultValue: T): NullAsUndefined<T> {
		const value = this.config.get<T>(key, defaultValue);
		return nullToUndefined(value);
	}

	private async setConfig<T>(key: string, value: T, target: ConfigurationTarget): Promise<void> {
		await this.config.update(key, value, target);
	}

	get env(): any { return this.getConfig<any>("env", {}); }

	// Server settings
	get enableFormatter(): boolean { return this.getConfig<boolean>("enableFormatter", true); }
	get notifyFormatterErrors(): boolean { return this.getConfig<boolean>("notifyFormatterErrors", true); }

	// Get other formatters options
	get sdkFormatterEnabled(): boolean | undefined { return this.dartSdkFormatterEnabled; }
	get defaultFormatter(): string | undefined { return this.dartDefaultFormatter; }

	// Options that can be set programatically.
	public setEnableFormatter(value: boolean | undefined): Promise<void> { return this.setConfig("enableFormatter", value, ConfigurationTarget.Global); }

	public for(uri?: Uri): ResourceConfig {
		return new ResourceConfig(uri);
	}
}

export class ResourceConfig {
	public uri?: Uri;
	public config: WorkspaceConfiguration;

	constructor(uri?: Uri) {
		this.uri = uri;
		this.config = workspace.getConfiguration("dart-polisher", this.uri);
	}

	private getConfig<T>(key: string, defaultValue: T): NullAsUndefined<T> {
		return nullToUndefined(this.config.get<T>(key, defaultValue));
	}


	// Extension
	get doNotFormat(): string[] { return this.getConfig<string[]>("doNotFormat", []); }

	// Formatter
	get lineLength(): number { return this.getConfig<number>("lineLength", 90); }
	get expressionIndent(): undefined | number { return this.getConfig<null | number>("expressionIndent", null); }
	get blockIndent(): undefined | number { return this.getConfig<null | number>("blockIndent", null); }
	get cascadeIndent(): undefined | number { return this.getConfig<null | number>("cascadeIndent", null); }
	get constructorInitializerIndent(): undefined | number { return this.getConfig<null | number>("constructorInitializerIndent", null); }
	get styleNumber(): number {
		const key = this.getConfig<CodeStylesEnum>("style", CodeStylesEnum["Dart Style"]);
		const num = CodeStylesEnum[key];
		// the syntax analyzer is confused and thinks this is a string, so...
		let numValue = Number(num);
		if (Number.isNaN(numValue)) { numValue = 0; }
		return numValue;
	}
	get style(): CodeStylesEnum { return this.getConfig<CodeStylesEnum>("style", CodeStylesEnum["Dart Style"]); }
}

// eslint-disable-next-line @typescript-eslint/naming-convention
export enum CodeStylesEnum { "Dart Style" = 0, "Expanded Style" = 1, "[Not available yet]" = 2 }

export const config = new Config();


export function getAppliedConfig(section: string, key: string, isResourceScoped = true) {
	const dummyDartFile = Uri.parse("untitled:foo.dart");
	// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
	const config = workspace.getConfiguration("", dummyDartFile).get("[dart]") as any;
	const dartValue = config ? config[`${section}.${key}`] : undefined;
	// if it isn't in "[dart]" section search in root.
	return dartValue !== undefined && dartValue !== null
		? dartValue
		: workspace.getConfiguration(section, isResourceScoped ? dummyDartFile : undefined).get(key);
}
