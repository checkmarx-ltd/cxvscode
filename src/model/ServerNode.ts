import * as vscode from "vscode";
import * as path from "path";
import * as url from "url";
import { INode } from "../interface/INode";
import { Logger } from "@checkmarx/cx-common-js-client";
import { ScanResults } from "@checkmarx/cx-common-js-client";
import { CxClient } from "@checkmarx/cx-common-js-client";
import { ScanConfig } from "@checkmarx/cx-common-js-client";
import { TeamApiClient } from "@checkmarx/cx-common-js-client";
import { HttpClient } from "@checkmarx/cx-common-js-client";
import { ProjectNode } from "./ProjectNode";
import { ScanNode } from "./ScanNode"
import { Utility } from "../utils/util";
import { SastClient } from '../services/sastClient'

export class ServerNode implements INode {

    public workspaceFolder: vscode.Uri | undefined;
    private httpClient: HttpClient | any;
    private scanedSources: Set<ScanNode>;
    public config: ScanConfig | any;
    private folderExclusion: string;
    private fileExtension: string;
    private projectName: string;
    private teamPath: string;

    constructor(private readonly sastUrl: string, private readonly alias: string, private readonly username: string,
        private readonly password: string, private readonly log: Logger) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        this.workspaceFolder = workspaceFolders ? workspaceFolders[0].uri : undefined;
        this.folderExclusion = "cvs, .svn, .hg, .git, .bzr, bin, obj, backup, .idea";
        this.fileExtension = "!*.DS_Store, !*.ipr, !*.iws, !*.bak, !*.tmp, !*.aac, !*.aif, !*.iff, !*.m3u, !*.mid, !*.mp3, !*.mpa, !*.ra, !*.wav, !*.wma, !*.3g2, !*.3gp, !*.asf, !*.asx, !*.avi, !*.flv, !*.mov, !*.mp4, !*.mpg, !*.rm, !*.swf, !*.vob, !*.wmv, !*.bmp, !*.gif, !*.jpg, !*.png, !*.psd, !*.tif, !*.swf, !*.jar, !*.zip, !*.rar, !*.exe, !*.dll, !*.pdb, !*.7z, !*.gz, !*.tar.gz, !*.tar, !*.gz, !*.ahtm, !*.ahtml, !*.fhtml, !*.hdm, !*.hdml, !*.hsql, !*.ht, !*.hta, !*.htc, !*.htd, !*.war, !*.ear, !*.htmls, !*.ihtml, !*.mht, !*.mhtm, !*.mhtml, !*.ssi, !*.stm, !*.stml, !*.ttml, !*.txn, !*.xhtm, !*.xhtml, !*.class, !*.iml";
        const baseUrl = url.resolve(this.sastUrl, 'CxRestAPI/');
        this.httpClient = new HttpClient(baseUrl, "Visual Studio Code", this.log);
        this.scanedSources = new Set<ScanNode>();
        this.projectName = '';
        this.teamPath = '';
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
        this.folderExclusion = await this.updateFileSystemPatterns(this.folderExclusion, "Add/Modify folder exclusion");
    }

    public async updateFileExtension() {
        this.fileExtension = await this.updateFileSystemPatterns(this.fileExtension, "Add/Modify file extension: included/excluded file starts without/with !");
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

    private format(config: ScanConfig): void {
        const formatOptionalString = (input: string) => input || 'none';

        const idOrName = config.projectId ? 'id' : 'name';
        const project = config.projectId ? config.projectId : config.projectName;
        const team = config.teamId ? config.teamId : config.teamName;
        const preset = config.presetId ? config.presetId : config.presetName;

        this.log.debug(`
-------------------------------Configurations---------------------------------
SAST URL: ${config.serverUrl}
Project ${idOrName}: ${project}
Team ${idOrName}: ${team}
Preset ${idOrName}: ${preset}
Source location: ${config.sourceLocation}
Is incremental scan: ${config.isIncremental}
Is synchronous scan: ${config.isSyncMode}
Is public scan: ${config.isPublic}
Folder exclusions: ${formatOptionalString(config.folderExclusion)}
File extensions: ${formatOptionalString(config.fileExtension)}
------------------------------------------------------------------------------
`);
    }

    public async login() {
        try {
            await this.httpClient.login(this.username, this.password);
            this.log.info('Login successful');
            vscode.window.showInformationMessage('Login successful');
        }
        catch (err) {
            this.log.error(err);
            vscode.window.showErrorMessage(err.message);
        }
    }

    public getTreeItem(): vscode.TreeItem {
        return {
            label: this.alias,
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

        const projectList: any[] = await this.httpClient.getRequest('projects');
        if (projectList) {
            const allTeams: any[] = await this.httpClient.getRequest('auth/teams');
            const teams: Map<string, number> = new Map<string, number>();
            allTeams.forEach(team => teams.set(team.fullName, team.id));
            const project = projectList.find(project => project['name'] === this.projectName && project['teamId'] === teams.get(this.teamPath));
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
        let chosenPreset: string | any;
        const allPresets: any[] = await this.httpClient.getRequest('sast/presets');
        const allPresetNames: string[] = allPresets.map(preset => preset.name);

        await vscode.window.showQuickPick(allPresetNames, { placeHolder: 'Choose Preset Name' }).then((preset) => {
            chosenPreset = preset;
            if (chosenPreset) {
                vscode.window.showInformationMessage('Chosen Preset: ' + chosenPreset);
            }
        });

        return chosenPreset;
    }

    private async chooseTeam(): Promise<string> {
        let chosenTeam: string | any;
        const allTeams: any[] = await this.httpClient.getRequest('auth/teams');
        const allTeamNames: string[] = allTeams.map(team => team.fullName);

        await vscode.window.showQuickPick(allTeamNames, { placeHolder: 'Choose Team Path' }).then((team) => {
            chosenTeam = team;
            if (chosenTeam) {
                vscode.window.showInformationMessage('Chosen Team: ' + chosenTeam);
            }
        });

        return chosenTeam;
    }

    private async selectSourceLocation(isFolder: boolean, labelType: string): Promise<string | any> {
        let sourceLocation: string | any;

        const options: vscode.OpenDialogOptions = {
            defaultUri: this.workspaceFolder,
            openLabel: labelType,
            canSelectFiles: true,
            canSelectFolders: isFolder,
            canSelectMany: false
        };

        await vscode.window.showOpenDialog(options).then((fileUri) => {
            if (fileUri && fileUri[0]) {
                sourceLocation = fileUri[0].fsPath;
                vscode.window.showInformationMessage('Selected source for scan: ' + sourceLocation);
            }
        });

        return sourceLocation;
    }

    private async getAllTeams(): Promise<[Map<number, string>, Map<string, number>]> {
        const allTeams: any[] = await this.httpClient.getRequest('auth/teams');
        const teamsById: Map<number, string> = new Map<number, string>();
        const teamsByName: Map<string, number> = new Map<string, number>();
        allTeams.forEach(team => teamsById.set(team.id, team.fullName));
        allTeams.forEach(team => teamsByName.set(team.fullName, team.id));
        return [teamsById, teamsByName];
    }

    private async chooseProjectToBind(projectList: any[], teamsById: Map<number, string>): Promise<vscode.QuickPickItem | undefined> {
        let chosenProject: vscode.QuickPickItem | undefined;
        const projects: vscode.QuickPickItem[] = [];
        // let lastScan: any[];

        projectList.forEach((project) => {
            // lastScan = await this.httpClient.getRequest(`sast/scans?projectId=${project['id']}&last=1`);
            projects.push({
                label: "project: " + project['name'],
                detail: "team: " + teamsById.get(project['teamId'])
                // description: "owner: " + lastScan && lastScan[0] && lastScan[0].owner
            });
        }
        );

        await vscode.window.showQuickPick(projects, { placeHolder: 'Choose project to bind' }).then((project) => {
            chosenProject = project;
        });

        return chosenProject;
    }

    public async bindProject(): Promise<ProjectNode | any> {
        let chosenProjectNode: ProjectNode | any;
        let chosenProject: vscode.QuickPickItem | undefined;
        try {
            const projectList: any[] = await this.httpClient.getRequest('projects');
            if (projectList) {
                const [teamsById, teamsByName] = await this.getAllTeams();
                chosenProject = await this.chooseProjectToBind(projectList, teamsById);
                if (chosenProject) {
                    vscode.window.showInformationMessage('Chosen: ' + chosenProject.label + ', ' + chosenProject.detail);
                    chosenProject.label = chosenProject.label.replace("project: ", '');
                    chosenProject.detail = chosenProject.detail?.replace("team: ", '');
                    const boundProject: any = projectList.find(project => project['name'] === chosenProject?.label && project['teamId'] === teamsByName.get(chosenProject?.detail || ''));
                    if (boundProject) {
                        chosenProjectNode = new ProjectNode(boundProject['id'], boundProject['teamId'], boundProject['name']);
                    }
                }
            }
        } catch (err) {
            this.log.error(err);
            if (err.message === 'Login failed') {
                vscode.window.showErrorMessage('Access token expired. Please login.');
            }
            else {
                vscode.window.showErrorMessage(err.message);
            }
        }
        return chosenProjectNode;
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
        const newSource: ScanNode = new ScanNode(scanId, projectId, sourceLocation, isFolder, this.httpClient, this.log, this)
        let found: boolean = false;
        for (const source of this.scanedSources) {
            if (this.isEquivalent(newSource, source)) {
                found = true;
                break;
            }
        }
        if (!found) {
            this.scanedSources.add(newSource);
        }
    }

    public async scan(projectNode: ProjectNode, isFolder: boolean, labelType: string) {
        try {
            this.projectName = '';
            this.teamPath = '';

            let presetId: number | undefined;
            let presetName: string = '';

            this.printHeader();
            this.log.debug('Entering CxScanner...\nReading configuration.');

            if (projectNode) {
                const settingsResponse = await this.httpClient.getRequest(`sast/scanSettings/${projectNode.id}`);
                presetId = settingsResponse && settingsResponse.preset && settingsResponse.preset.id;
            }
            else {
                this.projectName = await Utility.showInputBox("Enter project name", false);
                this.teamPath = await this.chooseTeam();
                if (!this.teamPath) {
                    return;
                }
                presetName = await this.choosePreset();
                if (!presetName) {
                    return;
                }
            }

            const sourceLocation: string | any = await this.selectSourceLocation(isFolder, labelType);
            if (!sourceLocation) {
                return;
            }
            const isScanIncremental = await Utility.showInputBox("Is scan incremental? (y/n)", false);
            const isScanPublic = await Utility.showInputBox("Is scan public? (y/n)", false);

            const config: ScanConfig = {
                serverUrl: this.sastUrl,
                username: this.username,
                password: this.password,
                sourceLocation: sourceLocation,
                projectId: projectNode && projectNode.id,
                projectName: this.projectName,
                teamId: projectNode && projectNode.teamId,
                teamName: TeamApiClient.normalizeTeamName(this.teamPath),
                denyProject: false,
                folderExclusion: this.folderExclusion,
                fileExtension: this.fileExtension,
                isIncremental: Utility.modeIsEnabled(isScanIncremental),
                isSyncMode: false,
                presetId,
                presetName,
                scanTimeoutInMinutes: undefined,
                comment: '',
                enablePolicyViolations: false,
                vulnerabilityThreshold: false,
                highThreshold: undefined,
                mediumThreshold: undefined,
                lowThreshold: undefined,
                forceScan: false,
                isPublic: Utility.modeIsEnabled(isScanPublic),
                cxOrigin: 'Visual Studio Code',
                enableDependencyScan: false,
                enableSastScan: true
            };

            this.format(config);
            this.config = config;

            const cxClient = new CxClient(this.log);
            const scanResults: ScanResults = await cxClient.scan(config);
            const sastClient = new SastClient(scanResults.scanId, this.httpClient, this.log, config.scanTimeoutInMinutes);
            await sastClient.waitForScanToFinish();

            const projectId: number = await this.getProjectId(projectNode);
            this.addSource(sourceLocation, scanResults.scanId, projectId, isFolder);
        } catch (err) {
            this.log.error(err);
            vscode.window.showErrorMessage(err.message);
        }
    }
}