/**
 * The absolute, normalized path of a file.
 *
 * If the format of a file path in a request is not valid, e.g. the path is
 * not absolute or is not normalized, then an error of type
 * INVALID_FILE_PATH_FORMAT will be generated.
 */
export type FilePath = string;

/**
 * Format the contents of a single file. The currently selected region of
 * text is passed in so that the selection can be preserved across the
 * formatting operation. The updated selection will be as close to
 * matching the original as possible, but whitespace at the beginning or
 * end of the selected region will be ignored. If preserving selection
 * information is not required, zero (0) can be specified for both the
 * selection offset and selection length.
 *
 * If a request is made for a file which does not exist, or which is not
 * currently subject to analysis (e.g. because it is not associated with
 * any analysis root specified to analysis.setAnalysisRoots), an error of
 * type FORMAT_INVALID_FILE will be generated. If the source
 * contains syntax errors, an error of type FORMAT_WITH_ERRORS
 * will be generated.
 */
export interface EditFormatRequest {
	/**
	 * The file containing the code to be formatted.
	 */
	file: FilePath;

	/**
	 * The offset of the current selection in the file.
	 */
	selectionOffset: number;

	/**
	 * The length of the current selection in the file.
	 */
	selectionLength: number;

	/**
	 * The line length to be used by the formatter.
	 */
	lineLength?: number;

	/**
	 * True if the code to be formatted should be limited
	 * to the selected text
	 */
	selectionOnly?: boolean;

	/// The tab size in spaces to be used by the formatter.
	/// defaults all indents to 4 if not set
	tabSize?: TabSize;

	/// True if the code to be formatted should use spaces for indentations,
	/// false to use tab stops. ignores [spaceIndent] if false. defaults to true
	/// if not set.
	insertSpaces?: boolean;

	/// Set of common code styles using the format "[code]" example: 0 or 1 ..
	/// 100 etc. default to 0 = dart_style with unlocked tab sizes. for more info
	/// check [StyleCode] type.
	styleProfile?: CodeStyle;
}

export class TabSize {
	/// The number of spaces in a block or collection body.
	block: number = 4;

	/// How much wrapped cascade sections indent.
	cascade: number = 4;

	/// The number of spaces in a single level of expression nesting.
	expression: number = 4;

	/// The ":" on a wrapped constructor initialization list.
	constructorInitializer: number = 4;
}

export class CodeStyle {
	/// 0 = dart_style
	/// 1 = Allman [https://en.wikipedia.org/wiki/Indentation_style#Allman_style]
	/// 2 = K&R [https://en.wikipedia.org/wiki/Indentation_style#K&R_style]
	/// 3 = etc
	/// 4 = etc
	code: number = 0;
}

/**
 * A description of a single change to a single file.
 */
export interface SourceEdit {
	/**
	 * The offset of the region to be modified.
	 */
	offset: number;

	/**
	 * The length of the region to be modified.
	 */
	length: number;

	/**
	 * The code that is to replace the specified region in the original code.
	 */
	replacement: string;

	/**
	 * An identifier that uniquely identifies this source edit from other
	 * edits in the same response. This field is omitted unless a containing
	 * structure needs to be able to identify the edit for some reason.
	 *
	 * For example, some refactoring operations can produce edits that might
	 * not be appropriate (referred to as potential edits). Such edits will
	 * have an id so that they can be referenced. Edits in the same response
	 * that do not need to be referenced will not have an id.
	 */
	id?: string;
}

/**
 * Format the contents of a single file. The currently selected region of
 * text is passed in so that the selection can be preserved across the
 * formatting operation. The updated selection will be as close to
 * matching the original as possible, but whitespace at the beginning or
 * end of the selected region will be ignored. If preserving selection
 * information is not required, zero (0) can be specified for both the
 * selection offset and selection length.
 *
 * If a request is made for a file which does not exist, or which is not
 * currently subject to analysis (e.g. because it is not associated with
 * any analysis root specified to analysis.setAnalysisRoots), an error of
 * type FORMAT_INVALID_FILE will be generated. If the source
 * contains syntax errors, an error of type FORMAT_WITH_ERRORS
 * will be generated.
 */
export interface EditFormatResponse {
	/**
	 * The edit(s) to be applied in order to format the code. The list
	 * will be empty if the code was already formatted (there are no
	 * changes).
	 */
	edits: SourceEdit[];

	/**
	 * The offset of the selection after formatting the code.
	 */
	selectionOffset: number;

	/**
	 * The length of the selection after formatting the code.
	 */
	selectionLength: number;
}

/**
 * Reports that the server is running. This notification is
 * issued once after the server has started running but before
 * any requests are processed to let the client know that it
 * started correctly.
 *
 * It is not possible to subscribe to or unsubscribe from this
 * notification.
 */
export interface ServerConnectedNotification {
	/**
	 * The version number of the formatting server.
	 */
	version: string;

	/**
	 * The process id of the formatting server process.
	 */
	pid: number;

	/**
	 * The session id for this session.
	 */
	sessionId?: string;
}

/**
 * Reports that an unexpected error has occurred while
 * executing the server. This notification is not used for
 * problems with specific requests (which are returned as part
 * of the response) but is used for exceptions that occur while
 * performing other tasks, such as analysis or preparing
 * notifications.
 *
 * It is not possible to subscribe to or unsubscribe from this
 * notification.
 */
export interface ServerErrorNotification {
	/**
	 * True if the error is a fatal error, meaning that the
	 * server will shutdown automatically after sending this
	 * notification.
	 */
	isFatal: boolean;

	/**
	 * The error message indicating what kind of error was
	 * encountered.
	 */
	message: string;

	/**
	 * The stack trace associated with the generation of the
	 * error, used for debugging the server.
	 */
	stackTrace: string;
}

/**
 * Reports the current status of the server. Parameters are
 * omitted if there has been no change in the status
 * represented by that parameter.
 *
 * This notification is not subscribed to by default. Clients
 * can subscribe by including the value "STATUS" in
 * the list of services passed in a server.setSubscriptions
 * request.
 */
export interface ServerStatusNotification {
	/**
	 * The current status of format server, including whether
	 * formatting is being performed and if so what is being
	 * formatted.
	 */
	format?: FormatStatus;
}

//TODO: not implemented server side, check then delete.
export interface FormatStatus {
	/**
	 * True if formatting is currently being performed.
	 */
	isFormatting: boolean;

	/**
	 * The name of the current target to format. This field is
	 * omitted if formatting is false.
	 */
	formatTarget?: string;
}
