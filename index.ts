import 'dotenv/config'
import Processor from './processor'
import { env } from 'node:process'
import { readdir } from 'node:fs/promises'
import { CronJob } from 'cron'

const { URL, CHROME_PATH, BROWSER_TYPE, URL_PAGES, MODE, ENV, TIME_LOGIN } = env
const [hour, minute] = TIME_LOGIN.split(':')
const urlPages = URL_PAGES.split(' ')

switch (MODE) {
  case 'grab_cookies':
    new Processor({
      env: ENV,
      url: URL,
      chromePath: CHROME_PATH,
      browserType: BROWSER_TYPE,
      mode: MODE,
    }).process()
    break
  case 'auto_login':
    CronJob.from({
      cronTime: `${minute} ${hour} * * *`,
      onTick: async () => {
        const filesName = await readdir('cookies')

        for (const fileName of filesName) {
          await new Processor({
            env: ENV,
            url: URL,
            chromePath: CHROME_PATH,
            browserType: BROWSER_TYPE,
            mode: 'auto_login',
            fileName,
            urlPages,
          }).process()
        }
      },
      start: true,
      timeZone: 'Asia/Jakarta',
    })
    break
}
