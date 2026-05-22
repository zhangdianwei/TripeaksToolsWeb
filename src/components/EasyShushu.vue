<script setup>
import { ref, reactive, computed, shallowRef, onMounted } from "vue";
import {
  Button, Input, Select, Option, InputNumber, DatePicker,
  Alert, Form, FormItem, Table, Page, Tooltip, Message,
  Tabs, TabPane,
  Dropdown, DropdownMenu, DropdownItem, Icon,
} from "view-ui-plus";

// ============ 项目配置 ============
const projectConfigs = {
  "Tripeaks1": { eventTableName: "ta.v_event_6", userTableName: "ta.v_user_6" },
  "Tripeaks1-Beta": { eventTableName: "ta.v_event_17", userTableName: "ta.v_user_17" },
  "Tripeaks4": { eventTableName: "ta.v_event_2", userTableName: "ta.v_user_2" },
  "Tripeaks4-Beta": { eventTableName: "ta.v_event_16", userTableName: "ta.v_user_16" },
};
const projectNames = Object.keys(projectConfigs);
const thinkingdataUrl = 'http://10.10.31.17:8992/querysql';

// ============ Token ============
const taToken = ref(null);
async function fetchToken() {
  try {
    const response = await fetch("easy_shushu/config.json");
    const data = await response.json();
    taToken.value = data.token;
  } catch (err) {
    errorMsg.value = `加载 token 失败: ${err.message}`;
  }
}

// ============ HTTP ============
const errorMsg = ref("");
async function fetchServer(sql) {
  const form = new URLSearchParams();
  form.append("token", taToken.value || "");
  form.append("sql", sql);
  form.append("format", "json");
  const response = await fetch(thinkingdataUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  return await response.text();
}

// ============ 工具函数 ============
function deepFreeze(obj) {
  Object.freeze(obj);
  Object.getOwnPropertyNames(obj).forEach(name => {
    const prop = obj[name];
    if (typeof prop === 'object' && prop !== null) deepFreeze(prop);
  });
}

function pad2(n) { return String(n).padStart(2, '0'); }

// DatePicker 显示什么时间就当 UTC 时间用：读取 local 分量当 UTC 分量
function dateToUtcIso(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}Z`;
}
function dateToUtcDate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function addDays(d, days) {
  const ret = new Date(d);
  ret.setDate(ret.getDate() + days);
  return ret;
}
function sqlStr(s) { return `'${String(s).replace(/'/g, "''")}'`; }

// ============ ID 启发式分类 ============
function classifyId(id) {
  if (/^\d{15,}$/.test(id)) return 'user_id';
  if (id.length >= 15 && /^[a-zA-Z0-9-]+$/.test(id)) return 'distinct_id';
  return 'account_id';
}

function parseUserInputText(text) {
  const parts = text.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
  const groups = { account_id: [], distinct_id: [], user_id: [] };
  parts.forEach(p => groups[classifyId(p)].push(p));
  return groups;
}

// ============ 数数返回解析 ============
function parseShushuResponse(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) throw new Error('返回为空');
  const first = JSON.parse(lines[0]);
  if (first.return_code != null && first.return_code !== 0) {
    throw new Error(first.return_message || '查询失败');
  }
  const rawHeaders = first.data.headers;
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const arr = JSON.parse(lines[i]);
    const obj = { ttid: i };
    for (let c = 0; c < rawHeaders.length; c++) {
      obj[rawHeaders[c]] = arr[c];
    }
    rows.push(obj);
  }
  const headers = ['ttid'].concat(rawHeaders);
  return { raw: text, headers, rows };
}

// ============ 列配置（事件） ============
const shouldRemoveColNames = ['country', 'new', 'fps', 'uuid', 'app_version'];
const fixedColNames = ['ttid', 'event_time_utc', '#event_name', 'activity_type', 'activity_step', 'add_source', 'sub_add_source', 'msg'];

