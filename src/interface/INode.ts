import * as vscode from "vscode";

export interface INode {
    id?: number;

    getTreeItem(isPortalTree:boolean): Promise<vscode.TreeItem> | vscode.TreeItem;

    getChildren(treeName?: string): Promise<INode[]> | INode[];
}