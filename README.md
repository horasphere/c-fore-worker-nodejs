# c-fore-worker-nodejs

C-fore Node.js worker registration

# Sample


```
await registerWorker({
        rabbitmqUrl: 'amqp://localhost',
        cforeApiBaseUrl: 'http://localhost',
    }, 
    {
        appId: 'file-logger',
        appVersion: '1',
        async execute(jobId: string, parameters: object, attachments: Attachment[], supervisor: Supervisor): Promise<JobResponse> {
            const content = await readableStreamToString(supervisor.getAttachment(jobId, 'problem.txt'));
            console.log(content);

            await supervisor.attachOutputFile(jobId, 'output.txt', fs.createReadStream('output.txt'));

            return {
                status: JobResponseStatus.Succeeded,
                message: '',
                details: {}
            };
        }

    })
```