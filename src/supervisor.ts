import {promisify} from 'util';
import * as amqp from 'amqplib/callback_api';
import {ConfigOptions, JobResponse, JobResponseStatus, WorkerOptions} from "./types";
import * as request from 'request';
import * as tmp from 'tmp';
import {PassThrough, Readable, Writable} from "stream";
import * as fs from "fs";

const QUEUE_PREFIX = `c-fore.worker`;

async function connect(rabbitmqUrl: string) {
    return promisify(amqp.connect)(rabbitmqUrl);
}

async function createChannel(connection: any) {
    return promisify(connection.createChannel.bind(connection))();
}

export class Supervisor {
    supervisorOptions: ConfigOptions;
    worker: WorkerOptions;
    baseUrl: string;
    constructor(configOptions: ConfigOptions, worker: WorkerOptions) {
        this.supervisorOptions = configOptions;
        this.worker = worker;
    }
    async init() {
        const { rabbitmqUrl, cforeApiBaseUrl } = this.supervisorOptions;
        const { appId } = this.worker;
        this.baseUrl = `${cforeApiBaseUrl}/api/v1`;

        request.defaults({
            headers : {},
            json : true,
            gzip : true,
        });

        const connection = await connect(rabbitmqUrl);
        const channel = await createChannel(connection);

        const q = `${QUEUE_PREFIX}.${appId}`;

        channel.assertQueue(q, {durable: true});

        // don't dispatch a new message to a worker until it has processed and acknowledged the previous one.
        channel.prefetch(1);

        channel.consume(q, async (msg) => {
            const {id, parameters, attachments} = JSON.parse(msg.content.toString());

            let jobResponse: JobResponse;
            try {
                jobResponse = await this.worker.execute(id, parameters, attachments, this);
            }
            catch(err) {
                jobResponse = {
                    status: JobResponseStatus.CouldNotComplete,
                    message: '',
                    details: err,
                }
            }

            channel.sendToQueue(msg.properties.replyTo,
                new Buffer(JSON.stringify(jobResponse)),
                {correlationId: msg.properties.correlationId});

            channel.ack(msg);
        }, {noAck: false});
    }
    getAttachmentAsStream(jobId, name): Readable {
        const options = {
            method: 'GET',
            url: `${this.baseUrl}/jobs/${jobId}/attachments/${name}/blob`,
            headers: {
                "Content-Type": 'application/octet-stream'
            }
        };

        return request(options).pipe(new PassThrough());
    }

    async getAttachmentAsLocalTempFile(jobId: string, filename: string): Promise<string> {
        return new Promise<string>(async (resolve, reject) => {
            try {
                const tmpInputPath = await this.createTmpFile();
                const inputStream = this.getAttachmentAsStream(jobId, filename);
                await this.streamToWritable(inputStream, fs.createWriteStream(tmpInputPath));

                return resolve(tmpInputPath);
            }
            catch(err) {
                reject(err);
            }
        })
    }

    async removeLocalFile(filename: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            fs.unlink(filename, (err) => {
                if(err) {
                    return reject(err);
                }

                return resolve();
            })
        })
    }

    async uploadOutputFile(jobId: string, filename: string, readableStream: Readable): Promise<void> {
        const options = {
            method: 'POST',
            url: `${this.baseUrl}/jobs/${jobId}/attachments/${filename}/blob?type=OUTPUT`,
            headers: {
                "Content-Type": 'application/octet-stream'
            }
        };

        return new Promise<void>((resolve, reject) => {
            readableStream
                .pipe(request(options))
                .on('response', (response) => {
                    if(response.statusCode === 200) {
                        return resolve();
                    }

                    reject('could not complete request');
                })
                .on('error', function(err) {
                    reject(err)
                })
        })
    }

    async createTmpFile(): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            tmp.file((err, path, fd, cleanupCallback) => {
                if(err) {
                    return reject(err);
                }

                return resolve(path)
            })
        })
    }

    async streamToWritable(inputStream: Readable, writableStream: Writable): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            try {
                inputStream.pipe(writableStream);

                inputStream.on('end', () => {
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
}