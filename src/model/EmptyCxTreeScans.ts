import * as vscode from "vscode";
import { INode } from "../interface/INode";

export class EmptyCxTreeScans implements vscode.TreeDataProvider<INode> {

    constructor() {
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