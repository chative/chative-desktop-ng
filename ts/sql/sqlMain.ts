// install sql worker
// and forward messages bettween worker and render

import { consoleLogger } from '../logger/consoleLogger';
import { LoggerType } from '../logger/types';
import { WorkerAccelerator } from './sqlWorkerWrapper/workerAccelerator';
import { WorkerDatabase } from './sqlWorkerWrapper/workerDatabase';
import { WrappedCallResult } from './sqlWorkerWrapper/types';
import { MethodCache } from './utils/methodCache';
import { logSeqId, shouldTrace } from '../logger/utils';

export class MainSQL {
  private workerDatabase: WorkerDatabase;
  private workerAccelerator: WorkerAccelerator;

  private methodCache: MethodCache = new MethodCache();

  private isReady = false;
  private onReady: Promise<any> | undefined;

  // // This promise is resolved when any of the queries that we run against the
  // // database reject with a corruption error (see `isCorruptionError`)
  // private readonly onCorruption: Promise<Error>;

  private logger?: LoggerType;

  constructor() {
    this.workerDatabase = new WorkerDatabase();
    this.workerAccelerator = new WorkerAccelerator();
  }

  private getLogger() {
    return this.logger || consoleLogger;
  }

  private getWorkerByMethod(method: string) {
    return this.methodCache.getByMethod(method) || this.workerDatabase;
  }

  private async migrateFromMainToAcc() {
    const oldCount = await this.workerDatabase.sqlCallEasy(
      'getUnprocessedCount'
    );
    if (!oldCount) {
      return;
    }

    const all = await this.workerDatabase.sqlCallEasy('getAllUnprocessed');
    while (all.length) {
      const items = all.splice(0, 50);
      const options = { forceSave: true };

      await this.workerAccelerator.sqlCallEasy(
        'saveUnprocesseds',
        items,
        options
      );

      await this.workerAccelerator.sqlCallEasy(
        'updateUnprocessedsWithData',
        items.map((item: { id: string }) => ({ id: item.id, data: item }))
      );
    }

    await this.workerDatabase.sqlCallEasy('removeAllUnprocessed');
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

    const options = { configDir, key, logger: this.getLogger() };

    this.onReady = Promise.all([
      this.workerDatabase.initialize(options),
      this.workerAccelerator.initialize(options),
    ]);
    await this.onReady;

    // migrate old data from main to acc
    await this.migrateFromMainToAcc();

    const methods = await this.workerAccelerator.getSQLMethods();
    this.methodCache.mapAddMethods(this.workerAccelerator, methods);

    this.onReady = undefined;
    this.isReady = true;
  }

  public async close(exit: boolean): Promise<void> {
    if (!this.isReady) {
      throw new Error('Not initialized');
    }

    await Promise.all([
      this.workerDatabase.close(exit),
      this.workerAccelerator.close(exit),
    ]);
  }

  public async removeDB(): Promise<void> {
    await Promise.all([
      this.workerDatabase.removeDB(),
      this.workerAccelerator.removeDB(),
    ]);
  }

  public async removeIndexedDBFiles(): Promise<void> {
    await this.workerDatabase.removeDB();
  }

  public async sqlCall(
    method: string,
    ...args: ReadonlyArray<any>
  ): Promise<WrappedCallResult> {
    if (this.onReady) {
      await this.onReady;
    }

    if (!this.isReady) {
      throw new Error('Not initialized');
    }

    const worker = this.getWorkerByMethod(method);
    const result = await worker.sqlCall(method, ...args);

    if (result) {
      result.worker = worker.getLogTag();
    }

    const { duration, seqId } = result || {};
    if (shouldTrace(duration)) {
      this.getLogger().info(
        `[Main-${result?.worker}]: SQL response ${logSeqId(seqId)}`,
        `${method} duration=${duration}ms`
      );
    }

    return result;
  }

  public async sqlCallEasy(method: string, ...args: ReadonlyArray<any>) {
    const wrappedResult = await this.sqlCall(method, ...args);
    return wrappedResult.result;
  }
}
