import { Router } from 'express'
import { execFile } from 'child_process'
import { promisify } from 'util'
import secrets from '../config.js'
import * as store from '../store/store.js'
import { getRelease, sendBotCard } from '../feishu/feishu.js'
import { querySql } from '../shushu/shushu.js'
import { triggerOta } from '../jenkins/jenkins.js'
import { fillRecord, findRecord } from '../gsheet/gsheet.js'
import { register } from '../schedule/registry.js'

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
function shortErr(e) {
  const lines = String(e.stderr || e.message || e).trim().split('\n').filter(Boolean)
  return (lines[lines.length - 1] || '失败').slice(0, 140)
}
const COL = 'flows'
// 仓库路径取自 server_config.json 顶层键(仓库名 → 绝对路径);分支/仓库组成按项目在此定义。
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
// 群机器人 webhook(server_config.json 顶层 webhook 映射)
const groupUrl = (name) => (secrets.webhook || {})[name]
const devGroupUrl = (project) => groupUrl(`${project}研发群`)

// ============ 飞书卡片内容(各通知统一风格) ============
const RED = (s) => `<font color='#A61B29'>**${s}**</font>`
function releaseCard(project, { versionName, needPackage, stories, releaseVersion, operator }) {
  const top = `是否发包：${needPackage ? RED('是') : '否'}\n发布版本：${releaseVersion ? RED(releaseVersion) : '—'}\n操作人：${operator || '—'}`
  const content = `**发版内容**\n${(stories || []).map((s, i) => `${i + 1}. ${s}`).join('\n') || '—'}`
  return { title: versionName || `${project} · 今日发版`, template: 'blue', body: [top, content] }
}
function doneCard(project, version) {
  return { title: `${project} · 发版完毕`, template: 'green', body: `客户端发版完毕\n版本：**${version || '—'}**` }
}
// jserror_new 的 msg → 数量,做成飞书卡片双列表格(is_short 两列)
function msgTable(groups) {
  const top = groups.slice(0, 30)
  const fields = [
    { is_short: true, text: { tag: 'lark_md', content: '**msg**' } },
    { is_short: true, text: { tag: 'lark_md', content: '**数量**' } },
  ]
  for (const g of top) {
    fields.push({ is_short: true, text: { tag: 'plain_text', content: g.msg } })
    fields.push({ is_short: true, text: { tag: 'plain_text', content: String(g.count) } })
  }
  return { tag: 'div', fields }
}
function shushuCard(project, r) {
  const md = `app_start 触发用户数 ${r.appStartUsers} 人\njserror_new 数量 ${r.total ? RED(r.total) : 0}`
  const body = [md]
  if (r.groups?.length) {
    body.push(msgTable(r.groups))
    if (r.groups.length > 30) body.push(`仅显示报错数前 30 条,共 ${r.groups.length} 条`)
  }
  return { title: `${r.version} 报错情况`, template: r.total ? 'red' : 'green', body }
}
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
  if (!r.path) return { sub: { name, ok: false, error: `未配置路径(server_config.json 顶层键 "${name}")` } }
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
      sub: { name, ok: true, result: r.build ? `ota 已开始构建,发布版本 ${r.build}` : 'ota 已触发(排队中)' },
      ctx: r.build ? { releaseVersion: r.build } : null,
    }
  } catch (e) { return { sub: { name, ok: false, error: shortErr(e), detail: String(e.stderr || e.message || e).slice(0, 2000) } } }
}
// 发消息:发版内容发到项目研发群(版本号用打ota存下的 build 号);发送失败不阻塞
async function runOtaMsgSub(flow, operator) {
  const name = '通知到群'
  const c = flow.context || {}
  const content = (c.stories || []).map((s, i) => `${i + 1}. ${s}`).join('\n')
  const smoke = c.releaseVersion ? `版本号${c.releaseVersion},可以smoke。` : '可以smoke。'
  const text = `今日发版：${c.versionName || ''}\n是否发包：${c.needPackage ? '是' : '否'}\n发版内容:\n${content}\n${smoke}`
  let note = ''
  try { await sendBotCard(devGroupUrl(flow.project), releaseCard(flow.project, { ...c, operator })) } catch (e) { note = `\n(通知失败:${shortErr(e)})` }
  return { sub: { name, ok: true, result: text + note } }
}
async function runPrepareSub(flow, sub, operator) {
  const project = flow.project
  if (sub === 'feishu') return runFeishuSub(project)
  if (sub === 'check:res') return runCheckSub('检查资源', ['res', '--all'])
  if (sub === 'check:table') return runCheckSub('检查配置表', ['table'])
  if (sub === 'check:level') return runCheckSub('检查关卡', ['level'])
  if (sub === 'ota') return runOtaSub(flow)
  if (sub === 'otamsg') return runOtaMsgSub(flow, operator)
  if (sub.startsWith('repo:')) return runRepoSub(project, sub.slice(5))
  throw new Error(`未知子流程: ${sub}`)
}

