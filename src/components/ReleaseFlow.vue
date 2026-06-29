<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { Button, Select, Option, Table, Card, Alert, Tag, Input, Divider, Message, Modal, Spin, Tooltip, Icon, Checkbox } from "view-ui-plus";

const RELEASERS = ["张殿伟", "赵谦", "王若冲", "王红", "焦红业"];
const PROJECTS = ["TP1", "TP4"];
const JENKINS_PIPELINE = "https://dev-jenkins.me2zengame.com/blue/organizations/jenkins/pipelines";
const PKG_URLS = {
  TP1: "http://10.10.31.17:8080/view/TP1/job/Tripeaks1_PKG/",
  TP4: "http://10.10.31.17:8080/view/TP4/job/Tripeaks4_PKG/",
};
const SHEET_URLS = {
  TP1: "https://docs.google.com/spreadsheets/d/1Pymj_iLeIWo4nvpdefsBLzC8y1iA-FUEPK9oT0rEqjs/edit?gid=2016334865#gid=2016334865",
  TP4: "https://docs.google.com/spreadsheets/d/1Pymj_iLeIWo4nvpdefsBLzC8y1iA-FUEPK9oT0rEqjs/edit?gid=98731370#gid=98731370",
};
const FLOW_TYPES = [
  { value: "regular", label: "常规发版" },
  { value: "hotfix_ota", label: "热更发ota" },
  { value: "hotfix_native", label: "热更发Native" },
];
function typeLabel(v) { return (FLOW_TYPES.find(t => t.value === v) || {}).label || v; }

const GEN = {
  push: f => `${f.project} ota ${f.context.otaVersion || "?"} 已推送线上,请 QA 验证`,
  done: f => `${f.project} 客户端发版完毕`,
  hfOccupy: f => `${f.project} 需要占用 tp1/tp4 测试服,修复问题:`,
  hfOta: f => `${f.project} 已打修复 ota(prod 分支),请验证`,
  hfPush: f => `${f.project} 修复 ota 已发线上,请验证`,
  hfRestore: f => `${f.project} 已恢复本周内容(beta-ota)`,
  hfCS: f => `${f.project} 本次问题已由新 ota 修复;玩家更新到新 ota 即可正常游戏`,
};

// 大流程定义(autosubs 类型的小流程由 SUB_PLANS 定义、后端逐个执行)
const FLOWS = {
  regular: [
    { key: "prepare", title: "发版前流程", kind: "autosubs", plan: "prepare", endpoint: "prepare", runLabel: "启动:拉取并检查" },
    { key: "push", title: "推送线上", kind: "external", link: JENKINS_PIPELINE, desc: "推送 ota 到线上。", notifyPushed: true },
    { key: "post", title: "发版后流程", kind: "autosubs", plan: "post", endpoint: "post", manual: true },
    { key: "shushu", title: "数数报错", kind: "shushu" },
  ],
  hotfix_ota: [
    { key: "occupy", title: "占测试服", kind: "external", gen: "hfOccupy" },
    { key: "prodfix", title: "改 prod 代码", kind: "external", desc: "确认上次发版 tag 和 prod 是同一次提交,直接在 prod 改代码并提交。" },
    { key: "ota", title: "打 OTA", kind: "external", gen: "hfOta", desc: "分支选 prod,勾 production。" },
    { key: "push", title: "发线上", kind: "external", link: JENKINS_PIPELINE, gen: "hfPush" },
    { key: "merge", title: "合并 beta", kind: "merge", direction: "prod2beta", desc: "同时通知策划把 release 表合并到 beta 表。" },
    { key: "restore", title: "恢复本周", kind: "external", gen: "hfRestore", desc: "打一个普通的 beta-ota。" },
    { key: "record", title: "发版记录", kind: "record" },
    { key: "cs", title: "通知客服", kind: "external", gen: "hfCS" },
  ],
  hotfix_native: [
    { key: "occupy", title: "占测试服", kind: "external", gen: "hfOccupy" },
    { key: "prodfix", title: "改 prod 代码", kind: "external", desc: "确认上次发版 tag 和 prod 是同一次提交,直接在 prod 改代码并提交。" },
    { key: "ota", title: "打 OTA", kind: "external", gen: "hfOta", desc: "分支选 prod,勾 production。" },
    { key: "push", title: "发线上", kind: "external", link: JENKINS_PIPELINE, gen: "hfPush", desc: "这个 ota 本身必须发到线上,否则包里 ota 比线上新会导致包无法更新 ota。" },
    { key: "native", title: "打正式包", kind: "external", pkg: true, desc: "热更 ota 后正常打 native 正式包,但分支选择 prod。" },
    { key: "merge", title: "合并 beta", kind: "merge", direction: "prod2beta", desc: "同时通知策划把 release 表合并到 beta 表。" },
    { key: "restore", title: "恢复本周", kind: "external", gen: "hfRestore", desc: "打一个普通的 beta-ota。" },
    { key: "record", title: "发版记录", kind: "record" },
    { key: "cs", title: "通知客服", kind: "external", gen: "hfCS" },
  ],
};

