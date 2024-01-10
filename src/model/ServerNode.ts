import * as vscode from "vscode";
import * as path from "path";
import * as url from "url";
import { INode } from "../interface/INode";
import { Logger,ScanResults,CxClient,ScanConfig ,SastConfig,TeamApiClient,HttpClient, AuthSSODetails,ProxyConfig} from "@checkmarx/cx-common-js-client";
import { ProjectNode } from "./ProjectNode";
import { ScanNode } from "./ScanNode";
import { Utility } from "../utils/util";
import { SastClient } from '../services/sastClient';
import { CxSettings } from "../services/CxSettings";
import { CxServerSettings } from "../services/CxSettings";
import { LoginChecks } from "../services/loginChecks";
import { LoginMethods } from './LoginMethods';
import { SSOConstants } from './ssoConstant';
import { SessionStorageService } from '../services/sessionStorageService';
import { CxPluginDetails } from "./CxPluginDetails";

export class ServerNode implements INode {

    private username: string;
    private password: string;
    public workspaceFolder: vscode.Uri | undefined;
    private httpClient: HttpClient | any;
    private scanedSources: Set<ScanNode>;
    public config: ScanConfig | any;
    private folderExclusion: string;
    private fileExtension: string;
    private projectName: string;
    private teamPath: string;
    private currentScanedSource: ScanNode | undefined;
    private currBoundProject: ProjectNode | any;
    private authSSODetails: AuthSSODetails | any;
    private storageManager :  SessionStorageService;
    private loginChecks: LoginChecks | any;
    private proxyConfig : ProxyConfig | any;

    constructor(public readonly sastUrl: string, private readonly alias: string, private readonly log: Logger,private readonly context: vscode.ExtensionContext) {
        this.username = '';
        this.password = '';
        const workspaceFolders = vscode.workspace.workspaceFolders;
        this.workspaceFolder = workspaceFolders ? workspaceFolders[0].uri : undefined;
       
        // read folder exclusions, or initialize to default
        this.folderExclusion = CxSettings.getFolderExclusions();

        // read file extensions, or initialize to default
        this.fileExtension = CxSettings.getFileExtensions();

        const baseUrl = url.resolve(this.sastUrl, 'CxRestAPI/');

        this.httpClient = new HttpClient(baseUrl, "Visual-Studio-Code","", this.log,this.proxyConfig,CxSettings.getSSLCertPath(), CxPluginDetails.getPluginVersion());

        this.storageManager = new SessionStorageService(context.workspaceState);

        this.loginChecks =  new LoginChecks(log,context,this.httpClient);
        
        this.projectName = '';
        this.teamPath = '';
       
        // read bound project, if available
        const cxServerSettings: CxServerSettings = CxSettings.getServer();
        try {
            if (cxServerSettings) {
                this.username = cxServerSettings.username;
                this.password = cxServerSettings.password;
                if (cxServerSettings.project_id > 0) {
                    this.currBoundProject = new ProjectNode(cxServerSettings.project_id, cxServerSettings.team_id, cxServerSettings.project_name);
                }
            }
        }
        catch (err) {
            log.error("Error reading server settings from settings.json: " + err);
        }

        this.scanedSources = new Set<ScanNode>();
    }

    private async updateFileSystemPatterns(pattern: string, prompt: string): Promise<string> {
        const options: vscode.InputBoxOptions = {
            prompt: prompt,
            value: pattern,
            valueSelection: [pattern.length, pattern.length]
        };
        await vscode.window.showInputBox(options).then((input) => {
            pattern = input ? input : pattern;
            pattern = pattern.trim();
            pattern = pattern.endsWith(',') ? pattern.slice(0, -1) : pattern;
        });
        return pattern;
    }

    public async updateFolderExclusion() {
        this.folderExclusion = CxSettings.updateFSConfigAsCode(this.folderExclusion, CxSettings.getFolderExclusions());
        this.folderExclusion = await this.updateFileSystemPatterns(this.folderExclusion, "Add/Modify folder exclusion");
        CxSettings.updateFolderExclusions(this.folderExclusion);
    }

