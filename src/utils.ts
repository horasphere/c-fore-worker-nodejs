export async function readableStreamToString(readableStream): Promise<string | object> {
    let str = '';

    return new Promise((resolve, reject) => {
        readableStream.on('data', (data) => {
            str += data.toString();
        })

        readableStream.on('end', () => {
            resolve(str);
        })

        readableStream.on('error', reject)
    })
}