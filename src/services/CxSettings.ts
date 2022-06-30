import * as vscode from 'vscode';
import { Utility } from "../utils/util";
import { URL } from 'url';

// constants defining settings
const DEFAULT_FILE_EXTENSIONS: string = "!**/*.DS_Store, !**/*.ipr, !**/*.iws, !**/*.bak, !**/*.tmp, !**/*.aac, !**/*.aif, !**/*.iff, !**/*.m3u, !**/*.mid, !**/*.mp3, !**/*.mpa, !**/*.ra, !**/*.wav, !**/*.wma, !**/*.3g2, !**/*.3gp, !**/*.asf, !**/*.asx, !**/*.avi, !**/*.flv, !**/*.mov, !**/*.mp4, !**/*.mpg, !**/*.rm, !**/*.swf, !**/*.vob, !**/*.wmv, !**/*.bmp, !**/*.gif, !**/*.jpg, !**/*.png, !**/*.psd, !**/*.tif, !**/*.swf, !**/*.jar, !**/*.zip, !**/*.rar, !**/*.exe, !**/*.dll, !**/*.pdb, !**/*.7z, !**/*.gz, !**/*.tar.gz, !**/*.tar, !**/*.gz, !**/*.ahtm, !**/*.ahtml, !**/*.fhtml, !**/*.hdm, !**/*.hdml, !**/*.hsql, !**/*.ht, !**/*.hta, !**/*.htc, !**/*.htd, !**/*.war, !**/*.ear, !**/*.htmls, !**/*.ihtml, !**/*.mht, !**/*.mhtm, !**/*.mhtml, !**/*.ssi, !**/*.stm, !**/*.stml, !**/*.ttml, !**/*.txn, !**/*.xhtm, !**/*.xhtml, !**/*.class, !**/*.iml";
const DEFAULT_FOLDER_EXCLUSIONS: string = "cvs, .svn, .hg, .git, .bzr, bin, obj, backup, .idea, .vscode, node_modules";
const CXSERVER: string = 'cx.server';
const CXQUIET: string = 'cx.quiet';
const CX_ENABLE_SCAN_BUTTONS: string = 'cx.enableScanButtons';
const CX_ENABLE_WORKSPACE_ONLY_SCAN: string = 'cx.enableWorkspaceOnlyScan';
const CX_FOLDER_EXCLUSIONS: string = 'cx.folderExclusions';
const CX_FILE_EXTENSIONS: string = 'cx.fileExtensions';
const CX_REPORT_PATH: string = 'cx.reportPath';
const CX_ENABLE_USER_CREDENTIALS_LOGIN: string = 'cx.enableUserCredentialsLogin';
const CX_SSL_CERT_PATH: string = 'cx.sslCertificatePath';
const CX_ENABLE_MANDATORY_COMMENT_ON_RESULT_STATE_CHANGE: string = 'cx.mandatoryComment';

export interface CxServerSettings {
    url: string;
    alias: string;
    username: string;
    password: string;
    project_id: number;
    team_id: number;
    project_name: string;
}

export class CxSettings {
    constructor() {
    }

    /**
     * Asks user to provide or update CxServer URL and Alias, and save in settings.json
     */
    public static async configureServer() {
        const cxServer: CxServerSettings = this.getServer();
        const url: URL = new URL(await Utility.showInputBox("Enter CxSAST Server URL", false, (cxServer) ? cxServer.url : ''));
        const alias: string = await Utility.showInputBox("Enter CxSAST Server Alias", false, (cxServer) ? cxServer.alias : '');
        cxServer.url = url.toString();
        cxServer.alias = alias;
        // updated server information = clear credentials
        cxServer.username = '';
        cxServer.password = '';
        cxServer.project_id = 0;
        cxServer.team_id = 0;
        cxServer.project_name = '';
        await this.updateServer(cxServer);
    }

    /**
     * Update CxServer settings
     * 
     * @param serverSettings updated CxServer settings
     */
    public static async updateServer(serverSettings: CxServerSettings) {
        if (serverSettings.password.length > 0) {
            serverSettings.password = Utility.encryptPassword(serverSettings.username, serverSettings.password);
        }
        await vscode.workspace.getConfiguration().update(CXSERVER, serverSettings);
    }

    /**
     * Update bound project settings.
     * 
     * @param boundProjectId boundProjectId = project Id
     * @param boundTeamId boundTeamId = team id
     * @param boundProjectName boundProjectName = project name
     */
    public static async updateBoundProject(boundProjectId: number, boundTeamId: number, boundProjectName: string) {
        let serverSettings: CxServerSettings = this.getServer();
        if (serverSettings) {
            serverSettings.project_id = boundProjectId;
            serverSettings.team_id = boundTeamId;
            serverSettings.project_name = boundProjectName;
            await this.updateServer(serverSettings);
        }
    }

    /**
     * Clear bound project settings.
     */
    public static async clearBoundProject() {
        let serverSettings: CxServerSettings = this.getServer();
        if (serverSettings) {
            serverSettings.project_id = 0;
            serverSettings.team_id = 0;
            serverSettings.project_name = '';
            await this.updateServer(serverSettings);
        }
    }

