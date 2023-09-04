import { ModuleThread, spawn, Thread, Worker } from 'threads';
import { consoleLogger } from '../../logger/consoleLogger';
import { LoggerType } from '../../logger/types';
import { isASAR, WorkerData } from './types';
import { handleLog } from './logger';
import { join } from 'path';

export class WorkerAccelerator {
  private readonly workerPath: string;
  private proxy: ModuleThread | undefined;
  private methods: string[];

  private logger?: LoggerType;

  private isReady = false;
  private onReady: Promise<any> | undefined;

  constructor() {
    const appDir = join(__dirname, '..', '..', '..');
    if (isASAR(appDir)) {
      this.workerPath = '../sqlWorker.bundle.js';
    } else {
      this.workerPath = '../sqlWorker.js';
    }

    this.methods = [];
  }

  private getLogger() {
    return this.logger || consoleLogger;
  }

  public getLogTag() {
    return 'ACC';
  }

  private async getProxy(wait: boolean = false) {
    if (!this.isReady) {
      const error = 'db is not initialized';
      this.getLogger().warn(error);
      if (!wait) {
        throw new Error(error);
      }
    }

    if (this.onReady) {
      await this.onReady;
    }

    if (!this.proxy) {
      const error = 'proxy is not initilized';
      this.getLogger().warn(error);
      throw new Error(error);
    }

    return this.proxy;
  }

  public async initialize({
    configDir,
    key,
    logger,
  }: {
    configDir: string;
    key: string;
    logger?: LoggerType;
  }): Promise<void> {
    if (this.isReady || this.onReady) {
      throw new Error('Already initialized');
    }

    if (logger) {
      this.logger = logger;
    }

    const workerData: WorkerData = { workerType: 'sql_worker_acc' };
    const spawnOptions = { timeout: 60 * 1000 };
    this.proxy = await spawn(
      new Worker(this.workerPath, { workerData }),
      spawnOptions
    );

    this.proxy.getLogObserver().subscribe(response => {
      try {
        handleLog(this.getLogger(), response, this.getLogTag());
      } catch (error) {
        this.getLogger().error('handle log error:', error, response);
      }
    });

    this.onReady = this.proxy.initialize(configDir, key);
    await this.onReady;

    this.onReady = undefined;
    this.isReady = true;

    this.methods = await this.proxy.getSQLMethods();
  }

  public async close(exit: boolean): Promise<void> {
    const proxy = await this.getProxy();
    await proxy.close();

    if (exit) {
      await Thread.terminate(proxy);
      this.proxy = undefined;
    }
  }

  public async removeDB(): Promise<void> {
    const proxy = await this.getProxy();
    return proxy.removeDB();
  }

  public async getSQLMethods() {
    // make sure initialized
    await this.getProxy(true);
    return this.methods;
  }

  public async sqlCall(method: string, ...args: ReadonlyArray<any>) {
    const proxy = await this.getProxy(true);
    const methods = await proxy.getSQLMethods();

    if (!methods.includes(method)) {
      throw new Error('method is not defined,' + method);
    }

    return proxy[method](...args);
  }

  public async sqlCallEasy(method: string, ...args: ReadonlyArray<any>) {
    const wrappedResult = await this.sqlCall(method, ...args);
    return wrappedResult.result;
  }
}
