
import * as vs from "vscode";

import { LogCategory } from "../../shared/enums";
import { IAmDisposable, Logger } from "../../shared/interfaces";
import { CategoryLogger } from "../../shared/logging";
import { PromiseCompleter, versionIsAtLeast, disposeAll } from "../../shared/utils";
import { config } from "../config";
import { escapeShell } from "../utils";
import { reportCFormatterTerminatedWithError } from "../utils/misc";
import { getToolEnv } from "../utils/processes";
import { getFormatterArgs } from "./formatter";
import { FormatterGen } from "./formatter_gen";


class FormatterCapabilities {
	public static get empty() { return new FormatterCapabilities("0.0.0"); }

	public version: string;

	constructor(formatterVersion: string) {
		this.version = formatterVersion;
	}

	//NOTE: testing, change name in the future.
	get hasCustomFormatTest() { return versionIsAtLeast(this.version, "0.1.0"); }
}

// Formatter Server Daemon
export class DfsFormatter implements IAmDisposable {
	protected readonly logger : Logger;
	protected disposables: IAmDisposable[] = [];
	public readonly client: DfsFormatterClient;

	constructor(logger: Logger) {
		this.logger = new CategoryLogger(logger, LogCategory.Formatter);

		//let extensionPath = context.extensionPath;
		//TEST: alternative method is: vs.extensions.getExtension(dartFormatterExtensionIdentifier)?.extensionUri.fsPath;
		// or vs.extensions.getExtension(dartFormatterExtensionIdentifier)?.packageJSON['extensionLocation']['_fsPath'];

		// Fires up the format server
		// the logger goes with (LogCategory.Formatter)
		// Extension -> DfsFormatter -> DfsFormatterClient -> FormatterGen -> StdIOService
		this.client = new DfsFormatterClient(this.logger);
		this.disposables.push(this.client);

		//TODO (tekert): delete this, its not needed anymore.
		const connectedEvent = this.client.registerForServerConnected((sc) => {
			//this.onReadyCompleter.resolve();
			connectedEvent.dispose();
		});
	}

	public dispose(): void | Promise<void> {
		disposeAll(this.disposables);
	}

}
// Formatter client
export class DfsFormatterClient extends FormatterGen {
	private launchArgs: string[];
	private version?: string;
	private isFormatting = false;
	private currentFormatCompleter?: PromiseCompleter<void>;
	public capabilities: FormatterCapabilities = FormatterCapabilities.empty;

	constructor(logger: Logger) {
		super(logger, config.maxLogLineLength);

		this.launchArgs = getFormatterArgs(logger);

		// Register for version.
		this.registerForServerConnected((e) => { this.version = e.version; this.capabilities.version = this.version; });

		//const fullDartVmPath = path.join(sdks.dart, dartVMPath);
		//let binaryPath = fullDartVmPath;
		//let processArgs = this.launchArgs.slice();
		//NOTE: for now we are launching the bin directly, without de dartVM, so launchArgs has the full path to the bin + args.
		let binaryPath = this.launchArgs.shift()!;
		let processArgs = this.launchArgs.slice();

		// Since we communicate with the analysis server over STDOUT/STDIN, it is trivial for us
		// to support launching it on a remote machine over SSH. This can be useful if the codebase
		// is being modified remotely over SSHFS.
		//TODO (tekert):  test this
		if (config.formatterSshHost) {
			binaryPath = "ssh";
			//processArgs.unshift(fullDartFormatterPath); //NOTE: enable when using dartvm
			processArgs = [
				// SSH quiet mode, which prevents SSH from interfering with the STDOUT/STDIN communication
				// with the analysis server.
				"-q",
				config.formatterSshHost,
				escapeShell(processArgs),
			];
		}

		this.createProcess(undefined, binaryPath, processArgs, { toolEnv: getToolEnv() });
		this.process?.on("exit", (code, signal) => {
			this.handleFormatterTerminated(!!code);
		});
	}

	private resolvedPromise = Promise.resolve();
	public get currentFormatting(): Promise<void> {
		if (!this.isFormatting)
			return this.resolvedPromise;

		if (!this.currentFormatCompleter)
			this.currentFormatCompleter = new PromiseCompleter<void>();
		return this.currentFormatCompleter.promise;
	}

	protected sendMessage<T>(json: string) {
		try {
			super.sendMessage(json);
		} catch (e) {
			this.handleFormatterTerminated(true);
			throw e;
		}
	}

	private handleFormatterTerminated(withError: boolean) {
		const serverHasStarted = !!this.version;
		if (withError)
			reportCFormatterTerminatedWithError(!serverHasStarted);
		this.notify(this.serverTerminatedSubscriptions, undefined);
	}

	protected shouldHandleMessage(message: string): boolean {
		return (message.startsWith("{") && message.endsWith("}"))
			|| (message.startsWith("[{") && message.endsWith("}]"));
	}
	/*
	private async requestDiagnosticsUpdate() {
		this.lastDiagnostics = undefined;

		if (!this.capabilities.supportsDiagnostics)
			return;

		this.lastDiagnostics = (await this.diagnosticGetDiagnostics()).contexts;
	}
	*/

	public getFormatterLaunchArgs(): string[] {
		return this.launchArgs;
	}

	private serverTerminatedSubscriptions: Array<() => void> = [];
	public registerForServerTerminated(subscriber: () => void): vs.Disposable {
		return this.subscribe(this.serverTerminatedSubscriptions, subscriber);
	}
}
