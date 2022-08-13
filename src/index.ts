import 'dotenv/config';
import { Telegraf } from 'telegraf';

import { withMedia } from './withMedia';

if (!process.env.TG_BOT_TOKEN) throw new Error('Please, set telegram bot token to the TG_BOT_TOKEN env var');

const bot = new Telegraf(process.env.TG_BOT_TOKEN);

bot.start((ctx) => {
  ctx.reply(
    `
Мои команды: 
- add_frame - Добавить рамку к фотографии. 
Можно дополнительно указать ширину рамки (по умолчанию - 8 пикселей) просто написав новую ширину в пикселях после команды в том же сообщении. 
Так же можно указать цвет рамки, задаётся в виде 24- или 48-битного HEX числа после #. Например: #00FF00

- bw - Сделать фотографию чёрно-белой
`
  );
});

bot.command(
  'add_frame',
  withMedia(async (ctx, media) => {
    const normalizeHex = (hexString: string): string => {
      return (
        ([3, 6].includes(hexString.length) &&
          hexString
            .match(new RegExp(`.{${hexString.length / 3}}`, 'g'))
            ?.map((v) => `${v.repeat(6 / hexString.length)}`)
            .join('')) ||
        'FFFFFF'
      );
    };

    const frameSize = +(ctx.message.text.match(/(?<= )(?<=[^(#\d+)])\d+/)?.[0] || 8);
    const parsedFrameHex = normalizeHex(ctx.message.text.match(/(?<=#)([0-f]{6}|[0-f]{3})/)?.[0] || 'FFF');

    if (frameSize > 500) {
      ctx.reply(`ОТi очем? Какие ${frameSize} пикселей??`);
      return;
    }

    return media.content.videoFilter([
      {
        filter: 'pad',
        options: `iw+{fs}:ih+{fs}:iw-{fs}:ih-{fs}:color={clr}`
          .replace(/{fs}/g, frameSize.toString())
          .replace(/{clr}/g, `#${parsedFrameHex}`),
      },
    ]);
  })
);

bot.command(
  'bw',
  withImage(async (ctx, photo) => {
    const outputBuffer: Buffer = await photo.toColorspace('b-w').toBuffer();

    await ctx.replyWithPhoto({ source: outputBuffer }, { caption: `Aparecium!` });
  })
);

bot.launch().then(() => console.log('Bot has been started successfully'));
