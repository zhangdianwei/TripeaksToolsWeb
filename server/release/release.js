import { Router } from 'express'
import { execFile } from 'child_process'
import { promisify } from 'util'
import secrets from '../config.js'
import * as store from '../store/store.js'
import { getRelease } from '../feishu/feishu.js'

// 说明:「正式环境」(prepare)真实执行飞书拉取 + 各仓库拉取;其余步骤(合并/记录/数数)仍为模拟数据。
const exec = promisify(execFile)
// compile.coffee 的 shebang 是相对路径,macOS 链式解析不可靠,显式用 coffee 解释器执行。
const COFFEE = './node_modules/coffee-script/bin/coffee'
const git = (cwd, args) => exec('git', ['-C', cwd, ...args], { maxBuffer: 64 * 1024 * 1024 }).then(r => r.stdout.trim())
function shortErr(e) {
  const lines = String(e.stderr || e.message || e).trim().split('\n').filter(Boolean)
  return (lines[lines.length - 1] || '失败').slice(0, 140)
}
const COL = 'flows'
// 仓库路径取自 private_key.json 顶层键(仓库名 → 绝对路径);分支/仓库组成按项目在此定义。
const PROJECT_REPOS = {
  TP1: [
    { name: 'TripeaksClient', branch: 'tripeaks/beta' },
    { name: 'TripeaksResources', branch: 'master' },
    { name: 'TripeaksJourneyConfig', branch: 'beta' },
    { name: 'TripeaksLevelConfig', branch: 'master' },
  ],
  TP4: [
    { name: 'TripeaksClient', branch: 'tripeaks4p/beta' },
    { name: 'TripeaksResources', branch: 'master' },
    { name: 'TripeaksAdventureConfig', branch: 'beta' },
    { name: 'TripeaksLevelConfig', branch: 'master' },
  ],
}
const MERGE = {
  TP1: { repo: 'TripeaksClient', from: 'tripeaks/beta', to: 'tripeaks/prod' },
  TP4: { repo: 'TripeaksClient', from: 'tripeaks4p/beta', to: 'tripeaks4p/prod' },
}
const repoPath = (name) => secrets[name] || ''
const projRepos = (p) => (PROJECT_REPOS[p] || []).map(r => ({ ...r, path: repoPath(r.name) }))
const projMerge = (p) => { const m = MERGE[p]; return m ? { ...m, repo: repoPath(m.repo) } : null }

function nowIso() { return new Date().toISOString() }
function stamp() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}
function logEntry(f, op, action, detail) { f.log.push({ at: nowIso(), operator: op || '', action, detail: detail || '' }) }
function summary(f) {
  const s = f.steps || {}
  const doneCount = Object.values(s).filter(x => x.status === 'done').length
  return { id: f.id, project: f.project, flowType: f.flowType, creator: f.creator, status: f.status, doneCount, updatedAt: f.updatedAt }
}
function newFlow(project, creator, flowType) {
  return {
    id: `${project}-${stamp()}`,
    project, flowType: flowType || 'regular', creator: creator || '',
    status: 'active',
    createdAt: nowIso(), updatedAt: nowIso(),
    context: {}, steps: {}, log: [],
  }
}

