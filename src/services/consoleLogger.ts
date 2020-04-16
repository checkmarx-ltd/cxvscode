import { Logger } from "@checkmarx/cx-common-js-client";

export class ConsoleLogger implements Logger {
    info(message: string): void {
        console.info(message);
    }

    error(message: string): void {
        console.error(message);
    }

    debug(message: string): void {
        console.debug(message);
    }

    warning(message: string): void {
        console.warn(message);
    }
}