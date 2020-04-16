import * as vscode from 'vscode';
import { Utility } from "../utils/util";

export class CxSettings {
    constructor() {
    }

    // Sets Cx Server saved on settings.json
    public static async setServer(): Promise<any> {
        let cxServer: any = {};
        let url: string | undefined = await Utility.showInputBox("Enter Cx Server URL", false);

        if (!url.startsWith("http") && !url.startsWith("https")) {
            vscode.window.showErrorMessage(`Invalid URL: ${url}, URL should starts with http or https.`);
            url = await Utility.showInputBox("Enter Cx Server URL", false);
        }

        const alias: string | undefined = await Utility.showInputBox("Enter Cx Server Alias", false);
        const userName: string | undefined = await Utility.showInputBox("Enter Cx Username", false);
        const password: string | undefined = await Utility.showInputBox("Enter Cx Password", true);
        cxServer = { "url": url, "alias": alias, "username": userName, "password": password };
        await vscode.workspace.getConfiguration().update("cx.server", cxServer);
        return cxServer;
    }

    // Returns Cx Server saved on settings.json
    public static async getServer(): Promise<any> {
        const serverNode: any = await vscode.workspace.getConfiguration().get("cx.server");
        return serverNode;
    }
}