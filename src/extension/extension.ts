/* eslint-disable @typescript-eslint/restrict-plus-operands */
/* eslint-disable curly */

// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
//import internal = require("stream");
import * as vs from "vscode";
import { IS_RUNNING_LOCALLY_CONTEXT, platformDisplayName } from "../shared/constants";
import { LogCategory } from "../shared/enums";
import { IAmDisposable, Logger } from "../shared/interfaces";
import { captureLogs, EmittingLogger, logToConsole, RingLog } from "../shared/logging";
import { disposeAll } from "../shared/utils";
import { extensionVersion, isDevExtension } from "../shared/vscode/extension_utils";
import { Context } from "../shared/vscode/workspace";
import { LoggingCommands } from "./commands/logging";
import { FileChangeHandler } from "./formatter/file_change_handler";
import { DartFormattingEditProvider } from "./providers/dart_formatting_edit_provider";
import * as util from "./utils";

import { isRunningLocally } from "../shared/vscode/utils";
import { FormatServerCommands } from "./commands/formatter";
import { config } from "./config";
import { DfsFormatter } from "./formatter/formatter_dfs";
import { FormatterStatusReporter } from "./formatter/formatter_status_reporter";
import { addToLogHeader, clearLogHeader, getExtensionLogPath, getLogHeader } from "./utils/log";

let previousSettings: string;

const PROJECT_LOADED = "dart-polisher:anyProjectLoaded";
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

	// Can be used in 'when' clause of package.json (not used for now)
	vs.commands.executeCommand("setContext", IS_RUNNING_LOCALLY_CONTEXT, isRunningLocally);

	buildLogHeaders();
	// Captures General log mesages to a file. (use commands for quick logging)
	setupLog(getExtensionLogPath(), [LogCategory.General]);

	const extContext = Context.for(context);

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('"Dart Polisher" extension is now active!');

	// Set up log files. (redirect category logs to these files)
	setupLog(config.polisherLogFile, [LogCategory.Formatter]);

	// Build log headers now we know formatter type.
	//buildLogHeaders(logger);

	// Wire up a reload command that will re-initialise everything.
	context.subscriptions.push(vs.commands.registerCommand("_dart-polisher.reloadExtension", async () => {
		logger.info("Performing silent extension reload...");
		await deactivate(true);
		disposeAll(context.subscriptions);
		activate(context, true);
		logger.info("Done!");
	}));

	// Format Server VsCode Commands
	formatter = new DfsFormatter(logger);
	const dfsFormatter = formatter;
	const dfsClient = dfsFormatter.client;
	context.subscriptions.push(formatter);

	formatter.client.onReady.then(() => {
		// Log and register version returned from server.
		logger.info(`[CONNECTED] Server responded with:`);
		logger.info(`Server version: ${formatter.client.formatterServerVersion}`);
		logger.info(`Protocol version: ${formatter.client.formatterServerProtocol}`);
	});

	// VsCode Command for the formatter service
	const formatCommands = new FormatServerCommands(context, logger);

	// Setup formatting providers.
	const activeFileFilters: vs.DocumentFilter[] = [DART_MODE];
	const formattingEditProvider = new DartFormattingEditProvider(logger, dfsClient, extContext);
	context.subscriptions.push(formattingEditProvider);
	//formattingEditProvider.registerDocumentFormatter(activeFileFilters); // Range already provides this.
	formattingEditProvider.registerDocumentRangeFormatter(activeFileFilters);
	formattingEditProvider.registerTypingFormatter(activeFileFilters, "}", ";");

	// Report to the user exceptions and errors from server.
	if (dfsClient)
		new FormatterStatusReporter(logger, dfsClient);
	else
		logger.error("Dart Formatter client start error");

	// Things to do when we succefully connect to the server, in case we need the context.
	const serverConnected = dfsClient.registerForServerConnected((sc) => {
		serverConnected.dispose();
		//vs.workspace.workspaceFolders;

		// Set up a handler for opened files.
		const handleOpenFile = (d: vs.TextDocument) => {
			if (d.languageId === "dart" && d.uri.scheme === "file") {
				// TODO(tekert): check then remove this if not necessary
				// vs.window.showWarningMessage("");
			}
		};
		context.subscriptions.push(vs.workspace.onDidOpenTextDocument((d) => handleOpenFile(d)));
		// Fire for editors already visible at the time this code runs.
		vs.window.visibleTextEditors.forEach((e) => handleOpenFile(e.document));

		// Setup that requires formatter server version/capabilities.
		// TODO(tekert): for future support.
		/*if (dfsClient.capabilities.hasCustomFormatTest) {
		}*/
	});

	// Important: Watch editor changes to send updated contents,
	// sends incremental changes for "format" to work on unsaved files (server uses an overlay).
	context.subscriptions.push(new FileChangeHandler(dfsClient));

	// For debugging and error reporting. (logs selectable categories on vscode temp dir and shows it after)
	context.subscriptions.push(new LoggingCommands(logger, context.logUri.fsPath));

	// Handle config changes so we can act if necessary.
	context.subscriptions.push(vs.workspace.onDidChangeConfiguration(() => handleConfigurationChange()));

	// Turn on all the commands.
	setCommandVisiblity(true);

	logger.info("Dart Polisher Extension finished loading.");
	// TODO(tekert): return API for other extensions.
}

function setupLog(logFile: string | undefined, category: LogCategory[]) {
	if (logFile)
		loggers.push(captureLogs(logger, logFile, getLogHeader(), config.maxLogLineLength, category));
}

function buildLogHeaders(logger?: Logger) {
	clearLogHeader();
	addToLogHeader(() => `!! PLEASE REVIEW THIS LOG FOR SENSITIVE INFORMATION BEFORE SHARING !!`);
	addToLogHeader(() => ``);
	addToLogHeader(() => `Dart Formatter extension: ${extensionVersion}`);
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
		//	+ config.sdkPaths?.length // TODO(tekert): or take from dart extension (if we use dills)
		+ config.formatterServerPath
		+ config.formatterInstrumentationLogFile
		+ config.formatterAdditionalArgs
		+ config.extensionLogFile
		+ config.polisherLogFile;
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
