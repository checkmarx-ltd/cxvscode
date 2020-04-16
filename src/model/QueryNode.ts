import * as vscode from "vscode";
import * as path from "path";
import { INode } from "../interface/INode";
import { SeverityNode } from "./SeverityNode";

export class QueryNode implements INode {

    constructor(public query: any | undefined,
        public parentNode: SeverityNode) {
    }

    public getTreeItem(): vscode.TreeItem {
        return {
            label: this.query?.$.name + " (" + this.query?.Result.length + " found)",
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: "query_node",
            iconPath: {
                "light": this.query?.$.Severity === "High" ?
                    path.join(__filename, "..", "..", "..", "resources", "icons", "light", "error.svg") :
                    (this.query?.$.Severity === "Low" ?
                        path.join(__filename, "..", "..", "..", "resources", "icons", "light", "info.svg") :
                        path.join(__filename, "..", "..", "..", "resources", "icons", "light", "warning.svg")),
                "dark": this.query?.$.Severity === "High" ?
                    path.join(__filename, "..", "..", "..", "resources", "icons", "dark", "error.svg") :
                    (this.query?.$.Severity === "Low" ?
                        path.join(__filename, "..", "..", "..", "resources", "icons", "dark", "info.svg") :
                        path.join(__filename, "..", "..", "..", "resources", "icons", "dark", "warning.svg"))
            }
        };
    }

    public async getChildren(): Promise<INode[]> {
        return [];
    }
}