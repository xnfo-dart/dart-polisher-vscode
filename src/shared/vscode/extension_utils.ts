import * as fs from "fs";
import * as path from "path";
import { extensions, MarkdownString, Uri } from "vscode";
import { dartFormatterExtensionIdentifier } from "../constants";
//import * as dartdoc from "../utils/dartdocs";

export const extensionPath = extensions.getExtension(dartFormatterExtensionIdentifier)!.extensionPath;
export const extensionVersion = getExtensionVersion();
export const vsCodeVersionConstraint = getVsCodeVersionConstraint();
export const isPreReleaseExtension = checkIsPreReleaseExtension();
export const isDevExtension = checkIsDevExtension();

export function readJson(file: string): any {
	return JSON.parse(fs.readFileSync(file).toString());
}

function getExtensionVersion(): string {
	const packageJson = readJson(path.join(extensionPath, "package.json"));
	return packageJson.version;
}

function getVsCodeVersionConstraint(): string {
	const packageJson = readJson(path.join(extensionPath, "package.json"));
	return packageJson.engines.vscode;
}

function checkIsDevExtension() {
	return extensionVersion.endsWith("-dev");
}

function checkIsPreReleaseExtension() {
	const segments = extensionVersion.split(".");
	const minSegment = parseInt(segments[1]);
	return minSegment % 2 === 1;
}


export function createMarkdownString(doc: string) {
	const md = new MarkdownString(doc);
	md.supportHtml = true;
	return md;
}
