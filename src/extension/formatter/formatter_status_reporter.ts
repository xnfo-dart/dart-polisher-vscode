import { env, version as codeVersion, window } from "vscode";
import { RequestError, ServerErrorNotification } from "../../shared/formatter_server_types";
import { LogCategory } from "../../shared/enums";
import { Logger } from "../../shared/interfaces";
import { extensionVersion } from "../../shared/vscode/extension_utils";
//import { Analytics } from "../analytics";
import { config } from "../config";
import { openLogContents } from "../utils";
import { DfsFormatterClient } from "./formatter_dfs";

const maxErrorReportCount = 3;
const sendFakeErrorAtStartup = false;

let errorCount = 0;

export class FormatterStatusReporter {

	constructor(private readonly logger: Logger, private readonly formatter: DfsFormatterClient) {
		// TODO: Should these go in disposables?
		// If so, do we need to worry about server cleaning them up if it disposes first?
		formatter.registerForServerError((e: ServerErrorNotification) => this.handleServerError(e)); // SERVER_ERROR notification (server.error) from server, caused by exceptions.
		formatter.registerForRequestError((e: RequestError) => this.handleRequestError(e)); // Is notified when a response.error == (RequestError.code == SERVER_ERROR)
		formatter.registerForServerTerminated(() => this.handleServerTerminated()); // Fires when process is terminated

		if (sendFakeErrorAtStartup) {
			setTimeout(() => {
				this.handleServerError(
					{
						isFatal: false,
						message: "This is a fake error for testing the error reporting!",
						stackTrace: new Error().stack || "",
					},
					"testError",
				);
			}, 5000);
		}
	}

	private handleServerTerminated() {
	}

	private handleRequestError(error: RequestError & { method?: string }) {
		// Map this request error to a server error to reuse the shared code.
		this.handleServerError(
			{
				isFatal: false,
				message: error.message,
				stackTrace: error.stackTrace || "",
			},
			error.method,
		);
	}

	private handleServerError(error: ServerErrorNotification, method?: string) {
		// Always log to the console.
		this.logger.error(error.message, LogCategory.Formatter);
		if (error.stackTrace)
			this.logger.error(error.stackTrace, LogCategory.Formatter);

		//TODO (tekert): enable when we have analytics.
		//this.analytics.logError(`Formatter server error${method ? ` (${method})` : ""}`, error.isFatal);

		errorCount++;

		// Offer to report the error.
		if (config.notifyFormatterErrors && errorCount <= maxErrorReportCount) {
			const showLog: string = "Show log";
			window.showErrorMessage(`Exception from the Dart custom formatter server: ${error.message}`, showLog).then((res) => {
				if (res === showLog)
					this.showErrorLog(error, method);
			});
		}
	}

	private showErrorLog(error: ServerErrorNotification, method?: string) {
		// TODO(tekert): enable when we can detect sdk.
		//const sdkVersion = this.workspaceContext.sdks.dartVersion;
		//const flutterSdkVersion = this.workspaceContext.sdks.flutterVersion;

		const formatterArgs = this.formatter.getFormatterLaunchArgs();

		const data = `
${method ? "### Request\n\nServer was responding to request: `" + method + "`\n" : ""}
### Versions

- ${env.appName} v${codeVersion}
- Dart Polisher extension v${extensionVersion}
- Dart Formatter Server / Protocol v${this.formatter.formatterServerVersion} / v${this.formatter.formatterServerProtocol}

### Formatter Info

The formatter server was launched using the arguments:

${formatterArgs.map((a) => `- ${a}`).join("\n")}

### Exception${error.isFatal ? " (fatal)" : ""}

${error.message}

${error.stackTrace.trim()}
`;

		openLogContents("md", data);
	}
}
