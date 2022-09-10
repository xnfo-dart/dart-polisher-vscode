import { ConfigurationTarget, Uri, workspace, WorkspaceConfiguration } from "vscode";
import { NullAsUndefined, nullToUndefined } from "./shared/utils";
import { createFolderForFile, resolvePaths } from "./utils";
import { setupToolEnv } from "./utils/processes";

class Config {
	private config: WorkspaceConfiguration;

	constructor() {
		workspace.onDidChangeConfiguration((e) => this.reloadConfig());
		this.config = workspace.getConfiguration("dart-custom-formatter");
		setupToolEnv(this.env);
	}

	private reloadConfig() {
		this.config = workspace.getConfiguration("dart-custom-formatter");
		setupToolEnv(this.env);
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
	get enableCustomFormatter(): boolean { return this.getConfig<boolean>("enableCustomFormatter", true); }
	get formatterSshHost(): undefined | string { return this.getConfig<null | string>("formatterSshHost", null); }
	get formatterPath(): undefined | string { return resolvePaths(this.getConfig<null | string>("formatterPath", null)); }
	get formatterAdditionalArgs(): string[] { return this.getConfig<string[]>("formatterAdditionalArgs", []); }

	// Logging
	get extensionLogFile(): undefined | string { return createFolderForFile(resolvePaths(this.getConfig<null | string>("extensionLogFile", null))); }
	get maxLogLineLength(): number { return this.getConfig<number>("maxLogLineLength", 2000); }


	public for(uri?: Uri): ResourceConfig {
		return new ResourceConfig(uri);
	}
}

export class ResourceConfig {
	public uri?: Uri;
	public config: WorkspaceConfiguration;

	constructor(uri?: Uri) {
		this.uri = uri;
		this.config = workspace.getConfiguration("dart-custom-formatter", this.uri);
	}

	private getConfig<T>(key: string, defaultValue: T): NullAsUndefined<T> {
		return nullToUndefined(this.config.get<T>(key, defaultValue));
	}

	get extensionLogFile(): undefined | string { return createFolderForFile(resolvePaths(this.getConfig<null | string>("extensionLogFile", null))); }

	// Server settings
	get doNotFormat(): string[] { return this.getConfig<string[]>("doNotFormat", []); }

	// Formatter
	get lineLength(): number { return this.getConfig<number>("lineLength", 80); }
}


export const config = new Config();