    /**
     * Returns CxServer saved in settings.json
     *
     * @returns cxserver settings as CxServerSettings struct
     */
    public static getServer(): CxServerSettings {
        const serverSettings: CxServerSettings = vscode.workspace.getConfiguration().get(CXSERVER) as CxServerSettings;
        if (serverSettings && serverSettings.password && serverSettings.password.length > 0) {
            serverSettings.password = Utility.decryptPassword(serverSettings.username, serverSettings.password);
        }
        return serverSettings;
    }

    /**
     * Returns value of the cx.enableScanButtons setting. The setting controls the scan any file/folder buttons.
     * Add "cx.enableScanButtons": true to the settings.json
     * @returns Value of cx.enableScanButtons setting
     */
    public static isScanButtonsEnabled(): boolean {
        return vscode.workspace.getConfiguration().get(CX_ENABLE_SCAN_BUTTONS) as boolean;
    }
 /**
     * Returns value of the cx.enableWorkspaceOnlyScan setting. The setting controls the scan any file/folder buttons.
     * Add "cx.enableWorkspaceOnlyScan": true to the settings.json
     * @returns Value of cx.enableWorkspaceOnlyScan setting
     */
  public static isWorkspaceOnlyScanEnabled(): boolean {
    return vscode.workspace.getConfiguration().get(CX_ENABLE_WORKSPACE_ONLY_SCAN) as boolean;
}


 /**
     * Returns value of the cx.enableUserCredentialsLogin setting. The setting controls the User credentials login.
     * Add "cx.enableUserCredentialsLogin": false to the settings.json
     * @returns Value of cx.enableUserCredentialsLogin setting
     */
  public static isEnableUserCredentialsLogin(): boolean {
    return vscode.workspace.getConfiguration().get(CX_ENABLE_USER_CREDENTIALS_LOGIN) as boolean;
}

 /**
     * Returns value of the cx.sslCertPath setting. The setting value will be used as certifcate path 
     * is used for SSL connection.
     * @returns Value of cx.sslCertPath setting
     */
  public static getSSLCertPath(): string {
    return vscode.workspace.getConfiguration().get(CX_SSL_CERT_PATH) as string;
}
    /**
     * Returns value of the cx.quiet setting. The setting controls the amount of popup messages displayed to the user.
     * Add "cx.quiet": true to the settings.json
     *
     * @returns Value of cx.quiet setting
     */
    public static isQuiet(): boolean {
        return vscode.workspace.getConfiguration().get(CXQUIET) as boolean;
    }

    /**
     * Stores folder exclusions in the settings.json
     *
     * @param folderExclusions string representing folder exclusions
     */
    public static async updateFolderExclusions(folderExclusions: string) {
        await vscode.workspace.getConfiguration().update(CX_FOLDER_EXCLUSIONS, folderExclusions);
    }

    /**
     * Returns the current value of cx.folderExclusions setting
     *
     * @returns Folder exclusions as string
     */
    public static getFolderExclusions(): string {
        const field = vscode.workspace.getConfiguration().get(CX_FOLDER_EXCLUSIONS);
        if (field) {
            return field as string;
        }
        else {
            return DEFAULT_FOLDER_EXCLUSIONS;
        }
    }

    /**
    * Stores folder exclusions in the settings.json
    *
    * @param fileExtensions string representing folder exclusions
    */
    public static async updateFileExtensions(fileExtensions: string) {
        await vscode.workspace.getConfiguration().update(CX_FILE_EXTENSIONS, fileExtensions);
    }

    /**
     * Returns the current value of cx.fileExtensions setting, or defaults if not currently set
     *
     * @returns file extensions as string
     */
    public static getFileExtensions(): string {
        const field = vscode.workspace.getConfiguration().get(CX_FILE_EXTENSIONS);
        if (field) {
            return field as string;
        }
        else {
            return DEFAULT_FILE_EXTENSIONS;
        }
    }

    /**
     * Stores mandatory comment in the settings.json
     *
     * @param isEnableMandatoryComment flag represents Mandatory Comment
     */
     public static async updateMandatoryCommentFlag(isEnableMandatoryComment: string) {
        await vscode.workspace.getConfiguration().update(CX_ENABLE_MANDATORY_COMMENT_ON_RESULT_STATE_CHANGE, isEnableMandatoryComment);
    }

    /**
     * Returns the current value of cx.folderExclusions setting
     *
     * @returns Folder exclusions as string
     */
    public static getMandatoryCommentFlag(): boolean {
        return vscode.workspace.getConfiguration().get(CX_ENABLE_MANDATORY_COMMENT_ON_RESULT_STATE_CHANGE) as boolean;
    }

    public static async updateReportPath(reportPath: string) {
        await vscode.workspace.getConfiguration().update(CX_REPORT_PATH, reportPath);
    }

    public static getReportPath(): string {
        return vscode.workspace.getConfiguration().get(CX_REPORT_PATH) as string;
    }

    public static updateFSConfigAsCode(fsCode: string, fsConfig: string): string {
        if (fsCode !== fsConfig) {
            fsCode = fsConfig;
        }
        return fsCode;
    }
}