import { Observable, ReplaySubject, distinct } from 'rxjs';
import { Worker } from 'worker_threads';

import { isDevMode } from './helpers';

/**
 * Multithread task state.
 *
 * @export
 * @typedef {MultithreadItemState}
 */
export type MultithreadItemState = 'queued' | 'starting' | 'online' | 'exited';

/**
 * Multithread task info required for it to be run
 *
 * @export
 * @interface MultithreadTaskInfo
 * @typedef {MultithreadTaskInfo}
 */
export interface MultithreadTaskInfo {
  /**
   * Data to be provided to the child process.
   *
   * Available in `workerData` from `worker_threads` in child process.
   *
   * @type {*}
   */
  arg: any;

  /**
   * Path to the script to be executed.
   *
   * It is recommended to specify without file extension (`.ts`) since TypeScript files will become js after compile.
   * So that `script.ts` won't be found (as it will have `.js` extension)
   *
   * @type {string}
   */
  scriptPath: string;
}

/**
 *
 * Returned from `queueInvoke` method
 *
 * @export
 * @interface QueuedMultithreadTask
 * @typedef {QueuedMultithreadTask}
 * @template T Type of the message
 */
export interface QueuedMultithreadTask<T> {
  /**
   * Messages from the child process
   *
   * @type {Observable<T>}
   */
  message: Observable<T>;

  /**
   * State of the child process
   *
   * @type {Observable<MultithreadItemState>}
   */
  state: Observable<MultithreadItemState>;

  /**
   * Order of the task in the queue
   *
   * @type {Observable<number>}
   */
  queueOrder: Observable<number>;

  /**
   * Task info required for it to be run
   *
   * @type {MultithreadTaskInfo}
   */
  info: MultithreadTaskInfo;
}

/**
 * Internal type which contains subjects for reporting child process state
 *
 * @export
 * @interface QueuedMultithreadItem
 * @typedef {QueuedMultithreadItem}
 * @template T Template arg for `QueuedMultithreadItem`
 */
export interface QueuedMultithreadItem<T> {
  /**
   * Object that is exposed to the user of the manager
   *
   * @type {QueuedMultithreadTask<T>}
   */
  exposed: QueuedMultithreadTask<T>;

  /**
   * Subject which is used to report status of the child process
   *
   * @type {ReplaySubject<MultithreadItemState>}
   */
  status$: ReplaySubject<MultithreadItemState>;

  /**
   * Subject which is used to forward messages from the child process
   *
   * @type {ReplaySubject<T>}
   */
  message$: ReplaySubject<T>;

  /**
   * Subject which is used to report task order in the queue
   *
   * @type {ReplaySubject<number>}
   */
  queueOrder$: ReplaySubject<number>;
}

/**
 * Type of the multithread item which is currently running
 *
 * @export
 * @interface RunningMultithreadItem
 * @typedef {RunningMultithreadItem}
 * @template T Template arg for the `QueuedMultithreadItem`
 * @extends {QueuedMultithreadItem<T>}
 */
export interface RunningMultithreadItem<T> extends QueuedMultithreadItem<T> {
  /**
   * Worker of the child process
   *
   * @type {Worker}
   */
  worker: Worker;
}

/**
 * Multithread manager is used to comfortably manage and limit running background tasks
 *
 * @export
 * @class MultithreadingManager
 * @typedef {MultithreadingManager}
 */
export class MultithreadingManager {
  /**
   * Tasks queue
   *
   * @type {QueuedMultithreadItem<any>[]}
   */
  queue: QueuedMultithreadItem<any>[] = [];

  /**
   * Currently running tasks
   *
   * @type {RunningMultithreadItem<any>[]}
   */
  running: RunningMultithreadItem<any>[] = [];

  /**
   * Maximum count of running workers
   *
   * @type {number}
   */
  maxThreads: number;

  /**
   * Creates an instance of MultithreadingManager.
   *
   * @constructor
   * @param {number} [maxThreads=1] Maximum count of running workers. Defaults to 1
   */
  constructor(maxThreads: number = 1) {
    this.maxThreads = maxThreads;
  }

  /**
   * Queues task for invocation. The task will be invoked ASAP
   *
   * @template T any by default. Type of the messages sent from child process
   * @param {MultithreadTaskInfo} info
   * @returns {QueuedMultithreadTask<T>}
   */
  queueInvoke<T = any>(info: MultithreadTaskInfo): QueuedMultithreadTask<T> {
    const status$ = new ReplaySubject<MultithreadItemState>(1);
    const message$ = new ReplaySubject<T>(1);
    const queueOrder$ = new ReplaySubject<number>(1);

    const exposed: QueuedMultithreadTask<T> = {
      info,
      message: message$.asObservable(),
      state: status$.asObservable(),
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

  /**
   * Runs queued task if amount of running tasks is less than maximum allowed by `maxThreads`
   *
   * @private
   */
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

  /**
   * For each queued task emits its position in the queue
   *
   * @private
   */
  private updateQueueOrder() {
    this.queue.forEach(({ queueOrder$ }, index) => queueOrder$.next(index + 1));
  }
}