const SHUSHU_MINUTES = [5, 15, 30, 60];

const errorMsg = ref("");
const project = ref("TP1");
const releaser = ref(RELEASERS[0]);
const flowType = ref("regular");
const flow = ref(null);
const cfg = ref({});
const operator = ref(RELEASERS[0]);
const texts = reactive({});
const busy = reactive({});
const ready = ref(false);
const sel = ref("");
const shushuMinutes = ref(30);
const notifyPushed = ref(true); // 推送线上完成时是否通知群
const nowMs = ref(Date.now());
let tick = null, autoQuerying = false;

const majors = computed(() => FLOWS[flow.value?.flowType] || FLOWS.regular);
const selMajor = computed(() => majors.value.find(m => m.key === sel.value) || majors.value[0]);
const selIndex = computed(() => majors.value.findIndex(m => m.key === selMajor.value?.key));

function st(key) { return flow.value?.steps?.[key] || {}; }
function majorStatus(key) { return st(key).status || "pending"; }

// autosubs 子流程定义(始终显示,逐个执行,执行一个显示一个结果)
const DEFAULT_REPOS = [{ name: "TripeaksClient" }, { name: "TripeaksResources" }, { name: "TripeaksJourneyConfig" }, { name: "TripeaksLevelConfig" }];
const runningSub = ref("");
const subStartMs = ref(0);
const subSkip = reactive({}); // 可选子流程的跳过集合(默认不跳过=勾选)
function fmtDur(ms) {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`;
}
const SUB_PLANS = {
  prepare: (c) => {
    const repos = c.repos?.length ? c.repos : DEFAULT_REPOS;
    const list = [{ id: "feishu", name: "拉取飞书发版内容", title: "拉取飞书发版内容", cmd: "查询飞书本周发版内容\nversion / 需求列表 / 是否发包" }];
    repos.forEach(r => {
      const b = r.branch || "?";
      list.push({
        id: "repo:" + r.name, name: r.name, title: `${r.name} 拉取最新提交`,
        cmd: `git fetch origin ${b}\ngit checkout -f ${b}\ngit reset --hard origin/${b}\ngit clean -df\ngit submodule update --init --recursive --force`,
      });
    });
    list.push({ id: "check:res", name: "检查资源", title: "检查资源", cmd: "./compile.coffee res --all\ngit status" });
    list.push({ id: "check:table", name: "检查配置表", title: "检查配置表", cmd: "./compile.coffee table\ngit status" });
    list.push({ id: "check:level", name: "检查关卡", title: "检查关卡", cmd: "./compile.coffee level\ngit status" });
    list.push({ id: "ota", name: "打ota并发消息", title: "打ota并发消息", optional: true, cmd: "外部打 ota 并发消息\n当前仅标记完成,不实际执行" });
    return list;
  },
  post: (c) => {
    const mg = c.merge || {};
    const f = mg.from || "beta", t = mg.to || "prod";
    return [
      { id: "merge", name: "beta合并到prod", title: "beta合并到prod", cmd: `git fetch origin ${f}\ngit reset --hard origin/${f}\ngit checkout -f ${t}\ngit merge origin/${f}\ngit tag <项目>/<ota版本>\ngit push origin ${t}\ngit push origin <tag>\n已合并则跳过 merge` },
      { id: "record", name: "填写发版记录", title: "填写发版记录", cmd: "查发版记录表是否已有该版本\n没有则写入一行" },
      { id: "notify", name: "通知完毕", title: "通知完毕", cmd: "占位\n后续接飞书机器人发群消息" },
    ];
  },
};
const curSubs = computed(() => selMajor.value?.plan ? (SUB_PLANS[selMajor.value.plan]?.(cfg.value) || []) : []);
function subOf(stepKey, name) { return (st(stepKey).subs || []).find(x => x.name === name); }
const subCols = computed(() => [
  { title: "子流程", slot: "sub", width: 300 },
  selMajor.value?.manual ? { title: "操作", slot: "op", width: 170 } : { title: "用时", slot: "dur", width: 90 },
  { title: "结果", slot: "result" },
]);
const subRows = computed(() => {
  let prevDone = true; // 手动模式按顺序解锁:前一步完成才允许执行后一步
  return curSubs.value.map(s => {
    const r = subOf(selMajor.value.key, s.name);
    const running = runningSub.value === s.id;
    const ms = running ? (nowMs.value - subStartMs.value) : (r?.ms ?? null);
    const skipped = s.optional && subSkip[s.id];
    const status = running ? "running" : (r ? (r.ok ? "done" : "failed") : (skipped ? "skipped" : "pending"));
    const canRun = prevDone;
    prevDone = prevDone && (status === "done" || skipped);
    return {
      id: s.id, name: s.name, title: s.title, cmd: s.cmd, running, optional: !!s.optional, status, canRun,
      dur: fmtDur(ms),
      result: r ? (r.ok ? (r.result || "完成") : (r.error || "失败")) : (skipped ? "未选,将跳过" : ""),
      detail: r && !r.ok ? (r.detail || "") : "",
      fail: r ? !r.ok : false,
    };
  });
});
// 发版记录表的标签页名:年份发版记录-项目(如 2026发版记录-tp1)
const recordSheet = computed(() => flow.value ? `${todayDot().split(".")[0]}发版记录-${flow.value.project.toLowerCase()}` : "");
// 发版记录预览(版本号来自「beta合并到prod」解析出的 otaVersion)
const recordPreview = computed(() => {
  const c = flow.value?.context || {};
  return {
    日期: todayDot(),
    平台: c.needPackage ? "ota/ios/android" : "ota",
    版本号: c.otaVersion ? `${flow.value.project.toLowerCase()}/${c.otaVersion}` : "待解析(合并步骤确定)",
    发版人: operator.value,
    发版内容: (c.stories || []).map((n, i) => `${i + 1}. ${n}`).join("\n") || "(发版前未拉到)",
    "Resource commit": c.resourceCommit || "(发版前未拉到)",
  };
});

const recordCols = [
  { title: "日期", key: "date", width: 100 },
  { title: "平台", key: "platform", width: 80 },
  { title: "版本号", key: "version", width: 120 },
  { title: "发版内容", slot: "content", minWidth: 240 },
  { title: "Resource commit", key: "commit", minWidth: 160 },
];
const shushuCols = [
  { title: "错误信息(msg)", key: "msg", minWidth: 240, tooltip: true },
  { title: "次数", key: "count", width: 80 },
];

function pad2(n) { return String(n).padStart(2, "0"); }
function fmtTime(s) { return s ? s.replace("T", " ").slice(0, 19) : ""; }
function todayDot() { const d = new Date(); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`; }

