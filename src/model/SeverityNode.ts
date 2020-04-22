import * as vscode from "vscode";
import * as path from "path";
import { INode } from "../interface/INode";
import { ScanNode } from "./ScanNode";
import { QueryNode } from "./QueryNode";

export class SeverityNode implements INode {

    constructor(public readonly severityName: string, public queries: any[] | undefined, public parentNode: ScanNode) {
    }

    public getTreeItem(): vscode.TreeItem {
        return {
            label: this.severityName,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: "severity_node",
            iconPath: {
                "light": this.severityName === "High" ?
                    path.join(__filename, "..", "..", "..", "resources", "icons", "light", "error.svg") :
                    (this.severityName === "Low" ?
                        path.join(__filename, "..", "..", "..", "resources", "icons", "light", "info.svg") :
                        path.join(__filename, "..", "..", "..", "resources", "icons", "light", "warning.svg")),
                "dark": this.severityName === "High" ?
                    path.join(__filename, "..", "..", "..", "resources", "icons", "dark", "error.svg") :
                    (this.severityName === "Low" ?
                        path.join(__filename, "..", "..", "..", "resources", "icons", "dark", "info.svg") :
                        path.join(__filename, "..", "..", "..", "resources", "icons", "dark", "warning.svg"))
            }
        };
    }

    public async getChildren(): Promise<INode[]> {
        const queryNodes: QueryNode[] = [];
        if (this.queries) {
            this.queries.forEach(query => {
                queryNodes.push(new QueryNode(query, this));
            });
        }
        return queryNodes;
    }
}