const defColConfigs = {
  'ttid': { key: 'ttid', title: 'ttid', width: 80, resizable: true, fixed: 'left' },
  'event_time_utc': { key: 'event_time_utc', title: 'event_time_utc', width: 250, resizable: true, fixed: 'left' },
  '#event_time': { key: '#event_time', title: '#event_time', width: 250, resizable: true },
  'clienttime': { key: 'clienttime', title: 'clienttime', width: 250, resizable: true },
  '#event_name': { key: '#event_name', title: '#event_name', width: 200, resizable: true, fixed: 'left' },
  'params': { key: 'params', title: 'params', width: 250, resizable: true },
};

function makeDefaultColConfig(headerName) {
  return {
    key: headerName,
    title: headerName,
    width: 200,
    resizable: true,
  };
}

function getColConfigFromHeader(headerName) {
  return defColConfigs[headerName] || makeDefaultColConfig(headerName);
}

function computeColMeta(parsed) {
  const allColConfigs = {};
  const sameValueColConfigs = {};
  const goodColConfigs = {};
  for (let c = 0; c < parsed.headers.length; c++) {
    const name = parsed.headers[c];
    if (shouldRemoveColNames.includes(name)) continue;
    const cfg = getColConfigFromHeader(name);
    let anyValue = null;
    let hasSameValue = true;
    let hasAny = false;
    for (const row of parsed.rows) {
      const v = row[name];
      if (v != null && v !== '') {
        hasAny = true;
        if (anyValue == null) { anyValue = v; }
        else if (v !== anyValue) { hasSameValue = false; }
      }
    }
    if (hasAny) {
      allColConfigs[name] = cfg;
      if (hasSameValue) {
        sameValueColConfigs[name] = { ...cfg, value: anyValue };
      } else {
        goodColConfigs[name] = cfg;
      }
    }
  }
  return { allColConfigs, sameValueColConfigs, goodColConfigs };
}

// ==========================================================
// 1. 用户信息输入
// ==========================================================
const userInputVar = reactive({
  userInput: '',
  projectName: 'Tripeaks1',
  isUserSearching: false,
});

const parsedUserInput = computed(() => parseUserInputText(userInputVar.userInput));

const userQuerySql = computed(() => {
  const project = projectConfigs[userInputVar.projectName];
  if (!project) return '';
  const groups = parsedUserInput.value;
  const conds = [];
  if (groups.account_id.length) {
    conds.push(`"#account_id" IN (${groups.account_id.map(sqlStr).join(',')})`);
  }
  if (groups.distinct_id.length) {
    conds.push(`"#distinct_id" IN (${groups.distinct_id.map(sqlStr).join(',')})`);
  }
  if (groups.user_id.length) {
    conds.push(`"#user_id" IN (${groups.user_id.join(',')})`);
  }
  if (!conds.length) return '-- 请输入至少一个 id';
  const userTable = project.userTableName;
  return `WITH base AS (
  SELECT "#account_id", "accountid", "userid", "#distinct_id", "distinctid"
  FROM ${userTable}
  WHERE ${conds.join('\n     OR ')}
),
collected_account_ids AS (
  SELECT DISTINCT aid FROM (
    SELECT "#account_id" aid FROM base WHERE "#account_id" IS NOT NULL
    UNION SELECT "accountid" FROM base WHERE "accountid" IS NOT NULL
    UNION SELECT "userid" FROM base WHERE "userid" IS NOT NULL
  )
),
collected_distinct_ids AS (
  SELECT DISTINCT did FROM (
    SELECT "#distinct_id" did FROM base WHERE "#distinct_id" IS NOT NULL
    UNION SELECT "distinctid" FROM base WHERE "distinctid" IS NOT NULL
  )
)
SELECT DISTINCT u.*
FROM ${userTable} u
WHERE EXISTS (SELECT 1 FROM collected_account_ids WHERE aid = u."#account_id")
   OR EXISTS (SELECT 1 FROM collected_account_ids WHERE aid = u."accountid")
   OR EXISTS (SELECT 1 FROM collected_account_ids WHERE aid = u."userid")
   OR EXISTS (SELECT 1 FROM collected_distinct_ids WHERE did = u."#distinct_id")
   OR EXISTS (SELECT 1 FROM collected_distinct_ids WHERE did = u."distinctid")
LIMIT 100`;
});