async function getJson(url) {
  const r = await fetch(url); const t = await r.text();
  if (!r.ok) { let m = t; try { m = JSON.parse(t).error || t; } catch {} throw new Error(m); }
  return JSON.parse(t);
}
async function postJson(url, body) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });
  const t = await r.text();
  if (!r.ok) { let m = t; try { m = JSON.parse(t).error || t; } catch {} throw new Error(m); }
  return JSON.parse(t);
}
async function run(key, fn) {
  if (busy[key]) return;
  busy[key] = true; errorMsg.value = "";
  try { await fn(); } catch (e) { errorMsg.value = String(e.message || e); Message.error(errorMsg.value); }
  finally { busy[key] = false; }
}
async function copy(t) { try { await navigator.clipboard.writeText(t || ""); Message.success("已复制"); } catch { Message.error("复制失败"); } }

function initTexts(f) {
  for (const m of FLOWS[f.flowType] || []) {
    if (m.gen) texts[m.key] = f.steps[m.key]?.notifyText || GEN[m.gen](f);
  }
}
function recordRow(f) {
  const c = f.context || {};
  return {
    date: todayDot(),
    platform: c.needPackage ? "ota/ios/android" : "ota",
    version: c.otaVersion ? `${f.project.toLowerCase()}/${c.otaVersion}` : "",
    content: (c.stories || []).map((n, i) => `${i + 1}. ${n}`).join("\n"),
    commit: c.resourceCommit || "",
  };
}

