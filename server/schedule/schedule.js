import { Router } from 'express'
import * as store from '../store/store.js'
import { dispatch } from './registry.js'

// 通用倒计时调度器:前端提交 {delayMs, module, action, params},到点后按注册表派发执行。
// 纯 JSON 落盘(集合 schedule),重启可恢复;不认识任何业务,只负责"到点调用注册动作"。
const COL = 'schedule'
const nowIso = () => new Date().toISOString()
let seq = 0
function newId() { return `sched-${Date.now()}-${seq++}` }

// 结算一条任务:派发动作,写回结果/错误,置 done。
async function settle(id) {
  const t = store.get(COL, id)
  if (!t || t.status !== 'pending') return t
  let result, error
  try { result = await dispatch(t.module, t.action, t.params) }
  catch (e) { error = String(e.message || e) }
  return store.patch(COL, id, x => {
    x.status = 'done'; x.updatedAt = nowIso()
    if (error) { x.error = error; x.result = null } else { x.result = result; x.error = null }
  })
}

const router = Router()
function wrap(fn) {
  return async (req, res) => {
    try { await fn(req, res) }
    catch (err) {
      console.error('[schedule]', err.stack || err)
      res.status(err.code || 500).json({ error: err.message || String(err) })
    }
  }
}

// 建任务:delayMs<=0 立即结算并返回;否则排期为 pending。
router.post('/', wrap(async (req, res) => {
  const { delayMs, module, action, params, createdBy } = req.body || {}
  if (!module || !action) throw new Error('缺少 module/action')
  const delay = Math.max(0, Number(delayMs) || 0)
  const id = newId()
  const task = {
    id, module, action, params: params || {},
    dueAt: new Date(Date.now() + delay).toISOString(),
    status: 'pending', result: null, error: null,
    createdBy: createdBy || '', createdAt: nowIso(), updatedAt: nowIso(),
  }
  await store.put(COL, id, task)
  res.json(delay <= 0 ? await settle(id) : task)
}))

router.get('/', wrap(async (req, res) => {
  let tasks = store.list(COL)
  for (const k of ['status', 'action', 'module']) {
    if (req.query[k]) tasks = tasks.filter(t => t[k] === req.query[k])
  }
  tasks.sort((a, b) => (a.dueAt < b.dueAt ? -1 : 1))
  res.json({ tasks })
}))

router.post('/:id/run', wrap(async (req, res) => {
  if (!store.get(COL, req.params.id)) { const e = new Error('任务不存在'); e.code = 404; throw e }
  res.json(await settle(req.params.id))
}))

router.delete('/:id', wrap(async (req, res) => {
  await store.remove(COL, req.params.id)
  res.json({ ok: true })
}))

// 定时扫描:到点的 pending 任务自动结算(与任何 flow 无关)。
let sweeping = false
async function sweep() {
  if (sweeping) return
  sweeping = true
  try {
    const now = Date.now()
    for (const t of store.list(COL)) {
      if (t.status !== 'pending' || Date.parse(t.dueAt) > now) continue
      await settle(t.id).catch(() => {})
    }
  } finally { sweeping = false }
}
setInterval(() => { sweep().catch(() => {}) }, 60000)

export default router
