import { Router } from 'express'
import { execFile } from 'child_process'
import { promisify } from 'util'
import secrets from '../config.js'
import * as store from '../store/store.js'
import { getRelease, sendBotMessage } from '../feishu/feishu.js'
import { querySql } from '../shushu/shushu.js'
import { triggerOta } from '../jenkins/jenkins.js'
import { fillRecord, findRecord } from '../gsheet/gsheet.js'

// 说明:常规发版各步(发版前/推送/发版后/数数/通知)均真实执行;热更流程的 merge/record 仍为 mock。
const exec = promisify(execFile)
// compile.coffee 的 shebang 是相对路径,macOS 链式解析不可靠,显式用 coffee 解释器执行。
const COFFEE = './node_modules/coffee-script/bin/coffee'
const git = (cwd, args) => exec('git', ['-C', cwd, ...args], { maxBuffer: 64 * 1024 * 1024 }).then(r => r.stdout.trim())
const OTA_GREP = 'Update[ _]ota[ _]files[ _]to[ _]version[ _][0-9]+[ _]for[ _]production'
const OTA_RE = /version[ _](\d+)[ _]for[ _]production/
async function isAncestor(cwd, a, b) {
  try { await exec('git', ['-C', cwd, 'merge-base', '--is-ancestor', a, b]); return true } catch { return false }
}
// 从 from 分支(fetch 后)解析最新的 production ota 版本号
async function otaVersionOf(project) {
  const m = MERGE[project]; const cwd = repoPath(m?.repo)
  if (!cwd) return null
  await git(cwd, ['fetch', 'origin', m.from]).catch(() => {})
  const out = await git(cwd, ['log', `origin/${m.from}`, '-E', '--grep', OTA_GREP, '-1', '--pretty=%s']).catch(() => '')
  const mm = String(out).match(OTA_RE)
  return mm ? mm[1] : null
}
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
// 群机器人 webhook(private_key.json 顶层 webhook 映射)
const groupUrl = (name) => (secrets.webhook || {})[name]
const devGroupUrl = (project) => groupUrl(`${project}研发群`)
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
      sub: { name: '拉取飞书发版内容', ok: true, result: `${g.versionName} · ${g.needPackage ? '需要发包' : '无需发包'}` },
      ctx: { versionName: g.versionName, stories: g.stories, needPackage: g.needPackage },
    }
  } catch (e) { return { sub: { name: '拉取飞书发版内容', ok: false, error: shortErr(e) } } }
}
async function runRepoSub(project, name) {
  const r = projRepos(project).find(x => x.name === name)
  if (!r) return { sub: { name, ok: false, error: '未知仓库' } }
  if (!r.path) return { sub: { name, ok: false, error: `未配置路径(private_key.json 顶层键 "${name}")` } }
  try {
    await git(r.path, ['fetch', 'origin', r.branch])
    await git(r.path, ['checkout', '-f', r.branch])
    await git(r.path, ['reset', '--hard', `origin/${r.branch}`])
    await git(r.path, ['clean', '-df'])
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
// 打 ota:触发 Jenkins 构建,等构建开始拿到 build 号存入 context
async function runOtaSub(flow) {
  const name = '打ota'
  try {
    const r = await triggerOta(flow.project, { branch: 'beta', production: true, syncTable: false, syncLevels: false, alert: true })
    return {
      sub: { name, ok: true, result: r.build ? `ota 已开始构建(#${r.build})` : 'ota 已触发(排队中)' },
      ctx: r.build ? { otaBuild: r.build } : null,
    }
  } catch (e) { return { sub: { name, ok: false, error: shortErr(e), detail: String(e.stderr || e.message || e).slice(0, 2000) } } }
}
// 发消息:发版内容发到项目研发群(版本号用打ota存下的 build 号);发送失败不阻塞
async function runOtaMsgSub(flow) {
  const name = '通知到群'
  const c = flow.context || {}
  const content = (c.stories || []).map((s, i) => `${i + 1}. ${s}`).join('\n')
  const smoke = c.otaBuild ? `\n版本号${c.otaBuild},可以smoke。` : '\n可以smoke。'
  const text = `今日发版：${c.versionName || ''}\n是否发包：${c.needPackage ? '是' : '否'}\n发版内容：\n${content}${smoke}`
  let note = ''
  try { await sendBotMessage(text, devGroupUrl(flow.project)) } catch (e) { note = `\n(通知失败:${shortErr(e)})` }
  return { sub: { name, ok: true, result: text + note } }
}
async function runPrepareSub(flow, sub) {
  const project = flow.project
  if (sub === 'feishu') return runFeishuSub(project)
  if (sub === 'check:res') return runCheckSub('检查资源', ['res', '--all'])
  if (sub === 'check:table') return runCheckSub('检查配置表', ['table'])
  if (sub === 'check:level') return runCheckSub('检查关卡', ['level'])
  if (sub === 'ota') return runOtaSub(flow)
  if (sub === 'otamsg') return runOtaMsgSub(flow)
  if (sub.startsWith('repo:')) return runRepoSub(project, sub.slice(5))
  throw new Error(`未知子流程: ${sub}`)
}

// ============ 发版后:幂等真实执行(先 precheck 真实状态,再决定跳过/执行一次) ============
// beta合并到prod:拉最新 client(beta)→ 解析 ota 版本 → 本地 merge 到 prod 打 tag,不 push
async function runMergeSub(project) {
  const name = 'beta合并到prod'
  const m = MERGE[project]; const cwd = repoPath('TripeaksClient')
  if (!cwd) return { sub: { name, ok: false, error: '未配置 TripeaksClient 路径' } }
  try {
    await git(cwd, ['fetch', 'origin', m.from])
    await git(cwd, ['checkout', '-f', m.from])
    await git(cwd, ['reset', '--hard', `origin/${m.from}`])
    await git(cwd, ['clean', '-df'])
    await git(cwd, ['submodule', 'update', '--init', '--recursive', '--force'])
    const out = await git(cwd, ['log', m.from, '-E', '--grep', OTA_GREP, '-1', '--pretty=%s']).catch(() => '')
    const mm = String(out).match(OTA_RE); const ver = mm ? mm[1] : null
    if (!ver) return { sub: { name, ok: false, error: 'beta 上未找到 production ota 提交,请先完成打 ota' } }
    const tag = `${project.toLowerCase()}/${ver}`
    const merged = await isAncestor(cwd, `origin/${m.from}`, m.to)
    const tagExists = !!(await git(cwd, ['tag', '-l', tag]).catch(() => ''))
    if (!merged) {
      await git(cwd, ['checkout', '-f', m.to])
      await git(cwd, ['merge', '--no-edit', `origin/${m.from}`])
    }
    if (!tagExists) await git(cwd, ['tag', tag])
    const head = await git(cwd, ['rev-parse', '--short', m.to])
    return { sub: { name, ok: true, result: `client ${ver} · ${merged ? `prod 已含 ${m.from}` : `已合并 ${m.from} 到 ${m.to}`} (${head}),tag ${tag}(本地,未 push)` }, ctx: { otaVersion: ver } }
  } catch (e) { return { sub: { name, ok: false, error: shortErr(e), detail: String(e.stderr || e.message || e).slice(0, 2000) } } }
}
// 发版记录:precheck 查表是否已有该版本行,否则真实写入
async function runRecordSub(project, operator, flow) {
  const name = '填写发版记录'
  try {
    const ver = flow.context?.otaVersion || await otaVersionOf(project)
    if (!ver) return { sub: { name, ok: false, error: '未解析到 ota 版本,请先完成打 ota / 合并' } }
    const version = `${project.toLowerCase()}/${ver}`
    const date = todayDot()
    const found = await findRecord({ project, version, date })
    if (found.exists) return { sub: { name, ok: true, skipped: true, result: `表中已存在(第 ${found.rowNumber} 行):${version}` }, ctx: { otaVersion: ver } }
    const row = {
      date, platform: flow.context?.needPackage ? 'ota/ios/android' : 'ota', version,
      content: (flow.context?.stories || []).map((n, i) => `${i + 1}. ${n}`).join('\n'),
      commit: flow.context?.resourceCommit || '',
    }
    const r = await fillRecord({ project, row, releaser: operator, dryRun: false })
    return { sub: { name, ok: true, result: `已写入「${r.sheet}」:${version}` }, ctx: { otaVersion: ver } }
  } catch (e) { return { sub: { name, ok: false, error: shortErr(e), detail: String(e.stderr || e.message || e).slice(0, 2000) } } }
}
function todayDot() { const d = new Date(); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}` }
// ============ 数数报错(真实查询 jserror_new,按 msg 分组,区分全版本/最新版本) ============
const SHUSHU_EVENT_TABLE = { TP1: 'ta.v_event_6', TP4: 'ta.v_event_2' }
function pad2(n) { return String(n).padStart(2, '0') }
function ymd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
// 只查本次发布版本(otaVersion):c_gameversion 精确过滤,按 msg 分组
async function queryShushu(project, version) {
  const table = SHUSHU_EVENT_TABLE[project]
  if (!table) throw new Error(`未配置数数事件表: ${project}`)
  const v = version != null && version !== '' ? String(version) : null
  if (!v) throw new Error('未获取到本次发布版本(otaVersion),无法查询')
  const now = Date.now()
  const from = ymd(new Date(now - 2 * 86400000)), to = ymd(new Date(now + 86400000))
  const sql = `SELECT "msg" msg, count(*) cnt FROM ${table} ` +
    `WHERE "$part_date" BETWEEN '${from}' AND '${to}' AND "#event_name" = 'jserror_new' AND "c_gameversion" = '${v}' ` +
    `GROUP BY "msg" ORDER BY cnt DESC`
  const rows = await querySql(sql)
  const groups = rows.map(r => ({ msg: r.msg || '(空)', count: Number(r.cnt) || 0 })).sort((a, b) => b.count - a.count)
  return { days: 2, queriedAt: nowIso(), version: v, total: groups.reduce((s, x) => s + x.count, 0), groups }
}
// 数数结果发到客户端群(近2天 jserror_new,按 msg)
function shushuMsg(project, r) {
  const head = `${project} 数数报错(近${r.days}天 jserror_new,版本 ${r.version})`
  if (!r.total) return `${head}\n无报错`
  const lines = r.groups.slice(0, 20).map((g, i) => `${i + 1}. ${String(g.msg).slice(0, 120)} ×${g.count}`)
  const more = r.groups.length > 20 ? `\n…其余 ${r.groups.length - 20} 类` : ''
  return `${head}\n共 ${r.total} 条\n${lines.join('\n')}${more}`
}
function notifyShushu(project, result) {
  return sendBotMessage(shushuMsg(project, result), groupUrl('客户端群')).catch(() => {})
}

// 通知完毕:发"客户端发版完毕"到项目研发群
async function runNotifySub(flow) {
  const name = '通知完毕'
  const ver = flow.context?.otaVersion ? `\n版本号 ${flow.project.toLowerCase()}/${flow.context.otaVersion}` : ''
  const text = `${flow.project} 客户端发版完毕${ver}`
  try {
    await sendBotMessage(text, devGroupUrl(flow.project))
    return { sub: { name, ok: true, result: text } }
  } catch (e) { return { sub: { name, ok: false, error: shortErr(e), detail: String(e.stderr || e.message || e).slice(0, 2000) } } }
}
async function runPostSub(flow, sub, operator) {
  if (sub === 'merge') return runMergeSub(flow.project)
  if (sub === 'record') return runRecordSub(flow.project, operator, flow)
  if (sub === 'notify') return runNotifySub(flow)
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
// 前端逐个调用,一个子流程一次,执行完即返回结果。
function saveSub(id, stepKey, out, ctx, operator) {
  return patchStep(id, stepKey, (f, s) => {
    if (!s.subs) s.subs = []
    const i = s.subs.findIndex(x => x.name === out.name)
    if (i >= 0) s.subs[i] = out; else s.subs.push(out)
    if (ctx) Object.assign(f.context, ctx)
    s.status = 'running'
  }, operator, `子流程 ${out.name} ${out.ok ? 'ok' : 'failed'}`)
}
// 发版前流程
router.post('/flows/:id/prepare/sub', wrap(async (req, res) => {
  const flow = getFlow(req.params.id)
  const { stepKey, sub, operator } = req.body || {}
  if (!sub) throw new Error('缺少 sub')
  const t0 = Date.now()
  const { sub: out, ctx } = await runPrepareSub(flow, sub)
  out.ms = Date.now() - t0
  res.json(await saveSub(req.params.id, stepKey, out, ctx, operator))
}))
// 发版后流程(幂等:先 precheck 真实状态)
router.post('/flows/:id/post/sub', wrap(async (req, res) => {
  const flow = getFlow(req.params.id)
  const { stepKey, sub, operator } = req.body || {}
  if (!sub) throw new Error('缺少 sub')
  const t0 = Date.now()
  const { sub: out, ctx } = await runPostSub(flow, sub, operator)
  out.ms = Date.now() - t0
  res.json(await saveSub(req.params.id, stepKey, out, ctx, operator))
}))
// 推送线上后通知群:线上 <版本> 已发
router.post('/flows/:id/notify-pushed', wrap(async (req, res) => {
  const flow = getFlow(req.params.id)
  const ver = flow.context?.otaVersion || await otaVersionOf(flow.project)
  const text = `线上 ${ver ? `${flow.project.toLowerCase()}/${ver}` : '版本'} 已发`
  await sendBotMessage(text, devGroupUrl(flow.project))
  res.json({ ok: true, text })
}))
// 手动标记某子流程为已完成(线下修复后用)
router.post('/flows/:id/sub/mark', wrap(async (req, res) => {
  getFlow(req.params.id)
  const { stepKey, name, operator } = req.body || {}
  if (!stepKey || !name) throw new Error('缺少 stepKey/name')
  res.json(await saveSub(req.params.id, stepKey, { name, ok: true, manual: true, result: '已手动标记完成' }, null, operator))
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

// 数数:启动倒计时(记录截止时间) + 倒计时结束后真实查询
router.post('/flows/:id/shushu/start', wrap(async (req, res) => {
  getFlow(req.params.id)
  const { stepKey, operator, minutes } = req.body || {}
  const mins = Number(minutes) || 30
  const endAt = new Date(Date.now() + mins * 60000).toISOString()
  res.json(await patchStep(req.params.id, stepKey, (f, s) => {
    s.status = 'running'; s.minutes = mins; s.countdownEndAt = endAt; s.result = null
  }, operator, `数数倒计时 ${mins}min`))
}))

router.post('/flows/:id/shushu/query', wrap(async (req, res) => {
  const flow = getFlow(req.params.id)
  const { stepKey, operator } = req.body || {}
  let result, errMsg
  try { result = await queryShushu(flow.project, flow.context?.otaVersion) } catch (e) { errMsg = shortErr(e) }
  if (result) await notifyShushu(flow.project, result)
  res.json(await patchStep(req.params.id, stepKey, (f, s) => {
    if (errMsg) { s.status = 'failed'; s.error = errMsg }
    else { s.status = 'done'; s.doneBy = operator || ''; s.doneAt = nowIso(); s.result = result; delete s.error; delete s.mock }
  }, operator, errMsg ? '数数查询失败' : '数数查询'))
}))

// 服务器端定时扫描:到点的数数倒计时(即使前端没打开)也会自动查询
let sweeping = false
async function sweepShushu() {
  if (sweeping) return
  sweeping = true
  try {
    const now = Date.now()
    for (const f of store.list(COL)) {
      if (f.status !== 'active') continue
      for (const [key, s] of Object.entries(f.steps || {})) {
        if (s.status !== 'running' || !s.countdownEndAt || s.result || Date.parse(s.countdownEndAt) > now) continue
        try {
          const result = await queryShushu(f.project, f.context?.otaVersion)
          await notifyShushu(f.project, result)
          await patchStep(f.id, key, (ff, ss) => { ss.status = 'done'; ss.doneAt = nowIso(); ss.doneBy = 'system'; ss.result = result; delete ss.mock }, 'system', '数数查询(自动)')
        } catch (e) {
          await patchStep(f.id, key, (ff, ss) => { ss.status = 'failed'; ss.error = shortErr(e) }, 'system', '数数查询失败(自动)').catch(() => {})
        }
      }
    }
  } finally { sweeping = false }
}
setInterval(() => { sweepShushu().catch(() => {}) }, 60000)

// 启动时:运行中的数数倒计时进程已不存在影响,这里无需 sweep(纯倒计时由前端依据 countdownEndAt 计算)

export default router