// ============ 两态 ============
async function loadActive() {
  await run("load", async () => {
    const list = (await getJson("/api/release/flows?status=active")).flows || [];
    if (list.length) await enterFlow(list[0].id);
    else flow.value = null;
  });
}
async function createFlow() {
  await run("create", async () => {
    const f = await postJson("/api/release/flows", { project: project.value, creator: releaser.value, flowType: flowType.value });
    await enterFlow(f.id);
  });
}
async function enterFlow(id) {
  const f = await getJson(`/api/release/flows/${id}`);
  operator.value = f.creator || RELEASERS[0];
  try { cfg.value = await getJson(`/api/release/config?project=${f.project}`); } catch { cfg.value = {}; }
  flow.value = f;
  initTexts(f);
  const ms = (FLOWS[f.flowType] || []).find(m => (f.steps[m.key]?.status || "pending") !== "done");
  sel.value = (ms || (FLOWS[f.flowType] || [])[0])?.key || "";
}

onMounted(async () => {
  await loadActive();
  ready.value = true;
  tick = setInterval(() => { nowMs.value = Date.now(); maybeAutoQuery(); }, 1000);
});
onUnmounted(() => { if (tick) clearInterval(tick); });

// ============ 大流程操作(后端 mock) ============
function setFlow(f) { flow.value = f; }
async function op(name, body) { setFlow(await postJson(`/api/release/flows/${flow.value.id}/${name}`, { ...body, operator: operator.value })); }

// 完成最后一个大流程时结束整个流程(不再自动跳转到下一步)
async function afterDone(key) {
  const i = majors.value.findIndex(m => m.key === key);
  if (majors.value[i + 1]) return;
  setFlow(await postJson(`/api/release/flows/${flow.value.id}/done`, { operator: operator.value }));
  Message.success("流程已完成");
}
async function runOp(m, fn) {
  await run("op", async () => { await fn(); if (majorStatus(m.key) === "done") await afterDone(m.key); });
}

