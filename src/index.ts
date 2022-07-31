import axios from 'axios'
import 'dotenv/config'
import * as sharp from 'sharp'
import { Telegraf } from 'telegraf'

if (!process.env.TG_BOT_TOKEN)
  throw new Error('Please, set telegram bot token to the TG_BOT_TOKEN env var')

const bot = new Telegraf(process.env.TG_BOT_TOKEN)

bot.start(ctx => {
  ctx.reply(
    `
Мои команды: 
- add_frame - Добавить рамку к фотографии. 
Можно дополнительно указать ширину рамки (по умолчанию - 8 пикселей) просто написав новую ширину в пикселях после команды в том же сообщении. 
Так же можно указать цвет рамки, задаётся в виде 24- или 48-битного HEX числа после #. Например: #00FF00`
  )
})

bot.command('add_frame', async ctx => {
  const normalizeHex = (hexString: string): string[] => {
    return (
      ([3, 6].includes(hexString.length) &&
        hexString
          .match(new RegExp(`.{${hexString.length / 3}}`, 'g'))
          ?.map(v => `0x${v.repeat(6 / hexString.length)}`)) || [
        '0xff',
        '0xff',
        '0xff',
      ]
    )
  }
  console.log('Got message, processing...')
  try {
    const frameSize = +(ctx.message.text.match(/(?<=[^(#\d+)])\d+/)?.[0] || 8)
    const parsedFrameHex = normalizeHex(
      ctx.message.text.match(/(?<=#)([0-f]{6}|[0-f]{3})/)?.[0] || 'FFF'
    )

    const frameColor: sharp.Color = {
      r: +parsedFrameHex[0],
      g: +parsedFrameHex[1],
      b: +parsedFrameHex[2],
    }

    if (frameSize > 500) {
      ctx.reply(`ОТi очем? Какие ${frameSize} пикселей??`)
      return
    }

    const url = await ctx.telegram.getFileLink(
      (ctx.message.reply_to_message as any).photo.at(-1).file_id
    )

    const inputBuffer = (
      await axios.get(url.toString(), { responseType: 'arraybuffer' })
    ).data as Buffer

    const photo = sharp(inputBuffer)

    const buffer = await photo
      .extend({
        top: frameSize,
        bottom: frameSize,
        left: frameSize,
        right: frameSize,
        background: frameColor,
      })
      .resize((await photo.metadata()).width)
      .toBuffer()

    await ctx.replyWithPhoto({ source: buffer }, { caption: `Aparecium!` })
    console.log('Done, replied with image')
  } catch (e) {
    await ctx.reply('Фото не получено 💁')
    console.log('Something went wrong, replied with message')
  }
})

bot.launch().then(() => console.log('Bot has been started successfully'))
