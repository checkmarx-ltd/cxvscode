import * as vscode from 'vscode';
import { Utility } from "../utils/util";

export class CxSettings {
    constructor() {
    }

    // Sets Cx Server saved on settings.json
    public static async setServer() {
        let cxServer: any = {};
        let url: string = await Utility.showInputBox("Enter Cx Server URL", false);

        while (!url.startsWith("http://") && !url.startsWith("https://")) {
            vscode.window.showErrorMessage(`Invalid URL [${url}]. URL should starts with 'http://' or 'https://'`);
            url = await Utility.showInputBox("Enter Cx Server URL", false);
        }

        const alias: string = await Utility.showInputBox("Enter Cx Server Alias", false);
        cxServer = { "url": url, "alias": alias };
        await vscode.workspace.getConfiguration().update("cx.server", cxServer);
    }

    // Returns Cx Server saved on settings.json
    public static async getServer(): Promise<any> {
        const serverNode: any = await vscode.workspace.getConfiguration().get("cx.server");
        return serverNode;
    }
}