// 发版前(自动):依次跑子流程,失败即整步 failed,重试重跑全部。
async function doAutoSubs(m) {
  await run("op", async () => {
    const plan = SUB_PLANS[m.plan]?.(cfg.value) || [];
    let ok = true;
    for (const s of plan) {
      if (s.optional && subSkip[s.id]) continue;
      runningSub.value = s.id; subStartMs.value = Date.now(); nowMs.value = Date.now();
      try { setFlow(await postJson(`/api/release/flows/${flow.value.id}/${m.endpoint}/sub`, { stepKey: m.key, sub: s.id, operator: operator.value })); }
      finally { runningSub.value = ""; }
      if (!subOf(m.key, s.name)?.ok) { ok = false; break; }
    }
    setFlow(await postJson(`/api/release/flows/${flow.value.id}/step`, { stepKey: m.key, status: ok ? "done" : "failed", operator: operator.value }));
    if (ok) await afterDone(m.key);
  });
}
// 发版后(手动):每个子流程单独执行,按顺序解锁;全部完成才置完成。
async function finishIfAllDone(m) {
  const plan = SUB_PLANS[m.plan]?.(cfg.value) || [];
  if (!plan.every(s => subOf(m.key, s.name)?.ok)) return;
  setFlow(await postJson(`/api/release/flows/${flow.value.id}/step`, { stepKey: m.key, status: "done", operator: operator.value }));
  await afterDone(m.key);
}
async function runOneSub(m, row) {
  await run("op", async () => {
    runningSub.value = row.id; subStartMs.value = Date.now(); nowMs.value = Date.now();
    try { setFlow(await postJson(`/api/release/flows/${flow.value.id}/${m.endpoint}/sub`, { stepKey: m.key, sub: row.id, operator: operator.value })); }
    finally { runningSub.value = ""; }
    await finishIfAllDone(m);
  });
}
async function markSubDone(m, row) {
  await run("mark", async () => {
    setFlow(await postJson(`/api/release/flows/${flow.value.id}/sub/mark`, { stepKey: m.key, name: row.name, operator: operator.value }));
    await finishIfAllDone(m);
  });
}
async function doRecord(m) { await runOp(m, () => op("record", { stepKey: m.key, row: recordRow(flow.value) })); }
async function doMerge(m) {
  const conf = cfg.value.merge || {};
  let from = conf.from, to = conf.to, tag = "";
  if (m.direction === "prod2beta") { from = conf.to; to = conf.from; }
  else if (m.tag) tag = `${flow.value.project.toLowerCase()}/${flow.value.context.otaVersion || "?"}`;
  await runOp(m, () => op("merge", { stepKey: m.key, from, to, tag }));
}
async function completeExternal(m) {
  await run("op_" + m.key, async () => {
    if (m.notifyPushed && notifyPushed.value) {
      try { const r = await postJson(`/api/release/flows/${flow.value.id}/notify-pushed`, { operator: operator.value }); Message.success(`已通知群:${r.text}`); }
      catch (e) { Message.warning(`通知失败(不影响完成):${e.message || e}`); }
    }
    setFlow(await postJson(`/api/release/flows/${flow.value.id}/step`, { stepKey: m.key, status: "done", data: m.gen ? { notifyText: texts[m.key] } : undefined, operator: operator.value }));
    await afterDone(m.key);
  });
}
async function shushuStart(m) { await run("op", () => op("shushu/start", { stepKey: m.key, minutes: shushuMinutes.value })); }
async function shushuQuery(m) { await runOp(m, () => op("shushu/query", { stepKey: m.key })); }
function closeFlow(id) {
  Modal.confirm({
    title: "关闭流程", content: "确定要关闭(作废)这个发版流程吗?", okText: "关闭流程", cancelText: "取消",
    onOk: () => run("close", async () => { await postJson(`/api/release/flows/${id}/abort`, { operator: operator.value }); await loadActive(); }),
  });
}

// ============ 数数倒计时 ============
function remainMs(s) { return s.countdownEndAt ? Math.max(0, Date.parse(s.countdownEndAt) - nowMs.value) : 0; }
function fmtRemain(ms) { const t = Math.floor(ms / 1000); return `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`; }
function maybeAutoQuery() {
  if (!flow.value) return;
  const m = (FLOWS[flow.value.flowType] || []).find(x => x.kind === "shushu");
  if (!m) return;
  const s = flow.value.steps?.[m.key];
  if (!s || s.status !== "running" || !s.countdownEndAt) return;
  if (Date.parse(s.countdownEndAt) <= Date.now() && !autoQuerying) {
    autoQuerying = true;
    shushuQuery(m).finally(() => { autoQuerying = false; });
  }
}
</script>

