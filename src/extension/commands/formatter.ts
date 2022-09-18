import * as vs from "vscode";
import { Logger } from "../../shared/interfaces";

// Must be global, as all classes are created during an extension restart.
let forcedReanalyzeCount = 0;

export class FormatServerCommands {
	constructor(context: vs.ExtensionContext, private readonly logger: Logger) {
		context.subscriptions.push(vs.commands.registerCommand("dart-custom-formatter.restartFormattingServer", async () => {
			forcedReanalyzeCount++;
			if (forcedReanalyzeCount === 10)
				this.showServerRestartPrompt().catch((e) => logger.error(e));
			vs.commands.executeCommand("_dart-custom-formatter.reloadExtension");
		}));
	}

	private async showServerRestartPrompt(): Promise<void> {
		const choice = await vs.window.showInformationMessage("Restarting Dart Custom Formatter Extension");
	}
}