    public isLoggedIn(): boolean {
        return this.loginChecks.isLoggedIn();
    }
    public async updateFileExtension() {
        this.fileExtension = CxSettings.updateFSConfigAsCode(this.fileExtension, CxSettings.getFileExtensions());
        this.fileExtension = await this.updateFileSystemPatterns(this.fileExtension, "Add/Modify file extension: included/excluded file starts without/with !");
        CxSettings.updateFileExtensions(this.fileExtension);
    }

    private printHeader() {
        this.log.debug(`
 CxCxCxCxCxCxCxCxCxCxCxCx          
CxCxCxCxCxCxCxCxCxCxCxCxCx         
CxCxCxCxCxCxCxCxCxCxCxCxCxCx        
CxCxCx                CxCxCxCx       
CxCxCx                CxCxCxCx       
CxCxCx  CxCxCx      CxCxCxCxC        
CxCxCx  xCxCxCx  .CxCxCxCxCx         
CxCxCx   xCxCxCxCxCxCxCxCx           
CxCxCx    xCxCxCxCxCxCx              
CxCxCx     CxCxCxCxCx   CxCxCx       
CxCxCx       xCxCxC     CxCxCx       
CxCxCx                 CxCxCx        
CxCxCxCxCxCxCxCxCxCxCxCxCxCx        
CxCxCxCxCxCxCxCxCxCxCxCxCx         
  CxCxCxCxCxCxCxCxCxCxCx           
                                    
    C H E C K M A R X              
                                    
Starting Checkmarx scan`);
    }

    private format(config: ScanConfig, sastConfig: SastConfig): void {
        const formatOptionalString = (input: string) => input || 'none';

        const idOrName = config.projectId ? 'id' : 'name';
        const project = config.projectId ? config.projectId : config.projectName;
        const team = sastConfig.teamId ? sastConfig.teamId : sastConfig.teamName;
        const preset = sastConfig.presetId ? sastConfig.presetId : sastConfig.presetName;

        this.log.debug(`
-------------------------------Configurations---------------------------------
SAST URL: ${sastConfig.serverUrl}
Project ${idOrName}: ${project}
Team ${idOrName}: ${team}
Preset ${idOrName}: ${preset}
Source location: ${config.sourceLocation}
Is incremental scan: ${sastConfig.isIncremental}
Is public scan: ${sastConfig.isPublic}
Folder exclusions: ${formatOptionalString(sastConfig.folderExclusion)}
File extensions: ${formatOptionalString(sastConfig.fileExtension)}
------------------------------------------------------------------------------
`       );
    }

   
    public async login() 
    {
        try 
        {
            if (this.loginChecks.isLoggedIn()) 
            {
                vscode.window.showInformationMessage('You are already logged in!');
                return;
            }
            let loginMethod = await this.getLoginMethod();

            if(loginMethod === LoginMethods.CREDENTIALS) 
            {
                await this.loginWithCredentials();
                this.log.info('Login successful');
                vscode.window.showInformationMessage('Login successful');
                this.storageManager.setValue<string>(SSOConstants.ACCESS_TOKEN, this.httpClient.accessToken);

                if (this.isBoundToProject()) 
                {
                    await this.retrieveLatestResults();
                }
            }
            else 
            {
                await this.ssoLogin();
            }         
        }    
        catch (err) {
            this.log.error(err);
            vscode.window.showErrorMessage('Login failed');
        }
    }
    private async getLoginMethod(): Promise<string> {
        let loginMethod: string;
        if(CxSettings.isEnableUserCredentialsLogin())
        {
             loginMethod  = await Utility.showPickString("Select login method", [ LoginMethods.SSO, LoginMethods.CREDENTIALS]);
        }else{
            loginMethod  =  LoginMethods.SSO;

        }
        return loginMethod;
    }
    private async loginWithCredentials() {
        const cxServer: CxServerSettings = CxSettings.getServer();
        if (cxServer.username.length > 0 && cxServer.password.length > 0) {
            this.username = cxServer.username;
            this.password = cxServer.password;
        } else {
            this.username = await Utility.showInputBox("Enter CxSAST Username", false, cxServer.username);
            this.password = await Utility.showInputBox("Enter CxSAST Password", true);
        }
        await this.httpClient.login(this.username, this.password);

        cxServer.username = this.username;
        cxServer.password = this.password;
        await CxSettings.updateServer(cxServer);

     
    }

