import axios from 'axios';
import { FfmpegCommand } from 'fluent-ffmpeg';
import * as Ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';
import { Context, NarrowedContext } from 'telegraf';
import { Message, PhotoSize } from 'telegraf/typings/core/types/typegram';
import { MountMap } from 'telegraf/typings/telegram-types';
import { v4 as uuidV4 } from 'uuid';

import { resultOf } from './helpers';

type ExtendedContext = NarrowedContext<Context, MountMap['text']>;

export type MediaType = 'photo' | 'video' | 'animation';

export interface MediaContent {
  content: FfmpegCommand;
  type: MediaType;
  dirPath: string;
  filePath: string;
  fileName: string;
  fileExtension: string;
}

const saveMedia = <T extends ExtendedContext>(ctx: T): Promise<MediaContent> => {
  return new Promise(async (resolve, reject) => {
    try {
      const availableMediaTypes: MediaType[] = ['animation', 'photo', 'video'];
      const replyTo = ctx.update.message.reply_to_message || {};

      const receivedMediaType = availableMediaTypes.find((key) => key in replyTo);

      if (!receivedMediaType) throw new Error('No media in replied message');

      const mediaMessage = replyTo as Message.AnimationMessage & Message.PhotoMessage & Message.VideoMessage;

      let fileId: string;

      if (receivedMediaType === 'photo') {
        const photo = mediaMessage[receivedMediaType].at(-1) as PhotoSize;
        fileId = photo.file_id;
      } else {
        fileId = mediaMessage[receivedMediaType].file_id;
      }

      const url = await ctx.telegram.getFileLink(fileId);

      const fileExtension = url.pathname.split('.').at(-1) as string;
      const fileName = uuidV4();
      const dirPath = path.join(__dirname, 'tmp');
      const filePath = path.join(dirPath, `${fileName}.${fileExtension}`);

      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath);
      }

      const stream = (await axios.get(url.toString(), { responseType: 'stream' })).data as Readable;

      stream.pipe(fs.createWriteStream(filePath));

      stream.once('end', () => {
        resolve({ content: Ffmpeg(filePath), fileExtension, fileName, dirPath, filePath, type: receivedMediaType });
      });
    } catch (e) {
      reject(e);
    }
  });
};

export const withMedia = <T extends ExtendedContext>(
  fn: (ctx: T, media: MediaContent) => Promise<FfmpegCommand | void>
) => {
  return async (ctx: T) => {
    console.log('Got message, processing...');

    const media = await saveMedia(ctx).catch(async (e) => {
      await ctx.reply('Фото не получено 💁');
      console.error('Something went wrong, replied with message', e);
    });

    if (!media) return;

    const outputFilePath = path.join(media.dirPath, `${media.fileName}-out.${media.fileExtension}`);

    try {
      const command = await fn(ctx, media);

      if (!command) return;

      await resultOf(command.save(outputFilePath));

      switch (media.type) {
        case 'animation':
          await ctx.replyWithAnimation({ source: outputFilePath }, { caption: `Aparecium!` });
          break;
        case 'photo':
          await ctx.replyWithPhoto({ source: outputFilePath }, { caption: `Aparecium!` });
          break;
        case 'video':
          await ctx.replyWithVideo({ source: outputFilePath }, { caption: `Aparecium!` });
      }

      console.log(`Done, replied with ${media.type}`);
    } finally {
      fs.rmSync(outputFilePath);
      fs.rmSync(media.filePath);
      console.log('Temporary files are removed');
    }
  };
};