// ==========================================================
// 2. 用户信息展示
// ==========================================================
const userQueryResult = shallowRef({ raw: '', headers: [], rows: [] });
const userColMeta = shallowRef({ allColConfigs: {}, sameValueColConfigs: {}, goodColConfigs: {} });
const userOutputVar = reactive({
  users: [],
  allAccountIds: [],
  allDistinctIds: [],
  allUserIds: [],
});

const userDefaultShownCols = ['ttid', '#account_id', '#distinct_id', '#user_id', 'user_level', 'user_name'];
const userShownColsText = ref(userDefaultShownCols.join(','));

const userAllColNames = computed(() => Object.keys(userColMeta.value.allColConfigs));
const userStatsColumns = [
  { title: 'name', key: 'label', width: 260 },
  { title: 'value', key: 'values', tooltip: true, ellipsis: true },
];
const userStatsRows = computed(() => [{
  label: '#user_id/#account_id/#distinct_id',
  values: [...userOutputVar.allUserIds, ...userOutputVar.allAccountIds, ...userOutputVar.allDistinctIds].join(', '),
}]);
const userShownCols = computed({
  get: () => userShownColsText.value.split(',').map(s => s.trim()).filter(Boolean),
  set: (val) => { userShownColsText.value = val.join(','); },
});
const userShownColConfigs = computed(() => {
  return userShownCols.value.map(n => {
    const base = userColMeta.value.allColConfigs[n] || { key: n, title: n, resizable: true };
    if (n === 'ttid') return { ...base, width: 60, minWidth: 50, ellipsis: true, tooltip: true };
    return { ...base, width: 180, minWidth: 100, ellipsis: true, tooltip: true };
  }).filter(Boolean);
});

const idCandidateFields = ['#user_id', '#account_id', '#distinct_id', 'accountid', 'distinctid', 'userid', 'user_id', 'c_userid', 'c_clientid'];

function extractUsersFromResult(parsed) {
  const accSet = new Set();
  const distSet = new Set();
  const userSet = new Set();
  for (const row of parsed.rows) {
    for (const f of idCandidateFields) {
      const v = row[f];
      if (v == null || v === '' || v === 'null' || v === 'undefined') continue;
      const s = String(v);
      const kind = classifyId(s);
      if (kind === 'user_id') userSet.add(s);
      else if (kind === 'distinct_id') distSet.add(s);
      else accSet.add(s);
    }
  }
  return {
    users: parsed.rows,
    allAccountIds: [...accSet],
    allDistinctIds: [...distSet],
    allUserIds: [...userSet],
  };
}

async function onClickSearchUser() {
  if (userInputVar.isUserSearching) return;
  errorMsg.value = '';
  userInputVar.isUserSearching = true;
  try {
    const sql = userQuerySql.value;
    if (!sql || sql.startsWith('--')) {
      errorMsg.value = '请输入至少一个 id';
      return;
    }
    const text = await fetchServer(sql);
    if (!text) { errorMsg.value = '无返回'; return; }
    if (text.includes('查询似乎出现了一些问题')) { errorMsg.value = text; return; }
    const parsed = parseShushuResponse(text);
    deepFreeze(parsed.rows);
    userQueryResult.value = parsed;
    userColMeta.value = computeColMeta(parsed);
    Object.assign(userOutputVar, extractUsersFromResult(parsed));
  } catch (err) {
    errorMsg.value = String(err.message || err);
  } finally {
    userInputVar.isUserSearching = false;
  }
}

// ==========================================================
// 3. 事件输入
// ==========================================================
function getDefaultEventStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

const eventInputVar = reactive({
  projectName: 'Tripeaks1',
  userInput: '',
  startTime: getDefaultEventStart(),
  endTime: new Date(),
  maxLimit: 5000,
  isEventSearching: false,
});

const parsedEventInput = computed(() => parseUserInputText(eventInputVar.userInput));

