import { promptToReloadExtension } from "../utils";

let isShowingFormatterError = false;

export function reportFormatterServerTerminatedWithError(duringStartup: boolean = false) {
	if (isShowingFormatterError)
		return;
	isShowingFormatterError = true;
	const message = duringStartup
		? "The Polisher format server could not be started."
		: "The Polisher format server has terminated.";
	// tslint:disable-next-line: no-floating-promises
	promptToReloadExtension(message, undefined, true).then(() => isShowingFormatterError = false);
}
