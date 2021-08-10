
import * as vscode from "vscode";
import { Logger } from "@checkmarx/cx-common-js-client";
import { SessionStorageService } from './sessionStorageService';
import { HttpClient } from "@checkmarx/cx-common-js-client";
import { AuthSSODetails } from "@checkmarx/cx-common-js-client";
import { SSOConstants } from '../model/ssoConstant';

/**
 * This class check login of user
 */
export class LoginChecks  {

    private authSSODetails: AuthSSODetails | any;
    private storageManager :  SessionStorageService;
    private httpClient: HttpClient | any;

    constructor(private readonly log: Logger,private readonly context: vscode.ExtensionContext
        ,private readonly httpClientLocal:HttpClient) {

        this.httpClient = httpClientLocal;

        this.storageManager = new SessionStorageService(context.workspaceState);
    }
     /**
     * Checks if the user is currently logged in to the server
     * @returns true if access token or cookies are available; false otherwise 
     */
    public isLoggedIn(): boolean {
                    
        let access_token = this.storageManager.getValue<string>(SSOConstants.ACCESS_TOKEN, '');
        if( access_token === '' )
        {
            return false;

        }else{
            let tokenExp = this.httpClient.isTokenExpired();
            if(this.httpClient.isSsoLogin  && tokenExp)
            {
                vscode.window.showInformationMessage('Access token expired. Logging into Checkmarx.');
                this.loginWithRefreshToken();
            }
            return true;
           
        }
    }
    /**
     * This method gets the access token using refresh token.
     * We pass AuthSSODetails object to http client getAccessTokenFromRefreshRoken 
     * method to get access token
     */
    async loginWithRefreshToken() {
        try{

            this.authSSODetails =  new AuthSSODetails();
            this.authSSODetails.clientId = SSOConstants.vscode_client_id;
            this.authSSODetails.scope = SSOConstants.vscode_client_scope;
            this.authSSODetails.redirectURI = SSOConstants.vscode_redirect_uri;

            await this.httpClient.getAccessTokenFromRefreshRoken(this.authSSODetails);

            vscode.window.showInformationMessage('SSO Login successful with refresh token.');
            let access_token = <string> this.httpClient.accessToken;

            /* Setting access token in context */ 
            this.storageManager.setValue<string>(SSOConstants.ACCESS_TOKEN, access_token);
        }catch (err) {
            this.log.error(err);
            vscode.window.showErrorMessage('Login failed - Not able to get access token from refresh token.');
        }
        
    }
}