const eventQuerySql = computed(() => {
  const project = projectConfigs[eventInputVar.projectName];
  if (!project) return '';
  const groups = parsedEventInput.value;
  const conds = [];
  if (groups.account_id.length) conds.push(`"#account_id" IN (${groups.account_id.map(sqlStr).join(',')})`);
  if (groups.distinct_id.length) conds.push(`"#distinct_id" IN (${groups.distinct_id.map(sqlStr).join(',')})`);
  if (groups.user_id.length) conds.push(`"#user_id" IN (${groups.user_id.join(',')})`);
  if (!conds.length) return '-- 请输入至少一个 id';
  const start = eventInputVar.startTime;
  const end = eventInputVar.endTime;
  if (!start || !end) return '-- 请选择起止时间';
  const partStart = dateToUtcDate(addDays(start, -1));
  const partEnd = dateToUtcDate(addDays(end, 1));
  const startIso = dateToUtcIso(start);
  const endIso = dateToUtcIso(end);
  return `SELECT * FROM (
  SELECT
    concat(replace(CAST(date_add('hour', -(CAST(COALESCE("#zone_offset", 0) AS bigint)), "#event_time") AS VARCHAR), ' ', 'T'), 'Z') event_time_utc,
    *
  FROM ${project.eventTableName}
  WHERE "$part_date" BETWEEN '${partStart}' AND '${partEnd}'
    AND (${conds.join(' OR ')})
)
WHERE event_time_utc >= '${startIso}'
  AND event_time_utc <= '${endIso}'
ORDER BY event_time_utc
LIMIT ${eventInputVar.maxLimit}`;
});

// ==========================================================
// 4. 事件查询 + 检测
// ==========================================================
const eventQueryResult = shallowRef({ raw: '', headers: [], rows: [] });
const eventColMeta = shallowRef({ allColConfigs: {}, sameValueColConfigs: {}, goodColConfigs: {} });
const eventCheckLogs = ref(null);

const eventStatsColumns = [
  { title: 'name', key: 'label', width: 260 },
  { title: 'value', slot: 'eventStatsValues' },
];
const eventStatsRows = computed(() => {
  const e = eventCheckLogs.value;
  if (!e) return [];

  const totalText = e.total >= eventInputVar.maxLimit
    ? `${e.total}（考虑适当放大 sql max limit）`
    : String(e.total);

  const allIds = [...e.allUserIds, ...e.allAccountIds, ...e.allDistinctIds];
  const userBaselineRun = userOutputVar.users.length > 0;
  const newIdsSet = new Set();
  if (userBaselineRun) {
    for (const id of e.allUserIds) if (!userOutputVar.allUserIds.includes(id)) newIdsSet.add(id);
    for (const id of e.allAccountIds) if (!userOutputVar.allAccountIds.includes(id)) newIdsSet.add(id);
    for (const id of e.allDistinctIds) if (!userOutputVar.allDistinctIds.includes(id)) newIdsSet.add(id);
  }

  const errorText = `errlog(${e.errlog}), jserror_new(${e.jsError})`;

  return [
    { kind: 'text', label: '日志总数', values: totalText },
    { kind: 'ids', label: '#user_id/#account_id/#distinct_id', allIds, newIdsSet },
    { kind: 'text', label: '是否有错误', values: errorText },
    { kind: 'text', label: 'city', values: e.cities.join(', ') },
  ];
});

function runEventChecks(parsed) {
  const seenCity = new Set();
  const accSet = new Set();
  const distSet = new Set();
  const userSet = new Set();
  let errlog = 0;
  let jsError = 0;

  for (const row of parsed.rows) {
    if (row['#city']) seenCity.add(row['#city']);
    if (row['#event_name'] === 'errlog') errlog++;
    if (row['#event_name'] === 'jserror_new') jsError++;
    for (const f of idCandidateFields) {
      const v = row[f];
      if (v == null || v === '' || v === 'null' || v === 'undefined') continue;
      const s = String(v);
      const kind = classifyId(s);
      if (kind === 'user_id') userSet.add(s);
      else if (kind === 'distinct_id') distSet.add(s);
      else accSet.add(s);
    }
  }

  return {
    total: parsed.rows.length,
    cities: [...seenCity],
    errlog,
    jsError,
    crossCity: seenCity.size > 1,
    allAccountIds: [...accSet],
    allDistinctIds: [...distSet],
    allUserIds: [...userSet],
  };
}

