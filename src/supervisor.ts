import {promisify} from 'util';
import * as amqp from 'amqplib/callback_api';
import {ConfigOptions, JobResponse, JobResponseStatus, WorkerOptions} from "./types";
import * as request from 'request';
import {PassThrough, Readable} from "stream";

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
    getAttachment(jobId, name): Readable {
        const options = {
            method: 'GET',
            url: `${this.baseUrl}/jobs/${jobId}/attachments/${name}/blob`,
            headers: {
                "Content-Type": 'application/octet-stream'
            }
        };

        return request(options).pipe(new PassThrough());
    }
    async attachOutputFile(jobId: string, filename: string, readableStream: Readable): Promise<any> {
        const options = {
            method: 'POST',
            url: `${this.baseUrl}/jobs/${jobId}/attachments/${filename}/blob?type=OUTPUT`,
            headers: {
                "Content-Type": 'application/octet-stream'
            }
        };

        return new Promise((resolve, reject) => {
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
}