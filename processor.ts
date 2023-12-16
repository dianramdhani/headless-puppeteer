import puppeteer from 'puppeteer-extra'
import pluginStealth from 'puppeteer-extra-plugin-stealth'
import { mkdir, writeFile } from 'node:fs/promises'
import { stdin } from 'node:process'
import { join } from 'path'
import type { Browser, Page } from 'puppeteer-core'

export default class Processor {
  private page?: Page
  private browser?: Browser

  constructor(
    private config: {
      url: string
      chromePath: string
      browserType: 'head' | 'headless'
      mode: 'grab_cookies' | 'auto_login'
    }
  ) {}

  private async initialize() {
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
    await this.page?.goto(this.config.url)
  }

  private async grabCookies() {
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
    await writeFile(`cookies/${fileName}.json`, JSON.stringify(cookies), 'utf8')
  }

  async process() {
    try {
      await this.initialize()
    } catch (error) {
      console.warn('gagal initialize')
      throw error
    }

    try {
      await this.grabCookies()
      await this.page?.close()
      await this.browser?.close()
    } catch (error) {
      console.warn('gagal grab cookies')
      throw error
    }
  }
}
