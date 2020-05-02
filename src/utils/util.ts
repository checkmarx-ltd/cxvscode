import * as vscode from 'vscode';

export class Utility {

    constructor() {
    }

    public static modeIsEnabled(mode: string): boolean {
        if (mode && mode.trim().toLowerCase().charAt(0) === 'y') {
            return true;
        }
        return false;
    }

    /**
     * Gets user input from a list of options. First option is always selected by default.
     * @param prompt Prompt to display 
     * @param items Array of srtings with options
     * @returns Selected option as String
     */
    public static async showPickString(prompt: string, items: string[]): Promise<string> {
        const options: vscode.QuickPickOptions = {
            placeHolder: prompt,
            canPickMany: false
        };
        return new Promise<string>(async (resolve) => {
            await vscode.window.showQuickPick(items, options).then((pick) => {
                if (pick) {
                    resolve(pick);
                }
            });
        });
    }

    public static async showInputBox(prompt: string, isPassword: boolean, value?: string): Promise<string> {
        const options: vscode.InputBoxOptions = {
            prompt: prompt,
            password: isPassword,
            value: value
        };
        return new Promise<string>(async (resolve) => {
            await vscode.window.showInputBox(options).then((input) => {
                if (input) {
                    resolve(input);
                }
            });
        });
    }
}