    /**
     * This method invokes browser URL for single sign on login.
     * User needs to enter credentials in webconsole in order to generate authrorization code
     */
    private async ssoLogin() {
        try {
                this.authSSODetails =  new AuthSSODetails();
                this.authSSODetails.clientId = SSOConstants.vscode_client_id;
                this.authSSODetails.scope = SSOConstants.vscode_client_scope;
                this.authSSODetails.redirectURI = SSOConstants.vscode_redirect_uri ;

                this.log.info('Logging into Checkmarx with authorization code.');
                let authURL: string = await this.httpClient.getAuthorizationCodeURL(this.authSSODetails);
                
                // Open browser windows for SAST server login for SSO
                vscode.commands.executeCommand('vscode.open', vscode.Uri.parse(authURL));
               
        }catch (err) {
            this.log.error(err);
            vscode.window.showErrorMessage('Login failed');
        }

    }

    /**
     * This method gets invoked by URI handler when SSO login in started and
     * After we receive authorization code. We pass AuthSSODetails object to http client
     * getAccessTokenFromAuthorizationCode method to get access token
     */
    public async loginWithAuthCode(authSSODetails:AuthSSODetails){
        
        try{

            vscode.window.showInformationMessage('Logging into Checkmarx with authorization code.');
            await this.httpClient.getAccessTokenFromAuthorizationCode(authSSODetails);

            vscode.window.showInformationMessage('Login successful with authorization code.');
            let access_token = <string> this.httpClient.accessToken;

            /* Setting access token in context */ 
            this.storageManager.setValue<string>(SSOConstants.ACCESS_TOKEN, access_token);

            if (this.isBoundToProject()) {
                await this.retrieveLatestResults();
            }
        }catch (err) {
            this.log.error(err);
            vscode.window.showErrorMessage('Login failed. Not able to get access token using Authorization code.');
        }
		

    }

    
    public async logout() {
        
        if (!this.loginChecks.isLoggedIn()) {
            vscode.window.showErrorMessage('You are not logged in.');
            return;
        }
        this.httpClient.logout();
        //removing access token from context
        this.storageManager.setValue<string>(SSOConstants.ACCESS_TOKEN,'');
        this.log.info('Logout successful');
        if (!CxSettings.isQuiet()) {
            vscode.window.showInformationMessage('Logout successful');
        }
        const cxServer: CxServerSettings = CxSettings.getServer();
        cxServer.username = '';
        cxServer.password = '';
        this.authSSODetails = null;

        await CxSettings.updateServer(cxServer);
    }

    public getTreeItem(): vscode.TreeItem {
        return {
            label: (this.isBoundToProject()) ? this.alias + ' (' + this.currBoundProject.name + ')' : this.alias,
            tooltip: (this.isBoundToProject()) ? 'Bound to ' + this.currBoundProject.name : 'Not bound to a project',
            collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
            contextValue: "server_node",
            iconPath: {
                "light": path.join(__filename, "..", "..", "..", "resources", "icons", "light", "editor-layout.svg"),
                "dark": path.join(__filename, "..", "..", "..", "resources", "icons", "dark", "editor-layout.svg")
            }
        };
    }

    private async getProjectId(projectNode: ProjectNode): Promise<number> {
        if (projectNode) {
            return projectNode.id;
        }
        if (!this.loginChecks.isLoggedIn()) {
            throw Error('Access token expired. Please login.');
        }
        const projectList: any[] = await this.httpClient.getRequest('projects');
        if (projectList && projectList.length > 0) {
            const teamsByName = await this.getTeamsByName();
            const project = projectList.find(proj => proj['name'] === this.projectName && proj['teamId'] === teamsByName.get(this.teamPath));
            if (project) {
                return project['id'];
            }
        }

        return -1;
    }

