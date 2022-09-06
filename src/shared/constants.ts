import * as fs from "fs";

export const dartFormatterExtensionIdentifier = "Xnfo.dart-custom-formatter";

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
	dartdoc: isWin ? "dartdoc.bat" : "dartdoc",
	pub: isWin ? "pub.bat" : "pub",
	cformatter: isWin ? "cformat.exe" : "cformat",
};
export const getExecutableName = (cmd: string) => (executableNames as { [key: string]: string | undefined })[cmd] ?? cmd;
export const dartVMPath = "bin/" + executableNames.dart;
export const dartDocPath = "bin/" + executableNames.dartdoc;
export const pubPath = "bin/" + executableNames.pub;
export const pubSnapshotPath = "bin/snapshots/pub.dart.snapshot";
export const analyzerSnapshotPath = "bin/snapshots/analysis_server.dart.snapshot";

export const stopLoggingAction = "Stop Logging";
export const showLogAction = "Show Log";
