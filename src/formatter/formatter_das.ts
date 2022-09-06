
import * as vs from "vscode";
import * as path from "path";
import { LogCategory } from "../shared/enums";
import { CategoryLogger } from "../shared/logging";
import { config } from "../config";
import { escapeShell } from "../utils";
import { reportCFormatterTerminatedWithError } from "../utils/misc";
import { getToolEnv } from "../utils/processes";
import { IAmDisposable, Logger } from "../shared/interfaces";
import { FormatServerBase } from "./formatter_das_base";
import { disposeAll, PromiseCompleter, versionIsAtLeast } from "../shared/utils";
import { EventEmitter } from "../shared/events";
import { resolvedPromise } from "../shared/utils/promises";
import { dartFormatterExtensionIdentifier, executableNames } from "../shared/constants";

export class DasFormatter implements IAmDisposable {
    protected disposables: IAmDisposable[] = [];
	public readonly client: DasFormatterClient;
    protected readonly logger: Logger;

    protected readonly onReadyCompleter = new PromiseCompleter<void>();
    public readonly onReady = this.onReadyCompleter.promise;

    private onAnalysisCompleteCompleter = new PromiseCompleter<void>();
	// InitialAnalysis uses the very first promise from onAnalysisCompleteCompleter.
	public readonly onInitialAnalysis = this.onAnalysisCompleteCompleter.promise;

    protected readonly onAnalysisStatusChangeEmitter = new EventEmitter<AnalyzingEvent>();
    public readonly onAnalysisStatusChange = this.onAnalysisStatusChangeEmitter.event;
	private isFormatting = false;

	constructor(logger: Logger, context: vs.ExtensionContext) {
        this.disposables.push(this.onAnalysisStatusChangeEmitter);
        this.setup();

        this.logger = new CategoryLogger(logger, LogCategory.Formatter);

		let extensionPath = context.extensionPath;

        // Fires up the format server
		this.client = new DasFormatterClient(this.logger, extensionPath);
		this.disposables.push(this.client);

        //TODO: ver de implementar estos 2 mensages en el server
		const connectedEvent = this.client.registerForServerConnected((sc) => {
			this.onReadyCompleter.resolve();
			connectedEvent.dispose();
		});

		this.client.registerForServerStatus((params) => {
			if (params.format)
				this.onAnalysisStatusChangeEmitter.fire({ isFormatting: params.format.isFormatting });
		});
	}

    private async setup(): Promise<void> {
		await this.onReady;
		this.onAnalysisStatusChange.listen((status) => {
			this.isFormatting = status.isFormatting;
			if (!status.isFormatting) {
				this.onAnalysisCompleteCompleter.resolve();
				this.onAnalysisCompleteCompleter = new PromiseCompleter<void>();
			}
		});
	}

    public dispose(): void | Promise<void> {
		disposeAll(this.disposables);
	}
}

export interface AnalyzingEvent {
	isFormatting: boolean;
	suppressProgress?: boolean;
}

export class FormatterCapabilities {
	public static get empty() { return new FormatterCapabilities("0.0.0"); }

	public version: string;

	constructor(analyzerVersion: string) {
		this.version = analyzerVersion;
	}

    get hasCustomFormat1() { return versionIsAtLeast(this.version, "0.1.2"); }
}

export class DasFormatterClient extends FormatServerBase {
	private launchArgs: string[];
	private version?: string;
	private isFormatting = false;
	private currentFormatCompleter?: PromiseCompleter<void>;
    public capabilities: FormatterCapabilities = FormatterCapabilities.empty;

    //TODO: ver como resolver el tema del binario, exe al lado de la extension o tratar de mirar sdk?
    constructor(logger: Logger, extensionPath : string) {
		super(logger, config.maxLogLineLength);

        this.launchArgs = ["format", "-l", "80", "-o", "show"];

        // Hook error subscriptions so we can try and get diagnostic info if this happens.
		//this.registerForServerError((e) => this.requestDiagnosticsUpdate());
        //this.registerForRequestError((e) => this.requestDiagnosticsUpdate());

		// Register for version.
		this.registerForServerConnected((e) => { this.version = e.version; this.capabilities.version = this.version; });

        //TODO: revisar esto
		// another form is vs.extensions.getExtension(dartFormatterExtensionIdentifier)?.extensionUri.fsPath;
        let formatter_bin_path = config.formatterPath;
        if (!formatter_bin_path) {
            if (!extensionPath)
                extensionPath = "./";

            formatter_bin_path = path.join(extensionPath, executableNames.cformatter);
        }
		const fullDartFormatterPath = formatter_bin_path;

		let binaryPath = fullDartFormatterPath;
		let processArgs = this.launchArgs.slice();

		// Since we communicate with the analysis server over STDOUT/STDIN, it is trivial for us
		// to support launching it on a remote machine over SSH. This can be useful if the codebase
		// is being modified remotely over SSHFS, and running the analysis server locally would
		// result in excessive file reading over SSHFS.
        //TODO: (tekert) ver bien esto
		if (config.formatterSshHost) {
			binaryPath = "ssh";
			processArgs.unshift(fullDartFormatterPath);
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
