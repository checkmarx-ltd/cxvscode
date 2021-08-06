
/**
 * This class contains all constants related to SSO login
 */
export class SSOConstants  {

    public static readonly vscode_client_scope:string = 'offline_access openid sast_api sast-permissions access_control_api';
    public static readonly vscode_redirect_uri:string = 'vscode://Checkmarx.cxvscode';
    public static readonly vscode_client_id:string = 'ide_client';
    public static readonly CODE:string = 'code';
    public static readonly EQUAL:string = '=';
    public static readonly AND:string = '&';
    public static readonly ACCESS_TOKEN:string = 'access_token';
    public static readonly REFRESH_TOKEN:string = 'refresh_token';
    public static readonly TOKEN_EXP_TIME:string = 'token_exp_time';
    

}