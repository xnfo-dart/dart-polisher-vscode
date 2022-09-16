
import * as vs from "vscode";

import { LogCategory } from "../../shared/enums";
import { CategoryLogger } from "../../shared/logging";
import { config } from "../config";
import { escapeShell } from "../utils";
import { reportCFormatterTerminatedWithError } from "../utils/misc";
import { getToolEnv } from "../utils/processes";
import { Logger } from "../../shared/interfaces";
import { FormatterGen } from "./formatter_gen";
import { PromiseCompleter, versionIsAtLeast } from "../../shared/utils";
import { getFormatterArgs } from "./formatter";
import { Formatter } from "../../shared/formatter";

export class FormatterCapabilities {
	public static get empty() { return new FormatterCapabilities("0.0.0"); }

	public version: string;

	constructor(formatterVersion: string) {
		this.version = formatterVersion;
	}

	//NOTE: testing, change name in the future.
	get hasCustomFormatTest() { return versionIsAtLeast(this.version, "0.1.0"); }
}

export class DfsFormatter extends Formatter {

	public readonly client: DfsFormatterClient;

	constructor(logger: Logger, context: vs.ExtensionContext) {
		super(new CategoryLogger(logger, LogCategory.FormatterServer));

		//let extensionPath = context.extensionPath;
		//TEST: alternative method is: vs.extensions.getExtension(dartFormatterExtensionIdentifier)?.extensionUri.fsPath;
		// or vs.extensions.getExtension(dartFormatterExtensionIdentifier)?.packageJSON['extensionLocation']['_fsPath'];

		// Fires up the format server
		this.client = new DfsFormatterClient(this.logger);
		this.disposables.push(this.client);

		const connectedEvent = this.client.registerForServerConnected((sc) => {
			this.onReadyCompleter.resolve();
			connectedEvent.dispose();
		});

		// NOTE: no use for a formatter server, maybe for something else?
		/*
		this.client.registerForServerStatus((params) => {
			if (params.format)
				this.onAnalysisStatusChangeEmitter.fire({ isFormatting: params.format.isFormatting });
		});
		*/
	}

}

export class DfsFormatterClient extends FormatterGen {
	private launchArgs: string[];
	private version?: string;
	private isFormatting = false;
	private currentFormatCompleter?: PromiseCompleter<void>;
	public capabilities: FormatterCapabilities = FormatterCapabilities.empty;

	constructor(logger: Logger) {
		super(logger, config.maxLogLineLength);

		this.launchArgs = getFormatterArgs(logger, this.capabilities);

		// Hook error subscriptions so we can try and get diagnostic info if this happens.
		//this.registerForServerError((e) => this.requestDiagnosticsUpdate());
		//this.registerForRequestError((e) => this.requestDiagnosticsUpdate());

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

		/*
		this.registerForServerStatus((n) => {
			if (n.format) {
				if (n.format?.isFormatting) {
					this.isFormatting = true;
				} else {
					this.isFormatting = false;
					if (this.currentFormatCompleter) {
						this.currentFormatCompleter.resolve();
						this.currentFormatCompleter = undefined;
					}
				}
			}
		});

		// tslint:disable-next-line: no-floating-promises
		this.serverSetSubscriptions({
			subscriptions: ["STATUS"],
		});
		*/

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