// ============ 正式环境:单个子流程真实执行 ============
const SEP = '│'
async function runFeishuSub(project) {
  try {
    const g = (await getRelease()).groups.find(x => x.project === project)
    if (!g) return { sub: { name: '拉取飞书发版内容', ok: false, error: '本周未找到该项目发版内容' } }
    return {
      sub: { name: '拉取飞书发版内容', ok: true, result: g.versionName },
      ctx: { versionName: g.versionName, stories: g.stories, needPackage: g.needPackage },
    }
  } catch (e) { return { sub: { name: '拉取飞书发版内容', ok: false, error: shortErr(e) } } }
}
async function runRepoSub(project, name) {
  const r = projRepos(project).find(x => x.name === name)
  if (!r) return { sub: { name, ok: false, error: '未知仓库' } }
  if (!r.path) return { sub: { name, ok: false, error: `未配置路径(private_key.json 顶层键 "${name}")` } }
  try {
    await git(r.path, ['checkout', '-f', r.branch])
    await git(r.path, ['clean', '-df'])
    await git(r.path, ['pull', '--rebase', 'origin', r.branch])
    await git(r.path, ['submodule', 'update', '--init', '--recursive', '--force'])
    const line = await git(r.path, ['log', '-1', `--pretty=%h${SEP}%s${SEP}%an`])
    const [commit, subject, author] = line.split(SEP)
    return {
      sub: { name, ok: true, commit, subject, author, result: `${commit} ${subject} · ${author}` },
      ctx: name === 'TripeaksResources' ? { resourceCommit: commit } : null,
    }
  } catch (e) { return { sub: { name, ok: false, error: shortErr(e) } } }
}
// 编译指定目标后检查是否产生改动(资源/配置表/关卡各自独立校验)
async function runCheckSub(name, args) {
  const cwd = repoPath('TripeaksClient')
  if (!cwd) return { sub: { name, ok: false, error: '未配置 TripeaksClient 路径' } }
  const opts = { cwd, maxBuffer: 64 * 1024 * 1024 }
  try {
    await exec(COFFEE, ['compile.coffee', ...args], opts)
    const dirty = (await git(cwd, ['status', '--porcelain'])).trim()
    if (!dirty) return { sub: { name, ok: true, result: '最新' } }
    const full = await git(cwd, ['status'])
    return { sub: { name, ok: false, result: full.slice(0, 4000) } }
  } catch (e) { return { sub: { name, ok: false, error: shortErr(e), detail: String(e.stderr || e.message || e).slice(0, 2000) } } }
}
async function runPrepareSub(project, sub) {
  if (sub === 'feishu') return runFeishuSub(project)
  if (sub === 'check:res') return runCheckSub('检查资源', ['res', '--all'])
  if (sub === 'check:table') return runCheckSub('检查配置表', ['table'])
  if (sub === 'check:level') return runCheckSub('检查关卡', ['level'])
  if (sub === 'ota') return { sub: { name: '打ota并发消息', ok: true, result: '已标记(暂未实际打ota/发消息)' } }
  if (sub.startsWith('repo:')) return runRepoSub(project, sub.slice(5))
  throw new Error(`未知子流程: ${sub}`)
}

const router = Router()

function wrap(fn) {
  return async (req, res) => {
    try { await fn(req, res) }
    catch (err) {
      console.error('[release]', err.stack || err)
      res.status(err.code || 500).json({ error: err.message || String(err) })
    }
  }
}
function getFlow(id) {
  const f = store.get(COL, id)
  if (!f) { const e = new Error(`流程不存在: ${id}`); e.code = 404; throw e }
  return f
}
function patchStep(id, stepKey, fn, op, detail) {
  return store.patch(COL, id, f => {
    if (!f.steps[stepKey]) f.steps[stepKey] = { status: 'pending' }
    fn(f, f.steps[stepKey])
    logEntry(f, op, stepKey, detail)
    f.updatedAt = nowIso()
  })
}

// ============ 流程 CRUD ============
router.get('/config', wrap(async (req, res) => {
  const repos = projRepos(req.query.project)
  res.json({ project: req.query.project, repos, merge: projMerge(req.query.project), configured: repos.every(r => r.path) })
}))

router.get('/flows', wrap(async (req, res) => {
  let flows = store.list(COL).map(summary)
  if (req.query.status) flows = flows.filter(f => f.status === req.query.status)
  flows.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
  res.json({ flows })
}))

router.post('/flows', wrap(async (req, res) => {
  const { project, creator, flowType } = req.body || {}
  if (!project) throw new Error('缺少 project')
  const flow = newFlow(project, creator, flowType)
  await store.put(COL, flow.id, flow)
  res.json(flow)
}))

router.get('/flows/:id', wrap(async (req, res) => res.json(getFlow(req.params.id))))

router.post('/flows/:id/step', wrap(async (req, res) => {
  const { stepKey, status, data, operator } = req.body || {}
  if (!stepKey) throw new Error('缺少 stepKey')
  getFlow(req.params.id)
  res.json(await patchStep(req.params.id, stepKey, (f, s) => {
    if (status) s.status = status
    if (data) Object.assign(s, data)
    if (status === 'done' || status === 'skipped') { s.doneBy = operator || ''; s.doneAt = nowIso() }
  }, operator, `step ${status || ''}`))
}))

