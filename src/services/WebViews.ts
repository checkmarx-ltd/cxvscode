import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs";
import { HttpClient, AuthSSODetails,Logger} from "@checkmarx/cx-common-js-client";
import { ScanNode } from '../model/ScanNode';
import { SessionStorageService } from './sessionStorageService';
import { SSOConstants } from '../model/ssoConstant';
import { LoginChecks } from './loginChecks';
import { CxSettings } from "./CxSettings";
import { promises } from 'dns';

interface ResultStateApiResponse {
	states: { id: number; name: string, isUserHavePermission:boolean }[]
}

interface ResultStateDetails {
	id: number;
	names: Name[];
	permission: string;
  }

  interface Name {
	languageId: number;
	name: string;
	isConstant: boolean;
  }
  

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
		if (this.resultTablePanel) 
		{
			let pathId = query.Result[0].Path[0].$.PathId;
			try {
				//to know webview its firstClick message
				query.mesg = "firstClick";
				var description = await this.httpClient.getRequest(`sast/scans/${this.scanNode.scanId}/results/${pathId}/shortDescription`);
				query.description = description;
                
				} catch (err) {					
					if (err.status == 404) {
						query.description="";
						query.mesg = "";
						this.log.error('The short description of the result will not be displayed with CxSAST version in use.');
					}
			}
			
			query.clickedRow=0;
			this.queryForDescription=query;

			query.resultStates = await this.getResultStateWithPermission();

			let usersResponse = await this.httpClient.getRequest(`auth/AssignableUsers`);
			let usersList: string[] = [];
			if(usersResponse){
				for(let user of usersResponse){
					usersList.push(user.username);
				}
				
			}
			query.mandatoryComment = CxSettings.getMandatoryCommentFlag();
			query.usersList = usersList;
			this.queryNode = query;
			this.resultTablePanel.webview.postMessage(query);
		}

	}

	async getResultStateWithPermission()
	{
		const resultStates: ResultStateApiResponse = await this.httpClient.getRequest(`sast/result-states`);
		try {
			let resultStatesWithPermissions: ResultStateDetails[] = await this.httpClient.getRequest(`sast/resultStates`);
			for(let i=0;i<resultStates.states.length ;i++)
			{
				let permission : string | any= resultStatesWithPermissions.find((abc) => abc.id === resultStates.states[i].id)?.permission;
				if(permission) resultStates.states[i].isUserHavePermission = await this.httpClient.validateUserPermission(permission);
			}
		}
		catch(e){
			if (e.status == 404) {
				resultStates.states.forEach( b => b.isUserHavePermission = true);
			}
		}
		
		return resultStates;
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
			if (err instanceof Error) {
			this.log.error(err.message);
			}
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
											if(message.bulkComment)
												this.resultStateChanged(message.bulkComment, message.resultStateTobeChange, message.data,message.resultStateText);
											else
												this.resultStateChanged('', message.resultStateTobeChange, message.data,message.resultStateText);
										 	 return;
										case 'onClick':
											this.updateShortDescriptionForResult(message);
											return;
										case 'updateComment':
											this.updateUserComment(message.inputCommentValue, message.pathId);
											return;
										case 'assignUser':
											this.assignUser(message.assignUser, message.data);
											return;
										case 'bulkComments':
											this.addBulkComments(message.bulkComment, message.data);
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
			if (err instanceof Error) {
			this.log.error(err.message);
			}
		}
	}

	private async apiCallToUpdateComment(node: any, scanId: any, pathId: any, comment:any) {
		const request = {"comment" : comment};
		try {
			await this.httpClient.patchRequest(`sast/scans/${scanId}/results/${pathId}`, request);
			comment = comment.replace(/[\r\n]+/g," ");			
			node.$.Remark = `New Comment,${comment}\r\n${node.$.Remark}`;			
		} catch (err) {
			this.log.error(`The following error occurred while updating the user: ${err}`);
		}
	}

	private async addBulkComments(comment: any, rows: any) {
		let scanId= this.scanNode.scanId;
		let nodes = this.queryNode.Result;

		//loop to fetch pathId of all selected rows one by one.
		for (let row of rows) {
			let pathId = row;
			for (let node of nodes) { 
				if( pathId == node.Path[0].$.PathId) {
					await this.apiCallToUpdateComment(node, scanId, pathId, comment);	
				}
			}
		}

		//mesg of node query currently open is changed to 'Onchange' fir webview to refresh and display updated value.  
		let queries:  any[] | undefined;
		queries = this.scanNode.queries;
		if(queries) {
			for (let query of queries) { 
				if(query.$.id == this.queryNode.$.id && this.resultTablePanel){
					this.queryNode = query;
					this.queryNode.mesg='onChange';
					this.resultTablePanel.webview.postMessage(this.queryNode);
					break;
				}
			}
		}
	}

	//calls server api to update user assigned
	private async apiCallToUpdateUser(node: any, scanId: any, pathId: any, assignUser:any) {
		const request = {"userAssignment" : assignUser};
		try {
			await this.httpClient.patchRequest(`sast/scans/${scanId}/results/${pathId}`, request);
			node.$.AssignToUser = `${assignUser}`;
		} catch (err) {
			this.log.error(`The following error occurred while updating the user: ${err}`);
		}
	}

	private async assignUser(assignUser: any, rows: any) {
		let scanId= this.scanNode.scanId;
		let nodes = this.queryNode.Result;

		//loop to fetch pathId of all selected rows one by one.
		for (let row of rows) {
			let pathId = row;
			for (let node of nodes) { 
				if( pathId == node.Path[0].$.PathId) {
					await this.apiCallToUpdateUser(node, scanId, pathId, assignUser);	
				}
			}
		}

		//mesg of node query currently open is changed to 'Onchange' fir webview to refresh and display updated value.  
		let queries:  any[] | undefined;
		queries = this.scanNode.queries;
		if(queries) {
			for (let query of queries) { 
				if(query.$.id == this.queryNode.$.id && this.resultTablePanel){
					this.queryNode = query;
					this.queryNode.mesg='onChange';
					this.resultTablePanel.webview.postMessage(this.queryNode);
					break;
				}
			}
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

	public createWebViews(context: vscode.ExtensionContext) {
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
		let nodes = this.queryNode.Result;
		const request = {
			"comment" : inputCommentValue
		};
		try {
			await this.httpClient.patchRequest(`sast/scans/${scanId}/results/${pathId}`, request);
			for (const nodeIterator of nodes) {
				if( pathId == nodeIterator.Path[0].$.PathId ) {
					inputCommentValue = inputCommentValue.replace(/[\r\n]+/g," ");
					nodeIterator.$.Remark = `New Comment,${inputCommentValue}\r\n${nodeIterator.$.Remark}`;	
				}
			}
		} catch (err) {
			if (err.status == 404) {
				this.log.error('This operation is not supported with CxSAST version in use.');
			}
		}
		
		let queries:  any[] | undefined;
		queries = this.scanNode.queries;
		if(queries) 
		{
			for (const queryIterator of queries) {
				if(queryIterator.$.id == this.queryNode.$.id && this.resultTablePanel)
				{
					this.queryNode = queryIterator;
					this.queryNode.mesg='onChange';
					this.resultTablePanel.webview.postMessage(this.queryNode);
					break;
				}
			}
		
		}	
	}
	private async resultStateChanged(bulkComment: any, selectedResultState: any, rows: any,resultStateText :any){
		let scanId = this.scanNode.scanId;
		let nodes = this.queryNode.Result;

		let mandatoryComment = CxSettings.getMandatoryCommentFlag();

		const request = bulkComment === '' ? {"state" : selectedResultState} : {"state" : selectedResultState,"comment" : bulkComment};
		//The below for loop updates the result state
		var isErrorCatched = false;
		for (var i = 0; i < rows.length; i++) {
			var pathId = rows[i];
			if(!isErrorCatched)
			{
				for (let nodeCtr = 0; nodeCtr < nodes.length; nodeCtr++) { 
					if( pathId == nodes[nodeCtr].Path[0].$.PathId) {
						
						try {
							await this.httpClient.patchRequest(`sast/scans/${scanId}/results/${pathId}`, request);
							nodes[nodeCtr].$.state = selectedResultState;	
							nodes[nodeCtr].$.Remark = bulkComment === '' ? nodes[nodeCtr].$.Remark  : `New Comment,${bulkComment}\r\n${nodes[nodeCtr].$.Remark}`;					
						} 
						catch (err) {
							isErrorCatched = true;
							if (err.status == 404) {
								this.log.error('This operation is not supported with CxSAST version in use.');
							}
							else if (err.status == 403) {
								this.log.error('You are not authorized to mark the selected vulnerability result as  ' + resultStateText);
								vscode.window.showErrorMessage('You are not authorized to mark the selected vulnerability result as  ' + resultStateText);
								break;
							}
							//in case sast server flag is true but extension flag is false then updating result state throws error response with 49797 code. This if block tackles the error response.
							if(err.response.body.messageCode == 49797)
							{
								this.log.error("A comment is required while updating result state flag.");
								this.queryNode.mandatoryCommentErrorMessage = "Checkmarx SAST Server mandates comments while changing state of vulnerabilities. Enable 'Mandatory Comments' setting in Extension settings in Visual Source Code.";
							}
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


