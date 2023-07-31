import * as vscode from "vscode";
import { INode } from "../interface/INode";
import { Logger } from "@checkmarx/cx-common-js-client";

export class EmptyCxTreeScans implements vscode.TreeDataProvider<INode> {
    public _onDidChangeTreeData: vscode.EventEmitter<INode> = new vscode.EventEmitter<INode>();
    public readonly onDidChangeTreeData: vscode.Event<INode> = this._onDidChangeTreeData.event;

    constructor(private context: vscode.ExtensionContext, private readonly log: Logger) {
        this.getTreeItem();
    }

    // Refresh Tree
    public refresh(element?: INode): void {
    }

    // Get Tree Item (Node)
    public getTreeItem(): Promise<vscode.TreeItem> | vscode.TreeItem {
        return {};
    }

    public async getChildren(element?: INode): Promise<INode[]> {
        return [];
    }
}