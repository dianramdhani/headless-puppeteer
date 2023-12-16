declare global {
  namespace NodeJS {
    interface ProcessEnv {
      URL: string
      CHROME_PATH: string
      BROWSER_TYPE: 'head' | 'headless'
    }
  }
}
export {}
