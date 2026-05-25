import { Router } from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const configPath = path.join(__dirname, 'config.json')

const SHUSHU_URL = 'http://54.242.216.84:8992/querySql'
const SHUSHU_TOKEN = (() => {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8')).token
  } catch (err) {
    console.error('Failed to load shushu token:', err.message)
    return null
  }
})()

const router = Router()

router.post('/query', async (req, res) => {
  const { sql } = req.body
  if (!sql) return res.status(400).json({ error: 'sql is required' })
  if (!SHUSHU_TOKEN) return res.status(500).json({ error: 'token not configured' })

  try {
    const form = new URLSearchParams()
    form.append('token', SHUSHU_TOKEN)
    form.append('sql', sql)
    form.append('format', 'json')

    const response = await fetch(SHUSHU_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    const text = await response.text()
    if (text.startsWith('<')) {
      return res.status(502).json({ error: '数数服务器错误或超时' })
    }
    res.send(text)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