async function onClickSearchEvent() {
  if (eventInputVar.isEventSearching) return;
  errorMsg.value = '';
  eventInputVar.isEventSearching = true;
  try {
    const sql = eventQuerySql.value;
    if (!sql || sql.startsWith('--')) {
      errorMsg.value = '请输入 id 并选择起止时间';
      return;
    }
    const text = await fetchServer(sql);
    if (!text) { errorMsg.value = '无返回'; return; }
    if (text.includes('查询似乎出现了一些问题')) { errorMsg.value = text; return; }
    const parsed = parseShushuResponse(text);
    deepFreeze(parsed.rows);
    eventQueryResult.value = parsed;
    eventColMeta.value = computeColMeta(parsed);
    eventCheckLogs.value = runEventChecks(parsed);
    eventFilterResult.value = { filtered: parsed.rows };
    eventFilterVar.curPage = 1;
    if (!eventFilterVar.wantShowColNamesText) {
      eventFilterVar.wantShowColNamesText = fixedColNames.join(',');
    }
  } catch (err) {
    errorMsg.value = String(err.message || err);
  } finally {
    eventInputVar.isEventSearching = false;
  }
}

// ==========================================================
// 5. 事件过滤
// ==========================================================
const eventFilterVar = reactive({
  wantShowColNamesText: '',
  conditionText: '',
  sortColName: 'event_time_utc',
  sortCategory: '升序',
  curPage: 1,
  pageSize: 100,
});

const eventFilterResult = shallowRef({ filtered: [] });

const allColNames = computed(() => Object.keys(eventColMeta.value.allColConfigs));
const sameValueColNames = computed(() => Object.keys(eventColMeta.value.sameValueColConfigs));
const goodColNames = computed(() => Object.keys(eventColMeta.value.goodColConfigs));

const eventShownCols = computed({
  get: () => eventFilterVar.wantShowColNamesText.split(',').map(s => s.trim()).filter(Boolean),
  set: (val) => { eventFilterVar.wantShowColNamesText = val.join(','); },
});
const wantShowColConfigs = computed(() => {
  return eventShownCols.value.map(n => eventColMeta.value.allColConfigs[n] || defColConfigs[n]).filter(Boolean);
});

function onClickApplyFilter() {
  const condition = eventFilterVar.conditionText.trim();
  errorMsg.value = '';
  if (!condition) {
    eventFilterResult.value = { filtered: eventQueryResult.value.rows };
  } else {
    const rows = eventQueryResult.value.rows;
    const filtered = [];
    try {
      const fn = new Function('x', `return !!(${condition})`);
      for (let i = 0; i < rows.length; i++) {
        if (fn(rows[i])) filtered.push(rows[i]);
      }
    } catch (err) {
      errorMsg.value = `过滤表达式错误: ${err.message}`;
      return;
    }
    eventFilterResult.value = { filtered };
  }
  eventFilterVar.curPage = 1;
}

const eventDisplayedRows = computed(() => {
  const filtered = eventFilterResult.value.filtered;
  if (!filtered.length) return [];
  const key = eventFilterVar.sortColName;
  const asc = eventFilterVar.sortCategory === '升序';
  const rows = filtered.slice();
  rows.sort((a, b) => {
    const va = a[key] == null ? '' : a[key];
    const vb = b[key] == null ? '' : b[key];
    if (va < vb) return asc ? -1 : 1;
    if (va > vb) return asc ? 1 : -1;
    return 0;
  });
  const start = (eventFilterVar.curPage - 1) * eventFilterVar.pageSize;
  return rows.slice(start, start + eventFilterVar.pageSize);
});

