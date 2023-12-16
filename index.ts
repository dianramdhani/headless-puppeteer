import 'dotenv/config'
import Processor from './processor'
import { env } from 'node:process'
import { readdir } from 'node:fs/promises'

const { URL, CHROME_PATH, BROWSER_TYPE, URL_PAGES, MODE, ENV } = env

switch (MODE) {
  case 'grab_cookies':
    new Processor({
      env: ENV,
      url: URL,
      chromePath: CHROME_PATH,
      browserType: BROWSER_TYPE,
      mode: MODE,
    }).process()
    break
  case 'auto_login':
    main()
    break
}

async function main() {
  const filesName = await readdir('cookies')

  filesName.forEach(async (fileName) =>
    new Processor({
      env: ENV,
      url: URL,
      chromePath: CHROME_PATH,
      browserType: BROWSER_TYPE,
      mode: 'auto_login',
      fileName,
      urlPages: URL_PAGES.split(' '),
    }).process()
  )
}
