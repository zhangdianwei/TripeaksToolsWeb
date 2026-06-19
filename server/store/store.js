import fs from 'fs'
import path from 'path'
import secrets from '../config.js'

function dataDir() {
  const dir = secrets.TripeaksToolsWebData
  if (!dir) throw new Error('未配置 TripeaksToolsWebData(server/private_key.json 顶层),无法存档')
  return dir
}

function colDir(collection) {
  const dir = path.join(dataDir(), collection)
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function filePath(collection, id) {
  return path.join(colDir(collection), `${id}.json`)
}

function writeAtomic(fp, obj) {
  const tmp = `${fp}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2))
  fs.renameSync(tmp, fp)
}

const locks = new Map()
function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve()
  const next = prev.then(fn, fn)
  locks.set(key, next.catch(() => {}))
  return next
}

export function list(collection) {
  return fs.readdirSync(colDir(collection))
    .filter(f => f.endsWith('.json'))
    .map(f => JSON.parse(fs.readFileSync(path.join(colDir(collection), f), 'utf-8')))
}

export function get(collection, id) {
  const fp = filePath(collection, id)
  return fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf-8')) : null
}

export function put(collection, id, obj) {
  return withLock(`${collection}/${id}`, () => {
    writeAtomic(filePath(collection, id), obj)
    return obj
  })
}

export function patch(collection, id, fn) {
  return withLock(`${collection}/${id}`, () => {
    const cur = get(collection, id)
    if (!cur) throw new Error(`记录不存在: ${collection}/${id}`)
    const next = fn(cur) || cur
    writeAtomic(filePath(collection, id), next)
    return next
  })
}

export function remove(collection, id) {
  return withLock(`${collection}/${id}`, () => {
    const fp = filePath(collection, id)
    if (fs.existsSync(fp)) fs.unlinkSync(fp)
  })
}
