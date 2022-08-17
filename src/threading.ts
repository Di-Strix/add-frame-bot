import { Observable, ReplaySubject, Subject, SubjectLike, distinct, filter, map, shareReplay, startWith } from 'rxjs';
import { Worker } from 'worker_threads';

import { isDevMode } from './helpers';

/**
 * Multithread task state.
 *
 * @export
 * @typedef {TaskState}
 */
export type TaskState = 'queued' | 'starting' | 'online' | 'exited';

/**
 * Used to filter task's message types. Such as `state`, `message`, etc...
 *
 * @export
 * @interface TaskReport
 * @typedef {TaskReport}
 */
export interface TaskReport {
  /**
   * Type of the report
   *
   * @type {('state' | 'message' | 'queueOrder')}
   */
  reportType: 'state' | 'message' | 'queueOrder';
  /**
   * Data for the report
   *
   * @type {*}
   */
  payload: any;
}

/**
 * Multithread task info required for it to be run
 *
 * @export
 * @interface MultithreadTaskInfo
 * @typedef {TaskInfo}
 */
export interface TaskInfo {
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
 * @interface QueuedTask
 * @typedef {QueuedTask}
 * @template T Type of the message
 */
export interface QueuedTask<T> {
  /**
   * Messages from the child process
   *
   * @type {Observable<T>}
   */
  message: Observable<T>;

  /**
   * State of the child process
   *
   * @type {Observable<TaskState>}
   */
  state: Observable<TaskState>;

  /**
   * Order of the task in the queue
   *
   * @type {Observable<number>}
   */
  queueOrder: Observable<number>;

  /**
   * Task info required for it to be run
   *
   * @type {TaskInfo}
   */
  info: TaskInfo;
}

/**
 * Internal type which contains subjects for reporting child process state
 *
 * @export
 * @interface QueuedMultithreadItem
 * @typedef {QueuedTaskItem}
 * @template T Template arg for `QueuedMultithreadItem`
 */
export interface QueuedTaskItem<T> {
  /**
   * Object that is exposed to the user of the manager
   *
   * @type {QueuedTask<T>}
   */
  exposed: QueuedTask<T>;

  /**
   * Unified report subject. Used to deliver messages to QueuedTask's `message`, `state`, etc...
   *
   * @type {Subject<TaskReport>}
   */
  report$: Subject<TaskReport>;
}

/**
 * Type of the multithread item which is currently running
 *
 * @export
 * @interface RunningMultithreadItem
 * @typedef {RunningTaskItem}
 * @template T Template arg for the `QueuedMultithreadItem`
 * @extends {QueuedMultithreadItem<T>}
 */
export interface RunningTaskItem<T> extends QueuedTaskItem<T> {
  /**
   * Worker of the child process
   *
   * @type {Worker}
   */
  worker: Worker;
}

/**
 * Shortcut for reporting status of the task
 *
 * @param {SubjectLike<TaskReport>} reporter
 * @param {TaskState} state
 * @returns {*}
 */
const reportStatus = (reporter: SubjectLike<TaskReport>, state: TaskState) =>
  reporter.next({ reportType: 'state', payload: state });

/**
 * Shortcut for reporting messages from the task
 *
 * @param {SubjectLike<TaskReport>} reporter
 * @param {*} msg
 * @returns {*}
 */
const reportMessage = (reporter: SubjectLike<TaskReport>, msg: any) =>
  reporter.next({ reportType: 'message', payload: msg });

/**
 * Shortcut for reporting queue order of the task
 *
 * @param {SubjectLike<TaskReport>} reporter
 * @param {number} order
 * @returns {*}
 */
const reportQueueOrder = (reporter: SubjectLike<TaskReport>, order: number) =>
  reporter.next({ reportType: 'queueOrder', payload: order });

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
   * @type {QueuedTaskItem<any>[]}
   */
  queue: QueuedTaskItem<any>[] = [];

  /**
   * Currently running tasks
   *
   * @type {RunningTaskItem<any>[]}
   */
  running: RunningTaskItem<any>[] = [];

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
   * @param {TaskInfo} info
   * @returns {QueuedTask<T>}
   */
  queueInvoke<T = any>(info: TaskInfo): QueuedTask<T> {
    const report$ = new Subject<TaskReport>();

    const exposed: QueuedTask<T> = {
      info,
      message: report$.asObservable().pipe(
        filter(({ reportType }) => reportType === 'message'),
        map(({ payload }) => payload as T),
        shareReplay(1)
      ),
      state: report$.asObservable().pipe(
        filter(({ reportType }) => reportType === 'state'),
        map(({ payload }) => payload as TaskState),
        startWith('queued' as TaskState),
        shareReplay(1)
      ),
      queueOrder: report$.asObservable().pipe(
        filter(({ reportType }) => reportType === 'queueOrder'),
        map(({ payload }) => payload as number),
        distinct(),
        startWith(1),
        shareReplay(1)
      ),
    };

    const item: QueuedTaskItem<T> = {
      exposed,
      report$,
    };

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

      reportStatus(item.report$, 'starting');

      const worker = new Worker(item.exposed.info.scriptPath, {
        workerData: item.exposed.info.arg,
        execArgv: isDevMode() ? ['-r', 'ts-node/register/transpile-only'] : undefined,
      });

      worker.on('online', () => {
        reportStatus(item.report$, 'online');
      });

      worker.on('message', (msg) => {
        reportMessage(item.report$, msg);
      });

      worker.on('error', (e) => {
        item.report$.error(e);
      });

      worker.on('exit', (e) => {
        reportStatus(item.report$, 'exited');

        item.report$.complete();

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
    this.queue.forEach(({ report$ }, index) => reportQueueOrder(report$, index + 1));
  }
}
