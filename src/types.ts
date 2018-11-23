import {Supervisor} from "./supervisor";

export type ConfigOptions = {
    rabbitmqUrl: string
    cforeApiBaseUrl: string
}

export type WorkerOptions = {
    appId: string,
    appVersion: string,
    execute(jobId: string, parameters: object, attachments: Attachment[], supervisor: Supervisor): Promise<JobResponse>
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