import {Api} from "./api";
import {createTmpDir, sinkToStream} from './utils';
import * as path from 'path';
import {Attachment, Job} from "./types";
import * as fs from "fs";

type ExecutionOptions = {
    jobId: string;
    api: Api,
    workspace: string
    inputFiles: string[]
    parameters: object
}

export interface IExecutionContext {
    getJobId(): string;
    getWorkspace(): string;
    getInputFiles(): string[];
    getParameters(): object;
    getFilePath(filename: string): string

}

class ExecutionContext implements IExecutionContext {
    private options: ExecutionOptions;
    constructor(options: ExecutionOptions) {
        this.options = options;
    }
    getJobId(): string {
        return this.options.jobId;
    }
    getInputFiles(): string[] {
        return this.options.inputFiles;
    }
    getWorkspace(): string {
        return this.options.workspace;
    }
    getFilePath(filename: string): string {
        return path.join(this.getWorkspace(), filename)
    }
    getParameters(): object {
        return this.options.parameters;
    }
}


export async function createExecutionContext(job: Job, api: Api): Promise<IExecutionContext> {
    return new Promise<ExecutionContext>(async (resolve, reject) => {
        try {
            const jobId = job.id;

            // create temporary workspace
            const workspacePath = await createTmpDir();

            // download input files
            const inputFiles: string[] = [];
            const inputAttachments: Attachment[] = job.attachments.filter(({type}) => {
                return type === 'INPUT';
            })

            const promises: Promise<void>[] = inputAttachments.map(({name}) => {
                const inputStream = api.getAttachmentAsStream(jobId, name);

                const filepath = path.join(workspacePath, name);
                inputFiles.push(filepath);
                return sinkToStream(inputStream, fs.createWriteStream(filepath));
            })

            await Promise.all(promises);

            const executionContext: ExecutionContext = new ExecutionContext({
                jobId,
                parameters: job.parameters,
                api,
                workspace: workspacePath,
                inputFiles
            })

            return resolve(executionContext);
        }
        catch(err) {
            return reject(err);
        }
    })

}


