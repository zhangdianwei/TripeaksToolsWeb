import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const keyPath = path.join(__dirname, 'private_key.json')

let secrets = {}
try {
  secrets = JSON.parse(fs.readFileSync(keyPath, 'utf-8'))
} catch (err) {
  console.error(`[config] 无法加载密钥文件 ${keyPath}: ${err.message}`)
}

export default secrets
