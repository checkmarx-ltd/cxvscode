import * as vscode from 'vscode';
import { AuthSSODetails } from "@checkmarx/cx-common-js-client";
import { SSOConstants } from '../model/ssoConstant';
import { ServerNode } from '../model/ServerNode';

/**
 * This class will handle redirect URI from SSO login and retrieves authorization code from URI query.
 * also invokes login method i.e. to get AccessToken from authorization code
 */
export class SSOUriHandler implements vscode.UriHandler {
	private authSSODetails: AuthSSODetails | any;
	private localServerNode : ServerNode | any;

	public setServerNode(serverNode : ServerNode)	{
		this.localServerNode = serverNode;
	}
	// This function will get run when something redirects to VS Code
	// with your extension id as the authority.
	handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
			
		try{
			var query = `${uri.query}`;
			var splitQueryArr = query.split(SSOConstants.AND); 
			var codeValue = '';
			
			// Get the code value from 1st query parameter
			var keyValueArr = splitQueryArr[0].split(SSOConstants.EQUAL);
			codeValue = keyValueArr[1];
						
			// set SSO details object
			this.authSSODetails =  new AuthSSODetails();
			this.authSSODetails.clientId = SSOConstants.vscode_client_id;
			this.authSSODetails.scope = SSOConstants.vscode_client_scope;
			this.authSSODetails.redirectURI = SSOConstants.vscode_redirect_uri;
			this.authSSODetails.code = codeValue;

			if(codeValue  !== ''){
				vscode.window.showInformationMessage('Retrieved authorization code.');
			}
			if(this.localServerNode){
				// call login method with authorization code
				this.localServerNode.loginWithAuthCode(this.authSSODetails);
			}
			
		}catch (err) {
            vscode.window.showErrorMessage('Error while retrieving authorization code.');
        }
	}
}