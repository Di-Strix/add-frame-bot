interface TaskParam {
  maxCalls: number;
  id: string;
}

export interface BotConfig {
  taskParams: TaskParam[];
}
