<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from "vue";
import { Button, Select, Option, Table, Card, Alert, Tag, Message, Modal, Spin, Tooltip, Icon, Checkbox } from "view-ui-plus";

const RELEASERS = ["张殿伟", "赵谦", "王若冲", "王红", "焦红业"];
const PROJECTS = ["TP1", "TP4"];
const SHEET_URLS = {
  TP1: "https://docs.google.com/spreadsheets/d/1Pymj_iLeIWo4nvpdefsBLzC8y1iA-FUEPK9oT0rEqjs/edit?gid=2016334865#gid=2016334865",
  TP4: "https://docs.google.com/spreadsheets/d/1Pymj_iLeIWo4nvpdefsBLzC8y1iA-FUEPK9oT0rEqjs/edit?gid=98731370#gid=98731370",
};
// 大流程定义(autosubs 类型的小流程由 SUB_PLANS 定义、后端逐个执行)
const FLOWS = {
  regular: [
    { key: "prepare", title: "发版前流程", kind: "autosubs", plan: "prepare", endpoint: "prepare", runLabel: "启动流程" },
    { key: "pkg", title: "打正式包", kind: "external", when: "needPackage", pkgProd: true, confirm: "你真的打正式包了吗？", desc: "这里的完成只做标记,不会自动调用 Jenkins 也不会发消息" },
    { key: "push", title: "推送线上", kind: "external", confirm: "你真的推送线上了吗？", desc: "这里的完成只做标记,不会自动调用 Jenkins 也不会发消息" },
    { key: "shushu", title: "数数报错", kind: "shushu" },
    { key: "post", title: "发版后流程", kind: "autosubs", plan: "post", endpoint: "post", runLabel: "启动流程" },
  ],
};

const SHUSHU_MINUTES = [5, 10, 15, 20, 30, 60];

const errorMsg = ref("");
const project = ref("TP1");
const releaser = ref(RELEASERS[0]);
const flow = ref(null);
const cfg = ref({});
const operator = ref(RELEASERS[0]);
const busy = reactive({});
const ready = ref(false);
const sel = ref("");
const nowMs = ref(Date.now());
let tick = null;

