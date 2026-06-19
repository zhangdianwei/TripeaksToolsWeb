#!/usr/bin/env node
import express from 'express'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import shushuRouter from './shushu/shushu.js'
import feishuRouter from './feishu/feishu.js'
import gitRouter from './git/git.js'
import gsheetRouter from './gsheet/gsheet.js'
import releaseRouter from './release/release.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = 9090
const DIST_PATH = path.join(__dirname, '..')
const isProd = fs.existsSync(path.join(DIST_PATH, 'index.html'))

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }))
app.use('/api/shushu', shushuRouter)
app.use('/api/feishu', feishuRouter)
app.use('/api/git', gitRouter)
app.use('/api/gsheet', gsheetRouter)
app.use('/api/release', releaseRouter)

if (isProd) {
  app.use(express.static(DIST_PATH))
  app.get('*', (req, res) => res.sendFile(DIST_PATH + '/index.html'))
}

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`))
