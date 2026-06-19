import { Router } from 'express'
import https from 'https'
import secrets from '../config.js'

const MCP_HOST = 'project.feishu.cn'
const MCP_PATH = '/mcp_server/v1'
const PROJECT_KEY = '658a7b2fd64ac0c13e4b6cf8'
const VERSION_TYPE = 'version'
const STORY_TYPE = 'story'
const STORY_PLANNING_VERSION_FIELD = 'field_60a893'

const config = secrets.feishu || {}

function isConfigured() {
  return !!config.mcp_token
}

function postMcp(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body)
    const req = https.request({
      hostname: MCP_HOST,
      path: MCP_PATH,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'X-Mcp-Token': config.mcp_token,
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let buf = ''
      res.on('data', c => buf += c)
      res.on('end', () => {
        try {
          resolve(JSON.parse(buf))
        } catch {
          const m = buf.match(/data:\s*(\{.*\})/s)
          if (m) { try { return resolve(JSON.parse(m[1])) } catch {} }
          reject(new Error(`MCP 返回非 JSON (${res.statusCode}): ${buf.slice(0, 200)}`))
        }
      })
    })
    req.on('error', reject)
    req.write(data)
    req.end()
  })
}

async function mql(expr) {
  const res = await postMcp({
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name: 'search_by_mql', arguments: { project_key: PROJECT_KEY, mql: expr } },
  })
  if (res.error) throw new Error(`MCP 错误: ${res.error.message || JSON.stringify(res.error).slice(0, 200)}`)
  const txt = res?.result?.content?.[0]?.text
  if (!txt) throw new Error(`MCP 返回为空: ${JSON.stringify(res).slice(0, 200)}`)
  const parsed = JSON.parse(txt)
  const rows = []
  const data = parsed.data || {}
  for (const k of Object.keys(data)) for (const it of data[k]) rows.push(mqlRow(it))
  return rows
}

// ============ MQL 字段值解析 ============
function mqlValue(field) {
  const v = field.value
  if (!v) return ''
  switch (field.value_type) {
    case 'string_value': return v.string_value || ''
    case 'long_value': return v.long_value
    case 'double_value': return v.double_value
    case 'key_label_value': return v.key_label_value?.label || ''
    case 'key_label_value_list': return (v.key_label_value_list || []).map(x => x.label).join(', ')
    case 'user_value_list': return (v.user_value_list || []).map(x => x.name_cn || x.name_en || x.user_key).join(', ')
    default: return ''
  }
}

function mqlRow(item) {
  const m = {}
  for (const f of item.moql_field_list || []) m[f.key] = mqlValue(f)
  return m
}

// ============ 时间:取 date 所在自然周(周一~周日) ============
function pad2(n) { return String(n).padStart(2, '0') }
function fmtDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }

function weekRange(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay()
  const mondayOffset = dow === 0 ? -6 : 1 - dow
  const monday = new Date(d)
  monday.setDate(d.getDate() + mondayOffset)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { monday, sunday }
}

function projectFromName(name) {
  const m = /^\((TP\d)\)/.exec(name || '')
  return m ? m[1] : null
}

export async function getRelease(dateStr) {
  if (!isConfigured()) throw new Error('feishu 未配置(private_key.json feishu.mcp_token)')
  const base = dateStr ? new Date(dateStr) : new Date()
  if (isNaN(base.getTime())) throw new Error('date 格式错误')
  const { monday, sunday } = weekRange(base)

  const versions = await mql(
    `SELECT \`work_item_id\`, \`name\`, \`work_item_status\`, \`schedule_publish_date\` ` +
    `FROM \`${PROJECT_KEY}\`.\`${VERSION_TYPE}\` ` +
    `WHERE \`schedule_publish_date\` between '${fmtDate(monday)}' and '${fmtDate(sunday)}'`,
  )

  const groups = []
  for (const v of versions) {
    const project = projectFromName(v.name)
    if (project !== 'TP1' && project !== 'TP4') continue

    const stories = await mql(
      `SELECT \`name\`, \`field_e26910\` ` +
      `FROM \`${PROJECT_KEY}\`.\`${STORY_TYPE}\` ` +
      `WHERE any_relation_match(\`${STORY_PLANNING_VERSION_FIELD}\`, x -> x.\`work_item_id\` = ${v.work_item_id})`,
    )

    groups.push({
      project,
      versionName: v.name,
      needPackage: stories.some(s => String(s.field_e26910).includes('需要发包')),
      stories: stories.map(s => s.name),
    })
  }
  groups.sort((a, b) => a.project.localeCompare(b.project))
  return { weekStart: fmtDate(monday), weekEnd: fmtDate(sunday), groups }
}

const router = Router()

router.get('/release', async (req, res) => {
  try {
    res.json(await getRelease(req.query.date))
  } catch (err) {
    console.error('[feishu]', err.stack)
    res.status(500).json({ error: err.message || String(err) })
  }
})

export default router
