import { Observable, ReplaySubject, distinct } from 'rxjs';
import { Worker } from 'worker_threads';

import { isDevMode } from './helpers';

export type MultithreadItemState = 'queued' | 'starting' | 'online' | 'exited';

export interface MultithreadTaskInfo {
  arg: any;
  scriptPath: string;
}

export interface QueuedMultithreadTask<T> {
  message: Observable<T>;
  status: Observable<MultithreadItemState>;
  queueOrder: Observable<number>;
  info: MultithreadTaskInfo;
}

export interface QueuedMultithreadItem<T> {
  exposed: QueuedMultithreadTask<T>;
  status$: ReplaySubject<MultithreadItemState>;
  message$: ReplaySubject<T>;
  queueOrder$: ReplaySubject<number>;
}

export interface RunningMultithreadItem<T> extends QueuedMultithreadItem<T> {
  worker: Worker;
}

export class MultithreadingManager {
  queue: QueuedMultithreadItem<any>[] = [];
  running: RunningMultithreadItem<any>[] = [];

  maxThreads: number;

  constructor(maxThreads: number = 1) {
    this.maxThreads = maxThreads;
  }

  queueInvoke<T = any>(info: MultithreadTaskInfo): QueuedMultithreadTask<T> {
    const status$ = new ReplaySubject<MultithreadItemState>(1);
    const message$ = new ReplaySubject<T>(1);
    const queueOrder$ = new ReplaySubject<number>(1);

    const exposed: QueuedMultithreadTask<T> = {
      info,
      message: message$.asObservable(),
      status: status$.asObservable(),
      queueOrder: queueOrder$.asObservable().pipe(distinct()),
    };

    const item: QueuedMultithreadItem<T> = {
      exposed,
      message$,
      status$,
      queueOrder$,
    };

    status$.next('queued');

    this.queue.push(item);

    setTimeout(() => this.run(), 0);

    return exposed;
  }

  private run() {
    while (this.running.length < this.maxThreads) {
      const item = this.queue.shift();

      if (!item) break;

      item.status$.next('starting');

      const worker = new Worker(item.exposed.info.scriptPath, {
        workerData: item.exposed.info.arg,
        execArgv: isDevMode() ? ['-r', 'ts-node/register/transpile-only'] : undefined,
      });

      worker.on('online', () => {
        item.status$.next('online');
      });

      worker.on('message', (msg) => {
        item.message$.next(msg);
      });

      worker.on('error', (e) => {
        item.message$.error(e);
      });

      worker.on('exit', (e) => {
        item.status$.next('exited');

        item.status$.complete();
        item.message$.complete();
        item.queueOrder$.complete();

        this.running = this.running.filter((item) => item.worker !== worker);

        this.run();
      });

      this.running.push({ ...item, worker });
    }

    this.updateQueueOrder();
  }

  private updateQueueOrder() {
    this.queue.forEach(({ queueOrder$ }, index) => queueOrder$.next(index + 1));
  }
}
