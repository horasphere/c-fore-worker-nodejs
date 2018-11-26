import {promisify} from 'util';
import * as amqp from 'amqplib/callback_api';
import {ConfigOptions, Job, JobResponse, JobResponseStatus, WorkerOptions} from "./types";
import {createExecutionContext, IExecutionContext} from "./execution-context";
import {Api} from "./api";
import * as path from "path";
import {rmdir} from "./utils";

// const log = debug('worker:supervisor');
const log = console.log;

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
        log('initialization');
        const { rabbitmqUrl, cforeApiBaseUrl } = this.supervisorOptions;
        const { appId } = this.worker;

        const api = new Api(cforeApiBaseUrl);

        log('connect to rabbitmq');
        const connection = await connect(rabbitmqUrl);
        const channel = await createChannel(connection);

        const q = `${QUEUE_PREFIX}.${appId}`;
        channel.assertQueue(q, {durable: true});
        log(`connected to queue: ${q}`);

        // don't dispatch a new message to a worker until it has processed and acknowledged the previous one.
        channel.prefetch(1);

        channel.consume(q, async (msg) => {
            const job: Job = JSON.parse(msg.content.toString());
            const executionContext: IExecutionContext = await createExecutionContext(job, api);

            log(`pull item from queue: ${q}`);
            log(`job: ${job.id}`);

            let jobResponse: JobResponse;
            try {
                log(`execute worker`);
                let outputFiles: string[] = await this.worker.execute(executionContext);

                log(`result files: ${outputFiles.join(', ')}`);
                const promises = outputFiles.map((filepath) => {
                    const filename = path.basename(filepath);

                    log(`upload attachment: ${filepath}`);
                    return api.uploadOutputAttachment(job.id, filename, filepath);
                })
                await Promise.all(promises);
                log(`uploaded attachments`);

                jobResponse = {
                    status: JobResponseStatus.Succeeded,
                    message: '',
                    details: {}
                }
            }
            catch(err) {
                jobResponse = {
                    status: JobResponseStatus.CouldNotComplete,
                    message: '',
                    details: err || {},
                }
            }

            try {
                await rmdir(executionContext.getWorkspace());
            }
            catch(err) {
                // do nothing it will be cleaned up on process.exit
            }
            console.log('send to queue', jobResponse)
            channel.sendToQueue(msg.properties.replyTo,
                new Buffer(JSON.stringify(jobResponse)),
                {correlationId: msg.properties.correlationId});

            console.log('ack msg')
            channel.ack(msg);
        }, {noAck: false});
    }
}