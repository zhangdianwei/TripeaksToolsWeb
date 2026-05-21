<script setup>
import { ref, reactive, computed, shallowRef, onMounted } from "vue";
import {
  Button, Input, Select, Option, InputNumber, DatePicker,
  Alert, Form, FormItem, Card, Table, Page, Tag, Tooltip, Message,
  Collapse, Panel, Divider,
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
  if (/^[a-f0-9]{16}$/.test(id)) return 'distinct_id';
  if (/^[A-F0-9]{8}-[A-F0-9-]{27}$/i.test(id)) return 'distinct_id';
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
const fixedColNames = ['ttid', 'event_time_utc', '#event_name'];
const commonTemplate1ColNames = fixedColNames.concat(['params']);

const defColConfigs = {
  'ttid': { key: 'ttid', title: 'ttid', width: 80, resizable: true, fixed: 'left' },
  'event_time_utc': { key: 'event_time_utc', title: 'event_time(utc)', width: 250, resizable: true, fixed: 'left' },
  '#event_time': { key: '#event_time', title: '#event_time', width: 250, resizable: true },
  'clienttime': { key: 'clienttime', title: 'clienttime', width: 250, resizable: true },
  '#event_name': { key: '#event_name', title: '#event_name', width: 200, resizable: true, fixed: 'left' },
  'params': { key: 'params', title: 'params', width: 250, resizable: true },
};

function makeDefaultColConfig(headerName) {
  return {
    key: headerName,
    title: headerName,
    width: 300,
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
  userInput: 'C1m3U3ZoYm\t772dd71ac9623749',
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

const userDefaultShownCols = ['ttid', '#account_id', '#distinct_id', '#user_id', 'platform'];
const userShownColsText = ref(userDefaultShownCols.join(','));

const userAllColNames = computed(() => Object.keys(userColMeta.value.allColConfigs));
const userStatsColumns = [
  { title: '统计结果', key: 'kind', width: 120 },
  { title: '值', key: 'value', tooltip: true, ellipsis: true },
];
const userStatsRows = computed(() => [
  { kind: 'user_id', value: userOutputVar.allUserIds.join(', ') },
  { kind: 'account_id', value: userOutputVar.allAccountIds.join(', ') },
  { kind: 'distinct_id', value: userOutputVar.allDistinctIds.join(', ') },
]);
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
      if (v == null || v === '') continue;
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
    // const text = await fetchServer(sql);
    const text = `{"data":{"headers":["#user_id","#account_id","#distinct_id","#active_time","#reg_time","#user_operation","#server_time","#update_time","#kafka_offset","#event_date","network","adgroup","trackertoken","platform","creative","isnewaeo2","devidemodel","isaeo","countrycode","campaign","adid","trackername","createtime","firstpurchasetime","totaliap","usercoins","firstbuytime","#distinct_list","fbname","canplaylevel","email_board","email_fb","#dw_create_time","#dw_update_time","#uuid","lastlogintime","gameversion","lastpurchasetime","lastlogintimedate","lastpurchasetimedate","adjust_adid","adjust_installed_at","adjust_ip_address","adjust_country","adjust_device_type","adjust_os_name","adjust_adgroup_name","adjust_device_name","adjust_language","adjust_campaign_name","adjust_creative_name","adjust_os_version","adjust_app_version_short","adjust_app_version","adjust_idfv","adjust_idfa","adjust_network_name","distinctid","adjust_android_id","app_version","gaid","timezone","notification_status","language","device_name","device_id","os_version","firebase_id","firebase_fcm_token","res_version","os_name","apns_token","att_status","idfv","idfa","first_app_version","adjust_gaid","last_launch_time","user_step","continuity_login","user_day_age","user_iap_total_cent","user_minutes_age","user_iap_times","max_iap_revenue","is_debug","user_reward_video_times","user_interstitial_video_times","user_coin","user_iap_total_usd","user_interstitial_revenue_usd","user_id","user_reward_revenue_usd","user_level","max_iap_revenue_usd","last_iap_time","first_iap_time","first_launch_time","userid","first_interstitial_video_time","fb_name","first_reward_video_time","fb_mail","first_iap_user_level","meta_campaign_name","meta_ad_set_name","meta_ad_name","adjust_timezone","fb_ad_name","fb_campaign_name","fb_ad_set_name","pay_coins","accountid","max_items_attempt","remaining_spending","user_name"]},"return_code":0,"return_message":"success","showStackMessage":false}
[1491513470724612096,"C1m3U3ZoYm",null,"2026-04-08 11:02:00.786","2026-04-08 11:02:00.786","user_set","2026-04-08 19:02:06.527","2026-04-08 12:02:03.814",39624964340,20260410,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,"2026-04-08 19:02:23.773","02357b40-91c1-4f97-8eb5-d604a393f70d",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,190.0,null,null,null,null,null,null,null,null,null,null,null,null,"C1m3U3ZoYm",null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null,null]
[1491513447303614476,null,"772dd71ac9623749","2026-04-08 12:01:52.695",null,"user_set","2026-04-08 19:02:29.827","2026-04-08 19:02:29.827",39624966590,20260410,null,null,null,"googleplay",null,null,null,null,"GB",null,null,null,"2026-04-08 12:01:59.114",null,null,null,null,["772dd71ac9623749"],null,null,null,null,null,"2026-04-08 19:03:22.785","09f1fecf-9ba0-0963-a617-5bab5616a4ec",1775646119686,null,null,"2026-04-08 12:01:59.686",null,"62351a3d7fd15320ff191b10c7083604","1775646117","80.194.229.181","gb","tablet","android","Google Ads ACI (2awwikm)","GalaxyTabS9FE","en","Store Rule","TP-AOS-WW-UAC3.0-mix-23.08.08-jy (20438022610) (13ho03u0)","16","1.222063.0","1.222063.0",null,null,"Unverified Devices","772dd71ac9623749",null,"1.222063.0","fa9fd7ea-e5b6-42b7-a0be-2a894a6f12da","-1","on","en","SM-X516B","772dd71ac9623749","16","dqStQ1J0RY2zW8RSSgk6kf","dqStQ1J0RY2zW8RSSgk6kf:APA91bESoYOzZ-qocm_iWL4H3k_yQdSWfwh4hlB0ZMcdVb90nl7e5PVoCPn9A3wRq4zO0qFhciGeT84ShAJtj5Bj0KvZCu99E4d6ZUkHtknRihbzv98nCmE","222063.0","android",null,null,null,null,"1.222063.0","fa9fd7ea-e5b6-42b7-a0be-2a894a6f12da",null,170.0,1.0,1.0,0.0,0.0,0.0,0.0,false,0.0,0.0,5000.0,0.0,0.0,"772dd71ac9623749",0.0,1.0,0.0,null,null,"2026-04-08 12:01:52.698","C1m3U3ZoYm",null,null,null,null,null,null,null,null,"UTC+0100",null,null,null,0.0,"772dd71ac9623749",0.0,null,null]`
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
  d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const eventInputVar = reactive({
  startTime: getDefaultEventStart(),
  endTime: new Date(),
  maxLimit: 5000,
  isEventSearching: false,
});

const eventQuerySql = computed(() => {
  const project = projectConfigs[userInputVar.projectName];
  if (!project) return '';
  const accs = userOutputVar.allAccountIds;
  const dists = userOutputVar.allDistinctIds;
  if (!accs.length && !dists.length) return '-- 请先查询用户';
  const start = eventInputVar.startTime;
  const end = eventInputVar.endTime;
  if (!start || !end) return '-- 请选择起止时间';
  const conds = [];
  if (accs.length) conds.push(`"#account_id" IN (${accs.map(sqlStr).join(',')})`);
  if (dists.length) conds.push(`"#distinct_id" IN (${dists.map(sqlStr).join(',')})`);
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

function runEventChecks(parsed) {
  const seenAccount = new Set();
  const seenDistinct = new Set();
  const seenUser = new Set();
  const seenCity = new Set();
  let errlog = 0;
  let jsError = 0;

  for (const row of parsed.rows) {
    if (row['#account_id']) seenAccount.add(row['#account_id']);
    if (row.c_userid) seenAccount.add(row.c_userid);
    if (row['#distinct_id']) seenDistinct.add(row['#distinct_id']);
    if (row.c_clientid) seenDistinct.add(row.c_clientid);
    if (row['#user_id'] != null) seenUser.add(String(row['#user_id']));
    if (row['#city']) seenCity.add(row['#city']);
    if (row['#event_name'] === 'errlog') errlog++;
    if (row['#event_name'] === 'jserror_new') jsError++;
  }

  const accounts = [...seenAccount];
  const distincts = [...seenDistinct];
  const userIds = [...seenUser];
  const cities = [...seenCity];

  return {
    total: parsed.rows.length,
    accounts,
    distincts,
    userIds,
    cities,
    errlog,
    jsError,
    newAccount: accounts.filter(x => !userOutputVar.allAccountIds.includes(x)),
    newDistinct: distincts.filter(x => !userOutputVar.allDistinctIds.includes(x)),
    newUser: userIds.filter(x => !userOutputVar.allUserIds.includes(x)),
    crossCity: cities.length > 1,
  };
}

async function onClickSearchEvent() {
  if (eventInputVar.isEventSearching) return;
  errorMsg.value = '';
  eventInputVar.isEventSearching = true;
  try {
    const sql = eventQuerySql.value;
    if (!sql || sql.startsWith('--')) {
      errorMsg.value = '请先查询用户并选择时间';
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
      eventFilterVar.wantShowColNamesText = commonTemplate1ColNames.join(',');
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

// 模板
const quickTemplate = [
  {
    name: '字段模板',
    children: [
      { name: '通用模板1', callback: () => { eventFilterVar.wantShowColNamesText = commonTemplate1ColNames.join(','); } },
      { name: '显示所有字段', callback: () => { eventFilterVar.wantShowColNamesText = allColNames.value.join(','); } },
      { name: '只显示值不同的字段', callback: () => { eventFilterVar.wantShowColNamesText = goodColNames.value.join(','); } },
      { name: '只显示值相同的字段', callback: () => { eventFilterVar.wantShowColNamesText = sameValueColNames.value.join(','); } },
    ],
  },
  {
    name: '快捷查询',
    children: [
      {
        name: '查 jserror_new', callback: () => {
          eventFilterVar.wantShowColNamesText = fixedColNames.concat(['msg']).join(',');
          eventFilterVar.conditionText = `x["#event_name"]=="jserror_new"`;
          onClickApplyFilter();
        }
      },
      {
        name: '查 errlog', callback: () => {
          eventFilterVar.wantShowColNamesText = fixedColNames.concat(['errtype', 'msg']).join(',');
          eventFilterVar.conditionText = `x["#event_name"]=="errlog"`;
          onClickApplyFilter();
        }
      },
      {
        name: '查 add_items', callback: () => {
          eventFilterVar.wantShowColNamesText = fixedColNames.concat(['add_source', 'sub_add_source']).join(',');
          eventFilterVar.conditionText = `x["#event_name"]=="add_items"`;
          onClickApplyFilter();
        }
      },
      {
        name: '查支付购买', callback: () => {
          eventFilterVar.wantShowColNamesText = fixedColNames.concat(['productid', 'orderid', 'add_source', 'sub_add_source']).join(',');
          eventFilterVar.conditionText = `["add_items","purchased","payment","ipa_begin","iap_end","iap_restore_begin","iap_verify_begin","subscrib","iap_consume","restore","restore_finish"].indexOf(x["#event_name"])>=0`;
          onClickApplyFilter();
        }
      },
    ],
  },
];

function onClickQuickTemplate(drop, item) {
  const config = drop.children.find(x => x.name === item);
  if (config) config.callback();
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

onMounted(() => {
  fetchToken();
});
</script>

<template>
  <Alert v-if="errorMsg" type="error" show-icon closable @on-close="errorMsg = ''">{{ errorMsg }}</Alert>

  <Divider orientation="left">用户查询</Divider>
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
        <Button shape="circle">sql</Button>
        <template #content>
          <div style="text-align:right; margin-bottom:4px;">
            <Button size="small" @click="copyToClipboard(userQuerySql)">复制</Button>
          </div>
          <pre style="margin:0; white-space:pre-wrap; word-break:break-all;">{{ userQuerySql }}</pre>
        </template>
      </Tooltip>
    </FormItem>
    <FormItem>
      <Button type="primary" :loading="userInputVar.isUserSearching" @click="onClickSearchUser">查询用户</Button>
    </FormItem>
  </Form>
  <template v-if="userOutputVar.users.length">
    <div class="table-toolbar">
      <span class="table-toolbar-label">显示字段</span>
      <Select v-model="userShownCols" multiple filterable placeholder="选择要显示的字段" style="flex:1;">
        <Option v-for="name in userAllColNames" :key="name" :value="name">{{ name }}</Option>
      </Select>
    </div>
    <Table :border="true" :columns="userShownColConfigs" :data="userOutputVar.users" size="small" />
    <Table :border="true" :columns="userStatsColumns" :data="userStatsRows" size="small" class="stats-table" />
  </template>

  <h3>2. 事件查询</h3>
  <Form inline :label-width="80">
    <FormItem label="开始(UTC)">
      <DatePicker v-model="eventInputVar.startTime" type="datetime" format="yyyy-MM-dd HH:mm:ss"
        placeholder="UTC" style="width: 200px" />
    </FormItem>
    <FormItem label="结束(UTC)">
      <DatePicker v-model="eventInputVar.endTime" type="datetime" format="yyyy-MM-dd HH:mm:ss"
        placeholder="UTC" style="width: 200px" />
    </FormItem>
    <FormItem label="最大条数">
      <InputNumber v-model="eventInputVar.maxLimit" :min="1" :max="100000" style="width: 120px" />
    </FormItem>
    <FormItem>
      <Button type="primary" :loading="eventInputVar.isEventSearching" @click="onClickSearchEvent">查询事件</Button>
    </FormItem>
  </Form>
  <Collapse simple>
    <Panel name="eventSql">
      查询事件 SQL
      <template #content>
        <Input type="textarea" :value="eventQuerySql" :autosize="{ minRows: 4, maxRows: 16 }" readonly />
      </template>
    </Panel>
  </Collapse>

  <h3>3. 事件检测</h3>
  <div v-if="!eventCheckLogs" style="color:#999">尚未查询事件</div>
  <template v-else>
    <div>
      <Tag color="default">总数 {{ eventCheckLogs.total }}</Tag>
      <Tag v-if="eventCheckLogs.errlog" color="orange">errlog {{ eventCheckLogs.errlog }}</Tag>
      <Tag v-if="eventCheckLogs.jsError" color="orange">jserror_new {{ eventCheckLogs.jsError }}</Tag>
      <Tag v-for="c in eventCheckLogs.cities" :key="`c-${c}`" :color="eventCheckLogs.crossCity ? 'red' : 'default'">city: {{ c }}</Tag>
    </div>
    <Alert v-if="eventCheckLogs.newAccount.length" type="warning" show-icon>
      新 account_id: {{ eventCheckLogs.newAccount.join(', ') }}
    </Alert>
    <Alert v-if="eventCheckLogs.newDistinct.length" type="warning" show-icon>
      新 distinct_id: {{ eventCheckLogs.newDistinct.join(', ') }}
    </Alert>
    <Alert v-if="eventCheckLogs.newUser.length" type="warning" show-icon>
      新 user_id: {{ eventCheckLogs.newUser.join(', ') }}
    </Alert>
    <Alert v-if="eventCheckLogs.crossCity" type="warning" show-icon>
      涉及多个 city: {{ eventCheckLogs.cities.join(', ') }}
    </Alert>
  </template>

  <h3>4. 事件过滤</h3>
  <Form inline :label-width="80">
    <FormItem label="模板">
      <Dropdown v-for="drop in quickTemplate" :key="drop.name" style="margin-right: 8px;"
        @on-click="(item) => onClickQuickTemplate(drop, item)">
        <Button>{{ drop.name }} <Icon type="ios-arrow-down" /></Button>
        <template #list>
          <DropdownMenu>
            <DropdownItem v-for="item in drop.children" :key="item.name" :name="item.name">{{ item.name }}
            </DropdownItem>
          </DropdownMenu>
        </template>
      </Dropdown>
    </FormItem>
    <FormItem label="排序">
      <Select v-model="eventFilterVar.sortColName" filterable style="width: 200px;">
        <Option value="ttid">ttid</Option>
        <Option value="event_time_utc">event_time_utc</Option>
        <Option value="clienttime">clienttime</Option>
        <Option v-for="name in allColNames" :key="name" :value="name">{{ name }}</Option>
      </Select>
      <Select v-model="eventFilterVar.sortCategory" style="width: 90px; margin-left: 4px;">
        <Option value="升序">升序</Option>
        <Option value="降序">降序</Option>
      </Select>
    </FormItem>
  </Form>
  <Form :label-width="80">
    <FormItem label="显示字段">
      <Select v-model="eventShownCols" multiple filterable placeholder="选择要显示的字段">
        <Option v-for="name in allColNames" :key="name" :value="name">{{ name }}</Option>
      </Select>
    </FormItem>
    <FormItem label="过滤条件">
      <Input v-model="eventFilterVar.conditionText" clearable
        placeholder='合法的 js，例如 x["#event_name"]=="add_items" && x.clienttime.startsWith("2024")'>
        <template #append>
          <Button type="primary" @click="onClickApplyFilter">应用</Button>
        </template>
      </Input>
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

<style scoped>
h3 {
  margin: 12px 0 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid #e8e8e8;
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
  margin-top: 8px;
}
.table-toolbar-label {
  color: #515a6e;
  font-size: 13px;
  white-space: nowrap;
}

.stats-table {
  margin-top: 16px;
}

:deep(.ivu-table) {
  font-size: 14px;
}
</style>
