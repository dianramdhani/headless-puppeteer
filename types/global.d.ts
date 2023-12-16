declare global {
  namespace NodeJS {
    interface ProcessEnv {
      URL: string
      URL_PAGES: string
      CHROME_PATH: string
      BROWSER_TYPE: 'head' | 'headless'
    }
  }
}
export {}
