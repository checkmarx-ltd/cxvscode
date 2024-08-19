import * as vscode from 'vscode';
import * as path from "path";

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

    public static encryptPassword(key: string, password: string): string {
        const aes256 = require('aes256');
        const encryptedPass = aes256.encrypt(key, password);
        return encryptedPass;
    }

    public static decryptPassword(key: string, encryptedPass: string): string {
        const aes256 = require('aes256');
        const decryptedPass = aes256.decrypt(key, encryptedPass);
        return decryptedPass;
    }

    public static getIconPerSeverity(severity: string, colorTheme: string): string {
        let iconPath: string = "";
        switch (severity) {
            case "Critical":
                iconPath = path.join(__filename, "..", "..", "..", "resources", "icons", colorTheme, "Critical.png");
                break;
            case "High":
                iconPath = path.join(__filename, "..", "..", "..", "resources", "icons", colorTheme, "High.png");
                break;
            case "Medium":
                iconPath = path.join(__filename, "..", "..", "..", "resources", "icons", colorTheme, "Medium.png");
                break;
            case "Low":
                iconPath = path.join(__filename, "..", "..", "..", "resources", "icons", colorTheme, "Low.png");
                break;
            case "Information":
                iconPath = path.join(__filename, "..", "..", "..", "resources", "icons", colorTheme, "Information.png");
                break;
        }
        return iconPath;
    }
}