<template>
  <div class="release-root">
  <Alert v-if="errorMsg" type="error" show-icon closable @on-close="errorMsg = ''">{{ errorMsg }}</Alert>

  <div v-if="!ready" class="loading"><Spin size="large" /></div>

  <!-- 态一:无进行中流程 → 新建 -->
  <template v-else-if="!flow">
    <div class="landing">
      <Card class="create-card" dis-hover>
        <h3 class="land-title">新建发版流程</h3>
        <div class="frow"><label>项目</label>
          <Select v-model="project" transfer style="flex:1"><Option v-for="p in PROJECTS" :key="p" :value="p">{{ p }}</Option></Select>
        </div>
        <div class="frow"><label>发版人</label>
          <Select v-model="releaser" transfer style="flex:1"><Option v-for="r in RELEASERS" :key="r" :value="r">{{ r }}</Option></Select>
        </div>
        <div class="frow"><label>流程类型</label>
          <Select v-model="flowType" transfer style="flex:1"><Option v-for="t in FLOW_TYPES" :key="t.value" :value="t.value">{{ t.label }}</Option></Select>
        </div>
        <Button type="primary" long size="large" :loading="busy.create" @click="createFlow">新建发版流程</Button>
      </Card>
    </div>
  </template>

  <!-- 态二:进行中流程 → 向导 -->
  <template v-else>
    <div class="topbar">
      <Tag color="blue">{{ flow.project }}</Tag>
      <Tag color="purple">{{ typeLabel(flow.flowType) }}</Tag>
      <span class="muted">{{ flow.id }}</span>
      <span style="margin-left:auto">操作人</span>
      <Select v-model="operator" transfer style="width:120px"><Option v-for="r in RELEASERS" :key="r" :value="r">{{ r }}</Option></Select>
      <Tag v-if="flow.status !== 'active'" color="default">{{ flow.status }}</Tag>
      <Button type="error" ghost :loading="busy.close" @click="closeFlow(flow.id)">关闭流程</Button>
    </div>

    <Alert type="info" show-icon banner>发版前 / 发版后(合并、发版记录)真实执行:合并会 push 到 prod 并打 tag,发版记录真实写表,数数真实查询 jserror_new;通知为占位。</Alert>

    <div class="wizard">
      <!-- 左侧 step 条 -->
      <ul class="rail">
        <li v-for="(m, i) in majors" :key="m.key" class="rail-li" :class="{ active: sel === m.key }" @click="sel = m.key">
          <span class="badge" :class="majorStatus(m.key)">
            {{ majorStatus(m.key) === 'done' ? '✓' : majorStatus(m.key) === 'failed' ? '✕' : i + 1 }}
          </span>
          <span class="rail-title">{{ m.title }}</span>
        </li>
      </ul>

      <!-- 右侧详情(不显示主流程标题) -->
      <div class="detail" v-if="selMajor">
        <Card dis-hover>
          <!-- 自动子流程表(发版前 / 发版后):逐个执行,执行一个显示一个结果 -->
          <template v-if="selMajor.kind === 'autosubs'">
            <Table :columns="subCols" :data="subRows" border size="small" style="margin-bottom:10px">
              <template #sub="{ row }">
                <Checkbox v-if="row.optional" :model-value="!subSkip[row.id]" :disabled="busy.op || majorStatus(selMajor.key) === 'done'" @on-change="v => subSkip[row.id] = !v">{{ row.title }}</Checkbox>
                <span v-else>{{ row.title }}</span>
                <Tooltip placement="right" transfer max-width="440" class="cmd-tip">
                  <Icon type="ios-information-circle-outline" />
                  <template #content><pre class="cmd-pre">{{ row.cmd }}</pre></template>
                </Tooltip>
              </template>
              <template #dur="{ row }"><span class="muted">{{ row.dur }}</span></template>
              <template #op="{ row }">
                <span v-if="row.status === 'done'" class="muted">已完成</span>
                <span v-else-if="row.status === 'running'" class="muted">执行中…</span>
                <template v-else>
                  <Button size="small" type="primary" :disabled="!row.canRun" :loading="busy.op" @click="runOneSub(selMajor, row)">执行</Button>
                  <Button v-if="row.status === 'failed'" size="small" style="margin-left:6px" :loading="busy.mark" @click="markSubDone(selMajor, row)">已人工解决</Button>
                </template>
              </template>
              <template #result="{ row }">
                <span v-if="row.running" class="muted">执行中…</span>
                <div v-else-if="row.id === 'record' && row.status === 'pending'" class="rec-preview">
                  <div class="muted">将填写到:<a :href="SHEET_URLS[flow.project]" target="_blank">{{ recordSheet }}</a></div>
                  <div class="kv" v-for="(v, k) in recordPreview" :key="k"><span class="kv-k">{{ k }}</span><span class="kv-v">{{ v }}</span></div>
                </div>
                <template v-else>
                  <span class="result-text" :class="{ err: row.fail }">{{ row.result }}</span>
                  <Tooltip v-if="row.detail" placement="left" transfer max-width="480" class="cmd-tip">
                    <Icon type="ios-information-circle-outline" />
                    <template #content><pre class="cmd-pre">{{ row.detail }}</pre></template>
                  </Tooltip>
                </template>
              </template>
            </Table>
            <template v-if="!selMajor.manual">
              <Button v-if="majorStatus(selMajor.key) !== 'done'" type="primary" :loading="busy.op" @click="doAutoSubs(selMajor)">
                {{ majorStatus(selMajor.key) === 'failed' ? '重试' : (selMajor.runLabel || '启动') }}
              </Button>
              <Tag v-else color="success">已完成</Tag>
            </template>
            <Tag v-else-if="majorStatus(selMajor.key) === 'done'" color="success">已完成</Tag>
          </template>

          <!-- 外部操作:打ota / 推送 / 通知 / 打包 / 改代码 -->
          <template v-else-if="selMajor.kind === 'external'">
            <div v-if="selMajor.desc" class="muted">{{ selMajor.desc }}</div>
            <div v-if="selMajor.link" class="muted">推送:<a :href="selMajor.link" target="_blank">{{ selMajor.link }}</a></div>
            <div v-if="selMajor.pkg" class="muted">Jenkins 打包:<a :href="PKG_URLS[flow.project]" target="_blank">{{ PKG_URLS[flow.project] }}</a></div>
            <template v-if="selMajor.gen">
              <Input v-model="texts[selMajor.key]" type="textarea" :rows="2" style="margin:8px 0" />
              <Button size="small" @click="copy(texts[selMajor.key])">复制文案</Button>
              <Button size="small" @click="texts[selMajor.key] = GEN[selMajor.gen](flow)">重置文案</Button>
              <Divider style="margin:10px 0" />
            </template>
            <Checkbox v-if="selMajor.notifyPushed && majorStatus(selMajor.key) !== 'done'" v-model="notifyPushed" style="display:block;margin:8px 0">通知已推送(向群发"线上版本已发")</Checkbox>
            <Button v-if="majorStatus(selMajor.key) !== 'done'" type="success" :loading="busy['op_' + selMajor.key]" @click="completeExternal(selMajor)">完成</Button>
            <Tag v-else color="success">已完成</Tag>
          </template>

          <!-- 5 合并 -->
          <template v-else-if="selMajor.kind === 'merge'">
            <div class="muted">{{ selMajor.direction === 'prod2beta' ? 'prod 合并回 beta' : 'beta 合并到 prod(并打 tag)' }}
              <span v-if="cfg.merge">· repo: {{ cfg.merge.repo }}</span>
            </div>
            <div v-if="selMajor.desc" class="muted">{{ selMajor.desc }}</div>
            <Button v-if="majorStatus(selMajor.key) !== 'done'" type="primary" :loading="busy.op" @click="doMerge(selMajor)">启动:合并并推送</Button>
            <div v-else class="result">
              <Tag v-if="st(selMajor.key).mock" color="warning">模拟</Tag>
              <span v-if="st(selMajor.key).tag">tag: <b>{{ st(selMajor.key).tag }}</b> · </span>
              <span>commit: {{ st(selMajor.key).mergeCommit }}</span>
              <pre class="log">{{ st(selMajor.key).mergedLog }}</pre>
            </div>
          </template>

          <!-- 6 填写发版记录 -->
          <template v-else-if="selMajor.kind === 'record'">
            <div class="muted">发版记录表:<a :href="SHEET_URLS[flow.project]" target="_blank">{{ SHEET_URLS[flow.project] }}</a></div>
            <Table :columns="recordCols" :data="[recordRow(flow)]" border size="small" style="margin:8px 0">
              <template #content="{ row }"><div class="multiline">{{ row.content }}</div></template>
            </Table>
            <Button v-if="majorStatus(selMajor.key) !== 'done'" type="primary" :loading="busy.op" @click="doRecord(selMajor)">启动:填写发版记录</Button>
            <span v-else class="muted">已写入:{{ st(selMajor.key).sheet }} <Tag v-if="st(selMajor.key).mock" color="warning">模拟</Tag></span>
          </template>

          <!-- 9 数数报错 -->
          <template v-else-if="selMajor.kind === 'shushu'">
            <div class="muted">倒计时结束后(即使页面关闭)由服务器自动查询本次发布版本的 jserror_new,按 msg 分组。</div>
            <template v-if="majorStatus(selMajor.key) === 'pending'">
              <div class="frow" style="max-width:280px;margin-top:8px">
                <label>倒计时</label>
                <Select v-model="shushuMinutes" transfer style="flex:1"><Option v-for="x in SHUSHU_MINUTES" :key="x" :value="x">{{ x }} 分钟</Option></Select>
              </div>
              <Button type="primary" :loading="busy.op" @click="shushuStart(selMajor)">启动倒计时</Button>
            </template>
            <template v-else-if="majorStatus(selMajor.key) === 'running'">
              <div class="countdown">{{ fmtRemain(remainMs(st(selMajor.key))) }}</div>
              <Button :loading="busy.op" @click="shushuQuery(selMajor)">立即查询</Button>
            </template>
            <template v-else-if="majorStatus(selMajor.key) === 'failed'">
              <div class="err">数数查询失败:{{ st(selMajor.key).error }}</div>
              <Button style="margin-top:8px" :loading="busy.op" @click="shushuQuery(selMajor)">重试</Button>
            </template>
            <template v-else>
              <div class="muted">近 {{ st(selMajor.key).result?.days }} 天 jserror_new · 版本 {{ st(selMajor.key).result?.version || '—' }} · 查询于 {{ fmtTime(st(selMajor.key).result?.queriedAt) }}
                <Button size="small" style="margin-left:8px" :loading="busy.op" @click="shushuQuery(selMajor)">重新查询</Button>
              </div>
              <div style="margin-top:10px">
                <Tag :color="(st(selMajor.key).result?.total || 0) ? 'error' : 'success'">{{ (st(selMajor.key).result?.total || 0) ? `${st(selMajor.key).result.total} 条报错` : '无报错' }}</Tag>
              </div>
              <Table v-if="st(selMajor.key).result?.groups?.length" :columns="shushuCols" :data="st(selMajor.key).result.groups" border size="small" style="margin:6px 0" />
            </template>
          </template>
        </Card>
      </div>
    </div>
  </template>
  </div>
