declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ENV: 'dev' | 'prod'
      URL: string
      URL_PAGE_LOGIN: string
      URL_PAGES: string
      URL_CART: string
      URL_QUERY: string
      URL_LIST_CO: string
      CHROME_PATH?: string
      CO_ACCOUNTS: string
      GRAB_COOKIES_ACCOUNTS: string
      PASSWORD: string
      BROWSER_TYPE: 'head' | 'headless'
      MODE: 'grab_cookies' | 'auto_grab_cookies' | 'auto_login' | 'auto_co'
      CRON_TIME: string
    }
  }
}
export {}
