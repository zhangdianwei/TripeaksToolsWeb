import { Router } from 'express'
import { google } from 'googleapis'
import secrets from '../config.js'

const SPREADSHEET_ID = '13xMhH852aM5ww_RzU2s_gdZanGfa0_UJL9DxnNicK-8'
const GID = { TP1: 503904834, TP4: 513464294 }

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

async function sheetTitleByGid(sheets, gid) {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID })
  const s = (meta.data.sheets || []).find(x => x.properties.sheetId === gid)
  if (!s) throw new Error(`未找到 gid=${gid} 对应的工作表`)
  return s.properties.title
}

const router = Router()

router.post('/fill', async (req, res) => {
  if (!isConfigured()) {
    return res.status(500).json({ error: 'Google Sheets 凭证未配置(private_key.json 的 gsheet 段)' })
  }
  try {
    const { project, row, releaser } = req.body || {}
    const gid = GID[project]
    if (gid == null) return res.status(400).json({ error: `未知项目: ${project}` })
    if (!row) return res.status(400).json({ error: '缺少 row 数据' })

    const sheets = getSheets()
    const title = await sheetTitleByGid(sheets, gid)
    const values = [[row.date, row.platform, row.version, releaser, row.content, row.commit]]

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `'${title}'`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values },
    })
    res.json({ ok: true, sheet: title })
  } catch (err) {
    console.error('[gsheet]', err.stack || err)
    res.status(500).json({ error: err.message || String(err) })
  }
})

export default router
