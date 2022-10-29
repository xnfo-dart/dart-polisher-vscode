
export type NullAsUndefined<T> = null extends T ? NonNullable<T> | undefined : T;

export function nullToUndefined<T>(value: T): NullAsUndefined<T> {
	return (value === null ? undefined : value) as NullAsUndefined<T>;
}

interface ErrorWithMessage {
	message: string
}

export function isError(error: unknown): error is Error {
	return (
		typeof error === "object" &&
		error !== null &&
		"name" in error &&
		"message" in error &&
		"stack" in error &&
		typeof (error as Record<string, unknown>).name === "string" &&
		typeof (error as Record<string, unknown>).message === "string"
	);
}

export function isErrorWithMessage(error: unknown): error is ErrorWithMessage {
	return (
		typeof error === "object" &&
		error !== null &&
		"message" in error &&
		typeof (error as Record<string, unknown>).message === "string"
	);
}

export function toErrorWithMessage(maybeError: unknown): ErrorWithMessage {
	if (isErrorWithMessage(maybeError)) return maybeError;

	try {
		return new Error(JSON.stringify(maybeError));
	} catch {
		// fallback in case there's an error stringifying the maybeError
		// like with circular references for example.
		return new Error(String(maybeError));
	}
}

export function getErrorMessage(error: unknown) {
	return toErrorWithMessage(error).message;
}
