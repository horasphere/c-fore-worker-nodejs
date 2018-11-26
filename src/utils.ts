import {Readable, Writable} from "stream";
import * as tmp from 'tmp';
import * as fs from "fs";

export async function sinkToStream(inputStream: Readable, writableStream: Writable): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        try {
            inputStream.pipe(writableStream);

            writableStream.on('close', () => {
                resolve();
            })

            inputStream.on('error', (err) => {
                reject(err);
            })
        }
        catch(err) {
            reject(err)
        }
    })
}

export async function createTmpFile(): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        tmp.file({discardDescriptor : true}, (err, path, fd, cleanupCallback) => {
            if(err) {
                return reject(err);
            }

            return resolve(path)
        })
    })
}

export async function createTmpDir() {
    return new Promise<string>((resolve, reject) => {
        tmp.dir((err, path, cleanupCallback) => {
            if(err) {
                return reject(err);
            }

            return resolve(path)
        })
    })
}

export function parametersToCliOptions(parameters: object): string
{
    return Object.keys(parameters).map((key) => {
        const value = parameters[key];
        if(value === 'true' || value === true) {
            return `--${key}`
        }

        if(value && value !== 'false') {
            return `--${key} ${value}`
        }

        return null;
    })
    .filter((arg) => (arg !== null))
    .join(' ')
}

export async function rmdir(dir: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        return fs.rmdir(dir, (err) => {
            if(err) {
                return reject(err);
            }

            return resolve();
        })

    })
}
