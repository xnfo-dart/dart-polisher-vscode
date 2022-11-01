import * as fs from "fs";
import * as path from "path";
import * as vs from "vscode";

import { formatterServerPath as cformatterServerPath } from "../../shared/constants";
import { Logger } from "../../shared/interfaces";
import { extensionPath, extensionVersion } from "../../shared/vscode/extension_utils";
import { isRunningLocally } from "../../shared/vscode/utils";
import { config } from "../config";


export function getFormatterArgs(logger: Logger) {
	/*const formatterServerPath = config.formatterServerPath || (
		dartCapabilities.supportsLanguageServerCommand
			? "language-server"
			: path.join(sdks.dart, formatterSnapshotPath)
	);*/
	// TODO(tekert): for now use binaries for each platform.
	// see if we can use dill (too big) and get a dart sdk path (from Dart-Code API).
	const formatterServerPath = config.formatterServerPath || path.join(extensionPath, cformatterServerPath);

	// If the ssh host is set, then we are running the formatter on a remote machine, that same formatter
	// might not exist on the local machine.
	if (!config.formatterSshHost && !fs.existsSync(formatterServerPath)) {
		const msg = "Could not find a Dart Formatter Server at " + formatterServerPath;
		vs.window.showErrorMessage(msg);
		logger.error(msg);
		throw new Error(msg);
	}

	return buildFormatterArgs(formatterServerPath);
}

function buildFormatterArgs(formatterServerPath: string) {
	let formatterArgs = [];

	formatterArgs.push(formatterServerPath);

	// formatter in server mode,
	formatterArgs.push("listen");

	// Add info about the extension that will be collected for crash reports etc.
	const clientID = isRunningLocally ? "VS-Code" : "VS-Code-Remote";
	formatterArgs.push(`--client-id=${clientID}`);
	formatterArgs.push(`--client-version=${extensionVersion}`);

	// The format server supports a verbose instrumentation log file.
	if (config.formatterInstrumentationLogFile)
		formatterArgs.push(`--instrumentation-log-file=${config.formatterInstrumentationLogFile}`);

	// Allow arbitrary args to be passed to the analysis server.
	if (config.formatterAdditionalArgs)
		formatterArgs = formatterArgs.concat(config.formatterAdditionalArgs);

	return formatterArgs;
}
