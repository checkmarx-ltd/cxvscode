import * as vscode from 'vscode';

export class Utility {

    constructor() {
    }

    public static modeIsEnabled(mode: string): boolean {
        if (mode && mode.trim().toLowerCase() === "y") {
            return true;
        }
        return false;
    }

    public static async showInputBox(prompt: string, isPass: boolean, validate?: (value: string) => Promise<string | undefined>) {
        return await new Promise<string>((resolve, reject) => {
            const input = vscode.window.createInputBox();
            input.prompt = prompt;
            input.password = isPass;
            input.onDidAccept(async () => {
                const value = input.value;
                resolve(value);
            });
            input.show();
        });
    }
}