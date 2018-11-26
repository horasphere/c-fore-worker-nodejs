import {PassThrough, Readable} from "stream";
import * as request from 'request';
import {Attachment} from "./types";
import * as fs from "fs";

request.defaults({
    headers : {},
    json : true,
    gzip : true,
});

export class Api {
    baseUrl: string
    constructor(cforceApiBaseUrl: string) {
        this.baseUrl = `${cforceApiBaseUrl}/api/v1`;
    }
    async listAttachments(jobId: string, type: string): Promise<Attachment[]> {
        const options = {
            method: 'GET',
            url: `${this.baseUrl}/jobs/${jobId}/attachments`,
            json: true,
            qs: {
                type
            }
        };

        return new Promise<Attachment[]>((resolve, reject) => {
            request(options, (err, response, attachments: Attachment[]) => {
                if(err) {
                    return reject(err);
                }
                else if(response.statusCode === 200) {
                    return resolve(attachments);
                }
                else if(response.statusCode === 404) {
                    return reject("job doesn't exists")
                }
                else {
                    return reject("couldn't complete request");
                }
            });

        })
    }
    getAttachmentAsStream(jobId: string, name: string): Readable {
        const options = {
            method: 'GET',
            url: `${this.baseUrl}/jobs/${jobId}/attachments/${name}/blob`,
            headers: {
                "Content-Type": 'application/octet-stream'
            }
        };

        return request(options).pipe(new PassThrough());
    }
    async uploadOutputAttachment(jobId: string, name: string, filepath: string): Promise<void> {
        const options = {
            method: 'POST',
            url: `${this.baseUrl}/jobs/${jobId}/attachments/${name}/blob?type=OUTPUT`,
            headers: {
                "Content-Type": 'application/octet-stream'
            }
        };
        return new Promise<void>((resolve, reject) => {
            fs.createReadStream(filepath)
                .on('response', (response) => {
                    if(response.statusCode === 200) {
                        return resolve();
                    }

                    reject('could not complete request');
                })
                .on('error', function(err) {
                    reject(err)
                })
                .pipe(request(options))
        })
    }
}