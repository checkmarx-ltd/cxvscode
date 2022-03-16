import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs";
import { HttpClient, AuthSSODetails,Logger} from "@checkmarx/cx-common-js-client";
import { ScanNode } from '../model/ScanNode';
import { SessionStorageService } from './sessionStorageService';
import { SSOConstants } from '../model/ssoConstant';
import { LoginChecks } from './loginChecks';
import { timeStamp } from 'console';

export class WebViews {

	public static webViews: WebViews;
	private attackVectorPanel?: vscode.WebviewPanel = undefined;
	private resultTablePanel?: vscode.WebviewPanel = undefined;
	private queryDescriptionPanel?: vscode.WebviewPanel = undefined;
	public queryNode: any;
	private storageManager :  SessionStorageService;
	private accessToken: string = '';
	private authSSODetails: AuthSSODetails | any;
	private loginChecks: LoginChecks | any;

	public queryForDescription :any ;
	constructor(context: vscode.ExtensionContext, private scanNode: ScanNode,
		private readonly log: Logger, private readonly httpClient: HttpClient) {
		this.createWebViews(context);

		this.storageManager = new SessionStorageService(context.workspaceState);
		this.accessToken = this.storageManager.getValue<string>(SSOConstants.ACCESS_TOKEN,'');
		this.loginChecks =  new LoginChecks(log,context,this.httpClient);
	}

	async createQueryDescriptionWebView(queryId: number) {

		if(!this.loginChecks.isLoggedIn())
		{
			vscode.window.showErrorMessage('Access token expired. Please login.');
			return;
		}
		
		
		if (this.queryDescriptionPanel) {
			this.queryDescriptionPanel.dispose();
		}

		this.log.info('Loading the HTML content...');

		const codeBashing: any = await this.httpClient.getRequest(`Queries/${queryId}/AppSecCoachLessonsRequestData`);
		const codeBashingLink: string = codeBashing.url + '?serviceProviderId=' + codeBashing.paramteres.serviceProviderId
			+ '&utm_source=' + codeBashing.paramteres.utm_source
			+ '&utm_campaign=' + codeBashing.paramteres.utm_campaign;

		let content: string = await this.httpClient.getRequest(`Queries/${queryId}/CxDescription`);
		content = content.replace("</body>", '');
		content += `<br/><br/><a href="${codeBashingLink}" target="_blank">CodeBashing Link</a>`;
		content += "</body></html>";

		this.queryDescriptionPanel = vscode.window.createWebviewPanel(
			'queryDescription',
			'Query Description',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);
		this.queryDescriptionPanel.webview.html = content;
	}

	async queryResultClicked(query: any | undefined) {
		if (this.resultTablePanel) {
			let pathId =query.Result[0].Path[0].$.PathId;
			try {
				//to know webview its firstClick message
				query.mesg="firstClick";
				var description = await this.httpClient.getRequest(`sast/scans/${this.scanNode.scanId}/results/${pathId}/shortDescription`);
				query.description=description;
                
				} catch (err) {
					if (err.status == 404) {
						query.description="";
						query.mesg="";
						this.log.error('The short description of the result will not be displayed with CxSAST version in use.');
					}
			}
			
			query.clickedRow=0;
			this.queryForDescription=query;

			const resultStates: string[] = await this.httpClient.getRequest(`sast/result-states`);
			query.resultStates = resultStates;
			this.queryNode = query;
			this.resultTablePanel.webview.postMessage(query);
		}

	}

	private createAttackVectorWebView(context: vscode.ExtensionContext) {
		this.attackVectorPanel = vscode.window.createWebviewPanel(
			'attackVector',
			'Attack Vector',
			vscode.ViewColumn.Two,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);

		try {
			const attackVectorViewPath: string = path.join(context.extensionPath, 'attackVectorWebView.html');
			fs.readFile(attackVectorViewPath, "utf8",
				(err: any, data: any) => {
					if (this.attackVectorPanel) {
						this.attackVectorPanel.webview.html = data;
						// Handle messages from the webview
						this.attackVectorPanel.webview.onDidReceiveMessage(
							message => {
								this.attackVectorNodeClicked(message.msg);
							},
							undefined,
							context.subscriptions
						);
						this.attackVectorPanel.onDidDispose(
							() => {
								this.attackVectorPanel = undefined;
							},
							undefined,
							context.subscriptions
						);
					}
				});
		} catch (err) {
			this.log.error(err);
		}
	}

