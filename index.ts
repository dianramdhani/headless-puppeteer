import 'dotenv/config'
import Processor from './processor'
import { env } from 'node:process'
import { CronJob } from 'cron'
import { set, subMinutes } from 'date-fns'
;(async () => {
  const {
    URL,
    URL_PAGE_LOGIN,
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
    GRAB_COOKIES_ACCOUNTS,
    PASSWORD,
  } = env
  const [hours, minutes] = CRON_TIME.split(':')
  const isProd = ENV === 'prod'
  const urlPages = URL_PAGES.split(' ')

  console.info({
    CHROME_PATH,
    BROWSER_TYPE,
    MODE,
    ENV,
    CRON_TIME,
    CO_ACCOUNTS,
    GRAB_COOKIES_ACCOUNTS,
  })

  switch (MODE) {
    case 'grab_cookies':
      new Processor({
        url: URL,
        browserType: BROWSER_TYPE,
        chromePath: CHROME_PATH,
      }).grabCookies()
      break

    case 'auto_grab_cookies':
      isProd
        ? CronJob.from({
            cronTime: `${minutes} ${hours} * * *`,
            onTick: () =>
              new Processor({
                url: URL_PAGE_LOGIN,
                browserType: BROWSER_TYPE,
                chromePath: CHROME_PATH,
              }).autoGrabCookies(
                GRAB_COOKIES_ACCOUNTS.split(' '),
                PASSWORD,
                urlPages
              ),
            start: true,
            timeZone: 'Asia/Jakarta',
          })
        : new Processor({
            url: URL_PAGE_LOGIN,
            browserType: BROWSER_TYPE,
            chromePath: CHROME_PATH,
          }).autoGrabCookies(GRAB_COOKIES_ACCOUNTS.split(' '), PASSWORD)
      break

    case 'auto_login':
      isProd
        ? CronJob.from({
            cronTime: `${minutes} ${hours} * * *`,
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
          }).autoLogin(urlPages)
      break

    case 'auto_co':
      const coAccounts = CO_ACCOUNTS.split(' ')
      const processor = new Processor({
        url: URL_CART,
        browserType: BROWSER_TYPE,
        chromePath: CHROME_PATH,
      })

      if (isProd) {
        const timePrepare = subMinutes(
          set(new Date(), {
            hours: +hours,
            minutes: +minutes,
          }),
          5
        )

        CronJob.from({
          cronTime: `${timePrepare.getMinutes()} ${timePrepare.getHours()} * * *`,
          onTick: () => processor.prepareCheckout(coAccounts, URL_QUERY),
          start: true,
          timeZone: 'Asia/Jakarta',
        })

        CronJob.from({
          cronTime: `${minutes} ${hours} * * *`,
          onTick: () => processor.checkout(URL_QUERY, URL_LIST_CO, isProd),
          start: true,
          timeZone: 'Asia/Jakarta',
        })
      } else {
        await processor.prepareCheckout(coAccounts, URL_QUERY)
        processor.checkout(URL_QUERY, URL_LIST_CO, isProd)
      }
      break
  }
})()