    public async getChildren(): Promise<INode[]> {
        return Array.from(this.scanedSources);
    }

    private async choosePreset(): Promise<string> {
       
        const allPresets: any[] = await this.httpClient.getRequest('sast/presets');
        const allPresetNames: string[] = allPresets.map(preset => preset.name);

        return new Promise<string>(async (resolve) => {
            await vscode.window.showQuickPick(allPresetNames, { placeHolder: 'Choose Preset Name' }).then((preset) => {
                if (preset) {
                    if (!CxSettings.isQuiet()) {
                        vscode.window.showInformationMessage('Chosen Preset: ' + preset);
                    }
                    resolve(preset);
                }
            });
        });
    }

    private async chooseTeam(): Promise<string> {
       
        const allTeams: any[] = await this.httpClient.getRequest('auth/teams');
        const allTeamNames: string[] = allTeams.map(team => team.fullName);

        return new Promise<string>(async (resolve) => {
            await vscode.window.showQuickPick(allTeamNames, { placeHolder: 'Choose Team Path' }).then((team) => {
                if (team) {
                    if (!CxSettings.isQuiet()) {
                        vscode.window.showInformationMessage('Chosen Team: ' + team);
                    }
                    resolve(team);
                }
            });
        });
    }

    private async selectSourceLocation(isFolder: boolean, labelType: string): Promise<string> {
        const options: vscode.OpenDialogOptions = {
            defaultUri: this.workspaceFolder,
            openLabel: labelType,
            canSelectFiles: true,
            canSelectFolders: isFolder,
            canSelectMany: false
        };

        return new Promise<string>(async (resolve) => {
            await vscode.window.showOpenDialog(options).then((fileUri) => {
                if (fileUri && fileUri[0]) {
                    if (!CxSettings.isQuiet()) {
                        vscode.window.showInformationMessage('Selected source: ' + fileUri[0].fsPath);
                    }
                    resolve(fileUri[0].fsPath);
                }
            });
        });
    }

    private async getTeamsByName(): Promise<Map<string, number>> {
       
        const allTeams: any[] = await this.httpClient.getRequest('auth/teams');
        const teamsByName: Map<string, number> = new Map<string, number>();
        allTeams.forEach(team => teamsByName.set(team.fullName, team.id));
        return teamsByName;
    }

    private async getAllTeams(): Promise<any[]> {
        this.log.debug(`<performance> ${new Date()}: Fetching teams. `);
        let allTeams = await this.httpClient.getRequest('auth/teams');
        this.log.debug(`<performance> ${new Date()}: Fetched ${allTeams.length} teams successfully.`);
        
        return allTeams;
    }

    private async chooseBindTeam(): Promise<vscode.QuickPickItem | undefined> {
        let chosenTeam: vscode.QuickPickItem | undefined;
        const teams: vscode.QuickPickItem[] = [];

        let teamsList = await this.getAllTeams();

        this.log.debug(`<performance> ${new Date()}: Populating teams.`);
        for (let team of teamsList){
            teams.push({ 
                label: "Team: " + team['fullName'],
                detail: "Team Id: " + team['id']
            });
        }
        this.log.debug(`<performance> ${new Date()}: Populated teams successfully.`);

        this.log.debug(`<performance> ${new Date()}: Selecting a team.`);
        await vscode.window.showQuickPick(teams, { placeHolder: 'Choose a team' }).then((team) => {
            chosenTeam = team;
        });
        this.log.debug(`<performance> ${new Date()}: Selected ${chosenTeam ? chosenTeam : "team undefined"}.`);
        return chosenTeam;
    }