</template>

<style scoped>
.release-root { font-size: 15px; }
.loading { text-align: center; padding: 64px 0; }
.landing { max-width: 520px; margin: 32px auto 0; }
.land-title { margin: 0 0 16px; text-align: center; }
.frow { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.frow label { width: 64px; flex: none; text-align: right; color: #515a6e; }
.topbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
.muted { color: #808695; }
.wizard { display: flex; gap: 16px; align-items: flex-start; margin-top: 12px; }
.rail { width: 248px; flex: none; list-style: none; margin: 0; padding: 0; border: 1px solid #e8eaec; border-radius: 6px; overflow: hidden; }
.rail-li { display: flex; align-items: center; gap: 10px; padding: 11px 12px; cursor: pointer; border-bottom: 1px solid #f2f3f5; }
.rail-li:last-child { border-bottom: none; }
.rail-li:hover { background: #f7f9fc; }
.rail-li.active { background: #e8f4ff; }
.rail-title { font-size: 14px; }
.badge { width: 22px; height: 22px; flex: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #fff; background: #c5c8ce; }
.badge.done { background: #19be6b; }
.badge.running { background: #2d8cf0; }
.badge.failed { background: #ed4014; }
.detail { flex: 1; min-width: 0; }
.cmd-tip { margin-left: 6px; color: #808695; cursor: help; }
.cmd-pre { margin: 0; white-space: pre-wrap; word-break: break-all; font-size: 12px; line-height: 1.5; }
.result-text { white-space: pre-wrap; word-break: break-all; }
.rec-preview { font-size: 13px; }
.kv { display: flex; gap: 10px; padding: 2px 0; }
.kv-k { width: 96px; flex: none; color: #808695; }
.kv-v { flex: 1; min-width: 0; white-space: pre-wrap; word-break: break-all; }
.err { color: #ed4014; }
.result { margin-top: 8px; }
.multiline { white-space: pre-line; padding: 4px 0; }
.countdown { font-size: 32px; font-weight: 600; margin: 12px 0; font-variant-numeric: tabular-nums; }
.log { background: #f7f7f7; padding: 8px; margin-top: 8px; white-space: pre-wrap; word-break: break-all; font-size: 12px; }
</style>