	private createResultTableWebView(context: vscode.ExtensionContext) {
		this.resultTablePanel = vscode.window.createWebviewPanel(
			'resultTable',
			'Result Table',
			vscode.ViewColumn.Three,
			{
				enableScripts: true,
				retainContextWhenHidden: true
			}
		);
		try {
			const resultTableViewPath: string = path.join(context.extensionPath, 'resultTableWebView.html');
			fs.readFile(resultTableViewPath, "utf8",
				(err: any, data: any) => {
					if (this.resultTablePanel) {
						this.resultTablePanel.webview.html = data;
						
						// Handle messages from the webview
						this.resultTablePanel.webview.onDidReceiveMessage(
							async message => {
								
								if (this.attackVectorPanel) {
									this.attackVectorPanel.webview.postMessage(message.path);
								}
								if(this.resultTablePanel) {
									switch (message.command) {
										case 'resultstateChangeEvent':
											this.resultStateChanged(message.resultStateTobeChange,  message.data);
										 	 return;
										case 'onClick':
											this.updateShortDescriptionForResult(message);
											return;
										case 'updateComment':
											this.updateUserComment(message.inputCommentValue, message.pathId);
											return;
									  }

								}
							},
							undefined,
							context.subscriptions
						);
						this.resultTablePanel.onDidDispose(
							() => {
								this.resultTablePanel = undefined;
							},
							undefined,
							context.subscriptions
						);
					}
				});
		} catch (err) {
			this.log.error(err);
		}
	}
	private async updateShortDescriptionForResult(message: any) {
		let scanId = this.scanNode.scanId;
		let pathId = message.path[0].$.PathId;
		try {
			this.queryForDescription.mesg = "vsCode";
			let description = await this.httpClient.getRequest(`sast/scans/${scanId}/results/${pathId}/shortDescription`);
			this.queryForDescription.description = description;
		
		} catch (err) {
			if (err.status == 404) {
				this.queryForDescription.description="";
				this.queryForDescription.handleError =  "shortDescAPIUnavailable";
				this.log.error('The short description of the result will not be displayed with CxSAST version in use.');
			}
		}
		this.queryForDescription.clickedRow = message.clickedRow;
		if(this.resultTablePanel){
			this.resultTablePanel.webview.postMessage(this.queryForDescription);
		}
	}

	private createWebViews(context: vscode.ExtensionContext) {
		// Creating three panel editors for the web views
		vscode.commands.executeCommand('vscode.setEditorLayout', {
			orientation: 1, groups: [
				{ groups: [{ groups: [{}], size: 0.7 }, { groups: [{}], size: 0.3 }], size: 0.7 },
				{ groups: [{}], size: 0.3 }
			]
		});
		this.createAttackVectorWebView(context);
		this.createResultTableWebView(context);
	}

	destroyWebViews() {
		if (this.attackVectorPanel) {
			this.attackVectorPanel.dispose();
		}
		if (this.resultTablePanel) {
			this.resultTablePanel.dispose();
		}
		if (this.queryDescriptionPanel) {
			this.queryDescriptionPanel.dispose();
		}
	}

	private isTextEditorVisible(node: any, fullSourcePath: string): boolean {
		const visibleTextEditors = vscode.window.visibleTextEditors;
		let found: boolean = false;
		visibleTextEditors.forEach(element => {
			if (element.document.fileName.toLowerCase() === fullSourcePath.toLowerCase()) {
				found = true;
				this.revealRangeAndSelection(element, node);
			}
		});
		return found;
	}

	private revealRangeAndSelection(element: vscode.TextEditor, node: any) {
		vscode.window.showTextDocument(element.document, vscode.ViewColumn.One, false).then(() => {
			const line = Math.max(0, parseInt(node.Line[0]) - 1);
			const col = Math.max(0, parseInt(node.Column[0]) - 1);
			const start = new vscode.Position(line, col);
			const end = new vscode.Position(line, col + parseInt(node.Length[0]));
			const range = new vscode.Range(start, end);
			element.revealRange(range);
			element.selection = new vscode.Selection(start, end);
		});
	}

