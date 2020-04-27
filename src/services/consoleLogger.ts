import * as vscode from "vscode";
import { Logger } from "@checkmarx/cx-common-js-client";

export class ConsoleLogger implements Logger {

    constructor(private readonly checkmarxOutput: vscode.OutputChannel) {
    }

    info(message: string): void {
        console.info(message);
        this.checkmarxOutput.appendLine(message);
    }

    error(message: string): void {
        console.error(message);
        this.checkmarxOutput.appendLine(message);
    }

    debug(message: string): void {
        console.debug(message);
        this.checkmarxOutput.appendLine(message);
    }

    warning(message: string): void {
        console.warn(message);
        this.checkmarxOutput.appendLine(message);
    }
}