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

    private readonly log: Logger;
    private serverNodes: ServerNode[];

    constructor() {
        this.log = new ConsoleLogger();
        this.serverNodes = [];
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
            const cxServer = await CxSettings.getServer();
            if (this.serverNodes.length > 0 && this.serverNodes[0].sastUrl === cxServer['url']) {
                await CxSettings.setServer();
                this.refresh();
                vscode.window.showInformationMessage('Server node edited');
            } else if (this.serverNodes.length > 0 && this.serverNodes[0].sastUrl !== cxServer['url']) {
                this.refresh();
                vscode.window.showInformationMessage('Server node edited');
            } else {
                vscode.window.showErrorMessage('Server node cannot be edited. It must be added first.');
            }
        } catch (err) {
            this.log.error(err);
            vscode.window.showErrorMessage(err.message);
        }
    }

    public async addTreeItem() {
        try {
            if (this.serverNodes.length === 0) {
                await CxSettings.setServer();
                this.refresh();
                vscode.window.showInformationMessage('New server node added');
            } else {
                vscode.window.showErrorMessage('Cannot add more than one server node.');
            }
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
            const cxServer = await CxSettings.getServer();
            if (cxServer) {
                this.convertToNode(cxServer);
            }
            return this.serverNodes;
        }
        return element.getChildren("CxTreeDataProvider");
    }

    // Maps Cx Server from settings.json to ServerNode (model)
    private convertToNode(server: any) {
        this.serverNodes = [];
        if (Object.entries(server).length > 0) {
            this.serverNodes.push(new ServerNode(server['url'], server['alias'], this.log));
        }
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
