import { botConfig } from '../bot-config';

export interface Task {
  commandCaller: () => Promise<any>;
  id: string;
}

interface TaskState {
  calls: number;
  queuedTasks: Task[];
}

export class TaskManager {
  state: Map<string, TaskState> = new Map();

  constructor() {
    if (botConfig.taskParams.length === 0) {
      throw new Error('no task params provided in bot-config.ts');
    }
    botConfig.taskParams.forEach((param) => this.state.set(param.id, { calls: 0, queuedTasks: [] }));
  }

  private getMaxCalls(taskId: string): number {
    const taskParam = botConfig.taskParams.find((param) => param.id === taskId);
    if (!taskParam) throw new Error('no task found with such id');
    return taskParam.maxCalls;
  }

  private getTaskState(taskId: string): TaskState {
    const taskState = this.state.get(taskId);
    if (!taskState) throw new Error('no task found with such id');
    return taskState;
  }

  async queueTask(task: Task): Promise<void> {
    const taskState: TaskState = this.getTaskState(task.id);
    await this.executeTask(task, taskState);
  }

  private executeTask(task: Task, taskState: TaskState): Promise<void> {
    return new Promise((resolve, reject) => {
      if (taskState.calls < this.getMaxCalls(task.id)) {
        taskState.calls++;
        task
          .commandCaller()
          .then(() => {
            taskState.calls--;
            const queuedTask = taskState.queuedTasks.shift();

            if (queuedTask) {
              taskState.calls++;
              queuedTask
                .commandCaller()
                .then(() => {
                  taskState.calls--;
                  resolve();
                })
                .catch((err) => {
                  taskState.calls--;
                  reject(err);
                });
            } else {
              resolve();
            }
          })
          .catch((err) => {
            taskState.calls--;
            reject(err);
          });
      } else {
        taskState.queuedTasks.push(task);
      }
    });
  }
}
