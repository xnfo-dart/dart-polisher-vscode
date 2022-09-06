import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { commands, Uri, window, workspace, WorkspaceFolder } from "vscode";
import { showLogAction } from "./shared/constants";
import { fsPath, getRandomInt, mkDirRecursive } from "./shared/utils/fs";
import { ringLog } from "./extension";

export async function promptToReloadExtension(prompt?: string, buttonText?: string, offerLog?: boolean): Promise<void> {
	const restartAction = buttonText || "Reload";
	const actions = offerLog ? [restartAction, showLogAction] : [restartAction];
	const ringLogContents = ringLog.toString();
	let showPromptAgain = true;
	const tempLogPath = path.join(os.tmpdir(), `log-${getRandomInt(0x1000, 0x10000).toString(16)}.txt`);
	while (showPromptAgain) {
		showPromptAgain = false;
		const chosenAction = prompt && await window.showInformationMessage(prompt, ...actions);
		if (chosenAction === showLogAction) {
			showPromptAgain = true;
			openLogContents(undefined, ringLogContents, tempLogPath);
		} else if (!prompt || chosenAction === restartAction) {
			commands.executeCommand("_cfdart.reloadExtension");
		}
	}
}

export function openLogContents(logType = `txt`, logContents: string, tempPath?: string) {
	if (!tempPath)
		tempPath = path.join(os.tmpdir(), `log-${getRandomInt(0x1000, 0x10000).toString(16)}.${logType}`);
	fs.writeFileSync(tempPath, logContents);
	workspace.openTextDocument(tempPath).then(window.showTextDocument);
}

export function createFolderForFile(file?: string): string | undefined {
	try {
		if (!file || !path.isAbsolute(file))
			return undefined;

		const folder = path.dirname(file);
		if (!fs.existsSync(folder))
			mkDirRecursive(folder);

		return file;
	} catch {
		console.warn(`Ignoring invalid file path ${file}`);
		return undefined;
	}
}

export function resolvePaths<T extends string | undefined>(p: T): string | (undefined extends T ? undefined : never) {
	if (typeof p !== "string")
		return undefined as (undefined extends T ? undefined : never);

	if (p.startsWith("~/"))
		return path.join(os.homedir(), p.substr(2));
	if (!path.isAbsolute(p) && workspace.workspaceFolders && workspace.workspaceFolders.length)
		return path.join(fsPath(workspace.workspaceFolders[0].uri), p);
	return p;
}

// Escapes a set of command line arguments so that the escaped string is suitable for passing as an argument
// to another shell command.
// Implementation is taken from https://github.com/xxorax/node-shell-escape
export function escapeShell(args: string[]) {
	const ret: string[] = [];
	args.forEach((arg) => {
		if (/[^A-Za-z0-9_\/:=-]/.test(arg)) {
			arg = "'" + arg.replace(/'/g, "'\\''") + "'";
			arg = arg.replace(/^(?:'')+/g, "") // unduplicate single-quote at the beginning
				.replace(/\\'''/g, "\\'"); // remove non-escaped single-quote if there are enclosed between 2 escaped
		}
		ret.push(arg);
	});
	return ret.join(" ");
}
