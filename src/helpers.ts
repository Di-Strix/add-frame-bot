import { FfmpegCommand } from 'fluent-ffmpeg';

export const resultOf = <T extends FfmpegCommand>(command: T): Promise<void> =>
  new Promise((resolve, reject) => {
    command.on('end', () => {
      resolve();
    });

    command.on('error', (err) => {
      reject(err);
    });
  });

export const isDevMode = () => process.env.NODE_ENV === 'development';
export const isProdMode = () => !isDevMode();
