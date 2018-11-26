import {IExecutionContext} from "./execution-context";

export type ConfigOptions = {
    rabbitmqUrl: string
    cforeApiBaseUrl: string
}

export type WorkerOptions = {
    appId: string,
    appVersion: string,
    execute(executionContext: IExecutionContext): Promise<string[]> // returns outputfiles
}

export enum AttachmentType {
    Input = 'INPUT',
    Output = 'OUTPUT'
}

export type Attachment = {
    name: string;
    type: AttachmentType;
    createdAt: string;
};

export enum JobResponseStatus {
    Succeeded = "SUCCEEDED",
    Failed = "FAILED",
    CouldNotComplete = "COULD_NOT_COMPLETE"
}

export type JobResponse = {
    status: JobResponseStatus,
    message: string,
    details: {}
}

export type Job = {
    id: string;
    parameters: object;
    attachments: Attachment[]
}