    private async chooseProjectToBind(projectList: any[]): Promise<vscode.QuickPickItem | undefined> {
        let chosenProject: vscode.QuickPickItem | undefined;
        const projects: vscode.QuickPickItem[] = [];
        
        this.log.debug(`<performance> ${new Date()}: Populating projects.`);
        projectList.forEach((project) => {
            projects.push({
                label: "Project: " + project['name']
            });
        }
        );
        this.log.debug(`<performance> ${new Date()}: Populated projects successfully.`);

        this.log.debug(`<performance> ${new Date()}: Selecting a project.`);
        await vscode.window.showQuickPick(projects, { placeHolder: 'Choose project to bind' }).then((project) => {
            chosenProject = project;
        });
        this.log.debug(`<performance> ${new Date()}: Selected ${chosenProject ? chosenProject : "project undefined"}.`);
        return chosenProject;
    }

    private reverseProjectList(list: []) {
        return list ? list.reverse() : list;
    }

    public async bindProject() 
    {
        let chosenProject: vscode.QuickPickItem | undefined;
        let chosenTeam: vscode.QuickPickItem | undefined;
        try {
            if (!this.loginChecks.isLoggedIn()) {
                throw Error('Access token expired. Please login.');
            }

            chosenTeam = await this.chooseBindTeam();
            
            if (chosenTeam){
                this.log.info(`Chosen Team:  ${chosenTeam.label}`);
                this.showMessage('Chosen ' + chosenTeam.label + ', ' + chosenTeam.detail);
                chosenTeam.label = chosenTeam.label.replace("Team: ", '');
                chosenTeam.detail = chosenTeam.detail?.replace("Team Id: ", '');
                let teamId = chosenTeam.detail;

                this.log.debug(`<performance> ${new Date()}: Fetching Projects for ${chosenTeam.label} team.`);
                let projectList = await this.httpClient.getRequest(`projects?teamid=${teamId}`);
                this.reverseProjectList(projectList);

                this.log.debug(`<performance> ${new Date()}: Fetched ${projectList.length} projects successfully.`);
                
                if(projectList && projectList.length > 0) {
                    chosenProject = await this.chooseProjectToBind(projectList);
                    if (chosenProject) {
                        this.log.info('Chosen ' + chosenProject.label);
                        this.showMessage('Chosen ' + chosenProject.label + ', Team Id: ' + teamId);
                        
                        chosenProject.label = chosenProject.label.replace("Project: ", '');
                        let chosenProjectName = chosenProject.label;
                        const boundProject: any = projectList.find( (project: { name: string; }) => project.name === chosenProjectName );
                        if (boundProject) {
                            this.currBoundProject = new ProjectNode(boundProject['id'], boundProject['teamId'], boundProject['name']);
                            await CxSettings.updateBoundProject(this.currBoundProject['id'], this.currBoundProject['teamId'], this.currBoundProject['name']);
                            await this.retrieveLatestResults();
                        } 
                    }  
                }
                else 
                {
                    vscode.window.showErrorMessage('There are no projects to bind to.');
                }
            }
            else
            {
                vscode.window.showErrorMessage('There are no teams on CxSAST server.');
            }
        } catch (err) {
            this.log.error(err);
            vscode.window.showErrorMessage(err.message);
            
        }
    }

    private async retrieveLatestResults() {
        if (!this.loginChecks.isLoggedIn()) {
            throw Error('Access token expired. Please login.');
        }
        const latestScan: any[] = await this.httpClient.getRequest(`sast/scans?last=1&projectId=${this.currBoundProject['id']}&scanStatus=Finished`);
        if (latestScan && latestScan.length === 1) {
            this.currentScanedSource = new ScanNode(latestScan[0].id, this.currBoundProject['id'], this.currBoundProject['name'],
             false, this.httpClient, this.log, this, false,this.loginChecks);
            this.displayCurrentScanedSource();
        }
    }

    public async unbindProject() {
        if (this.isBoundToProject()) {
            this.currBoundProject = undefined;
            await CxSettings.clearBoundProject();
            this.log.info('Project got unbound');
            if (!CxSettings.isQuiet()) {
                vscode.window.showInformationMessage('Project got unbound');
            }
        }
        else {
            this.log.error('No project got bound');
            if (!CxSettings.isQuiet()) {
                vscode.window.showErrorMessage('No project got bound');
            }
        }
    }

