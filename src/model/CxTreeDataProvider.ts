import * as vscode from "vscode";
import { INode } from "../interface/INode";
import { ServerNode as ServerNodeTreeItem } from "./ServerNode";
import { ScanNode } from './ScanNode';
import { CxSettings, CxServerSettings } from "../services/CxSettings";
import { Logger } from "@checkmarx/cx-common-js-client";
import { ConsoleLogger } from "../services/consoleLogger";
import { CxTreeScans } from './CxTreeScans';
import { WebViews } from "../services/WebViews";
import { QueryNode } from './QueryNode';
import { SSOUriHandler } from '../services/SSOUriHandler';
import { EmptyCxTreeScans } from "./EmptyCxTreeScans";

export class CxTreeDataProvider implements vscode.TreeDataProvider<INode> {
    public _onDidChangeTreeData: vscode.EventEmitter<INode> = new vscode.EventEmitter<INode>();
    public readonly onDidChangeTreeData: vscode.Event<INode> = this._onDidChangeTreeData.event;

    private readonly log: Logger;
    private serverNodes: ServerNodeTreeItem[];
    private vsCodeContext:  vscode.ExtensionContext | any;
    private uriHandler = new SSOUriHandler();

    constructor(checkmarxOutput: vscode.OutputChannel,context: vscode.ExtensionContext) {
        this.log = new ConsoleLogger(checkmarxOutput);
        this.serverNodes = [];
        this.vsCodeContext = context;
        // register urihandler with VS Code. We can only register a single UriHandler for extension.
        context.subscriptions.push(vscode.window.registerUriHandler(this.uriHandler));
    }

    /**
     * TODO: Change to return the currently selected ServerNode, once support for multiple servers is added.
     * 
     * @returns Top ServerNode or undefined if none has been configured
     */
    public getCurrentServerNode(): ServerNodeTreeItem | undefined {
        if (this.serverNodes && this.serverNodes.length > 0) {
            return this.serverNodes[0];
        }
        return undefined;
    }

    // Refresh Tree
    public refresh(element?: INode ): void {
        let treeNode : INode | any;
        treeNode = element;
        try {
            this._onDidChangeTreeData.fire(treeNode);
        } catch (err) {
            this.log.error(err);
            vscode.window.showErrorMessage(err.message);
        }

    }

    // Edit Tree Item (Node)
    public async editTreeItem() {
        try {
            const cxServer = CxSettings.getServer();
            if (this.serverNodes.length > 0) {
               
                if (this.serverNodes[0].sastUrl === cxServer.url) {
                    await CxSettings.configureServer();
               }else{
                
                    await CxSettings.clearBoundProject();
                }
                if (this.serverNodes[0].isLoggedIn()) {
                    this.serverNodes[0].logout();
                }
                this.refresh();
                this.log.info('Server node edited');
                if (!CxSettings.isQuiet()) {
                    vscode.window.showInformationMessage('Server node edited');
                }
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
                await CxSettings.configureServer();
                this.refresh();
                this.log.info('New server node added');
                if (!CxSettings.isQuiet()) {
                    vscode.window.showInformationMessage('New server node added');
                }
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
        return element.getTreeItem(true);
    }

    // Get Children of Item (Nodes)
    public async getChildren(element?: INode): Promise<INode[]> {
        if (!element) {
            const cxServer: CxServerSettings = CxSettings.getServer();
            if (cxServer) {
                this.convertToNode(cxServer);
            }
            this.uriHandler.setServerNode(this.serverNodes[0]);
            return this.serverNodes;
        }
        return element.getChildren("CxTreeDataProvider");
    }

    // Maps Cx Server from settings.json to ServerNode (model)
    private convertToNode(server: CxServerSettings) {
        this.serverNodes = [];
        if (Object.entries(server).length > 0) {
            this.serverNodes.push(new ServerNodeTreeItem(server.url, server.alias, this.log,this.vsCodeContext));
        }
    }

    public async destroyTreeScans(context: vscode.ExtensionContext) {
        const emptyCxTreeDataScans = new EmptyCxTreeScans();
        context.subscriptions.push(vscode.window.registerTreeDataProvider("cxscanswin", emptyCxTreeDataScans));
    }

    public async createTreeScans(context: vscode.ExtensionContext, element: ScanNode) {
        const cxTreeDataScans = new CxTreeScans(context, element, this.log);
        context.subscriptions.push(vscode.window.registerTreeDataProvider("cxscanswin", cxTreeDataScans));
     
        if(element.queries) {
            vscode.commands.executeCommand('setContext', 'showSaveReport', true);
        } else {
            vscode.commands.executeCommand('setContext', 'showSaveReport', false);
        }

        context.subscriptions.push(vscode.commands.registerCommand("cxscanswin.saveReport", async (scanNode: ScanNode) => {
            await scanNode.attachJsonReport();
        }));

        context.subscriptions.push(vscode.commands.registerCommand("cxscanswin.clickQueryNode", (queryNode: QueryNode) => {
            WebViews.webViews.destroyWebViews();
            WebViews.webViews.createWebViews(context);
            WebViews.webViews.queryResultClicked(queryNode.query);
        }));

        context.subscriptions.push(vscode.commands.registerCommand("cxscanswin.clickNodeIfNoVulnarability", (queryNode: QueryNode) => {
            this.log.info("There are no vulnerabilities");
            vscode.window.showInformationMessage("There are no vulnerabilities");
        }));
		
        context.subscriptions.push(vscode.commands.registerCommand("cxscanswin.showQueryDescription", async (queryNode: QueryNode) => {
            await WebViews.webViews.createQueryDescriptionWebView(queryNode.query?.$.id);
        }));
    }
}
