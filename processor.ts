import puppeteer from 'puppeteer-extra'
import pluginStealth from 'puppeteer-extra-plugin-stealth'
import winston, { format } from 'winston'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { stdin } from 'node:process'
import { join } from 'path'
import type { Browser, Page, Protocol } from 'puppeteer-core'

const logger = winston.createLogger({
  format: format.combine(format.timestamp(), format.prettyPrint()),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
})

export default class Processor {
  private page?: Page
  private browser?: Browser

  constructor(
    private config: {
      env: 'dev' | 'prod'
      url: string
      chromePath: string
      browserType: 'head' | 'headless'
      mode: 'grab_cookies' | 'auto_login'
      fileName?: string
      urlPages?: string[]
    }
  ) {}

  async process() {
    try {
      await this.initialize()

      switch (this.config.mode) {
        case 'grab_cookies':
          await this.grabCookies()
          break
        case 'auto_login':
          await this.autoLogin()
          break
      }
    } catch (error) {
      console.error(error)
      logger.error(`gagal ${this.config.mode}`, error)
    } finally {
      if (this.config.env === 'prod') {
        await this.page?.close()
        await this.browser?.close()
      }
    }
  }

  private async initialize() {
    try {
      puppeteer.use(pluginStealth())
      this.browser = await puppeteer.launch({
        executablePath: join(__dirname, this.config.chromePath),
        ...(this.config.browserType === 'head'
          ? {
              headless: false,
              defaultViewport: null,
            }
          : {
              headless: 'new',
              defaultViewport: { width: 1080, height: 720 },
            }),
      })
      this.page = await this.browser?.newPage()
      await this.page?.goto(this.config.url, { waitUntil: 'domcontentloaded' })
    } catch (error) {
      throw new Error('gagal initialize')
    }
  }

  private async grabCookies() {
    try {
      const input = new Promise<string>((resolve) => {
        console.info('Please enter cookies name')
        stdin.on('data', (data) => {
          resolve(data.toString().trim())
          stdin.pause()
        })
      })
      const fileName = await input
      const cookies = await this.page?.cookies()

      await mkdir('cookies', { recursive: true })
      await writeFile(
        `cookies/${fileName}.json`,
        JSON.stringify(cookies),
        'utf8'
      )
      logger.info(`${fileName} berhasil grab cookies`)
    } catch (error) {
      throw new Error('gagal grab cookies')
    }
  }

  private async autoLogin() {
    try {
      if (!this.config.fileName) throw new Error('fileName unset')

      const cookies = JSON.parse(
        (await readFile(`cookies/${this.config.fileName}`)).toString()
      ) as Protocol.Network.CookieParam[]

      await this.page?.setCookie(...cookies)
      await this.page?.reload({ waitUntil: 'domcontentloaded' })
      logger.info(
        `${this.config.fileName.replace('.json', '')} berhasil auto login`
      )
    } catch (error) {
      throw new Error('gagal auto login')
    }

    try {
      if (!this.config.urlPages) throw new Error('no url pages')

      for (const urlPage of this.config.urlPages) {
        await this.page?.goto(urlPage, { waitUntil: 'domcontentloaded' })
      }
    } catch (error) {
      throw error
    }
  }
}
