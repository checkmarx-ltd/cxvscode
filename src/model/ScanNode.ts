import * as vscode from "vscode";
import * as path from "path";
import { INode } from "../interface/INode";
import { ServerNode } from './ServerNode';
import { HttpClient } from "@checkmarx/cx-common-js-client";
import { CxSettings, CxServerSettings } from "../services/CxSettings";
import { ScanResults } from "@checkmarx/cx-common-js-client";
import { Logger } from "@checkmarx/cx-common-js-client";
import { ReportingClient } from "@checkmarx/cx-common-js-client";
import { Utility } from "../utils/util";
import { LoginChecks } from '../services/loginChecks';
import { SeverityNode } from './SeverityNode';
import * as fs from "fs";
import * as url from "url";

export class ScanNode implements INode {

    private scanResult: ScanResults;
    public queries: any[] | undefined;

    constructor(public scanId: number, public projectId: number,
        public readonly sourceLocation: string, public readonly isFolder: boolean,
        public readonly httpClient: HttpClient, private readonly log: Logger,
        public parentNode: ServerNode, public readonly isScannedByVSC: boolean,private readonly loginChecks:LoginChecks) {
        this.scanResult = new ScanResults();
        if (parentNode.config) {
            this.scanResult.updateSastDefaultResults(parentNode.config.sastConfig);
        } else {
            this.scanResult.url = parentNode.sastUrl;
            this.scanResult.enablePolicyViolations = false;
            this.scanResult.thresholdEnabled = false;
        }
    }

    private chooseLabelName(): string {
        let result: string = this.sourceLocation;
        const workspace: string | any = this.parentNode.workspaceFolder?.fsPath;
        if (result.includes(workspace)) {
            result = result.replace(workspace, '');
            if (result.length === 0) {
                result = "Workspace";
            }
            if (result.startsWith(path.sep)) {
                result = result.replace(path.sep, '');
            }
        }
        return result;
    }

    public getTreeItem(): vscode.TreeItem {
        return {
            label: this.chooseLabelName(),
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: "scan_node",
            iconPath: {
                "light": path.join(__filename, "..", "..", "..", "resources", "icons", "light", "open-preview.svg"),
                "dark": path.join(__filename, "..", "..", "..", "resources", "icons", "dark", "open-preview.svg")
            }
        };
    }

    private static getExistingNodeBySeverity(severity: string, severityNodes: SeverityNode[]): SeverityNode {
        let curNode: SeverityNode | any;
        for (const node of severityNodes) {
            if (node.severityName === severity) {
                curNode = node;
                break;
            }
        }
        return curNode;
    }

    public async getChildren(treeName?: string): Promise<INode[]> {
        const severityNodes: SeverityNode[] = [];
        try {
            if (treeName === "CxTreeScans") {
                (this.queries || []).forEach(query => {
                    let node = ScanNode.getExistingNodeBySeverity(query.$.Severity, severityNodes);
                    if (node) {
                        if (node.queries) {
                            node.queries.push(query);
                        }
                    } else {
                        severityNodes.push(new SeverityNode(query.$.Severity, [query], this));
                    }
                });
            }
        } catch (err) {
            this.log.error(err);
            vscode.window.showErrorMessage(err.message);
        }

        if (treeName === "CxTreeScans" && severityNodes.length === 0) {
            this.log.info("There are no vulnerabilities");
            vscode.window.showInformationMessage("There are no vulnerabilities");
        }

        return severityNodes;
    }

    public async retrieveScanResults() {
        try {
            await this.addStatisticsToScanResults();
            this.printStatistics();
            await this.addDetailedReportToScanResults();
        } catch (err) {
            this.log.error(err);
            vscode.window.showErrorMessage(err.message);
        }
    }

    public async addStatisticsToScanResults() {
        const cxServer: CxServerSettings = CxSettings.getServer();
        if (!this.loginChecks.isLoggedIn()) {
            throw Error('Access token expired. Please login.');
        }
        const statistics: any = await this.httpClient.getRequest(`sast/scans/${this.scanId}/resultsStatistics`);

        this.scanResult.scanId = this.scanId;
        this.scanResult.highResults = statistics.highSeverity;
        this.scanResult.mediumResults = statistics.mediumSeverity;
        this.scanResult.lowResults = statistics.lowSeverity;
        this.scanResult.infoResults = statistics.infoSeverity;

        const sastScanPath = `CxWebClient/ViewerMain.aspx?scanId=${this.scanId}&ProjectID=${this.projectId}`;
        this.scanResult.sastScanResultsLink = url.resolve(cxServer.url, sastScanPath);

        const sastProjectLink = `CxWebClient/portal#/projectState/${this.projectId}/Summary`;
        this.scanResult.sastSummaryResultsLink = url.resolve(cxServer.url, sastProjectLink);

        this.scanResult.sastResultsReady = true;
    }

    private printStatistics() {
        this.log.info(`----------------------------Checkmarx Scan Results(CxSAST):-------------------------------
High severity results: ${this.scanResult.highResults}
Medium severity results: ${this.scanResult.mediumResults}
Low severity results: ${this.scanResult.lowResults}
Info severity results: ${this.scanResult.infoResults}

Scan results location:  ${this.scanResult.sastScanResultsLink}
------------------------------------------------------------------------------------------
`);
    }

    private async addDetailedReportToScanResults() {
        const client = new ReportingClient(this.httpClient, this.log);
        if (!CxSettings.isQuiet()) {
            vscode.window.showInformationMessage('Waiting for server to generate scan report');
        }
        const reportXml = await client.generateReport(this.scanId, undefined);
        const doc = reportXml.CxXMLResults;
        this.scanResult.scanStart = doc.$.ScanStart;
        this.scanResult.scanTime = doc.$.ScanTime;
        this.scanResult.locScanned = doc.$.LinesOfCodeScanned;
        this.scanResult.filesScanned = doc.$.FilesScanned;
        this.queries = doc.Query;
        this.scanResult.queryList = ScanNode.toJsonQueries(doc.Query);
        if (!CxSettings.isQuiet()) {
            vscode.window.showInformationMessage('Scan report was generated successfully');
        }
    }

    private static toJsonQueries(queries: any[] | undefined) {
        const SEPARATOR = ';';

        // queries can be undefined if no vulnerabilities were found.
        return (queries || []).map(query =>
            JSON.stringify({
                name: query.$.name,
                severity: query.$.Severity,
                resultLength: query.Result.length
            })
        ).join(SEPARATOR);
    }

    public async attachJsonReport() {
        const reportPath: string = CxSettings.getReportPath();
        const jsonReportPath: string = await Utility.showInputBox("Enter JSON report full path", false, reportPath);
        if (!path.isAbsolute(jsonReportPath)) {
            vscode.window.showErrorMessage(`Path [${jsonReportPath}] is not absolute`);
            return;
        }
        if (!jsonReportPath.endsWith('.json')) {
            vscode.window.showErrorMessage('File name should ends with .json');
            return;
        }

        const reportJson = JSON.stringify(this.scanResult);

        this.log.info(`Writing report to ${jsonReportPath}`);
        if (!CxSettings.isQuiet()) {
            vscode.window.showInformationMessage(`Writing report to ${jsonReportPath}`);
        }
        await new Promise((resolve, reject) => {
            fs.writeFile(jsonReportPath, reportJson, err => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        this.log.info('Generated Checkmarx summary results.');
        if (!CxSettings.isQuiet()) {
            vscode.window.showInformationMessage('Generated Checkmarx summary results.');
        }

        if (reportPath !== jsonReportPath) {
            await CxSettings.updateReportPath(jsonReportPath);
        }
    }
}