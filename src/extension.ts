import * as vscode from 'vscode';
import { CxTreeDataProvider } from "./model/CxTreeDataProvider";
import { ServerNode } from './model/ServerNode';
import { ScanNode } from './model/ScanNode';
import { CxSettings } from "./services/CxSettings";
import { SSOUriHandler } from './services/SSOUriHandler';
import { SessionStorageService } from './services/sessionStorageService';
import { SSOConstants } from './model/ssoConstant';

export function activate(context: vscode.ExtensionContext) {
	if (context && context.subscriptions && context.subscriptions.length > 0) {
		context.subscriptions.forEach((item: { dispose: () => any; }) => item.dispose());
		context.subscriptions.splice(0);
	}

	// keep the count of command registered at initialization; everything above it is results, and will need to be refreshed 
	let numOfContextSubsForCxPortalWin: number = 0;

	const checkmarxOutput: vscode.OutputChannel = vscode.window.createOutputChannel('Checkmarx');
	context.subscriptions.push(checkmarxOutput);

	const cxTreeDataProvider = new CxTreeDataProvider(checkmarxOutput,context);
	let storageManager = new SessionStorageService(context.workspaceState);
	storageManager.setValue<string>(SSOConstants.ACCESS_TOKEN,'');

	// Register Window (Explorer CxPortal)
	context.subscriptions.push(vscode.window.registerTreeDataProvider("cxportalwin", cxTreeDataProvider));
	context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.addCxServer", async () => {
		await cxTreeDataProvider.addTreeItem();
	}));
	// Register Command Edit Cx Server Node
	context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.editCxServer", async () => {
		await cxTreeDataProvider.editTreeItem();
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
		await cxTreeDataProvider.destroyTreeScans(context);
		cxTreeDataProvider.refresh(serverNode);
	}));
	context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.scanFile", async (serverNode: ServerNode) => {
		if (CxSettings.isScanButtonsEnabled()) {
			await serverNode.scan(false, '');
			cxTreeDataProvider.refresh(serverNode);
			serverNode.displayCurrentScanedSource();
		} else {
			vscode.window.showWarningMessage('\'Scan Any File\' button is disabled');
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.scanFolder", async (serverNode: ServerNode) => {
		if (CxSettings.isScanButtonsEnabled()) {
			await serverNode.scan(true, '');
			cxTreeDataProvider.refresh(serverNode);
			serverNode.displayCurrentScanedSource();
		} else {
			vscode.window.showWarningMessage('\'Scan Any Folder\' button is disabled');
		}
	}));
if(CxSettings.isWorkspaceOnlyScanEnabled()) {
	vscode.commands.executeCommand('setContext', 'cxSettings.showWorkspaceOnly', true);
} else {
	vscode.commands.executeCommand('setContext', 'cxSettings.showWorkspaceOnly', false);
}

	context.subscriptions.push(vscode.commands.registerCommand("Explorer.scanFile", async (uri: vscode.Uri) => {
		const cxServerNode = cxTreeDataProvider.getCurrentServerNode();
		if(!CxSettings.isWorkspaceOnlyScanEnabled()) {
		if (cxServerNode) {
			await cxServerNode.scan(false, uri.fsPath);
			cxTreeDataProvider.refresh(cxServerNode);
			cxServerNode.displayCurrentScanedSource();
		}
	} else {
		vscode.window.showWarningMessage('\'Checkmarx: Scan Current File\' option is disabled \n. Scan can be performed at workspace level only.');
	}
	}));
	context.subscriptions.push(vscode.commands.registerCommand("Explorer.scanFolder", async (uri: vscode.Uri) => {
		const cxServerNode = cxTreeDataProvider.getCurrentServerNode();
		if(!CxSettings.isWorkspaceOnlyScanEnabled()) {
		if (cxServerNode) {
			await cxServerNode.scan(true, uri.fsPath);
			cxTreeDataProvider.refresh(cxServerNode);
			cxServerNode.displayCurrentScanedSource();
		}
	} else {
		vscode.window.showWarningMessage('\'Checkmarx: Scan Current Folder\' option is disabled \n. Scan can be performed at workspace level only.');
	}
	}));

	context.subscriptions.push(vscode.commands.registerCommand("Explorer.scanWorkspace", async () => {
		const cxServerNode = cxTreeDataProvider.getCurrentServerNode();
		if (cxServerNode && cxServerNode.workspaceFolder) {
			await cxServerNode.scan(true, cxServerNode.workspaceFolder.fsPath);
			cxTreeDataProvider.refresh(cxServerNode);
			cxServerNode.displayCurrentScanedSource();
		}
	}));
	context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.bindProject", async (serverNode: ServerNode) => {
		await serverNode.bindProject();
		cxTreeDataProvider.refresh(serverNode);
	}));
	context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.unbindProject", async (serverNode: ServerNode) => {
		await serverNode.unbindProject();
		await cxTreeDataProvider.destroyTreeScans(context);
		cxTreeDataProvider.refresh(serverNode);
	}));
	context.subscriptions.push(vscode.commands.registerCommand("cxportalwin.clickToRetrieveScanResults", async (scanNode: ScanNode) => {
		if (scanNode.parentNode.isLoggedIn()) {
			// remove any entries that contain (potentially stale) results
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

	// record the number of registered commands
	numOfContextSubsForCxPortalWin = context.subscriptions.length;
	if (!CxSettings.isQuiet()) {
		vscode.window.showInformationMessage('Checkmarx Extension Enabled!');
	}
}

export function deactivate() { }
