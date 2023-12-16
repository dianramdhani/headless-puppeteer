import 'dotenv/config'
import { join } from 'path'
import puppeteer from 'puppeteer-core'

const { URL } = process.env
main()

async function main() {
  const browser = await puppeteer.launch({
    executablePath: join(
      __dirname,
      'chrome/linux-120.0.6099.71/chrome-linux64/chrome'
    ),
    headless: false,
    defaultViewport: null,
  })
  const page = await browser.newPage()
  await page.goto(URL)
}
