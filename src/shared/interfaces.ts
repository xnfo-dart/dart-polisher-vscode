import * as child_process from "child_process";
import * as stream from "stream";
import { LogCategory, LogSeverity } from "./enums";

export type SpawnedProcess = child_process.ChildProcess & {
	stdin: stream.Writable,
	stdout: stream.Readable,
	stderr: stream.Readable,
};

export interface IAmDisposable {
	dispose(): void | Promise<void>;
}

export interface Logger {
	info(message: string, category?: LogCategory): void;
	warn(message: any, category?: LogCategory): void;
	error(error: any, category?: LogCategory): void;
}

export interface LogMessage {
	readonly message: string;
	readonly severity: LogSeverity;
	readonly category: LogCategory;
	toLine(maxLength: number): string;
}

export interface Location {
	startLine: number;
	startColumn: number;
	length: number;
}
