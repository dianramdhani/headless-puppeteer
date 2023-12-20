import 'dotenv/config'
import Processor from './processor'
import { env } from 'node:process'
import { CronJob } from 'cron'

const {
  URL,
  URL_CART,
  URL_QUERY,
  CHROME_PATH,
  BROWSER_TYPE,
  URL_PAGES,
  MODE,
  ENV,
  CRON_TIME,
  CO_ACCOUNTS,
} = env
const [hour, minute] = CRON_TIME.split(':')

switch (MODE) {
  case 'grab_cookies':
    new Processor({
      url: URL,
      browserType: BROWSER_TYPE,
      chromePath: CHROME_PATH,
    }).grabCookies()
    break
  case 'auto_login':
    const urlPages = URL_PAGES.split(' ')

    ENV === 'dev'
      ? new Processor({
          url: URL,
          browserType: BROWSER_TYPE,
          chromePath: CHROME_PATH,
        }).autoLogin(urlPages, false)
      : CronJob.from({
          cronTime: `${minute} ${hour} * * *`,
          onTick: () =>
            new Processor({
              url: URL,
              browserType: BROWSER_TYPE,
              chromePath: CHROME_PATH,
            }).autoLogin(urlPages),
          start: true,
          timeZone: 'Asia/Jakarta',
        })
    break
  case 'auto_co':
    ;(async () => {
      const coAccounts = CO_ACCOUNTS.split(' ')
      const processor = new Processor({
        url: URL_CART,
        browserType: BROWSER_TYPE,
        chromePath: CHROME_PATH,
      })

      await processor.prepareCheckout(coAccounts, URL_QUERY)
    })()
    break
}
