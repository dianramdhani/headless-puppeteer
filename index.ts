import 'dotenv/config'
import Processor from './processor'
import { env } from 'node:process'

const { URL, CHROME_PATH, BROWSER_TYPE } = env
const processor = new Processor({
  url: URL,
  chromePath: CHROME_PATH,
  browserType: BROWSER_TYPE,
  mode: 'grab_cookies',
})
processor.process()
