import { Router } from 'express'
import http from 'http'
import secrets from '../config.js'

const SHUSHU_URL = 'http://54.242.216.84:8992/querySql'
const SHUSHU_TOKEN = secrets.shushu?.token || null

function postForm(urlStr, params) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(params).toString()
    const u = new URL(urlStr)
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve({ status: res.statusCode, text: data }))
    })
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

const router = Router()

router.post('/query', async (req, res) => {
  const { sql } = req.body
  if (!sql) return res.status(400).json({ error: 'sql is required' })
  if (!SHUSHU_TOKEN) return res.status(500).json({ error: 'token not configured' })

  try {
    const { text } = await postForm(SHUSHU_URL, {
      token: SHUSHU_TOKEN,
      sql,
      format: 'json',
    })
    if (text.startsWith('<')) {
      return res.status(502).json({ error: '数数服务器错误或超时' })
    }
    res.send(text)
  } catch (err) {
    console.error('[shushu]', err.stack)
    res.status(500).json({ error: err.stack || err.message })
  }
})

export default router