// 快捷查询
const quickSearches = [
  {
    name: '查jserror_new', callback: () => {
      eventFilterVar.conditionText = `x["#event_name"]=="jserror_new"`;
      onClickApplyFilter();
    },
  },
  {
    name: '查errlog', callback: () => {
      eventFilterVar.conditionText = `x["#event_name"]=="errlog"`;
      onClickApplyFilter();
    },
  },
  {
    name: '查add_items', callback: () => {
      eventFilterVar.conditionText = `x["#event_name"]=="add_items"`;
      onClickApplyFilter();
    },
  },
  {
    name: '查支付购买', callback: () => {
      eventFilterVar.wantShowColNamesText = fixedColNames.concat(['productid', 'orderid', 'add_source', 'sub_add_source']).join(',');
      eventFilterVar.conditionText = `["add_items","purchased","payment","ipa_begin","iap_end","iap_restore_begin","iap_verify_begin","subscrib","iap_consume","restore","restore_finish"].indexOf(x["#event_name"])>=0`;
      onClickApplyFilter();
    },
  },
  {
    name: '查活动日志', callback: () => {
      eventFilterVar.conditionText = `x['#event_name']=='activity_log'`;
      onClickApplyFilter();
    },
  },
];

function onClickQuickSearch(name) {
  const item = quickSearches.find(x => x.name === name);
  if (item) item.callback();
}

