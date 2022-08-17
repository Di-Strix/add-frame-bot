import { BotConfig } from './bot-config.interface';

export const botConfig: BotConfig = {
  taskParams: [
    { id: 'photo', maxCalls: 1 },
    { id: 'animation', maxCalls: 1 },
    { id: 'video', maxCalls: 2 },
  ],
};
