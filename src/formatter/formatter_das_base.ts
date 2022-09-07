import * as vs from "vscode";
import * as as from "./formatter_server_types";
import { Logger } from "../shared/interfaces";
import { UnknownNotification, UnknownResponse } from "../shared/services/interfaces";
import { StdIOService } from "../shared/services/stdio_service";


export abstract class FormatServerBase extends StdIOService<UnknownNotification> {
	constructor(logger: Logger, maxLogLineLength: number | undefined) {
		super(logger, maxLogLineLength);
	}

	protected buildRequest<TReq>(id: number, method: string, params?: TReq): { id: string, method: string, params?: TReq } {
		return Object.assign(
			super.buildRequest(id, method, params),
			{ clientRequestTime: Date.now() },
		);
	}

    private serverConnectedSubscriptions: ((notification: as.ServerConnectedNotification) => void)[] = [];
	private serverErrorSubscriptions: ((notification: as.ServerErrorNotification) => void)[] = [];
	private serverStatusSubscriptions: ((notification: as.ServerStatusNotification) => void)[] = [];

    protected async handleNotification(evt: UnknownNotification): Promise<void> {
		switch (evt.event) {
			case "server.connected":
				await this.notify(this.serverConnectedSubscriptions, <as.ServerConnectedNotification>evt.params);
				break;
			case "server.error":
				await this.notify(this.serverErrorSubscriptions, <as.ServerErrorNotification>evt.params);
				break;
			case "server.status":
				await this.notify(this.serverStatusSubscriptions, <as.ServerStatusNotification>evt.params);
				break;
		}
	}

    /**
		Reports that the server is running. This notification is
		issued once after the server has started running but before
		any requests are processed to let the client know that it
		started correctly.
		It is not possible to subscribe to or unsubscribe from this
		notification.
	*/
	registerForServerConnected(subscriber: (notification: as.ServerConnectedNotification) => void): vs.Disposable {
		return this.subscribe(this.serverConnectedSubscriptions, subscriber);
	}

	/**
		Reports that an unexpected error has occurred while
		executing the server. This notification is not used for
		problems with specific requests (which are returned as part
		of the response) but is used for exceptions that occur while
		performing other tasks, such as analysis or preparing
		notifications.
		It is not possible to subscribe to or unsubscribe from this
		notification.
	*/
	registerForServerError(subscriber: (notification: as.ServerErrorNotification) => void): vs.Disposable {
		return this.subscribe(this.serverErrorSubscriptions, subscriber);
	}

	/**
		Reports the current status of the server. Parameters are
		omitted if there has been no change in the status
		represented by that parameter.
		This notification is not subscribed to by default. Clients
		can subscribe by including the value "STATUS" in
		the list of services passed in a server.setSubscriptions
		request.
	*/
	registerForServerStatus(subscriber: (notification: as.ServerStatusNotification) => void): vs.Disposable {
		return this.subscribe(this.serverStatusSubscriptions, subscriber);
	}

	/**
		Format the contents of a single file. The currently selected region of
		text is passed in so that the selection can be preserved across the
		formatting operation. The updated selection will be as close to
		matching the original as possible, but whitespace at the beginning or
		end of the selected region will be ignored. If preserving selection
		information is not required, zero (0) can be specified for both the
		selection offset and selection length.
		If a request is made for a file which does not exist, or which is not
		currently subject to analysis (e.g. because it is not associated with
		any analysis root specified to analysis.setAnalysisRoots), an error of
		type FORMAT_INVALID_FILE will be generated. If the source
		contains syntax errors, an error of type FORMAT_WITH_ERRORS
		will be generated.
	*/
	editFormat(request: as.EditFormatRequest): Promise<as.EditFormatResponse> {
		return this.sendRequest("edit.format", request);
	}

}
