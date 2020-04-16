import * as vscode from 'vscode';
import { CxTreeDataProvider } from "./model/CxTreeDataProvider";
import { ServerNode } from './model/ServerNode';
import { ProjectNode } from './model/ProjectNode';
import { ScanNode } from './model/ScanNode';

export function activate(context: vscode.ExtensionContext) {

	const numOfContextSubsForCxPortalWin: number = 11;

	let disposable = vscode.commands.registerCommand('extension.CxVSCodeTree', () => {
		let currProjectToScan: ProjectNode | any;
		const cxTreeDataProvider = new CxTreeDataProvider();
		// Register Window (Explorer CxPortal)
		context.subscriptions.push(vscode.window.registerTreeDataProvider("cxportalwin", cxTreeDataProvider));
		// Register Command Edit Cx Server Node
		context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.editCxServer", async () => {
			await cxTreeDataProvider.editTreeItem();
			currProjectToScan = undefined;
		}));
		context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.updateFolderExclusion", async (serverNode: ServerNode) => {
			await serverNode.updateFolderExclusion();
		}));
		context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.updateFileExtension", async (serverNode: ServerNode) => {
			await serverNode.updateFileExtension();
		}));
		context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.login", async (serverNode: ServerNode) => {
			await serverNode.login();
			cxTreeDataProvider.refresh(serverNode);
		}));
		context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.scanFile", async (serverNode: ServerNode) => {
			await serverNode.scan(currProjectToScan, false, 'Open Source File');
			cxTreeDataProvider.refresh(serverNode);
		}));
		context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.scanFolder", async (serverNode: ServerNode) => {
			await serverNode.scan(currProjectToScan, true, 'Open Source Folder');
			cxTreeDataProvider.refresh(serverNode);
		}));
		context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.bindProject", async (serverNode: ServerNode) => {
			currProjectToScan = await serverNode.bindProject();
		}));
		context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.unbindProject", () => {
			currProjectToScan = undefined;
		}));
		context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.seeScanResults", async (scanNode: ScanNode) => {
			if (context.subscriptions.length > numOfContextSubsForCxPortalWin) {
				for (let idx = numOfContextSubsForCxPortalWin; idx < context.subscriptions.length; idx++) {
					context.subscriptions[idx].dispose();
				}
				context.subscriptions.splice(numOfContextSubsForCxPortalWin);
			}

			await scanNode.addStatisticsToScanResults();
			scanNode.printStatistics();
			await scanNode.addDetailedReportToScanResults();
			await cxTreeDataProvider.createTreeScans(context, scanNode);
		}));

		vscode.window.showInformationMessage('Checkmarx Extension Started!');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }
