import * as path from "path";
import { Logger } from "../../shared/interfaces";
import { promptToReloadExtension } from "../utils";

let isShowingFormatterError = false;

export function reportCFormatterTerminatedWithError(duringStartup: boolean = false) {
	if (isShowingFormatterError)
		return;
	isShowingFormatterError = true;
	const message = duringStartup
		? "The Dart custom formatter could not be started."
		: "The Dart custom formatter has terminated.";
	// tslint:disable-next-line: no-floating-promises
	promptToReloadExtension(message, undefined, true).then(() => isShowingFormatterError = false);
}
