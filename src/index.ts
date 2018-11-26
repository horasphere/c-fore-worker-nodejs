import {ConfigOptions, WorkerOptions} from "./types";
import {IExecutionContext} from "./execution-context";
import {Supervisor} from "./supervisor";
import * as _utils from './utils';

// const log = debug('worker:supervisor:register');
const log = console.log;

export async function registerWorker(configOptions: ConfigOptions, workerOptions: WorkerOptions) {
    log(`register worker ${workerOptions.appId}:${workerOptions.appVersion}`);
    const supervisor = new Supervisor(configOptions, workerOptions);
    log(`initialize supervisor`);
    await supervisor.init();
}

export const utils = _utils;
