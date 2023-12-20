import 'dotenv/config'
import Processor from './processor'
import { env } from 'node:process'
import { CronJob } from 'cron'
;(async () => {
  const {
    URL,
    URL_PAGES,
    URL_CART,
    URL_QUERY,
    URL_LIST_CO,
    CHROME_PATH,
    BROWSER_TYPE,
    MODE,
    ENV,
    CRON_TIME,
    CO_ACCOUNTS,
  } = env
  const [hour, minute] = CRON_TIME.split(':')
  const isProd = ENV === 'prod'

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

      isProd
        ? CronJob.from({
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
        : new Processor({
            url: URL,
            browserType: BROWSER_TYPE,
            chromePath: CHROME_PATH,
          }).autoLogin(urlPages, false)
      break

    case 'auto_co':
      const coAccounts = CO_ACCOUNTS.split(' ')
      const processor = new Processor({
        url: URL_CART,
        browserType: BROWSER_TYPE,
        chromePath: CHROME_PATH,
      })

      await processor.prepareCheckout(coAccounts, URL_QUERY)
      isProd
        ? CronJob.from({
            cronTime: `${minute} ${hour} * * *`,
            onTick: () => processor.checkout(URL_QUERY, URL_LIST_CO, isProd),
            start: true,
            timeZone: 'Asia/Jakarta',
          })
        : processor.checkout(URL_QUERY, URL_LIST_CO, isProd)
      break
  }
})()
