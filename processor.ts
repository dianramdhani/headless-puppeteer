import puppeteer from 'puppeteer-extra'
import pluginStealth from 'puppeteer-extra-plugin-stealth'
import blockResourcesPlugin from 'puppeteer-extra-plugin-block-resources'
import winston, { format } from 'winston'
import { mkdir, readdir, writeFile } from 'node:fs/promises'
import { stdin } from 'node:process'
import { resolve } from 'node:path'
import type { Browser, Page, Protocol } from 'puppeteer'

const logger = winston.createLogger({
  format: format.combine(format.timestamp(), format.prettyPrint()),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
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
          ? resolve(__dirname, this.config.chromePath)
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
      throw new Error('gagal initialize', { cause: error })
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
        console.info('Masukkan email untuk nama cookies')
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
      throw new Error('gagal grab cookies', { cause: error })
    } finally {
      await this.closeBrowser()
    }
  }

  async autoGrabCookies(
    grabCookiesAccounts: string[],
    password: string,
    urlPages: string[] = []
  ) {
    for (const account of grabCookiesAccounts) {
      try {
        puppeteer.use(
          blockResourcesPlugin({
            blockedTypes: new Set(['media', 'stylesheet', 'image']),
          })
        )
        const processor = new Processor(this.config)
        await processor.initialize()
        await processor.page?.setRequestInterception(true)
        await processor.page?.goto(this.config.url)
        ;(async () => {
          try {
            const buttonIgnoreGetNotification =
              await processor.page?.waitForSelector(
                '#desktopBannerWrapped button'
              )
            await buttonIgnoreGetNotification?.click()
          } catch (error) {}
        })()
        await processor.page
          ?.waitForSelector('[name="username"]')
          .then((el) => el?.type(account, { delay: 50 }))
        await processor.page
          ?.waitForSelector('[name="password"]')
          .then((el) => el?.type(password, { delay: 50 }))
        await processor.page?.click('#remember-me')
        await processor.page?.click('form button')
        await processor.page?.waitForNavigation({ waitUntil: 'networkidle0' })
        for (const urlPage of urlPages) {
          await processor.page?.goto(urlPage, {
            waitUntil: 'domcontentloaded',
          })
        }
        const cookies = await processor.page?.cookies()
        await mkdir('cookies', { recursive: true })
        await writeFile(
          `cookies/${account}.json`,
          JSON.stringify(cookies),
          'utf8'
        )
        await processor.closeBrowser()
        logger.info(`${account} berhasil grab cookies`)
        console.info(`${account} berhasil grab cookies`)
      } catch (error) {
        logger.error(`${account} gagal grab cookies`, { cause: error })
      }
    }
  }

  async autoLogin(urlPages: string[], autoClose: boolean = true) {
    const filesName = await readdir('cookies')
    for (const fileName of filesName) {
      const name = fileName.replace('.json', '')
      const processor = new Processor(this.config)

      try {
        await processor.initialize()
        const cookies = (await import(`./cookies/${fileName}`))
          .default as Protocol.Network.CookieParam[]
        await processor.page?.setCookie(...cookies)

        try {
          await processor.page?.goto(this.config.url, {
            waitUntil: 'domcontentloaded',
          })
          for (const urlPage of urlPages) {
            await processor.page?.goto(urlPage, {
              waitUntil: 'domcontentloaded',
            })
          }
        } catch (error) {}
        logger.info(`${name} berhasil auto login`)
        console.info(`${name} berhasil auto login`)
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
          const cookies = (await import(`./cookies/${name}.json`))
            .default as Protocol.Network.CookieParam[]
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
              } catch (error) {}
            }
          })
          .on('console', (message) => {
            const text = message.text()
            if (!text.includes('~')) return
            if (text.includes('~addressID'))
              this.coInstances[index].addressID = +text.split(' ')[1] ?? -1
            if (text.includes('~addOrder')) logger.info(text)
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
            path: `./ss/${Date.now()}-${name}-cart.jpg`,
          })
        } catch (error) {}

        await processor.page?.evaluate(
          async (urlQuery, headers, name) => {
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
                ? console.log(`~addressID-${name} ${addressID}`)
                : console.log('~error gak ada address id')
            } catch (error) {}
          },
          urlQuery,
          this.coInstances[index].headers,
          name
        )
      })
    } catch (error) {
      throw new Error('gagal prepare checkout coba cek cookies', {
        cause: error,
      })
    }
  }

  async checkout(urlQuery: string, urlListCO: string, isProd: boolean) {
    !isProd && (await new Promise((resolve) => setTimeout(resolve, 10000)))

    this.coInstances.forEach(
      async ({ name, processor, headers, addressID }) => {
        try {
          const startTime = Date.now()
          await processor.page?.evaluate(
            async (urlQuery, headers, addressID, isProd, name) => {
              const process: () => Promise<string[]> = async () => {
                const responses: string[] = []

                try {
                  responses.push(
                    ...(await Promise.all([
                      await fetch(urlQuery, {
                        method: 'POST',
                        body: JSON.stringify([
                          {
                            operationName: 'processCheckout',
                            variables: {},
                            query:
                              'query processCheckout {\n  processCheckout {\n    meta {\n      message\n      error\n      code\n    }\n    result\n  }\n}\n',
                          },
                        ]),
                        headers,
                      }).then(async (response) => {
                        const jsonResponse: any = await response.json()
                        console.log(
                          `~processCheckout ${JSON.stringify(jsonResponse)}`
                        )
                        return jsonResponse[0].data.processCheckout.meta
                          .code as string
                      }),
                      await fetch(urlQuery, {
                        method: 'POST',
                        body: JSON.stringify([
                          {
                            operationName: 'addPreBook',
                            variables: {
                              params: {
                                isRewardPoint: false,
                                addressID,
                                shippingID: 4,
                                shippingName: 'J&T',
                                shippingDuration:
                                  'Estimasi pengiriman 2-3 Hari',
                              },
                            },
                            query:
                              'mutation addPreBook($params: PreBookRequest!) {\n  addPreBook(params: $params) {\n    meta {\n      message\n      error\n      code\n    }\n    result {\n      status\n      orderID\n      analytic {\n        affiliation\n        coupon\n        currency\n        transaction_id\n        shipping\n        insurance\n        value\n        partial_reward\n        coupon_discount\n        shipping_discount\n        location\n        quantity\n        items {\n          item_id\n          item_name\n          affiliation\n          coupon\n          currency\n          discount\n          index\n          item_brand\n          item_category\n          item_category2\n          item_category3\n          item_category4\n          item_category5\n          item_list_id\n          item_list_name\n          item_variant\n          price\n          quantity\n        }\n        content_id\n        content_type\n        contents {\n          id\n          quantity\n        }\n        description\n        category_id\n        category_name\n        brand_id\n        brand_name\n        sub_brand_id\n        sub_brand_name\n        order_id\n        order_date\n        total_trx\n        shipping_fee\n        insurance_fee\n        tax\n        discount\n        partial_mw_reward\n        shipping_method\n        payment_method\n        is_dropship\n        voucher_code\n        products\n      }\n    }\n  }\n}\n',
                          },
                        ]),
                        headers,
                      }).then(async (response) => {
                        const jsonResponse: any = await response.json()
                        console.log(
                          `~addPreBook ${JSON.stringify(jsonResponse)}`
                        )
                        return jsonResponse[0].data.addPreBook.meta
                          .code as string
                      }),
                    ]))
                  )
                  isProd &&
                    responses.push(
                      await fetch(urlQuery, {
                        method: 'POST',
                        body: JSON.stringify([
                          {
                            operationName: 'addOrder',
                            variables: {
                              params: {
                                paymentID: 57,
                                paymentCode: 'VABCA',
                                paymentName: 'BCA Virtual Account',
                                paymentParentCode: 'VirtualAccount',
                              },
                            },
                            query:
                              'mutation addOrder($params: AddOrderRequest!) {\n  addOrder(params: $params) {\n    meta {\n      error\n      code\n      message\n    }\n    result {\n      payment {\n        status\n        orderId\n        redirectUrl\n      }\n      analytic {\n        affiliation\n        coupon\n        currency\n        transaction_id\n        transaction_code\n        shipping\n        insurance\n        value\n        partial_reward\n        coupon_discount\n        shipping_discount\n        location\n        quantity\n        items {\n          item_id\n          item_name\n          affiliation\n          currency\n          discount\n          index\n          item_brand\n          item_category\n          item_category2\n          item_category3\n          item_category4\n          item_category5\n          item_list_id\n          item_list_name\n          item_variant\n          price\n          quantity\n        }\n        content_id\n        content_type\n        contents {\n          id\n          quantity\n        }\n        description\n        category_id\n        category_name\n        brand_id\n        brand_name\n        sub_brand_id\n        sub_brand_name\n        order_id\n        order_date\n        total_trx\n        shipping_fee\n        insurance_fee\n        tax\n        discount\n        partial_mw_reward\n        shipping_method\n        payment_method\n        is_dropship\n        voucher_code\n        products\n        total_price\n        gender\n        db\n        user_id\n        fb_login_id\n        ip_override\n        user_data {\n          email_address\n          phone_number\n          client_ip_address\n          address {\n            first_name\n            last_name\n            city\n            region\n            postal_code\n            country\n          }\n        }\n      }\n    }\n  }\n}\n',
                          },
                        ]),
                        headers,
                      }).then(async (response) => {
                        const jsonResponse: any = await response.json()
                        console.log(
                          `~addOrder-${name} ${JSON.stringify(jsonResponse)}`
                        )
                        return jsonResponse[0].data.addOrder.meta.code as string
                      })
                    )
                } catch (error) {
                  console.log(`~error-${name} masih ada yang gagal di proses`)
                  responses.push('error')
                }

                return responses
              }

              let allStatus: string[] = []
              while (true) {
                allStatus = await process()
                if (!allStatus.some((status) => status !== 'success')) break
              }
              console.log(`~dataCO-${name} ${JSON.stringify(allStatus)}`)
            },
            urlQuery,
            headers,
            addressID,
            isProd,
            name
          )
          logger.info(`${name} lama CO ${Date.now() - startTime}ms`)

          try {
            await processor.page?.goto(urlListCO)
            await processor.page?.waitForSelector('#orders-item-0')
            await mkdir('ss', { recursive: true })
            await processor.page?.screenshot({
              path: `./ss/${Date.now()}-${name}-co.jpg`,
            })
          } catch (error) {}
        } catch (error) {
          logger.error(`${name} gagal CO`)
        } finally {
          processor.closeBrowser()
        }
      }
    )
  }
}