function onPageChange(value) { eventFilterVar.curPage = value; }
function onPageSizeChange(value) { eventFilterVar.pageSize = value; }

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    Message.success('已复制');
  } catch (err) {
    Message.error(`复制失败: ${err.message}`);
  }
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvEscape(v) {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
function rowsToCsv(rows, headers) {
  const cols = headers.filter(h => h !== 'ttid');
  const lines = [cols.join(',')];
  for (const r of rows) {
    lines.push(cols.map(c => csvEscape(r[c])).join(','));
  }
  return lines.join('\n');
}

function onDownload(source, kind) {
  const d = new Date();
  const stamp = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_${pad2(d.getHours())}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}`;
  const base = `${source}_${stamp}`;
  const result = source === 'user' ? userQueryResult.value : eventQueryResult.value;
  if (!result || !result.rows.length) {
    Message.warning('没有可下载的数据');
    return;
  }
  if (kind === 'raw') {
    downloadBlob(result.raw, `${base}.txt`, 'text/plain;charset=utf-8');
  } else if (kind === 'csv') {
    downloadBlob(rowsToCsv(result.rows, result.headers), `${base}.csv`, 'text/csv;charset=utf-8');
  }
}

onMounted(() => {
  fetchToken();
});
</script>

<template>
  <Alert v-if="errorMsg" type="error" show-icon closable @on-close="errorMsg = ''">{{ errorMsg }}</Alert>

  <Tabs :animated="false">
    <TabPane label="查用户" name="user">
      <h3>输入</h3>
      <Form inline :label-width="0">
        <FormItem>
          <Select v-model="userInputVar.projectName" style="width: 160px">
            <Option v-for="name in projectNames" :key="name" :value="name">{{ name }}</Option>
          </Select>
        </FormItem>
        <FormItem>
          <Input v-model="userInputVar.userInput" style="width: 600px"
            placeholder="任意account_id/distinct_id/user_id（逗号/空格分隔）例: sk1Y7TGZB, 772dd71ac9623749, 1242505651616231424">
            <template #suffix>
              <Tooltip placement="bottom-end" transfer>
                <Icon type="ios-information-circle-outline" style="cursor: pointer;" />
                <template #content>
                  <div>account_id × {{ parsedUserInput.account_id.length }}：{{ parsedUserInput.account_id.join(', ') || '-' }}</div>
                  <div>distinct_id × {{ parsedUserInput.distinct_id.length }}：{{ parsedUserInput.distinct_id.join(', ') || '-' }}</div>
                  <div>user_id × {{ parsedUserInput.user_id.length }}：{{ parsedUserInput.user_id.join(', ') || '-' }}</div>
                </template>
              </Tooltip>
            </template>
          </Input>
        </FormItem>
        <FormItem>
          <Tooltip placement="bottom" transfer :max-width="700">
            <Button shape="circle" @click="copyToClipboard(userQuerySql)">sql</Button>
            <template #content>
              <pre style="margin:0; white-space:pre-wrap; word-break:break-all;">{{ userQuerySql }}</pre>
            </template>
          </Tooltip>
        </FormItem>
        <FormItem>
          <Button type="primary" :loading="userInputVar.isUserSearching" @click="onClickSearchUser">查询用户</Button>
        </FormItem>
      </Form>

      <template v-if="userOutputVar.users.length">
        <h3 class="section-header">
          <span>查询结果</span>
          <Dropdown @on-click="(k) => onDownload('user', k)" trigger="click">
            <Button size="small">下载结果 <Icon type="ios-arrow-down" /></Button>
            <template #list>
              <DropdownMenu>
                <DropdownItem name="raw">原始格式 (.txt)</DropdownItem>
                <DropdownItem name="csv">csv 格式 (.csv)</DropdownItem>
              </DropdownMenu>
            </template>
          </Dropdown>
        </h3>
        <div class="table-toolbar">
          <span class="table-toolbar-label">显示字段</span>
          <Select v-model="userShownCols" multiple filterable placeholder="选择要显示的字段" style="flex:1;">
            <Option v-for="name in userAllColNames" :key="name" :value="name">{{ name }}</Option>
          </Select>
        </div>
        <Table :border="true" :columns="userShownColConfigs" :data="userOutputVar.users" size="small" />

        <h3>统计信息</h3>
        <Table :border="true" :columns="userStatsColumns" :data="userStatsRows" size="small" />
      </template>
    </TabPane>

    <TabPane label="查事件" name="event">
      <h3>输入</h3>
      <Form inline :label-width="0">
        <FormItem>
          <Select v-model="eventInputVar.projectName" style="width: 160px">
            <Option v-for="name in projectNames" :key="name" :value="name">{{ name }}</Option>
          </Select>
        </FormItem>
        <FormItem>
          <Input v-model="eventInputVar.userInput" style="width: 400px"
            placeholder="任意account_id/distinct_id/user_id（逗号/空格分隔）">
            <template #suffix>
              <Tooltip placement="bottom-end" transfer>
                <Icon type="ios-information-circle-outline" style="cursor: pointer;" />
                <template #content>
                  <div>account_id × {{ parsedEventInput.account_id.length }}：{{ parsedEventInput.account_id.join(', ') || '-' }}</div>
                  <div>distinct_id × {{ parsedEventInput.distinct_id.length }}：{{ parsedEventInput.distinct_id.join(', ') || '-' }}</div>
                  <div>user_id × {{ parsedEventInput.user_id.length }}：{{ parsedEventInput.user_id.join(', ') || '-' }}</div>
                </template>
              </Tooltip>
            </template>
          </Input>
        </FormItem>
        <FormItem>
          <DatePicker v-model="eventInputVar.startTime" type="datetime" format="yyyy-MM-dd HH:mm:ss"
            placeholder="开始(UTC)" style="width: 200px" />
        </FormItem>
        <FormItem>
          <DatePicker v-model="eventInputVar.endTime" type="datetime" format="yyyy-MM-dd HH:mm:ss"
            placeholder="结束(UTC)" style="width: 200px" />
        </FormItem>
        <FormItem>
          <InputNumber v-model="eventInputVar.maxLimit" :min="1" :max="100000" style="width: 120px" />
        </FormItem>
        <FormItem>
          <Tooltip placement="bottom" transfer :max-width="700">
            <Button shape="circle" @click="copyToClipboard(eventQuerySql)">sql</Button>
            <template #content>
              <pre style="margin:0; white-space:pre-wrap; word-break:break-all;">{{ eventQuerySql }}</pre>
            </template>
          </Tooltip>
        </FormItem>
        <FormItem>
          <Button type="primary" :loading="eventInputVar.isEventSearching" @click="onClickSearchEvent">查询事件</Button>
        </FormItem>
      </Form>

      <template v-if="eventCheckLogs">
        <h3>统计信息</h3>
        <Table :border="true" :columns="eventStatsColumns" :data="eventStatsRows" size="small">
          <template #eventStatsValues="{ row }">
            <template v-if="row.kind === 'ids'">
              <template v-if="row.allIds.length">
                <span v-for="(id, i) in row.allIds" :key="id">
                  <span :class="{ 'new-id': row.newIdsSet.has(id) }">{{ id }}</span><span v-if="i < row.allIds.length - 1">, </span>
                </span>
              </template>
              <span v-else style="color:#999">-</span>
            </template>
            <template v-else>{{ row.values }}</template>
          </template>
        </Table>

        <h3 class="section-header">
          <span>查询结果</span>
          <Dropdown @on-click="(k) => onDownload('event', k)" trigger="click">
            <Button size="small">下载结果 <Icon type="ios-arrow-down" /></Button>
            <template #list>
              <DropdownMenu>
                <DropdownItem name="raw">原始格式 (.txt)</DropdownItem>
                <DropdownItem name="csv">csv 格式 (.csv)</DropdownItem>
              </DropdownMenu>
            </template>
          </Dropdown>
        </h3>
        <Form :label-width="80">
          <FormItem label="显示字段">
            <Select v-model="eventShownCols" multiple filterable placeholder="选择要显示的字段">
              <Option v-for="name in allColNames" :key="name" :value="name">{{ name }}</Option>
            </Select>
          </FormItem>
          <FormItem label="过滤条件">
            <div style="display:flex; align-items:center; gap:8px;">
              <Input v-model="eventFilterVar.conditionText" clearable
                placeholder='合法的 js，例如 x["#event_name"]=="add_items" && x.clienttime.startsWith("2024")'
                style="flex:1;" />
              <Dropdown @on-click="onClickQuickSearch" trigger="click">
                <Button>快捷查询 <Icon type="ios-arrow-down" /></Button>
                <template #list>
                  <DropdownMenu>
                    <DropdownItem v-for="item in quickSearches" :key="item.name" :name="item.name">{{ item.name }}
                    </DropdownItem>
                  </DropdownMenu>
                </template>
              </Dropdown>
              <Button type="primary" @click="onClickApplyFilter">应用</Button>
            </div>
          </FormItem>
          <FormItem label="排序">
            <Select v-model="eventFilterVar.sortColName" filterable style="width: 200px;">
              <Option v-for="name in allColNames" :key="name" :value="name">{{ name }}</Option>
            </Select>
            <Select v-model="eventFilterVar.sortCategory" style="width: 90px; margin-left: 4px;">
              <Option value="升序">升序</Option>
              <Option value="降序">降序</Option>
            </Select>
          </FormItem>
          <FormItem label="分页">
            <Page show-sizer show-total :total="eventFilterResult.filtered.length" :current="eventFilterVar.curPage"
              :page-size="eventFilterVar.pageSize" :page-size-opts="[10, 50, 100, 500]" @on-change="onPageChange"
              @on-page-size-change="onPageSizeChange" />
            <span style="margin-left: 8px; color:#999;">符合 {{ eventFilterResult.filtered.length }} / 总数 {{
              eventQueryResult.rows.length }}</span>
          </FormItem>
        </Form>
        <Table :border="true" :columns="wantShowColConfigs" :data="eventDisplayedRows" size="small" />
      </template>
    </TabPane>
  </Tabs>
</template>

<style scoped>
h3 {
  margin: 16px 0 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #e8e8e8;
}
h3.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

:deep(.ivu-form-inline .ivu-form-item) {
  margin-bottom: 0;
}

.table-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid #dcdee2;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  background: #fafafa;
}
.table-toolbar-label {
  color: #515a6e;
  font-size: 13px;
  white-space: nowrap;
}

:deep(.ivu-table) {
  font-size: 14px;
}

.new-id {
  color: #ed4014;
  font-weight: bold;
}
</style>
