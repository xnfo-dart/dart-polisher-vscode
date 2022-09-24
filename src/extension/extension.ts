/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable curly */

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import internal = require("stream");
import * as vs from "vscode";
import { disposeAll } from "../shared/utils";
import { dartFormatterExtensionIdentifier, dartPlatformName, isWin, IS_RUNNING_LOCALLY_CONTEXT, platformDisplayName } from "../shared/constants";
import { captureLogs, EmittingLogger, logToConsole, RingLog } from "../shared/logging";
import { LoggingCommands } from "./commands/logging";
import { LogCategory } from "../shared/enums";
import { IAmDisposable, Logger } from "../shared/interfaces";
import { FileChangeHandler } from "./formatter/file_change_handler";
import { extensionVersion, isDevExtension } from "../shared/vscode/extension_utils";
import { Context } from "../shared/vscode/workspace";
import { DartFormattingEditProvider } from "./providers/dart_formatting_edit_provider";
import * as util from "./utils";

import { addToLogHeader, clearLogHeader, getExtensionLogPath, getLogHeader } from "./utils/log";
import { FormatServerCommands } from "./commands/formatter";
import { DfsFormatter } from "./formatter/formatter_dfs";
import { config } from "./config";
import { isRunningLocally } from "../shared/vscode/utils";
import { FormatterStatusReporter } from "./formatter/formatter_status_reporter";

let previousSettings: string;

const PROJECT_LOADED = "dart-custom-formatter:anyProjectLoaded";
export const DART_MODE = { language: "dart", scheme: "file" };

let formatter: DfsFormatter;

const loggers: IAmDisposable[] = [];
let ringLogger: IAmDisposable | undefined;
const logger = new EmittingLogger();

// Keep a running in-memory buffer of last 200 log events we can give to the
// user when something crashed even if they don't have disk-logging enabled.
export const ringLog: RingLog = new RingLog(200);

export function activate(context: vs.ExtensionContext, isRestart: boolean = false) {

	// Ring logger is only set up once and presist over silent restarts.
	if (!ringLogger)
		ringLogger = logger.onLog((message) => ringLog.log(message.toLine(500)));

	if (isDevExtension)
		context.subscriptions.push(logToConsole(logger));

	vs.commands.executeCommand("setContext", IS_RUNNING_LOCALLY_CONTEXT, isRunningLocally);
	buildLogHeaders();
	setupLog(getExtensionLogPath(), LogCategory.General);

	const extContext = Context.for(context);

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "Dart C Formatter" is now active!');

	// Set up log files.
	//setupLog(config.formatterServerLogFile, LogCategory.Formatter);

	// Build log headers now we know formatter type.
	buildLogHeaders(logger);

	// Wire up a reload command that will re-initialise everything.
	context.subscriptions.push(vs.commands.registerCommand("_dart-custom-formatter.reloadExtension", async () => {
		logger.info("Performing silent extension reload...");
		await deactivate(true);
		disposeAll(context.subscriptions);
		activate(context, true);
		logger.info("Done!");
	}));

	// Format Server VsCode Commands
	formatter = new DfsFormatter(logger);
	const dasFormatter = formatter;
	const dfsClient = dasFormatter.client;
	context.subscriptions.push(formatter);

	// VsCode Command for the custom formatter service
	const formatCommands = new FormatServerCommands(context, logger);

	const activeFileFilters: vs.DocumentFilter[] = [DART_MODE];
	const formattingEditProvider = new DartFormattingEditProvider(logger, dfsClient, extContext);
	context.subscriptions.push(formattingEditProvider);
	//formattingEditProvider.registerDocumentFormatter(activeFileFilters); // One or the other
	formattingEditProvider.registerDocumentRangeFormatter(activeFileFilters);
	// Only for Dart.
	formattingEditProvider.registerTypingFormatter(DART_MODE, "}", ";");

	if (dfsClient)
		// tslint:disable-next-line: no-unused-expression
		new FormatterStatusReporter(logger, dfsClient);

	// Things to do when we succefully connect to the server.
	const serverConnected = dfsClient.registerForServerConnected((sc) => {
		serverConnected.dispose();
		//vs.workspace.workspaceFolders;

		// Set up a handler to warn the user if they open a Dart file and we
		// never set up the formatter
		const handleOpenFile = (d: vs.TextDocument) => {
			if (d.languageId === "dart" && d.uri.scheme === "file") {
				// TODO (tekert): check then remove this if not necessary
				// vs.window.showWarningMessage("For full Dart language support, please open a folder containing your Dart files instead of individual loose files");
			}
		};
		context.subscriptions.push(vs.workspace.onDidOpenTextDocument((d) => handleOpenFile(d)));
		// Fire for editors already visible at the time this code runs.
		vs.window.visibleTextEditors.forEach((e) => handleOpenFile(e.document));

		// Setup that requires formatter server version/capabilities.
		// TODO (tekert): for future support.
		/*if (dfsClient.capabilities.hasCustomFormatTest) {
		}*/
	});
	// Hook editor changes to send updated contents to formatter server.
	context.subscriptions.push(new FileChangeHandler(dfsClient));

	context.subscriptions.push(new LoggingCommands(logger, context.logUri.fsPath));

	// Handle config changes so we can reanalyze if necessary.
	context.subscriptions.push(vs.workspace.onDidChangeConfiguration(() => handleConfigurationChange()));

	// Turn on all the commands.
	setCommandVisiblity(true);
}