    private isBoundToProject(): boolean {
        return this.currBoundProject;
    }

    private isEquivalent(newSource: ScanNode, existSource: ScanNode): boolean {
        if (newSource.sourceLocation === existSource.sourceLocation) {
            existSource.scanId = newSource.scanId;
            existSource.projectId = newSource.projectId;
            return true;
        }
        return false;
    }

    private addSource(sourceLocation: string, scanId: number, projectId: number, isFolder: boolean) {
        const newSource: ScanNode = new ScanNode(scanId, projectId, sourceLocation, isFolder, 
            this.httpClient, this.log, this, true,this.loginChecks);
        let found: boolean = false;
        for (const source of this.scanedSources) {
            if (this.isEquivalent(newSource, source)) {
                this.currentScanedSource = source;
                found = true;
                break;
            }
        }
        if (!found) {
            this.scanedSources.add(newSource);
            this.currentScanedSource = newSource;
        }
    }

    public displayCurrentScanedSource() {
        if (this.currentScanedSource) {
            vscode.commands.executeCommand("cxportalwin.clickToRetrieveScanResults", this.currentScanedSource);
        }
    }

    private async isProjectExists() {
        const teamsByName = await this.getTeamsByName();
        const encodedName = encodeURIComponent(this.projectName);
        const projectRestApi = `projects?projectname=${encodedName}&teamid=${teamsByName.get(this.teamPath)}`;
        try {
            
            const projects = await this.httpClient.getRequest(projectRestApi, { suppressWarnings: true });
            if (projects && projects.length) {
                throw Error(`Project [${this.projectName}] already exists`);
            }
        } catch (err) {
            const isExpectedError = err.response && err.response.notFound;
            if (!isExpectedError) {
                throw err;
            }
        }
    }

    private showMessage(message : string){
        if (!CxSettings.isQuiet()) {
            vscode.window.showInformationMessage(message);
        }
    }

