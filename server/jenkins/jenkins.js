import secrets from '../config.js'

const cfg = () => secrets.jenkins || {}
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function getJson(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status} @ ${url}`)
  return r.json()
}
// crumb 与会话绑定,必须带回取 crumb 时的 cookie
async function getCrumb(base) {
  try {
    const r = await fetch(`${base}/crumbIssuer/api/json`)
    if (!r.ok) return null
    const j = await r.json()
    const raw = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [r.headers.get('set-cookie')].filter(Boolean)
    const cookie = raw.map(c => c.split(';')[0]).join('; ')
    if (j && j.crumb) return { field: j.crumbRequestField || 'Jenkins-Crumb', value: j.crumb, cookie }
  } catch {}
  return null
}
// Jenkins 返回的内部 URL 常是 http://localhost:8080,统一改回 baseUrl
const fixHost = (url, base) => url.replace(/^https?:\/\/[^/]+/, base)

// 触发参数化构建,只确认已成功触发(不等构建结束),返回 { ok, build, buildUrl, job }
export async function triggerOta(project, params) {
  const base = cfg().baseUrl
  const job = (cfg().otaJob || {})[project]
  if (!base) throw new Error('未配置 jenkins.baseUrl')
  if (!job) throw new Error(`未配置 jenkins.otaJob[${project}]`)

  const crumb = await getCrumb(base)
  const headers = {}
  if (crumb) { headers[crumb.field] = crumb.value; if (crumb.cookie) headers.Cookie = crumb.cookie }
  const qs = new URLSearchParams(params).toString()
  const r = await fetch(`${base}/job/${job}/buildWithParameters?${qs}`, { method: 'POST', headers })
  if (r.status !== 201) throw new Error(`触发构建失败 HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const queueUrl = r.headers.get('location')

  // 等到这次构建真正开始(队列分配到 build 号,即"已经开始打了");最多约 5 分钟
  let build = null, buildUrl = null
  for (let i = 0; queueUrl && i < 150 && !build; i++) {
    await sleep(2000)
    const q = await getJson(`${fixHost(queueUrl, base)}api/json`).catch(() => null)
    if (q && q.cancelled) throw new Error('构建在队列中被取消')
    if (q && q.executable && q.executable.url) { buildUrl = fixHost(q.executable.url, base); build = q.executable.number }
  }
  return { ok: true, build, buildUrl, job }
}

// 获取最新构建号(GET /job/<job>/lastBuild/buildNumber)
export async function getLastBuildNumber(project) {
  const base = cfg().baseUrl
  const job = (cfg().otaJob || {})[project]
  if (!base || !job) return null
  const r = await fetch(`${base}/job/${job}/lastBuild/buildNumber`)
  if (!r.ok) return null
  const t = (await r.text()).trim()
  return /^\d+$/.test(t) ? t : null
}
