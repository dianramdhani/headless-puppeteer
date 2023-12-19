import puppeteer from 'puppeteer-extra'
import pluginStealth from 'puppeteer-extra-plugin-stealth'
import winston, { format } from 'winston'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { stdin } from 'node:process'
import { join } from 'path'
import type { Browser, Page, Protocol } from 'puppeteer'

const logger = winston.createLogger({
  format: format.combine(format.timestamp(), format.prettyPrint()),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
})

export default class Processor {
  page?: Page
  browser?: Browser

  constructor(
    private readonly config: {
      url: string
      browserType: typeof process.env.BROWSER_TYPE
      chromePath?: string
    }
  ) {}

  async grabCookies() {
    try {
      await this.initialize()
      await this.page?.goto(this.config.url, { waitUntil: 'domcontentloaded' })
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
    } finally {
      await this.closeBrowser()
    }
  }

  async autoLogin(urlPages: string[], autoClose: boolean = true) {
    const filesName = await readdir('cookies')
    for (const fileName of filesName) {
      const name = fileName.replace('.json', '')
      const processor = new Processor(this.config)

      try {
        await processor.initialize()
        const cookies = JSON.parse(
          (await readFile(`cookies/${fileName}`)).toString()
        ) as Protocol.Network.CookieParam[]
        await processor.page?.setCookie(...cookies)
        logger.info(`${name} berhasil auto login`)

        try {
          await processor.page?.goto(this.config.url, {
            waitUntil: 'domcontentloaded',
          })
          for (const urlPage of urlPages) {
            await processor.page?.goto(urlPage, {
              waitUntil: 'domcontentloaded',
            })
          }
          await mkdir('ss', { recursive: true })
          await processor.page?.screenshot({
            path: `./ss/${new Date().getTime()}-${name}.jpg`,
          })
        } catch (error) {}
      } catch (error) {
        logger.error(`${name} gagal auto login`)
      } finally {
        autoClose && (await processor.closeBrowser())
      }
    }
  }

  async initialize() {
    try {
      puppeteer.use(pluginStealth())
      this.browser = await puppeteer.launch({
        args: ['--no-sandbox'],
        executablePath: this.config.chromePath
          ? join(__dirname, this.config.chromePath)
          : undefined,
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
    } catch (error) {
      throw new Error('gagal initialize')
    }
  }

  async closeBrowser() {
    await this.page?.close()
    await this.browser?.close()
  }
}
