import * as os from "os";
import * as path from "path";
import { platformEol } from "./../shared/constants";
import { LogCategory } from "./../shared/enums";
import { getRandomInt } from "./../shared/utils/fs";
import { config } from "../config";

// TODO: change config. log file to extensionLogFile
let extensionLogPath: string;
export function getExtensionLogPath() {
	extensionLogPath = extensionLogPath || config.formatterLogFile || path.join(process.env.DC_TEST_LOGS || os.tmpdir(), `dart-cf-startup-log-${getRandomInt(0x1000, 0x10000).toString(16)}.txt`);
	return extensionLogPath;
}
export const userSelectableLogCategories: { [key: string]: LogCategory } = {
	"General": LogCategory.General,
	"Formatter": LogCategory.Formatter,
	"Command Processes": LogCategory.CommandProcesses,
};

export const analysisServerLogCategories = [
	LogCategory.General,
	LogCategory.CommandProcesses,
];

export const extensionsLogCategories = [
	LogCategory.CommandProcesses,
	LogCategory.General,
	LogCategory.Formatter,
];

export const debuggingLogCategories = Object.values(userSelectableLogCategories)
	.filter((c) => c !== LogCategory.Formatter);

const logHeader: string[] = [];
export function clearLogHeader() {
	logHeader.length = 0;
}
export function getLogHeader() {
	if (!logHeader.length)
		return "";
	return logHeader.join(platformEol) + platformEol + platformEol;
}
export function addToLogHeader(f: () => string) {
	try {
		logHeader.push(f().replace(/\r/g, "").replace(/\n/g, "\r\n"));
	} catch {
		// Don't log here; we may be trying to access things that aren't available yet.
	}
}
