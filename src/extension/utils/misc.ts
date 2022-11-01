import { promptToReloadExtension } from "../utils";

let isShowingFormatterError = false;

export function reportFormatterServerTerminatedWithError(duringStartup: boolean = false) {
	if (isShowingFormatterError)
		return;
	isShowingFormatterError = true;
	const message = duringStartup
		? "The Formatter Server could not be started."
		: "The Formatter Server has terminated.";
	// tslint:disable-next-line: no-floating-promises
	promptToReloadExtension(message, undefined, true).then(() => isShowingFormatterError = false);
}
