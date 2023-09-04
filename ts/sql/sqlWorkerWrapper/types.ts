import { ThreadWorkerType } from '../sqlTypes';
import { CallResult } from '../sqlWorkers/types';

export type WorkerData = {
  workerType: ThreadWorkerType;
};

export type WrappedCallResult = CallResult & { seqId: Number };

const ASAR_PATTERN = /app\.asar$/;

export function isASAR(path: string) {
  return ASAR_PATTERN.test(path);
}

export function replaceASAR(path: string) {
  return path.replace(ASAR_PATTERN, 'app.asar.unpacked');
}
