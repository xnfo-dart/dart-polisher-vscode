import * as vs from "vscode";
import * as path from "path";
import * as fs from "fs";

import { dartFormatterExtensionIdentifier, executableNames, gformatterPath } from "../../shared/constants";
import { isRunningLocally } from "../../shared/vscode/utils";
import { extensionPath, extensionVersion } from "../../shared/vscode/extension_utils";
import { config } from "../../config";
import { Logger } from "../../shared/interfaces";
import { FormatterCapabilities } from "./formatter_das";


export function getFormatterArgs(logger: Logger, formatterCapabilities: FormatterCapabilities) {
	/*const formatterPath = config.formatterPath || (
		dartCapabilities.supportsLanguageServerCommand
			? "language-server"
			: path.join(sdks.dart, formatterSnapshotPath)
	);*/
	//TODO: for now use binaries for each platform.
	// see if we can use dill and get a dart sdk path.
	const formatterPath = config.formatterPath || path.join(extensionPath, gformatterPath)

	// If the ssh host is set, then we are running the formatter on a remote machine, that same formatter
	// might not exist on the local machine.
	if (!config.formatterSshHost && !fs.existsSync(formatterPath)) {
		const msg = "Could not find a Dart Formatter Server at " + formatterPath;
		vs.window.showErrorMessage(msg);
		logger.error(msg);
		throw new Error(msg);
	}

	return buildFormatterArgs(formatterPath, formatterCapabilities);
}

function buildFormatterArgs(formatterPath: string, dartCapabilities: FormatterCapabilities) {
	let formatterArgs = [];

	formatterArgs.push(formatterPath);

	// formatter in server mode,
	formatterArgs.push("listen");

	// Add info about the extension that will be collected for crash reports etc.
	const clientID = isRunningLocally ? "VS-Code" : "VS-Code-Remote";
	formatterArgs.push(`--client-id=${clientID}`);
	formatterArgs.push(`--client-version=${extensionVersion}`);

	// The format server supports a verbose instrumentation log file.
	// TODO: intrumentation log file is already implemented server side.
	//if (config.formatterInstrumentationLogFile)
	//	formatterArgs.push(`--instrumentation-log-file=${config.formatterInstrumentationLogFile}`);

	// Allow arbitrary args to be passed to the analysis server.
	if (config.formatterAdditionalArgs)
		formatterArgs = formatterArgs.concat(config.formatterAdditionalArgs);

	return formatterArgs;
}
