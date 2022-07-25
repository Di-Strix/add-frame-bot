import 'dotenv/config'
import { Telegraf } from 'telegraf'
import axios from 'axios'
import * as sharp from 'sharp'

if (!process.env.TG_BOT_TOKEN)
  throw new Error('Please, set telegram bot token to the TG_BOT_TOKEN env var')

const bot = new Telegraf(process.env.TG_BOT_TOKEN)

bot.command('add_frame', async ctx => {
  console.log('Got message, processing...')
  try {
    const url = await ctx.telegram.getFileLink(
      (ctx.message.reply_to_message as any).photo.at(-1).file_id
    )

    const inputBuffer = (
      await axios.get(url.toString(), { responseType: 'arraybuffer' })
    ).data as Buffer

    const photo = sharp(inputBuffer)

    const buffer = await photo
      .extend({
        top: 10,
        bottom: 10,
        left: 10,
        right: 10,
        background: { r: 255, g: 255, b: 255 },
      })
      .toBuffer()

    await ctx.replyWithPhoto({ source: buffer }, { caption: `Aparecium!` })
    console.log('Done, replied with image')
  } catch (e) {
    await ctx.reply('Пожалуйста, отвечайте этой командой на сообщение с фотографией')
    console.log('Something went wrong, replied with message')
  }
})

bot.launch().then(() => console.log('Bot has been started successfully'))