	private attackVectorNodeClicked(node: any) {
		let fullSourcePath: string = '';
		if (this.scanNode.isScannedByVSC) {
			fullSourcePath = this.scanNode.isFolder ? this.scanNode.sourceLocation + path.sep + (path.sep === "/" ? node.FileName[0] : node.FileName[0].replace(/[/]/g, '\\')) : this.scanNode.sourceLocation;
		} else {
			fullSourcePath = this.getFullSourcePathIfExistsForBoundProject(node.FileName[0]);
		}

		const uri = vscode.Uri.file(fullSourcePath);
		let found: boolean = this.isTextEditorVisible(node, fullSourcePath);
		if (!found) {
			vscode.commands.executeCommand('vscode.open', uri, vscode.ViewColumn.One).then(() => {
				found = this.isTextEditorVisible(node, fullSourcePath);
			});
		}
		
	}
	private async updateUserComment(inputCommentValue: any, pathId: any)
	{
		let scanId= this.scanNode.scanId;
		const request = {
			"comment" : inputCommentValue
		};
		try {
			await this.httpClient.patchRequest(`sast/scans/${scanId}/results/${pathId}`, request);
		} 
		catch (err) 
		{
			if (err.status == 404) 
			{
				this.log.error('This operation is not supported with CxSAST version in use.');
			}
		}

		const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
		const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
		const dateTimeNow = new Date();
		const time = `${dateTimeNow.getHours()%12}:${dateTimeNow.getMinutes()}:${dateTimeNow.getSeconds()} ${dateTimeNow.getHours()>=12 ? 'PM' : 'AM'}`; 
		let commentTimeStamp = `[${days[dateTimeNow.getDay()]}, ${months[dateTimeNow.getMonth()]} ${dateTimeNow.getDate()}, ${dateTimeNow.getFullYear()} ${time}]: `;

		let nodes = this.queryNode.Result
		for (let nodeCtr = 0; nodeCtr < nodes.length; nodeCtr++) {
			if( pathId == nodes[nodeCtr].Path[0].$.PathId ) {
				nodes[nodeCtr].$.Remark = `New Comment,${commentTimeStamp}${inputCommentValue}\r\n${nodes[nodeCtr].$.Remark}`;	
			}
		}
		
		let queries:  any[] | undefined;
		queries = this.scanNode.queries;
		if(queries) 
		{
			for (let queryCtr = 0; queryCtr < queries.length; queryCtr++) 
			{ 
				if(queries[queryCtr].$.id == this.queryNode.$.id && this.resultTablePanel)
				{
					this.queryNode = queries[queryCtr];
					this.queryNode.mesg='onChange';
					this.resultTablePanel.webview.postMessage(this.queryNode);
					break;
				}
			}
		}	
	}
	private async resultStateChanged(selectedResultState: any, rows: any){
		let scanId = this.scanNode.scanId;
		let nodes = this.queryNode.Result;
		//The below for loop updates the result state
		for (var i = 0; i < rows.length; i++) {
			var pathId = rows[i];
			for (let nodeCtr = 0; nodeCtr < nodes.length; nodeCtr++) { 
				if( pathId == nodes[nodeCtr].Path[0].$.PathId) {
					let state = selectedResultState;
					const request = {
						"state" : state						
					};
					try {
						await this.httpClient.patchRequest(`sast/scans/${scanId}/results/${pathId}`, request);
						nodes[nodeCtr].$.state = state;						
					} 
					catch (err) {
						if (err.status == 404) {
							this.log.error('This operation is not supported with CxSAST version in use.');
						}
					}	
				}
			}
		}
		this.scanNode.addStatisticsToScanResults();
		let queries:  any[] | undefined;
		queries = this.scanNode.queries;
		if(queries) {
			for (let queryCtr = 0; queryCtr < queries.length; queryCtr++) { 
				if(queries[queryCtr].$.id == this.queryNode.$.id && this.resultTablePanel){
					this.queryNode = queries[queryCtr];
					this.queryNode.mesg='onChange';
					this.resultTablePanel.webview.postMessage(this.queryNode);
					break;
				}
			}
		}	
	}
	private getFullSourcePathIfExistsForBoundProject(sastFileName: string): string {
		const glob = require("glob");
		let fullSourcePath: string = '';
		const workspace: string | any = this.scanNode.parentNode.workspaceFolder?.fsPath;
		const workspaceFiles: string[] = glob.sync(workspace + '/**/*');
		for (const file of workspaceFiles) {
			if (file.toLowerCase().endsWith(sastFileName.toLowerCase())) {
				fullSourcePath = file;
				break;
			}
		}
		if (fullSourcePath && fullSourcePath.length) {
			fullSourcePath = path.sep === "/" ? fullSourcePath : fullSourcePath.replace(/[/]/g, '\\');
		}
		else {
			fullSourcePath = sastFileName;
		}
		return fullSourcePath;
	}
}


