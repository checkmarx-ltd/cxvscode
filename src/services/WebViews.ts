import * as vscode from 'vscode';
import * as path from "path";
import * as fs from "fs";
import { Logger } from "@checkmarx/cx-common-js-client";
import { HttpClient } from "@checkmarx/cx-common-js-client";

export class WebViews {

	public static webViews: WebViews;
	private attackVectorPanel?: vscode.WebviewPanel = undefined;
	private resultTablePanel?: vscode.WebviewPanel = undefined;
	private queryDescriptionPanel?: vscode.WebviewPanel = undefined;

	constructor(context: vscode.ExtensionContext, private sourceDetails: any,
		private readonly log: Logger, private readonly httpClient: HttpClient) {
		this.createWebViews(context);
	}

	async createQueryDescriptionWebView(queryId: number) {
		if (!this.httpClient.accessToken) {
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

	queryResultClicked(query: any | undefined) {
		if (this.resultTablePanel) {
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
			const attackVectorViewPath:string = path.join(context.extensionPath, 'attackVectorWebView.html');
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
			const resultTableViewPath:string = path.join(context.extensionPath, 'resultTableWebView.html');
			fs.readFile(resultTableViewPath, "utf8",
				(err: any, data: any) => {
					if (this.resultTablePanel) {
						this.resultTablePanel.webview.html = data;
						// Handle messages from the webview
						this.resultTablePanel.webview.onDidReceiveMessage(
							message => {
								if (this.attackVectorPanel) {
									this.attackVectorPanel.webview.postMessage(message.path);
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
		const [isFolder, sourceLocation] = this.sourceDetails;
		const fullSourcePath = isFolder ? sourceLocation + path.sep + (path.sep === "/" ? node.FileName[0] : node.FileName[0].replace(/[/]/g, '\\')) : sourceLocation;
		const uri = vscode.Uri.file(fullSourcePath);
		let found: boolean = this.isTextEditorVisible(node, fullSourcePath);
		if (!found) {
			vscode.commands.executeCommand('vscode.open', uri, vscode.ViewColumn.One).then(() => {
				found = this.isTextEditorVisible(node, fullSourcePath);
			});
		}
	}
}