// 数数报错查询:内嵌流程,项目/版本取自流程;立即→/api/release/jserror-report,延时→/api/schedule
const sh = reactive({ minutes: 30, notify: true, last: null, deadline: 0, schedId: "" });
const shCountdown = computed(() => {
  const left = sh.deadline - nowMs.value;
  if (left <= 0) return "";
  const s = Math.floor(left / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
});

function condMet(when) { return when === "needPackage" ? !!flow.value?.context?.needPackage : true; }
const majors = computed(() => (FLOWS[flow.value?.flowType] || FLOWS.regular).filter(m => !m.when || condMet(m.when)));
const selMajor = computed(() => majors.value.find(m => m.key === sel.value) || majors.value[0]);

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
    const list = [{ id: "feishu", name: "拉取飞书发版内容", title: "拉取飞书发版内容", optional: true, cmd: "查询飞书本周发版内容\nversion / 需求列表 / 是否发包" }];
    repos.forEach(r => {
      const b = r.branch || "?";
      list.push({
        id: "repo:" + r.name, name: r.name, title: `更新${r.name}`, optional: true,
        cmd: `git fetch origin ${b}\ngit checkout -f ${b}\ngit reset --hard origin/${b}\ngit clean -df\ngit submodule update --init --recursive --force`,
      });
    });
    list.push({ id: "check:res", name: "检查资源", title: "检查资源", optional: true, cmd: "./compile.coffee res --all\ngit status" });
    list.push({ id: "check:table", name: "检查配置表", title: "检查配置表", optional: true, cmd: "./compile.coffee table\ngit status" });
    list.push({ id: "check:level", name: "检查关卡", title: "检查关卡", optional: true, cmd: "./compile.coffee level\ngit status" });
    list.push({ id: "ota", name: "打ota", title: "打ota", optional: true, cmd: "触发 Jenkins 打 ota(等构建开始拿版本号)\nbranch=beta production=true\nsyncTable=false syncLevels=false alert=true" });
    list.push({ id: "otamsg", name: "通知到群", title: "通知到群", optional: true, cmd: "发飞书研发群:今日发版 / 是否发包 / 发版内容 / 版本号,可以smoke" });
    return list;
  },
  post: (c) => {
    const mg = c.merge || {};
    const f = mg.from || "beta", t = mg.to || "prod";
    return [
      { id: "updateclient", name: "更新TripeaksClient", title: "更新TripeaksClient", optional: true, cmd: `对齐到最新 ${f}\ngit fetch/checkout -f/reset --hard/clean/submodule\ngit log -1` },
      { id: "checkversion", name: "检查版本号一致性", title: "检查版本号一致性", optional: true, cmd: `grep client ${f} 的 production 版本号\n与发布版本比对,不一致则失败(暂停)` },
      { id: "merge", name: "beta合并到prod", title: "beta合并到prod", optional: true, cmd: `对齐 ${t} → merge --no-ff origin/${f}(强制留合并提交) → 打 tag <项目>/<发布版本>\n已合并则跳过` },
      { id: "record", name: "填写发版记录", title: "填写发版记录", optional: true, cmd: "查发版记录表是否已有该版本;没有则写入一行(含 ResourcesCommit)" },
      { id: "notify", name: "通知发版完毕", title: "通知发版完毕", optional: true, cmd: "发飞书研发群:客户端发版完毕 + 版本号" },
    ];
  },
};
const curSubs = computed(() => selMajor.value?.plan ? (SUB_PLANS[selMajor.value.plan]?.(cfg.value) || []) : []);
function subOf(stepKey, name) { return (st(stepKey).subs || []).find(x => x.name === name); }
const subCols = [
  { title: "子流程", slot: "sub", width: 300 },
  { title: "用时", slot: "dur", width: 90 },
  { title: "结果", slot: "result" },
];
const subRows = computed(() => curSubs.value.map(s => {
  const r = subOf(selMajor.value.key, s.name);
  const running = runningSub.value === s.id;
  const ms = running ? (nowMs.value - subStartMs.value) : (r?.ms ?? null);
  const skipped = s.optional && subSkip[s.id];
  return {
    id: s.id, title: s.title, cmd: s.cmd, running, optional: !!s.optional,
    dur: fmtDur(ms),
    result: r ? (r.ok ? (r.result || "完成") : (r.error || "失败")) : (skipped ? "未选,将跳过" : ""),
    detail: r && !r.ok ? (r.detail || "") : "",
    fail: r ? !r.ok : false,
  };
}));

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
    const f = await postJson("/api/release/flows", { project: project.value, creator: releaser.value, flowType: "regular" });
    await enterFlow(f.id);
  });
}
async function enterFlow(id) {
  const f = await getJson(`/api/release/flows/${id}`);
  operator.value = f.creator || RELEASERS[0];
  try { cfg.value = await getJson(`/api/release/config?project=${f.project}`); } catch { cfg.value = {}; }
  flow.value = f;
  const ms = (FLOWS[f.flowType] || []).find(m => (f.steps[m.key]?.status || "pending") !== "done");
  sel.value = (ms || (FLOWS[f.flowType] || [])[0])?.key || "";
  await restoreShushu();
}

onMounted(async () => {
  await loadActive();
  ready.value = true;
  tick = setInterval(() => { nowMs.value = Date.now(); }, 1000);
});
onUnmounted(() => { if (tick) clearInterval(tick); });

// ============ 大流程操作 ============
function setFlow(f) { flow.value = f; }

// 完成最后一个大流程时结束整个流程(不再自动跳转到下一步)
async function afterDone(key) {
  const i = majors.value.findIndex(m => m.key === key);
  if (majors.value[i + 1]) return;
  setFlow(await postJson(`/api/release/flows/${flow.value.id}/done`, { operator: operator.value }));
  Message.success("流程已完成");
}

