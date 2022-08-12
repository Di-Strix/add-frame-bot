import axios from 'axios';
import sharp, { Sharp } from 'sharp';
import { Context, NarrowedContext } from 'telegraf';
import { Message } from 'telegraf/typings/core/types/typegram';
import { MountMap } from 'telegraf/typings/telegram-types';

export const withImage = <T extends NarrowedContext<Context, MountMap['text']>>(
  fn: (ctx: T, image: Sharp) => Promise<any>
) => {
  return async (ctx: T) => {
    let photo: Sharp | undefined;
    try {
      console.log('Got message, processing...');

      const replyTo = ctx.update.message.reply_to_message || {};
      if (!('photo' in replyTo)) throw new Error('No photo in replied message');

      const photoMessage = replyTo as Message.PhotoMessage;

      const url = await ctx.telegram.getFileLink(photoMessage.photo.at(-1)?.file_id || '');

      const inputBuffer = (await axios.get(url.toString(), { responseType: 'arraybuffer' })).data as Buffer;

      photo = sharp(inputBuffer);
    } catch (e) {
      await ctx.reply('Фото не получено 💁');
      console.error('Something went wrong, replied with message', e);
    }

    if (photo) return await fn(ctx, photo);
  };
};
