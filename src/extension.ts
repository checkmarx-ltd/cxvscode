import * as vscode from 'vscode';
import { CxTreeDataProvider } from "./model/CxTreeDataProvider";
import { ServerNode } from './model/ServerNode';
import { ProjectNode } from './model/ProjectNode';
import { ScanNode } from './model/ScanNode';

export function activate(context: vscode.ExtensionContext) {

	const numOfContextSubsForCxPortalWin: number = 13;

	let disposable = vscode.commands.registerCommand('extension.CxVSCodeTree', () => {
		let currProjectToScan: ProjectNode | any;
		const cxTreeDataProvider = new CxTreeDataProvider();
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
			await serverNode.scan(currProjectToScan, false, 'Open Source File');
			cxTreeDataProvider.refresh(serverNode);
			serverNode.displayCurrentScanedSource();
		}));
		context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.scanFolder", async (serverNode: ServerNode) => {
			await serverNode.scan(currProjectToScan, true, 'Open Source Folder');
			cxTreeDataProvider.refresh(serverNode);
			serverNode.displayCurrentScanedSource();
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

		vscode.window.showInformationMessage('Checkmarx Extension Enabled!');
	});

	context.subscriptions.push(disposable);
}

export function deactivate() { }
