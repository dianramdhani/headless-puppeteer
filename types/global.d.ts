declare global {
  namespace NodeJS {
    interface ProcessEnv {
      ENV: 'dev' | 'prod'
      URL: string
      URL_PAGES: string
      CHROME_PATH?: string
      BROWSER_TYPE: 'head' | 'headless'
      MODE: 'grab_cookies' | 'auto_login' | 'auto_co'
      CRON_TIME: string
    }
  }
}
export {}