router.post('/flows/:id/done', wrap(async (req, res) => {
  getFlow(req.params.id)
  res.json(await store.patch(COL, req.params.id, f => { f.status = 'done'; logEntry(f, req.body?.operator, 'done', ''); f.updatedAt = nowIso() }))
}))

router.post('/flows/:id/abort', wrap(async (req, res) => {
  getFlow(req.params.id)
  res.json(await store.patch(COL, req.params.id, f => { f.status = 'aborted'; logEntry(f, req.body?.operator, 'abort', ''); f.updatedAt = nowIso() }))
}))

// ============ 大流程操作 ============
// 正式环境:前端逐个调用本端点,一个子流程一次,执行完即返回结果。
router.post('/flows/:id/prepare/sub', wrap(async (req, res) => {
  const flow = getFlow(req.params.id)
  const { stepKey, sub, operator } = req.body || {}
  if (!sub) throw new Error('缺少 sub')
  const t0 = Date.now()
  const { sub: out, ctx } = await runPrepareSub(flow.project, sub)
  out.ms = Date.now() - t0
  res.json(await patchStep(req.params.id, stepKey, (f, s) => {
    if (!s.subs) s.subs = []
    const i = s.subs.findIndex(x => x.name === out.name)
    if (i >= 0) s.subs[i] = out; else s.subs.push(out)
    if (ctx) Object.assign(f.context, ctx)
    s.status = 'running'
  }, operator, `子流程 ${out.name} ${out.ok ? 'ok' : 'failed'}`))
}))

router.post('/flows/:id/merge', wrap(async (req, res) => {
  const flow = getFlow(req.params.id)
  const { stepKey, operator, from, to, tag } = req.body || {}
  res.json(await patchStep(req.params.id, stepKey, (f, s) => {
    s.status = 'done'; s.doneBy = operator || ''; s.doneAt = nowIso(); s.mock = true
    s.from = from || ''; s.to = to || ''
    s.mergeCommit = 'def5678'
    s.tag = tag || ''
    s.mergedLog = `${from || 'beta'} → ${to || 'prod'} (mock merge def5678)${tag ? `\ntag: ${tag}` : ''}`
  }, operator, `合并(mock) ${tag || ''}`))
}))

router.post('/flows/:id/record', wrap(async (req, res) => {
  const flow = getFlow(req.params.id)
  const { stepKey, operator, row } = req.body || {}
  const year = String(row?.date || '').split('.')[0] || String(new Date().getFullYear())
  const sheet = `${year}发版记录-${flow.project.toLowerCase()}`
  res.json(await patchStep(req.params.id, stepKey, (f, s) => {
    s.status = 'done'; s.doneBy = operator || ''; s.doneAt = nowIso(); s.mock = true
    s.sheet = sheet; s.row = row
  }, operator, `填记录(mock) ${sheet}`))
}))

// 数数:启动倒计时(记录截止时间) + 倒计时结束后查询(mock)
router.post('/flows/:id/shushu/start', wrap(async (req, res) => {
  getFlow(req.params.id)
  const { stepKey, operator, minutes } = req.body || {}
  const mins = Number(minutes) || 30
  const endAt = new Date(Date.now() + mins * 60000).toISOString()
  res.json(await patchStep(req.params.id, stepKey, (f, s) => {
    s.status = 'running'; s.minutes = mins; s.countdownEndAt = endAt; s.result = null; s.mock = true
  }, operator, `数数倒计时 ${mins}min`))
}))

router.post('/flows/:id/shushu/query', wrap(async (req, res) => {
  const flow = getFlow(req.params.id)
  const { stepKey, operator } = req.body || {}
  const result = {
    version: `${flow.project.toLowerCase()}/${flow.context?.otaVersion || '123'}`,
    days: 2,
    total: 0,
    errors: [],
    queriedAt: nowIso(),
  }
  res.json(await patchStep(req.params.id, stepKey, (f, s) => {
    s.status = 'done'; s.doneBy = operator || ''; s.doneAt = nowIso(); s.result = result
  }, operator, '数数查询(mock)'))
}))

// 启动时:运行中的数数倒计时进程已不存在影响,这里无需 sweep(纯倒计时由前端依据 countdownEndAt 计算)

export default router
