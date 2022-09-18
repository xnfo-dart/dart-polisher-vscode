import { strict as assert } from "assert";
import * as fs from "fs";
import { tmpdir } from "os";
import * as path from "path";
import * as vs from "vscode";
import { dartFormatterExtensionIdentifier } from "../shared/constants";
import { Logger } from "../shared/interfaces";
import { BufferedLogger } from "../shared/utils";


export const ext = vs.extensions.getExtension(dartFormatterExtensionIdentifier)!;
// eslint-disable-next-line prefer-const
export let logger: Logger = new BufferedLogger();


if (!ext) {
	logger.error("Quitting with error because extension failed to load.");
	process.exit(1);
}
