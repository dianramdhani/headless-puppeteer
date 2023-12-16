import 'dotenv/config'
import Processor from './processor'
import { env } from 'node:process'
import { readdir } from 'node:fs/promises'

const { URL, CHROME_PATH, BROWSER_TYPE, URL_PAGES } = env
new Processor({
  url: URL,
  chromePath: CHROME_PATH,
  browserType: BROWSER_TYPE,
  mode: 'grab_cookies',
}).process()
// main()

async function main() {
  const filesName = await readdir('cookies')

  filesName.forEach(async (fileName) =>
    new Processor({
      url: URL,
      chromePath: CHROME_PATH,
      browserType: BROWSER_TYPE,
      mode: 'auto_login',
      fileName,
      urlPages: URL_PAGES.split(' '),
    }).process()
  )
}
