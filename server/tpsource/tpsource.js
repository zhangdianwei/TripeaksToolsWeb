import { Router } from 'express'
import { execFile } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'
import config from '../config.js'

const exec = promisify(execFile)
const root = path.resolve(config.TripeaksClient || '.')
const router = Router()

function resolveTpSource(relativePath = '') {
  const target = path.resolve(root, relativePath)
  if (target !== root && !target.startsWith(root + path.sep)) {
    const err = new Error('路径超出 TripeaksClient 目录')
    err.status = 400
    throw err
  }
  return target
}

function wrap(fn) {
  return async (req, res) => {
    try { await fn(req, res) }
    catch (err) {
      console.error('[tpsource]', err.stack || err)
      res.status(err.status || (err.code === 'ENOENT' ? 404 : 500)).json({ error: err.message || String(err) })
    }
  }
}

router.get('/', (req, res) => res.json({
  root: 'TripeaksClient',
  endpoints: {
    list: 'GET /api/tpsource/list?path=js',
    read: 'GET /api/tpsource/read?path=js/main.js',
    search: 'GET /api/tpsource/search?q=keyword&path=js',
  },
}))

router.get('/list', wrap(async (req, res) => {
  const relativePath = String(req.query.path || '')
  const target = resolveTpSource(relativePath)
  const entries = await fs.promises.readdir(target, { withFileTypes: true })
  res.json({
    path: relativePath,
    entries: entries.map(entry => ({
      name: entry.name,
      path: path.posix.join(relativePath.replaceAll('\\', '/'), entry.name),
      type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
    })).sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'directory' ? -1 : 1),
  })
}))

router.get('/read', wrap(async (req, res) => {
  const relativePath = String(req.query.path || '')
  if (!relativePath) {
    const err = new Error('缺少 path')
    err.status = 400
    throw err
  }
  const target = resolveTpSource(relativePath)
  const stat = await fs.promises.stat(target)
  if (!stat.isFile()) {
    const err = new Error('路径不是文件')
    err.status = 400
    throw err
  }
  res.sendFile(target)
}))

router.get('/search', wrap(async (req, res) => {
  const query = String(req.query.q || '')
  if (!query) {
    const err = new Error('缺少 q')
    err.status = 400
    throw err
  }
  const relativePath = String(req.query.path || '')
  resolveTpSource(relativePath)
  try {
    const { stdout } = await exec('git', [
      '-C', root, 'grep', '--recurse-submodules', '--line-number', '--column', '-I', '-E',
      '--', query, '--', relativePath || '.',
    ], { maxBuffer: 64 * 1024 * 1024 })
    res.type('text/plain').send(stdout)
  } catch (err) {
    if (err.code === 1) return res.type('text/plain').send('')
    throw err
  }
}))

export default router
