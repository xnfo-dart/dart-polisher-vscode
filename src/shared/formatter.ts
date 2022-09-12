import { EventEmitter } from "./events";
import { IAmDisposable, Logger } from "./interfaces";
import { disposeAll, PromiseCompleter } from "./utils";
import { resolvedPromise } from "./utils/promises";

export abstract class Formatter implements IAmDisposable {
	protected disposables: IAmDisposable[] = [];

	protected readonly onReadyCompleter = new PromiseCompleter<void>();
	public readonly onReady = this.onReadyCompleter.promise;

	private onAnalysisCompleteCompleter = new PromiseCompleter<void>();
	// InitialAnalysis uses the very first promise from onAnalysisCompleteCompleter.
	public readonly onInitialAnalysis = this.onAnalysisCompleteCompleter.promise;

	protected readonly onAnalysisStatusChangeEmitter = new EventEmitter<AnalyzingEvent>();
	public readonly onAnalysisStatusChange = this.onAnalysisStatusChangeEmitter.event;
	private isFormatting = false;

	constructor(protected readonly logger: Logger) {
		this.disposables.push(this.onAnalysisStatusChangeEmitter);
		// tslint:disable-next-line: no-floating-promises
		this.setup();
	}

	//TODO: these commands are for status events wich are not enabled on the formatter server
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
