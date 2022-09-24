import * as path from "path";
import * as vs from "vscode";
import { FORMATTER_IS_CAPTURING_LOGS_CONTEXT } from "../../shared/constants";
import { LogCategory } from "../../shared/enums";
import { captureLogs, EmittingLogger } from "../../shared/logging";
import { PromiseCompleter } from "../../shared/utils";
import { forceWindowsDriveLetterToUppercase, fsPath } from "../../shared/utils/fs";
import { config } from "../config";
import { createFolderForFile } from "../utils";
import { /*formatServerLogCategories, extensionsLogCategories,*/ getExtensionLogPath, getLogHeader, userSelectableLogCategories } from "../utils/log";

export let isLogging = false;

export class LoggingCommands implements vs.Disposable {
	private disposables: vs.Disposable[] = [];
	private currentLogCompleter: PromiseCompleter<void> | undefined;

	constructor(private readonly logger: EmittingLogger, private extensionLogPath: string) {
		this.disposables.push(
			vs.commands.registerCommand("dart-formatter.startLogging", this.startLoggingViaPicker, this),
			//	vs.commands.registerCommand("dart-formatter.startLoggingFormatServer", this.startLoggingFormatServer, this),
			//	vs.commands.registerCommand("dart-formatter.startLoggingExtensionOnly", this.startLoggingExtensionOnly, this),
			vs.commands.registerCommand("dart-formatter.openExtensionLog", this.openExtensionLog, this),
			vs.commands.registerCommand("dart-formatter.stopLogging", this.stopLogging, this),
		);
	}

	private async startLoggingViaPicker(): Promise<string | undefined> {
		const selectedLogCategories = await vs.window.showQuickPick(
			Object.keys(userSelectableLogCategories).map((k) => ({
				label: k,
				logCategory: userSelectableLogCategories[k],
				picked: true,
			})),
			{
				canPickMany: true,
				placeHolder: "Select which categories to include in the log",
			},
		);
		if (!selectedLogCategories || !selectedLogCategories.length)
			return;

		return this.startLogging(selectedLogCategories.map((s) => s.logCategory));
	}
	/*
	private async startLoggingFormatServer(): Promise<string | undefined> {
		return this.startLogging(formatServerLogCategories);
	}

	private async startLoggingExtensionOnly(): Promise<string | undefined> {
		return this.startLogging(extensionsLogCategories);
	}
	*/
	private async startLogging(categoriesToLog: LogCategory[]): Promise<string | undefined> {
		const logFilename = path.join(forceWindowsDriveLetterToUppercase(this.extensionLogPath), this.generateFilename());
		const logUri = vs.Uri.file(logFilename);
		createFolderForFile(logFilename);

		const allLoggedCategories = [LogCategory.General].concat(categoriesToLog);

		const logger = captureLogs(this.logger, fsPath(logUri), getLogHeader(), config.maxLogLineLength, allLoggedCategories);
		isLogging = true;
		this.disposables.push(logger);
		vs.commands.executeCommand("setContext", FORMATTER_IS_CAPTURING_LOGS_CONTEXT, true);
		const completer = new PromiseCompleter<void>();
		this.currentLogCompleter = completer;

		await vs.window.withProgress(
			{
				cancellable: true,
				location: vs.ProgressLocation.Notification,
				title: `Dart Formatter logs are being captured. Reproduce your issue then click Cancel.`,
			},
			(_, token) => {
				token.onCancellationRequested(() => completer.resolve());
				return completer.promise;
			},
		);

		isLogging = false;
		await logger.dispose();

		const doc = await vs.workspace.openTextDocument(logUri);
		await vs.window.showTextDocument(doc);

		return logFilename;
	}

	private async openExtensionLog(): Promise<void> {
		const doc = await vs.workspace.openTextDocument(vs.Uri.file(getExtensionLogPath()));
		await vs.window.showTextDocument(doc);
	}

	private async stopLogging(): Promise<void> {
		if (this.currentLogCompleter)
			this.currentLogCompleter.resolve();
	}

	private generateFilename(): string {
		const pad = (s: string | number) => `0${s.toString()}`.slice(-2);
		const now = new Date();
		const formattedDate = `${now.getFullYear()}-${pad(now.getMonth())}-${pad(now.getDay())} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
		return `Dart-Formatter-Log-${formattedDate}.txt`;
	}

	public dispose(): any {
		for (const command of this.disposables)
			command.dispose();
	}
}