    async getSourceLocation(isFolder: boolean, scanPath: string): Promise<any> {

        // get the source location; if scanPath is empty, prompt user to select
        let sourceLocation: string;
        if (!scanPath || scanPath.length === 0) {
            const labelType: string = (isFolder) ? 'Scan Folder' : 'Scan File';
            sourceLocation = await this.selectSourceLocation(isFolder, labelType);
        }
        else {
            sourceLocation = scanPath;
        }
        return sourceLocation;
    }
    /**
     * @param projectNode  CxSAST project, or undefined if this workspace not yet bound to a project
     * @param isFolder True if scanning a folder; false if scanning a single file
     * @param scanPath Path to a file or a folder to be scanned; empty string will prompt user to select 
     */
    public async scan(isFolder: boolean, scanPath: string) {
        try {
            if (!this.loginChecks.isLoggedIn()) {
                throw Error('Access token expired. Please login.');
            }

            this.currentScanedSource = undefined;
            this.projectName = '';
            this.teamPath = '';

            let presetId: number | undefined;
            let presetName: string = '';
            
            let isProjPrivate:boolean = true;

            this.printHeader();
            this.log.debug('Entering CxScanner...\nReading configuration.');

            if (this.currBoundProject) {
               
                const settingsResponse = await this.httpClient.getRequest(`sast/scanSettings/${this.currBoundProject.id}`);
                presetId = settingsResponse && settingsResponse.preset && settingsResponse.preset.id;

                const settingsResponseProject = await this.httpClient.getRequest(`projects/${this.currBoundProject.id}`);
                isProjPrivate = !settingsResponseProject.isPublic;
            }
            else {
                this.projectName = await Utility.showInputBox("Enter project name", false);
                this.showMessage('Chosen Project: ' + this.projectName);
                
                this.teamPath = await this.chooseTeam();
                await this.isProjectExists();
                presetName = await this.choosePreset();

                const isProjectPrivate: string = await Utility.showPickString("Is project private?", ['Yes', 'No']);
                 isProjPrivate = Utility.modeIsEnabled(isProjectPrivate);
                if (isProjPrivate) {
                    this.showMessage('Project is private');
                } else {
                    this.showMessage('Project is public');
                }
            }

            let sourceLocation: string;
            sourceLocation = await this.getSourceLocation(isFolder,scanPath);

            const isScanIncremental = await Utility.showPickString("Is scan incremental?", ['Yes', 'No']);
            const isIncremental: boolean = Utility.modeIsEnabled(isScanIncremental);
            if (isIncremental) {
                this.showMessage('Scan is incremental');
            } else {
                this.showMessage('Scan is full');
            }
            
            var isPrivate : boolean;
            if(!isProjPrivate) // Checking if project is private all its scans are by default private. 
           //Hence no need of asking user another prompt to choose whether scan has to be private/public
            {
            const isScanPrivate = await Utility.showPickString("Is scan private?", ['Yes', 'No']);
             isPrivate = Utility.modeIsEnabled(isScanPrivate);
                if (isPrivate) {
                    this.showMessage('Scan is private');
                } else {
                    this.showMessage('Scan is public');
                }
            
          } else 
          {
            isPrivate = true;
          }

            this.folderExclusion = CxSettings.updateFSConfigAsCode(this.folderExclusion, CxSettings.getFolderExclusions());
            this.fileExtension = CxSettings.updateFSConfigAsCode(this.fileExtension, CxSettings.getFileExtensions());

            const sastConfig: SastConfig = {
                serverUrl: this.sastUrl,
                username: this.username,
                password: this.password,
                teamId: this.currBoundProject && this.currBoundProject.teamId,
                teamName: TeamApiClient.normalizeTeamName(this.teamPath),
                denyProject: false,
                folderExclusion: this.folderExclusion,
                fileExtension: this.fileExtension,
                isIncremental: isIncremental,
                presetId,
                presetName,
                scanTimeoutInMinutes: 120,
                comment: '',
                enablePolicyViolations: false,
                vulnerabilityThreshold: false,
                forceScan: false,
                isPublic: !isPrivate,
                postScanActionName: "",
                postScanActionId: -1,
                avoidDuplicateProjectScans:false,
                projectCustomFields: "",
                customFields: "",
                failBuildForNewVulnerabilitiesEnabled: false,
                failBuildForNewVulnerabilitiesSeverity: "",
                generatePDFReport: false,
                overrideProjectSettings: false,
                // This gets used only in ADO plugin. adding here to resolve compileation issue.
                cacert_chainFilePath: ""
            };

            let proxyResult: ProxyConfig ={
                proxyHost: '',
                proxyPass:  '',
                proxyPort: '',
                proxyUser:  '',
                proxyUrl:  '',
                sastProxyUrl: '',
                scaProxyUrl: '',
                resolvedProxyUrl: ''
    };

            const config: ScanConfig = {
                sourceLocation: sourceLocation,
                projectId: this.currBoundProject && this.currBoundProject.id,
                projectName: this.projectName,
                isSyncMode: false,
                enableProxy: false,
                cxOrigin: '',
                cxOriginUrl: '',
                enableDependencyScan: false,
                enableSastScan: true,
                sastConfig: sastConfig,
                proxyConfig: proxyResult
            };

            this.format(config, sastConfig);
            this.config = config;

            const cxClient = new CxClient(this.log);
            const scanResults: ScanResults = await cxClient.scan(config, this.httpClient);
            const sastClient = new SastClient(scanResults.scanId, this.httpClient, this.log,
                this.loginChecks, sastConfig.scanTimeoutInMinutes);
            await sastClient.waitForScanToFinish();

            const projectId: number = await this.getProjectId(this.currBoundProject);
            this.addSource(sourceLocation, scanResults.scanId, projectId, isFolder);
        } catch (err) {
            this.log.error(err);
            vscode.window.showErrorMessage(err.message);
        }
    }
}
