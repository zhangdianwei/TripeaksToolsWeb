import { Router } from 'express'
import { google } from 'googleapis'
import secrets from '../config.js'

const SPREADSHEET_ID = '1Pymj_iLeIWo4nvpdefsBLzC8y1iA-FUEPK9oT0rEqjs'

function isConfigured() {
  return !!(secrets.gsheet && secrets.gsheet.private_key)
}

let sheetsClient = null
function getSheets() {
  if (sheetsClient) return sheetsClient
  const auth = new google.auth.GoogleAuth({
    credentials: secrets.gsheet,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  sheetsClient = google.sheets({ version: 'v4', auth })
  return sheetsClient
}

function sheetName(project, year) {
  return `${year}发版记录-${project.toLowerCase()}`
}

async function assertSheetExists(sheets, title) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const exists = (meta.data.sheets || []).some(x => x.properties.title === title)
  if (!exists) throw new Error(`未找到工作表「${title}」,请确认表格中已存在该 sheet`)
}

export async function fillRecord({ project, row, releaser, dryRun }) {
  if (!isConfigured()) throw new Error('Google Sheets 凭证未配置(private_key.json 的 gsheet 段)')
  if (!row) throw new Error('缺少 row 数据')
  const year = String(row.date || '').split('.')[0]
  if (!/^\d{4}$/.test(year)) throw new Error(`无法从日期解析年份: ${row.date}`)
  const title = sheetName(project, year)
  if (dryRun) return { ok: true, sheet: title, dryRun: true }

  const sheets = getSheets()
  await assertSheetExists(sheets, title)
  const values = [[row.date, row.platform, row.version, releaser, row.content, row.commit]]
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `'${title}'`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  })
  return { ok: true, sheet: title }
}

export async function findRecord({ project, version, date }) {
  if (!isConfigured()) throw new Error('Google Sheets 凭证未配置(private_key.json 的 gsheet 段)')
  const year = String(date || '').split('.')[0]
  if (!/^\d{4}$/.test(year)) throw new Error(`无法从日期解析年份: ${date}`)
  const title = sheetName(project, year)
  const sheets = getSheets()
  await assertSheetExists(sheets, title)
  const resp = await sheets.spreadsheets.values.get({ spreadsheetId: SPREADSHEET_ID, range: `'${title}'!A:F` })
  const rows = resp.data.values || []
  const key = String(version || '').trim()
  const idx = key ? rows.findIndex(r => String(r[2] || '').trim() === key) : -1
  return { sheet: title, exists: idx >= 0, rowNumber: idx >= 0 ? idx + 1 : 0 }
}

const router = Router()

router.post('/fill', async (req, res) => {
  try {
    const { project, row, releaser } = req.body || {}
    res.json(await fillRecord({ project, row, releaser }))
  } catch (err) {
    console.error('[gsheet]', err.stack || err)
    res.status(500).json({ error: err.message || String(err) })
  }
})

export default router
