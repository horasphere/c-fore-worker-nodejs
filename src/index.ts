import {ConfigOptions, WorkerOptions} from "./types";
import {Supervisor} from "./supervisor";

export async function registerWorker(configOptions: ConfigOptions, workerOptions: WorkerOptions) {
    const supervisor = new Supervisor(configOptions, workerOptions);
    await supervisor.init();
}