function setupLog(logFile: string | undefined, category: LogCategory) {
	if (logFile)
		loggers.push(captureLogs(logger, logFile, getLogHeader(), config.maxLogLineLength, [category]));
}

function buildLogHeaders(logger?: Logger) {
	clearLogHeader();
	addToLogHeader(() => `!! PLEASE REVIEW THIS LOG FOR SENSITIVE INFORMATION BEFORE SHARING !!`);
	addToLogHeader(() => ``);
	addToLogHeader(() => `Dart Custom Formatter extension: ${extensionVersion}`);
	addToLogHeader(() => ``);
	addToLogHeader(() => `App: ${vs.env.appName}`);
	if (vs.env.remoteName)
		addToLogHeader(() => `Remote: ${vs.env.remoteName}`);
	addToLogHeader(() => `Version: ${vs.version}`);
	addToLogHeader(() => `Platform: ${platformDisplayName}`);
	addToLogHeader(() => ``);
	addToLogHeader(() => `HTTP_PROXY: ${process.env.HTTP_PROXY}`);
	addToLogHeader(() => `NO_PROXY: ${process.env.NO_PROXY}`);

	// Any time the log headers are rebuilt, we should re-log them.
	logger?.info(getLogHeader());
}

function handleConfigurationChange() {

	const newSettings = getSettingsThatRequireRestart();
	const settingsChanged = previousSettings !== newSettings;
	previousSettings = newSettings;

	if (settingsChanged) {
		// Delay the restart slightly.
		// NOTE: not really necessary for a formatting server, but better on the safe side.
		setTimeout(util.promptToReloadExtension, 50);
	}
}

function getSettingsThatRequireRestart() {
	// The return value here is used to detect when any config option changes that requires a project reload.
	// It doesn't matter how these are combined; it just gets called on every config change and compared.
	// Usually these are options that affect the formatter and need a reload, but config options used at
	// activation time will also need to be included.
	return "CONF-"
		//	+ config.sdkPath
		//	+ config.sdkPaths?.length // TODO: or take from dart extension
		+ config.formatterPath
		+ config.formatterInstrumentationLogFile
		+ config.formatterAdditionalArgs
		+ config.extensionLogFile;
}

// this method is called when your extension is deactivated
// export function deactivate() {}
export async function deactivate(isRestart: boolean = false): Promise<void> {
	setCommandVisiblity(false);

	formatter?.dispose();
	if (loggers) {
		await Promise.all(loggers.map((logger) => logger.dispose()));
		loggers.length = 0;
	}
	if (!isRestart) {
		ringLogger?.dispose();
		logger.dispose();
	}

}

function setCommandVisiblity(enable: boolean) {
	vs.commands.executeCommand("setContext", PROJECT_LOADED, enable);
}
