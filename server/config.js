import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const keyPath = path.join(__dirname, 'server_config.json')

let secrets = {}
try {
  secrets = JSON.parse(fs.readFileSync(keyPath, 'utf-8'))
} catch (err) {
  console.error(`[config] 无法加载配置文件 ${keyPath}: ${err.message}`)
}

export default secrets
