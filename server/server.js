import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import shushuRouter from './shushu/shushu.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = process.env.PORT || 3000
const DIST_PATH = fs.existsSync(path.join(__dirname, '../dist'))
  ? path.join(__dirname, '../dist')  // 开发环境
  : path.join(__dirname, '..')       // 生产环境（在 dist/server 里）

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }))
app.use('/api/shushu', shushuRouter)

app.use(express.static(DIST_PATH))
app.get('*', (req, res) => res.sendFile(DIST_PATH + '/index.html'))

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`))
