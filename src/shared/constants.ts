import * as fs from "fs";

export const formatterExtensionIdentifier = "xnfo.dart-polisher";

export const isCI = !!process.env.CI;
export const isWin = process.platform.startsWith("win");
export const isMac = process.platform === "darwin";
export const isLinux = !isWin && !isMac;
export const isChromeOS = isLinux && fs.existsSync("/dev/.cros_milestone");
export const dartPlatformName = isWin ? "win" : isMac ? "mac" : "linux";
// Used for display (logs, analytics) so Chrome OS is its own.
export const platformDisplayName = isWin ? "win" : isMac ? "mac" : isChromeOS ? "chromeos" : "linux";

export const platformEol = isWin ? "\r\n" : "\n";

export const executableNames = {
	dart: isWin ? "dart.exe" : "dart",
	dartFormatter: isWin ? "dartpolishd-windows.exe" : isMac ? "dartpolishd-mac" : "dartpolishd-linux",
};
export const getExecutableName = (cmd: string) => (executableNames as { [key: string]: string | undefined })[cmd] ?? cmd;
export const dartVMPath = "bin/" + executableNames.dart;
export const formatterPath = "bin/" + executableNames.dartFormatter;

export const stopLoggingAction = "Stop Logging";
export const showLogAction = "Show Log";
export const captureLogsMaxLineLength = 999999999;

export const FORMATTER_IS_CAPTURING_LOGS_CONTEXT = "dart-polisher:isCapturingLogs";
export const IS_RUNNING_LOCALLY_CONTEXT = "dart-polisher:isRunningLocally";