// ============ 发版后:幂等真实执行(先 precheck 真实状态,再决定跳过/执行一次) ============
// beta合并到prod:beta 和 prod 都对齐到最新 → 解析 ota 版本 → 本地 merge 到 prod 打 tag,不 push
const alignBranch = async (cwd, branch) => {
  await git(cwd, ['fetch', 'origin', branch])
  await git(cwd, ['checkout', '-f', branch])
  await git(cwd, ['reset', '--hard', `origin/${branch}`])
  await git(cwd, ['clean', '-df'])
  await git(cwd, ['submodule', 'update', '--init', '--recursive', '--force'])
}
// 更新 TripeaksClient(对齐到最新 beta),返回 commit/msg/author
async function runUpdateClientSub(project) {
  const name = '更新TripeaksClient'
  const m = MERGE[project]; const cwd = repoPath('TripeaksClient')
  if (!cwd) return { sub: { name, ok: false, error: '未配置 TripeaksClient 路径' } }
  try {
    await alignBranch(cwd, m.from)
    const line = await git(cwd, ['log', '-1', `--pretty=%h${SEP}%s${SEP}%an`])
    const [commit, subject, author] = line.split(SEP)
    return { sub: { name, ok: true, commit, subject, author, result: `${commit} ${subject} · ${author}` } }
  } catch (e) { return { sub: { name, ok: false, error: shortErr(e), detail: String(e.stderr || e.message || e).slice(0, 2000) } } }
}
// 检查版本号一致性:beta 上的 production 版本号 == 发布版本
async function runCheckVersionSub(flow) {
  const name = '检查版本号一致性'
  const rv = flow.context?.releaseVersion
  if (!rv) return { sub: { name, ok: false, error: '未记录发布版本(打 ota 未完成?)' } }
  const m = MERGE[flow.project]; const cwd = repoPath('TripeaksClient')
  if (!cwd) return { sub: { name, ok: false, error: '未配置 TripeaksClient 路径' } }
  try {
    const out = await git(cwd, ['log', m.from, '-E', '--grep', OTA_GREP, '-1', '--pretty=%s']).catch(() => '')
    const mm = String(out).match(OTA_RE); const cur = mm ? mm[1] : null
    if (cur == null) return { sub: { name, ok: false, error: 'beta 上未找到 production ota 提交' } }
    if (String(cur) !== String(rv)) return { sub: { name, ok: false, error: `不一致:beta production=${cur},发布版本=${rv}` } }
    return { sub: { name, ok: true, result: `一致:${cur}` } }
  } catch (e) { return { sub: { name, ok: false, error: shortErr(e), detail: String(e.stderr || e.message || e).slice(0, 2000) } } }
}
// beta合并到prod:对齐 prod → merge origin/beta → 打 tag(用发布版本)→ push 分支和 tag
async function runMergeSub(project, releaseVersion) {
  const name = 'beta合并到prod'
  const m = MERGE[project]; const cwd = repoPath('TripeaksClient')
  if (!cwd) return { sub: { name, ok: false, error: '未配置 TripeaksClient 路径' } }
  if (!releaseVersion) return { sub: { name, ok: false, error: '未记录发布版本' } }
  try {
    await git(cwd, ['fetch', 'origin', m.from])
    await alignBranch(cwd, m.to)
    const tag = `${project.toLowerCase()}/${releaseVersion}`
    const merged = await isAncestor(cwd, `origin/${m.from}`, m.to)
    const tagExists = !!(await git(cwd, ['tag', '-l', tag]).catch(() => ''))
    if (!merged) await git(cwd, ['merge', '--no-edit', `origin/${m.from}`])
    if (!tagExists) await git(cwd, ['tag', tag])
    if (!merged) await git(cwd, ['push', 'origin', m.to])
    if (!tagExists) await git(cwd, ['push', 'origin', tag])
    const head = await git(cwd, ['rev-parse', '--short', m.to])
    return { sub: { name, ok: true, result: `${merged ? `prod 已含 ${m.from}` : `已合并 ${m.from} 到 ${m.to}`} (${head}),tag ${tag}(已 push)` } }
  } catch (e) { return { sub: { name, ok: false, error: shortErr(e), detail: String(e.stderr || e.message || e).slice(0, 2000) } } }
}
// 发版记录:precheck 查表是否已有该版本行,否则真实写入(含 Resources commit)
async function runRecordSub(project, operator, flow) {
  const name = '填写发版记录'
  const rv = flow.context?.releaseVersion
  if (!rv) return { sub: { name, ok: false, error: '未记录发布版本,请先完成打 ota' } }
  try {
    const version = `${project.toLowerCase()}/${rv}`
    const date = todayDot()
    const rp = repoPath('TripeaksResources')
    let resourceCommit = rp ? await git(rp, ['rev-parse', 'HEAD']).catch(() => '') : ''
    if (!resourceCommit) resourceCommit = flow.context?.resourceCommit || ''
    const found = await findRecord({ project, version, date })
    if (found.exists) return { sub: { name, ok: true, skipped: true, result: `表中已存在(第 ${found.rowNumber} 行):${version}` } }
    const row = {
      date, platform: flow.context?.needPackage ? 'ota/ios/android' : 'ota', version,
      content: (flow.context?.stories || []).map((n, i) => `${i + 1}. ${n}`).join('\n'),
      commit: resourceCommit || '',
    }
    const r = await fillRecord({ project, row, releaser: operator, dryRun: false })
    return { sub: { name, ok: true, result: `已写入「${r.sheet}」:${version}(ResourcesCommit ${resourceCommit || '—'})` } }
  } catch (e) { return { sub: { name, ok: false, error: shortErr(e), detail: String(e.stderr || e.message || e).slice(0, 2000) } } }
}
function todayDot() { const d = new Date(); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}` }
// ============ 数数报错(真实查询 jserror_new,按 msg 分组,区分全版本/最新版本) ============
const SHUSHU_EVENT_TABLE = { TP1: 'ta.v_event_6', TP4: 'ta.v_event_2' }
const SHUSHU_VER_FIELD = { TP1: 'c_gameversion', TP4: 'gameversion' }
function pad2(n) { return String(n).padStart(2, '0') }
function ymd(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
// 只查本次发布版本:版本字段 LIKE 过滤(app_start 与 jserror_new 共用同一 where)
async function queryShushu(project, version) {
  const table = SHUSHU_EVENT_TABLE[project]
  const field = SHUSHU_VER_FIELD[project]
  if (!table || !field) throw new Error(`未配置数数事件表: ${project}`)
  const v = version != null && version !== '' ? String(version) : null
  if (!v) throw new Error('未记录发布版本,无法查询')
  const now = Date.now()
  const from = ymd(new Date(now - 2 * 86400000)), to = ymd(new Date(now + 86400000))
  const where = `WHERE "$part_date" BETWEEN '${from}' AND '${to}' AND "${field}" LIKE '%${v}%'`
  const startRows = await querySql(`SELECT count(distinct "#account_id") cnt FROM ${table} ${where} AND "#event_name" = 'app_start'`)
  const appStartUsers = Number(startRows[0]?.cnt) || 0
  const rows = await querySql(`SELECT "msg" msg, count(*) cnt FROM ${table} ${where} AND "#event_name" = 'jserror_new' GROUP BY "msg" ORDER BY cnt DESC`)
  const groups = rows.map(r => ({ msg: r.msg || '(空)', count: Number(r.cnt) || 0 })).sort((a, b) => b.count - a.count)
  return { days: 2, queriedAt: nowIso(), version: v, appStartUsers, total: groups.reduce((s, x) => s + x.count, 0), groups }
}
// 数数结果发到客户端群(近2天 jserror_new,按 msg)
function notifyShushu(project, result) {
  return sendBotCard(groupUrl('客户端群'), shushuCard(project, result)).catch(() => {})
}
// 原子能力:查询数数报错 + 可选发群;注册给通用调度器,供"倒计时到点自动执行"复用。
async function queryJserrorReport({ project, version, notify = true }) {
  const r = await queryShushu(project, version)
  if (notify) await notifyShushu(project, r)
  return r
}
register('release', 'query_jserror_report', queryJserrorReport)

// 通知完毕:发"客户端发版完毕"到项目研发群
async function runNotifySub(flow) {
  const name = '通知发版完毕'
  const version = flow.context?.releaseVersion ? `${flow.project.toLowerCase()}/${flow.context.releaseVersion}` : ''
  const text = `${flow.project} 客户端发版完毕${version ? `\n版本号 ${version}` : ''}`
  try {
    await sendBotCard(devGroupUrl(flow.project), doneCard(flow.project, version))
    return { sub: { name, ok: true, result: text } }
  } catch (e) { return { sub: { name, ok: false, error: shortErr(e), detail: String(e.stderr || e.message || e).slice(0, 2000) } } }
}
async function runPostSub(flow, sub, operator) {
  if (sub === 'updateclient') return runUpdateClientSub(flow.project)
  if (sub === 'checkversion') return runCheckVersionSub(flow)
  if (sub === 'merge') return runMergeSub(flow.project, flow.context?.releaseVersion)
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
  const pushJenkins = (secrets['推送线上jenkins'] || {})[String(req.query.project || '').toLowerCase()]
  const jk = secrets.jenkins || {}
  const pkgJob = (jk.pkgProdJob || {})[req.query.project]
  const pkgProdJenkins = pkgJob && jk.baseUrl ? `${jk.baseUrl}/job/${pkgJob}/` : undefined
  res.json({ project: req.query.project, repos, merge: projMerge(req.query.project), pushJenkins, pkgProdJenkins, configured: repos.every(r => r.path) })
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
  const { sub: out, ctx } = await runPrepareSub(flow, sub, operator)
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
// 数数报错:立即查询(+可选发群)。延时查询由前端排到通用调度器 /api/schedule。
router.post('/jserror-report', wrap(async (req, res) => {
  const { project, version, notify = true } = req.body || {}
  if (!project) throw new Error('缺少 project')
  res.json(await queryJserrorReport({ project, version, notify }))
}))

export default router
