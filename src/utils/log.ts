import * as os from "os";
import * as path from "path";
import { platformEol } from "./../shared/constants";
import { LogCategory } from "./../shared/enums";
import { getRandomInt } from "./../shared/utils/fs";
import { config } from "../config";

let extensionLogPath: string;
export function getExtensionLogPath() {
	extensionLogPath = extensionLogPath || config.extensionLogFile || path.join(process.env.DC_TEST_LOGS || os.tmpdir(), `dart-formatter-startup-log-${getRandomInt(0x1000, 0x10000).toString(16)}.txt`);
	return extensionLogPath;
}
export const userSelectableLogCategories: { [key: string]: LogCategory } = {
	"Formatter": LogCategory.FormatterServer,
	"Command Processes": LogCategory.CommandProcesses,
};
/*
export const formatServerLogCategories = [
	LogCategory.CommandProcesses,
	LogCategory.Formatter,
];

export const extensionsLogCategories = [
	LogCategory.CommandProcesses,
	LogCategory.General,
];
*/
export const debuggingLogCategories = Object.values(userSelectableLogCategories)
	.filter((c) => c !== LogCategory.FormatterServer);

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
