import * as vscode from "vscode";
import { INode } from "../interface/INode";
import { Logger } from "@checkmarx/cx-common-js-client";
import { WebViews } from "../services/WebViews";
import { ScanNode } from './ScanNode';

export class CxTreeScans implements vscode.TreeDataProvider<INode> {
    public _onDidChangeTreeData: vscode.EventEmitter<INode> = new vscode.EventEmitter<INode>();
    public readonly onDidChangeTreeData: vscode.Event<INode> = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext, private scanNode: ScanNode, private readonly log: Logger) {
        this.getTreeItem(this.scanNode);
        if (WebViews.webViews) {
            WebViews.webViews.destroyWebViews();
        }
        if (scanNode.queries) {
            WebViews.webViews = new WebViews(context, scanNode, this.log, scanNode.httpClient);
        }
    }

    // Refresh Tree
    public refresh(element?: INode): void {
        try {
            if(element)
            this._onDidChangeTreeData.fire(element);
        } catch (err) {
            this.log.error(err);
            vscode.window.showErrorMessage(err.message);
        }
    }

    // Get Tree Item (Node)
    public getTreeItem(element: INode): Promise<vscode.TreeItem> | vscode.TreeItem {
        return element.getTreeItem();
    }

    public async getChildren(element?: INode): Promise<INode[]> {
        if (!element) {
            return [this.scanNode];
        }
        return element.getChildren("CxTreeScans");
    }
}