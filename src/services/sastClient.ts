import * as vscode from "vscode";
import { HttpClient } from "@checkmarx/cx-common-js-client";
import { ScanStatus } from "@checkmarx/cx-common-js-client";
import { ScanStage } from "@checkmarx/cx-common-js-client";
import { Waiter } from "@checkmarx/cx-common-js-client";
import { Logger } from "@checkmarx/cx-common-js-client";
import { PollingSettings } from "@checkmarx/cx-common-js-client";
import { CxSettings } from "../services/CxSettings";

export class SastClient {
    private static readonly POLLING_INTERVAL_IN_SECONDS = 10;

    private static readonly SCAN_COMPLETED_MESSAGE = 'Scan completed';

    constructor(private readonly scanId: number,
        private readonly httpClient: HttpClient,
        private readonly log: Logger,
        private readonly scanTimeoutInMinutes?: number) {
    }

    async waitForScanToFinish() {
        this.log.info('Waiting for CxSAST scan to finish.');
        if(!CxSettings.isQuiet()) { vscode.window.showInformationMessage('Waiting for CxSAST scan to finish.'); }

        const polling: PollingSettings = {
            masterTimeoutMinutes: this.scanTimeoutInMinutes,
            intervalSeconds: SastClient.POLLING_INTERVAL_IN_SECONDS
        };

        let lastStatus;
        const waiter = new Waiter();
        try {
            lastStatus = await waiter.waitForTaskToFinish(
                this.checkIfScanFinished,
                this.logWaitingProgress,
                polling);
        } catch (err) {
            throw Error(`Waiting for CxSAST scan has reached the time limit (${polling.masterTimeoutMinutes} minutes).`);
        }

        if (SastClient.isFinishedSuccessfully(lastStatus)) {
            this.log.info('SAST scan finished successfully.');
            if(!CxSettings.isQuiet()) { vscode.window.showInformationMessage('SAST scan finished successfully.'); }
        } else {
            SastClient.throwScanError(lastStatus);
        }
    }

    private static throwScanError(status: ScanStatus) {
        let details = '';
        if (status) {
            const stage = status.stage ? status.stage.value : '';
            details = `Status [${stage}]: ${status.stageDetails}`;
        }
        throw Error(`SAST scan cannot be completed. ${details}`);
    }

    private checkIfScanFinished = () => {
        return new Promise<ScanStatus>((resolve, reject) => {
            this.httpClient.getRequest(`sast/scansQueue/${this.scanId}`)
                .then((scanStatus: ScanStatus) => {
                    if (SastClient.isInProgress(scanStatus)) {
                        reject(scanStatus);
                    } else {
                        resolve(scanStatus);
                    }
                });
        });
    }

    private logWaitingProgress = (scanStatus: ScanStatus) => {
        const stage = scanStatus && scanStatus.stage ? scanStatus.stage.value : 'n/a';
        this.log.info(`Waiting for SAST scan results. ${scanStatus.totalPercent}% processed. Status: ${stage}.`);
        if(!CxSettings.isQuiet()) { vscode.window.showInformationMessage(`Waiting for SAST scan results. ${scanStatus.totalPercent}% processed. Status: ${stage}.`); }
    }

    private static isFinishedSuccessfully(status: ScanStatus) {
        return status && status.stage &&
            (status.stage.value === ScanStage.Finished ||
                status.stageDetails === SastClient.SCAN_COMPLETED_MESSAGE);
    }

    private static isInProgress(scanStatus: ScanStatus) {
        let result = false;
        if (scanStatus && scanStatus.stage) {
            const stage = scanStatus.stage.value;
            result =
                stage !== ScanStage.Finished &&
                stage !== ScanStage.Failed &&
                stage !== ScanStage.Canceled &&
                stage !== ScanStage.Deleted &&
                scanStatus.stageDetails !== SastClient.SCAN_COMPLETED_MESSAGE;
        }
        return result;
    }
}