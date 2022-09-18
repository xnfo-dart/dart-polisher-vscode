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

	/// Set of common code styles.
	///  default to 0 = dart_style with unlocked indent sizes.
	///  for more info check [CodeStyle] type.
	codeStyle?: CodeStyle;
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
	/// 1 = expanded_style
	/// 2 = etc
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

//NOTE: pretty straighfoward, except ChangeContentOverlay on the part on ranges.
/**
 * Update the content of one or more files. Files that were
 * previously updated but not included in this update remain
 * unchanged. This effectively represents an overlay of the
 * filesystem. The files whose content is overridden are
 * therefore seen by server as being files with the given
 * content, even if the files do not exist on the filesystem or
 * if the file path represents the path to a directory on the
 * filesystem.
 */
export interface ServerUpdateContentRequest {
	/**
	 * A table mapping the files whose content has changed to a
	 * description of the content change.
	 */
	files: { [key: string]: AddContentOverlay | ChangeContentOverlay | RemoveContentOverlay | undefined; };
}

/**
 * A directive to begin overlaying the contents of a file. The supplied
 * content will be used for file access server-side in place of the file contents in the
 * filesystem.
 *
 * If this directive is used on a file that already has a file content
 * overlay, the old overlay is discarded and replaced with the new one.
 */
export interface AddContentOverlay {
	/**
	 *
	 */
	type: "add";

	/**
	 * The new content of the file.
	 */
	content: string;
}

/**
 * A directive to modify an existing file content overlay. One or more ranges
 * of text are deleted from the old file content overlay and replaced with
 * new text.
 *
 * The edits are applied in the order in which they occur in the list. This
 * means that the offset of each edit must be correct under the assumption
 * that all previous edits have been applied.
 *
 * It is an error to use this overlay on a file that does not yet have a file
 * content overlay or that has had its overlay removed via
 * RemoveContentOverlay.
 *
 * If any of the edits cannot be applied due to its offset or length being
 * out of range, an INVALID_OVERLAY_CHANGE error will be reported.
 */
export interface ChangeContentOverlay {
	/**
	 *
	 */
	type: "change";

	/**
	 * The edits to be applied to the file.
	 */
	edits: SourceEdit[];
}

/**
 * A directive to remove an existing file content overlay. After processing
 * this directive, the file contents will once again be read from the file
 * system.
 *
 * If this directive is used on a file that doesn't currently have a content
 * overlay, it has no effect.
 */
export interface RemoveContentOverlay {
	/**
	 *
	 */
	type: "remove";
}
