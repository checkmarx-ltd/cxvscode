import * as vscode from 'vscode';
import { CxTreeDataProvider } from "./model/CxTreeDataProvider";
import { ServerNode } from './model/ServerNode';
import { ProjectNode } from './model/ProjectNode';
import { ScanNode } from './model/ScanNode';
import { CxSettings } from "./services/CxSettings";

export function activate(context: vscode.ExtensionContext) {
	if (context && context.subscriptions && context.subscriptions.length > 0) {
		context.subscriptions.forEach((item: { dispose: () => any; }) => item.dispose());
		context.subscriptions.splice(0);
	}

	const numOfContextSubsForCxPortalWin: number = 13;
	const checkmarxOutput: vscode.OutputChannel = vscode.window.createOutputChannel('Checkmarx');
	context.subscriptions.push(checkmarxOutput);

	let currProjectToScan: ProjectNode | any;
	const cxTreeDataProvider = new CxTreeDataProvider(checkmarxOutput);
	// Register Window (Explorer CxPortal)
	context.subscriptions.push(vscode.window.registerTreeDataProvider("cxportalwin", cxTreeDataProvider));
	context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.addCxServer", async () => {
		await cxTreeDataProvider.addTreeItem();
		currProjectToScan = undefined;
	}));
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
	context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.logout", async (serverNode: ServerNode) => {
		await serverNode.logout();
		cxTreeDataProvider.refresh(serverNode);
	}));
	context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.scanFile", async (serverNode: ServerNode) => {
		await serverNode.scan(currProjectToScan, false, '');
		cxTreeDataProvider.refresh(serverNode);
		serverNode.displayCurrentScanedSource();
	}));
	context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.scanFolder", async (serverNode: ServerNode) => {
		await serverNode.scan(currProjectToScan, true, '');
		cxTreeDataProvider.refresh(serverNode);
		serverNode.displayCurrentScanedSource();
	}));
	context.subscriptions.push(vscode.commands.registerCommand("Explorer.scanFile", async (uri:vscode.Uri) => {
		let cxServerNode = cxTreeDataProvider.getCurrentServerNode();
		if(cxServerNode) {
			await cxServerNode.scan(currProjectToScan, false, uri.fsPath);
			cxTreeDataProvider.refresh(cxServerNode);
			cxServerNode.displayCurrentScanedSource();
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand("Explorer.scanFolder", async (uri:vscode.Uri) => {
		let cxServerNode = cxTreeDataProvider.getCurrentServerNode();
		if(cxServerNode) {
			await cxServerNode.scan(currProjectToScan, true, uri.fsPath);
			cxTreeDataProvider.refresh(cxServerNode);
			cxServerNode.displayCurrentScanedSource();
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand("Explorer.scanWorkspace", async () => {
		let cxServerNode = cxTreeDataProvider.getCurrentServerNode();
		if(cxServerNode && vscode.workspace.rootPath) {
			await cxServerNode.scan(currProjectToScan, true, vscode.workspace.rootPath);
			cxTreeDataProvider.refresh(cxServerNode);
			cxServerNode.displayCurrentScanedSource();
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.bindProject", async (serverNode: ServerNode) => {
		const chosenProject = await serverNode.bindProject();
		if (chosenProject) {
			currProjectToScan = chosenProject;
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.unbindProject", () => {
		if (currProjectToScan) {
			vscode.window.showInformationMessage(`Project [${currProjectToScan.name}] got unbound`);
			currProjectToScan = undefined;
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.retrieveScanResults", async (scanNode: ScanNode) => {
		if (scanNode.canRetrieveResults()) {
			if (context.subscriptions.length > numOfContextSubsForCxPortalWin) {
				for (let idx = numOfContextSubsForCxPortalWin; idx < context.subscriptions.length; idx++) {
					context.subscriptions[idx].dispose();
				}
				context.subscriptions.splice(numOfContextSubsForCxPortalWin);
			}
			await scanNode.retrieveScanResults();
			await cxTreeDataProvider.createTreeScans(context, scanNode);
		} else {
			vscode.window.showErrorMessage('Access token expired. Please login.');
		}
	}));
	if(!CxSettings.isQuiet()) { vscode.window.showInformationMessage('Checkmarx Extension Enabled!'); }
}

export function deactivate() { }
