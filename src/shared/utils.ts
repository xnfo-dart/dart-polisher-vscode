import { IAmDisposable} from "./interfaces";
import * as semver from "semver";

export function disposeAll(disposables: IAmDisposable[]) {
	const toDispose = disposables.slice();
	disposables.length = 0;
	for (const d of toDispose) {
		try {
			d.dispose();
		} catch (e) {
			console.warn(e);
		}
	}
}

export type NullAsUndefined<T> = null extends T ? NonNullable<T> | undefined : T;

export function nullToUndefined<T>(value: T): NullAsUndefined<T> {
	return (value === null ? undefined : value) as NullAsUndefined<T>;
}

export function errorString(error: any): string {
	if (!error)
		return "<empty error>";
	else if (error instanceof Error)
		return error.message + (error.stack ? `\n${error.stack}` : "");
	else if (error.message)
		return error.message;
	else if (typeof error === "string")
		return error;
	else
		return `${error}`;
}

export function versionIsAtLeast(inputVersion: string, requiredVersion: string): boolean {
	return semver.gte(inputVersion, requiredVersion);
}

export class PromiseCompleter<T> {
	public promise: Promise<T>;
	public resolve!: (value: T | PromiseLike<T>) => void;
	public reject!: (error?: any, stackTrace?: string) => void;

	constructor() {
		this.promise = new Promise((res, rej) => {
			this.resolve = res;
			this.reject = rej;
		});
	}
}
