import * as vscode from "vscode";
import { INode } from "../interface/INode";
import { ScanNode } from "./ScanNode";
import { QueryNode } from "./QueryNode";
import { Utility } from "../utils/util";

export class SeverityNode implements INode {

    constructor(public readonly severityName: string, public queries: any[] | undefined, public parentNode: ScanNode) {
    }

    public getTreeItem(isPortalTree :boolean): vscode.TreeItem {
            return {
            label: this.severityName,
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: "severity_node",
            iconPath: {
                "light": Utility.getIconPerSeverity(this.severityName, "light"),
                "dark": Utility.getIconPerSeverity(this.severityName, "dark")
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