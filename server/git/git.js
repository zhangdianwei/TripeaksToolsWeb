import { Router } from 'express'
import { execFile } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { promisify } from 'util'

const exec = promisify(execFile)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const REPO = 'git@github.com:LuckyZen/TripeaksClient.git'
const RES_REPO = 'git@github.com:LuckyZen/TripeaksResources.git'
const CACHE = path.join(__dirname, '.cache', 'TripeaksClient.git')
const PROJECTS = [
  { project: 'TP1', branch: 'tripeaks/beta' },
  { project: 'TP4', branch: 'tripeaks4p/beta' },
]
const GREP = 'Update[ _]ota[ _]files[ _]to[ _]version[ _][0-9]+[ _]for[ _]production'
const PATTERN = /Update[ _]ota[ _]files[ _]to[ _]version[ _](\d+)[ _]for[ _]production/

function git(args) {
  return exec('git', args, { maxBuffer: 64 * 1024 * 1024 }).then(r => r.stdout)
}

async function ensureMirror() {
  if (fs.existsSync(CACHE)) return
  fs.mkdirSync(path.dirname(CACHE), { recursive: true })
  await git(['clone', '--bare', '--filter=tree:0', REPO, CACHE])
}

async function latestProd({ project, branch }) {
  await git(['-C', CACHE, 'fetch', '--filter=tree:0', 'origin', `+refs/heads/${branch}:refs/heads/${branch}`])
  const out = await git([
    '-C', CACHE, 'log', branch, '-E', '--grep', GREP,
    '--max-count=1', '--pretty=%H|%cd|%s', '--date=short',
  ])
  const line = out.trim().split('\n')[0]
  if (!line) return { project, branch, version: null }
  const [commit, date, subject] = line.split('|')
  const m = subject.match(PATTERN)
  return { project, branch, version: m ? m[1] : null, commit, date }
}

const router = Router()

router.get('/ota', async (req, res) => {
  try {
    await ensureMirror()
    const results = []
    for (const p of PROJECTS) results.push(await latestProd(p))
    res.json({ results })
  } catch (err) {
    console.error('[git]', err.stack)
    res.status(500).json({ error: err.message || String(err) })
  }
})

router.get('/resources', async (req, res) => {
  try {
    const branch = req.query.branch || 'master'
    const out = await git(['ls-remote', RES_REPO, `refs/heads/${branch}`])
    const commit = out.trim().split('\t')[0]
    if (!commit) return res.status(404).json({ error: `未找到分支: ${branch}` })
    res.json({ branch, commit })
  } catch (err) {
    console.error('[git]', err.stack)
    res.status(500).json({ error: err.message || String(err) })
  }
})

export default router
