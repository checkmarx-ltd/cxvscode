import * as vscode from "vscode";
import { INode } from "../interface/INode";
import { ServerNode } from "./ServerNode";
import { ScanNode } from './ScanNode'
import { CxSettings } from "../services/CxSettings";
import { Logger } from "@checkmarx/cx-common-js-client";
import { ConsoleLogger } from "../services/consoleLogger";
import { CxTreeScans } from './CxTreeScans'
import { WebViews } from "../services/WebViews"
import { QueryNode } from './QueryNode'

export class CxTreeDataProvider implements vscode.TreeDataProvider<INode> {
    public _onDidChangeTreeData: vscode.EventEmitter<INode> = new vscode.EventEmitter<INode>();
    public readonly onDidChangeTreeData: vscode.Event<INode> = this._onDidChangeTreeData.event;

    private readonly log: Logger = new ConsoleLogger();

    constructor() {
    }

    // Refresh Tree
    public refresh(element?: INode): void {
        try {
            this._onDidChangeTreeData.fire(element);
        } catch (err) {
            this.log.error(err);
            vscode.window.showErrorMessage(err.message);
        }
    }

    // Edit Tree Item (Node)
    public async editTreeItem() {
        try {
            await CxSettings.setServer();
            this.refresh();
            vscode.window.showInformationMessage('Server Node Edited');
        } catch (err) {
            this.log.error(err);
            vscode.window.showErrorMessage(err.message);
        }
    }

    // Get Tree Item (Node)
    public getTreeItem(element: INode): Promise<vscode.TreeItem> | vscode.TreeItem {
        return element.getTreeItem();
    }

    // Get Children of Item (Nodes)
    public async getChildren(element?: INode): Promise<INode[]> {
        if (!element) {
            let cxServer: any = await CxSettings.getServer();
            if (Object.entries(cxServer).length === 0) {
                cxServer = await CxSettings.setServer();
            }
            return this.convertToNode(cxServer);
        }
        return element.getChildren("CxTreeDataProvider");
    }

    // Maps Cx Server from settings.json to ServerNode (model)
    private convertToNode(server: any): INode[] {
        let serverNodes = [];
        try {
            if (Object.entries(server).length > 0) {
                serverNodes.push(new ServerNode(server['url'], server['alias'], server['username'], server['password'], this.log));
            }
        } catch (err) {
            this.log.error(err);
            vscode.window.showErrorMessage(err.message);
        }
        return serverNodes;
    }

    public async createTreeScans(context: vscode.ExtensionContext, element: ScanNode) {
        const cxTreeDataScans = new CxTreeScans(context, element, this.log);
        context.subscriptions.push(vscode.window.registerTreeDataProvider("cxscanswin", cxTreeDataScans));
        context.subscriptions.push(vscode.commands.registerCommand("cxscanswin.saveReport", async (scanNode: ScanNode) => {
            await scanNode.attachJsonReport();
        }));
        context.subscriptions.push(vscode.commands.registerCommand("cxscanswin.seeQueryResults", (queryNode: QueryNode) => {
            WebViews.webViews.queryResultClicked(queryNode.query);
        }));
        context.subscriptions.push(vscode.commands.registerCommand("cxscanswin.showQueryDescription", async (queryNode: QueryNode) => {
            await WebViews.webViews.createQueryDescriptionWebView(queryNode.query?.$.id);
        }));
    }
}
