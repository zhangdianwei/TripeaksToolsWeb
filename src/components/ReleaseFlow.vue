<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { Button, Select, Option, Table, Card, Alert, Tag, Input, Divider, Message, Modal, Spin, Tooltip, Icon } from "view-ui-plus";

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

// 大流程定义(小流程在 resources 内部,由后端返回)
const FLOWS = {
  regular: [
    { key: "prepare", title: "正式环境", kind: "prepare" },
    { key: "push", title: "推送线上", kind: "external", link: JENKINS_PIPELINE, desc: "推送 ota 到线上。" },
    { key: "merge", title: "合并 prod", kind: "merge", direction: "beta2prod", tag: true },
    { key: "record", title: "发版记录", kind: "record" },
    { key: "notify_done", title: "通知完毕", kind: "external", gen: "done" },
    { key: "package", title: "本地打包", kind: "external", pkg: true, desc: "可选:按时打包方便 QA 测试老活动。" },
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
const nowMs = ref(Date.now());
let poll = null, tick = null, autoQuerying = false;

const majors = computed(() => FLOWS[flow.value?.flowType] || FLOWS.regular);
const selMajor = computed(() => majors.value.find(m => m.key === sel.value) || majors.value[0]);
const selIndex = computed(() => majors.value.findIndex(m => m.key === selMajor.value?.key));

function st(key) { return flow.value?.steps?.[key] || {}; }
function majorStatus(key) { return st(key).status || "pending"; }

// 「正式环境」步的子流程(始终显示,逐个执行,执行一个显示一个结果)
const DEFAULT_REPOS = [{ name: "TripeaksClient" }, { name: "TripeaksResources" }, { name: "TripeaksJourneyConfig" }, { name: "TripeaksLevelConfig" }];
const runningSub = ref("");
const subStartMs = ref(0);
function fmtDur(ms) {
  if (ms == null) return "";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s`;
}
const subPlan = computed(() => {
  const repos = cfg.value.repos?.length ? cfg.value.repos : DEFAULT_REPOS;
  const list = [{ id: "feishu", name: "拉取飞书发版内容", title: "拉取飞书发版内容", cmd: "飞书 MQL:查询本周该项目 version 及其 stories" }];
  repos.forEach(r => list.push({
    id: "repo:" + r.name, name: r.name, title: `${r.name} 拉取最新提交`,
    cmd: `cd ${r.name}\ngit checkout -f ${r.branch || "?"}\ngit clean -df\ngit pull --rebase origin ${r.branch || "?"}\ngit submodule update --init --recursive --force\ngit log -1`,
  }));
  list.push({ id: "check:res", name: "检查资源", title: "检查资源", cmd: "cd TripeaksClient\n./compile.coffee res --all\ngit status  # 编译后是否有改动" });
  list.push({ id: "check:table", name: "检查配置表", title: "检查配置表", cmd: "cd TripeaksClient\n./compile.coffee table\ngit status  # 编译后是否有改动" });
  list.push({ id: "check:level", name: "检查关卡", title: "检查关卡", cmd: "cd TripeaksClient\n./compile.coffee level\ngit status  # 编译后是否有改动" });
  list.push({ id: "ota", name: "打ota并发消息", title: "打ota并发消息", cmd: "外部操作:打 ota 并发消息(当前仅标记完成,暂不实际执行)" });
  return list;
});
function subOf(name) { return (st("prepare").subs || []).find(x => x.name === name); }
const prepareCols = [
  { title: "子流程", slot: "sub", width: 300 },
  { title: "用时", slot: "dur", width: 90 },
  { title: "结果", slot: "result" },
];
const prepareRows = computed(() => subPlan.value.map(s => {
  const r = subOf(s.name);
  const running = runningSub.value === s.id;
  const ms = running ? (nowMs.value - subStartMs.value) : (r?.ms ?? null);
  return {
    id: s.id, title: s.title, cmd: s.cmd, running,
    dur: fmtDur(ms),
    result: r ? (r.ok ? (r.result || "完成") : (r.error || "失败")) : "",
    detail: r && !r.ok ? (r.detail || "") : "",
    fail: r ? !r.ok : false,
  };
}));

const recordCols = [
  { title: "日期", key: "date", width: 100 },
  { title: "平台", key: "platform", width: 80 },
  { title: "版本号", key: "version", width: 120 },
  { title: "发版内容", slot: "content", minWidth: 240 },
  { title: "Resource commit", key: "commit", minWidth: 160 },
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
    platform: "ota",
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
    else { stopPoll(); flow.value = null; }
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
  startPoll();
}
function startPoll() {
  stopPoll();
  poll = setInterval(async () => {
    if (!flow.value) return;
    try { flow.value = await getJson(`/api/release/flows/${flow.value.id}`); } catch {}
  }, 3000);
}
function stopPoll() { if (poll) { clearInterval(poll); poll = null; } }

onMounted(async () => {
  await loadActive();
  ready.value = true;
  tick = setInterval(() => { nowMs.value = Date.now(); maybeAutoQuery(); }, 1000);
});
onUnmounted(() => { stopPoll(); if (tick) clearInterval(tick); });

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

async function doPrepare(m) {
  await run("op", async () => {
    let ok = true;
    for (const s of subPlan.value) {
      runningSub.value = s.id; subStartMs.value = Date.now(); nowMs.value = Date.now();
      try { setFlow(await postJson(`/api/release/flows/${flow.value.id}/prepare/sub`, { stepKey: m.key, sub: s.id, operator: operator.value })); }
      finally { runningSub.value = ""; }
      if (!subOf(s.name)?.ok) { ok = false; break; }
    }
    setFlow(await postJson(`/api/release/flows/${flow.value.id}/step`, { stepKey: m.key, status: ok ? "done" : "failed", operator: operator.value }));
    if (ok) await afterDone(m.key);
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

    <Alert type="info" show-icon banner>「正式环境」步骤真实执行(拉飞书内容 + 拉取各仓库);其余步骤暂为模拟数据。</Alert>

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
          <!-- 1 正式环境(拉取飞书内容 + 拉取各仓库最新提交,子流程表格) -->
          <template v-if="selMajor.kind === 'prepare'">
            <Table :columns="prepareCols" :data="prepareRows" border size="small" style="margin-bottom:10px">
              <template #sub="{ row }">
                <span>{{ row.title }}</span>
                <Tooltip placement="right" transfer max-width="440" class="cmd-tip">
                  <Icon type="ios-information-circle-outline" />
                  <template #content><pre class="cmd-pre">{{ row.cmd }}</pre></template>
                </Tooltip>
              </template>
              <template #dur="{ row }"><span class="muted">{{ row.dur }}</span></template>
              <template #result="{ row }">
                <span v-if="row.running" class="muted">执行中…</span>
                <template v-else>
                  <span class="result-text" :class="{ err: row.fail }">{{ row.result }}</span>
                  <Tooltip v-if="row.detail" placement="left" transfer max-width="480" class="cmd-tip">
                    <Icon type="ios-information-circle-outline" />
                    <template #content><pre class="cmd-pre">{{ row.detail }}</pre></template>
                  </Tooltip>
                </template>
              </template>
            </Table>
            <Button v-if="majorStatus(selMajor.key) !== 'done'" type="primary" :loading="busy.op" @click="doPrepare(selMajor)">
              {{ majorStatus(selMajor.key) === 'failed' ? '重试' : '启动:拉取并检查' }}
            </Button>
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

          <!-- 9 数数倒计时 -->
          <template v-else-if="selMajor.kind === 'shushu'">
            <div class="muted">倒计时结束后自动从数数查询最新版本近 2 天的报错信息(server 执行)。</div>
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
            <template v-else>
              <div class="result">
                查询完成:版本 {{ st(selMajor.key).result?.version }} · 近 {{ st(selMajor.key).result?.days }} 天
                <Tag :color="(st(selMajor.key).result?.total || 0) ? 'error' : 'success'">
                  {{ (st(selMajor.key).result?.total || 0) ? `${st(selMajor.key).result.total} 条报错` : '无报错' }}
                </Tag>
              </div>
            </template>
          </template>
        </Card>
      </div>
    </div>
  </template>
</template>

<style scoped>
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
.rail-title { font-size: 13px; }
.badge { width: 22px; height: 22px; flex: none; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; color: #fff; background: #c5c8ce; }
.badge.done { background: #19be6b; }
.badge.running { background: #2d8cf0; }
.badge.failed { background: #ed4014; }
.detail { flex: 1; min-width: 0; }
.cmd-tip { margin-left: 6px; color: #808695; cursor: help; }
.cmd-pre { margin: 0; white-space: pre-wrap; word-break: break-all; font-size: 12px; line-height: 1.5; }
.result-text { white-space: pre-wrap; word-break: break-all; }
.err { color: #ed4014; }
.result { margin-top: 8px; }
.multiline { white-space: pre-line; padding: 4px 0; }
.countdown { font-size: 32px; font-weight: 600; margin: 12px 0; font-variant-numeric: tabular-nums; }
.log { background: #f7f7f7; padding: 8px; margin-top: 8px; white-space: pre-wrap; word-break: break-all; font-size: 12px; }
</style>