// 批处理:依次跑勾选的子流程;跳过已完成的(支持继续);暂停只拦未开始的,进行中的跑完。
const paused = ref(false);
function pauseFlow() { paused.value = true; }
async function doAutoSubs(m) {
  paused.value = false;
  await run("op", async () => {
    const plan = SUB_PLANS[m.plan]?.(cfg.value) || [];
    let failed = false;
    for (const s of plan) {
      if (s.optional && subSkip[s.id]) continue;
      if (subOf(m.key, s.name)?.ok) continue;
      if (paused.value) break;
      runningSub.value = s.id; subStartMs.value = Date.now(); nowMs.value = Date.now();
      try { setFlow(await postJson(`/api/release/flows/${flow.value.id}/${m.endpoint}/sub`, { stepKey: m.key, sub: s.id, operator: operator.value })); }
      finally { runningSub.value = ""; }
      if (!subOf(m.key, s.name)?.ok) { failed = true; break; }
    }
    const allDone = plan.every(s => (s.optional && subSkip[s.id]) || subOf(m.key, s.name)?.ok);
    const status = allDone ? "done" : (failed ? "failed" : "running");
    setFlow(await postJson(`/api/release/flows/${flow.value.id}/step`, { stepKey: m.key, status, operator: operator.value }));
    if (allDone) await afterDone(m.key);
  });
}
function confirmComplete(m) {
  if (!m.confirm) return completeExternal(m);
  Modal.confirm({ title: "确认", content: m.confirm, okText: "确定", cancelText: "取消", onOk: () => completeExternal(m) });
}
async function completeExternal(m) {
  await run("op_" + m.key, async () => {
    setFlow(await postJson(`/api/release/flows/${flow.value.id}/step`, { stepKey: m.key, status: "done", operator: operator.value }));
    await afterDone(m.key);
  });
}
async function shushuSubmit(m) {
  const version = flow.value?.context?.releaseVersion;
  if (!version) { Message.warning("未记录发布版本(请先完成打 ota)"); return; }
  await run("shushu", async () => {
    const params = { project: flow.value.project, version: String(version), notify: sh.notify };
    if (sh.minutes > 0) {
      const t = await postJson("/api/schedule", { delayMs: sh.minutes * 60000, module: "release", action: "query_jserror_report", params, createdBy: operator.value });
      sh.deadline = Date.parse(t.dueAt); sh.schedId = t.id;
    } else {
      sh.last = await postJson("/api/release/jserror-report", params);
      Message.success("查询完成" + (sh.notify ? ",已通知群" : ""));
    }
    setFlow(await postJson(`/api/release/flows/${flow.value.id}/step`, { stepKey: m.key, status: "done", operator: operator.value }));
    await afterDone(m.key);
  });
}
async function shushuCancel() {
  if (sh.schedId) await fetch(`/api/schedule/${sh.schedId}`, { method: "DELETE" }).catch(() => {});
  sh.deadline = 0; sh.schedId = "";
}
async function restoreShushu() {
  sh.deadline = 0; sh.schedId = "";
  const ver = flow.value?.context?.releaseVersion;
  if (!ver) return;
  const list = (await getJson("/api/schedule?status=pending&action=query_jserror_report").catch(() => ({}))).tasks || [];
  const t = list.find(x => x.params?.project === flow.value.project && String(x.params?.version) === String(ver));
  if (t) { sh.deadline = Date.parse(t.dueAt); sh.schedId = t.id; sh.notify = !!t.params?.notify; }
}
function closeFlow(id) {
  if (flow.value?.status === "done") { flow.value = null; return; } // 已跑完,直接关闭
  Modal.confirm({
    title: "关闭流程", content: "确定要关闭这个发版流程吗?", okText: "关闭流程", cancelText: "取消",
    onOk: () => run("close", async () => { await postJson(`/api/release/flows/${id}/abort`, { operator: operator.value }); await loadActive(); }),
  });
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
        <Button type="primary" long size="large" :loading="busy.create" @click="createFlow">新建发版流程</Button>
      </Card>
    </div>
  </template>

  <!-- 态二:进行中流程 → 向导 -->
  <template v-else>
    <div class="topbar">
      <Tag color="blue">{{ flow.project }}</Tag>
      <span class="muted">{{ flow.id }}</span>
      <Tag v-if="flow.status !== 'active'" color="default" style="margin-left:auto">{{ flow.status }}</Tag>
      <Button type="error" ghost :loading="busy.close" :style="flow.status === 'active' ? 'margin-left:auto' : ''" @click="closeFlow(flow.id)">关闭流程</Button>
    </div>

    <div class="titlebar">
      <span class="muted">发版人</span> <b>{{ operator }}</b>
      <span class="muted" style="margin-left:20px">是否发包</span> <b :class="{ relver: flow.context?.needPackage }">{{ flow.context?.needPackage == null ? '-' : (flow.context.needPackage ? '是' : '否') }}</b>
      <span class="muted" style="margin-left:20px">发布版本</span> <b class="relver">{{ flow.context?.releaseVersion || '-' }}</b>
    </div>

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
              <template #result="{ row }">
                <span v-if="row.running" class="muted">执行中…</span>
                <template v-else-if="row.id === 'record'">
                  <template v-if="row.fail">
                    <span class="result-text err">{{ row.result }}</span>
                    <Tooltip v-if="row.detail" placement="left" transfer max-width="480" class="cmd-tip"><Icon type="ios-information-circle-outline" /><template #content><pre class="cmd-pre">{{ row.detail }}</pre></template></Tooltip>
                  </template>
                  <a v-else-if="row.result" :href="SHEET_URLS[flow.project]" target="_blank">{{ SHEET_URLS[flow.project] }}</a>
                </template>
                <template v-else>
                  <span class="result-text" :class="{ err: row.fail }">{{ row.result }}</span>
                  <Tooltip v-if="row.detail" placement="left" transfer max-width="480" class="cmd-tip">
                    <Icon type="ios-information-circle-outline" />
                    <template #content><pre class="cmd-pre">{{ row.detail }}</pre></template>
                  </Tooltip>
                </template>
              </template>
            </Table>
            <Button v-if="busy.op" type="warning" @click="pauseFlow">暂停</Button>
            <Tag v-else-if="majorStatus(selMajor.key) === 'done'" color="success">已完成</Tag>
            <Button v-else type="primary" @click="doAutoSubs(selMajor)">
              {{ majorStatus(selMajor.key) === 'running' ? '继续' : majorStatus(selMajor.key) === 'failed' ? '重试' : (selMajor.runLabel || '启动流程') }}
            </Button>
          </template>

          <!-- 外部操作:打ota / 推送 / 通知 / 打包 / 改代码 -->
          <template v-else-if="selMajor.kind === 'external'">
            <div v-if="selMajor.pkgProd && cfg.pkgProdJenkins" class="muted">打正式包 Jenkins:<a :href="cfg.pkgProdJenkins" target="_blank">{{ cfg.pkgProdJenkins }}</a></div>
            <div v-if="selMajor.key === 'push' && cfg.pushJenkins" class="muted">推送线上 Jenkins:<a :href="cfg.pushJenkins" target="_blank">{{ cfg.pushJenkins }}</a></div>
            <div v-if="selMajor.desc" class="muted">{{ selMajor.desc }}</div>
            <Button v-if="majorStatus(selMajor.key) !== 'done'" type="success" :loading="busy['op_' + selMajor.key]" @click="confirmComplete(selMajor)">完成</Button>
            <Tag v-else color="success">已完成</Tag>
          </template>

          <!-- 数数报错:立即查询,或启动倒计时(倒计时为独立后台任务,流程结束后仍继续) -->
          <template v-else-if="selMajor.kind === 'shushu'">
            <div v-if="!flow.context?.releaseVersion" class="err">未记录发布版本(请先完成打 ota),无法查询数数。</div>
            <template v-else>
              <template v-if="shCountdown">
                <div class="frow"><label>倒计时</label><span class="relver">{{ shCountdown }}</span></div>
                <div class="frow"><label>通知</label><span>{{ sh.notify ? '查询后通知客户端群' : '不通知' }}</span></div>
                <div class="frow"><Button @click="shushuCancel">取消倒计时</Button></div>
                <div class="muted">倒计时是独立后台任务,发版流程结束后仍会继续,可在【后台任务】页查看或取消。</div>
              </template>
              <template v-else>
                <div class="frow">
                  <label>时机</label>
                  <Select v-model="sh.minutes" transfer style="width:220px">
                    <Option :value="0">立即查询</Option>
                    <Option v-for="x in SHUSHU_MINUTES" :key="x" :value="x">{{ x }} 分钟后</Option>
                  </Select>
                </div>
                <div class="frow"><label>通知</label><Checkbox v-model="sh.notify" style="white-space:nowrap">查询后通知客户端群</Checkbox></div>
                <div class="frow">
                  <Button type="primary" :loading="busy.shushu" @click="shushuSubmit(selMajor)">{{ sh.minutes ? `启动倒计时(${sh.minutes} 分钟后)` : '立即查询' }}</Button>
                  <Tag v-if="majorStatus(selMajor.key) === 'done'" color="success">已完成</Tag>
                </div>
                <div v-if="sh.last" class="muted">✅ {{ sh.last.version }} · app_start {{ sh.last.appStartUsers }} 人 · 报错 {{ sh.last.total }} 条{{ sh.notify ? ' · 已通知群' : '' }}</div>
              </template>
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
.topbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 8px; }
.titlebar { padding: 8px 12px; background: #f8f9fb; border-radius: 6px; margin-bottom: 12px; }
.relver { font-size: 20px; color: #A61B29; }
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
.kv-k { width: 124px; flex: none; color: #808695; }
.kv-v { flex: 1; min-width: 0; white-space: pre-wrap; word-break: break-all; }
.err { color: #ed4014; }
.result { margin-top: 8px; }
.multiline { white-space: pre-line; padding: 4px 0; }
.log { background: #f7f7f7; padding: 8px; margin-top: 8px; white-space: pre-wrap; word-break: break-all; font-size: 12px; }
</style>
