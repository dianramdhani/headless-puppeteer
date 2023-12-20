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

type COInstance = {
  name: string
  processor: Processor
  headers: Record<string, string>
  addressID: number
}

export default class Processor {
  page?: Page
  browser?: Browser
  coInstances: COInstance[] = []

  constructor(
    private readonly config: {
      url: string
      browserType: typeof process.env.BROWSER_TYPE
      chromePath?: string
    }
  ) {}

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
          processor.page?.screenshot({
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

  async prepareCheckout(coAccounts: string[], urlQuery: string) {
    try {
      this.coInstances = await Promise.all(
        coAccounts.map<Promise<COInstance>>(async (name) => {
          const processor = new Processor(this.config)
          await processor.initialize()
          const cookies = JSON.parse(
            (await readFile(`cookies/${name}.json`)).toString()
          ) as Protocol.Network.CookieParam[]
          await processor.page?.setCookie(...cookies)

          return {
            name,
            processor,
            addressID: -1,
            headers: {},
          }
        })
      )

      this.coInstances.forEach(async ({ name, processor }, index) => {
        processor.page?.setRequestInterception(true)
        processor.page
          ?.on('request', (request) => request.continue())
          .on('response', async (response) => {
            if (response.url().includes('/query')) {
              try {
                await response.json()
                this.coInstances[index].headers = response.request().headers()
                console.info(`${name} headers updated`)
              } catch (error) {}
            }
          })
          .on('console', (message) => {
            const text = message.text()
            if (!text.includes('~')) return
            if (text.includes('~addressID'))
              this.coInstances[index].addressID = +text.split(' ')[1] ?? -1
            console.info(`console: ${text}`)
          })

        try {
          await processor.page?.goto(this.config.url, {
            waitUntil: 'domcontentloaded',
          })
          await processor.page?.waitForSelector('#cart-item-0', {
            timeout: 30000,
          })
          await mkdir('ss', { recursive: true })
          processor.page?.screenshot({
            path: `./ss/${new Date().getTime()}-${name}-cart.jpg`,
          })
        } catch (error) {}

        await processor.page?.evaluate(
          async (urlQuery, headers) => {
            try {
              const addressID = await fetch(urlQuery, {
                method: 'POST',
                body: JSON.stringify([
                  {
                    operationName: 'getAddressList',
                    variables: {},
                    query:
                      'query getAddressList($size: Int, $page: Int) {\n  getAddressList(size: $size, page: $page) {\n    meta {\n      page\n      size\n      sort\n      sortType\n      keyword\n      totalData\n      totalPage\n      message\n      error\n      code\n    }\n    result {\n      isSelected\n      addressID\n      addressName\n      addressPhone\n      addressLabel\n      addressZipCode\n      addressDetail\n      latitude\n      longitude\n      provinceID\n      provinceName\n      districtName\n      districtID\n      subdistrictName\n      subdistrictID\n    }\n  }\n}\n',
                  },
                ]),
                headers,
              }).then(async (response) => {
                const addressList: any = await response.json()
                return addressList[0].data.getAddressList.result[0]
                  .addressID as number
              })

              addressID
                ? console.log(`~addressID ${addressID}`)
                : console.log('~error gak ada address id')
            } catch (error) {}
          },
          urlQuery,
          this.coInstances[index].headers
        )
      })
    } catch (error) {
      throw new Error('gagal prepare checkout')
    }
  }
}
