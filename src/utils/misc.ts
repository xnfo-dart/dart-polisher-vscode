import * as path from "path";
import { Logger } from "../shared/interfaces";
import { promptToReloadExtension } from "../utils";

let isShowingAnalyzerError = false;

export function reportCFormatterTerminatedWithError(duringStartup: boolean = false) {
	if (isShowingAnalyzerError)
		return;
	isShowingAnalyzerError = true;
	const message = duringStartup
		? "The Dart CFormatter could not be started."
		: "The Dart CFormatter has terminated.";
	// tslint:disable-next-line: no-floating-promises
	promptToReloadExtension(message, undefined, true).then(() => isShowingAnalyzerError = false);
}
