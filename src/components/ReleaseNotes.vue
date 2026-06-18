<script setup>
import { ref } from "vue";
import { Button, DatePicker, Alert, Tag, Table, Select, Option, Divider, Message } from "view-ui-plus";

const loading = ref(false);
const errorMsg = ref("");
const selectedDate = ref(new Date());
const weekStart = ref("");
const weekEnd = ref("");
const queryDate = ref("");
const groups = ref([]);
const otaMap = ref({});
const resourceCommit = ref("");
const releaserMap = ref({});

const RELEASERS = ["张殿伟", "赵谦", "王若冲", "王红", "焦红业"];

const SHEET_URLS = {
  TP1: "https://docs.google.com/spreadsheets/d/1Pymj_iLeIWo4nvpdefsBLzC8y1iA-FUEPK9oT0rEqjs/edit?gid=2016334865#gid=2016334865",
  TP4: "https://docs.google.com/spreadsheets/d/1Pymj_iLeIWo4nvpdefsBLzC8y1iA-FUEPK9oT0rEqjs/edit?gid=98731370#gid=98731370",
};

const filling = ref({});

const columns = [
  { title: "日期", key: "date", width: 110 },
  { title: "平台", key: "platform", width: 130 },
  { title: "版本号", key: "version", width: 140 },
  { title: "发版人", slot: "releaser", width: 130 },
  { title: "发版内容", slot: "content", minWidth: 320 },
  { title: "TripeaksResource 仓库 commit id", slot: "commit", minWidth: 320 },
];

function pad2(n) { return String(n).padStart(2, "0"); }
function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function fmtDot(s) {
  if (!s) return "";
  const [y, m, d] = s.split("-");
  return `${y}.${Number(m)}.${Number(d)}`;
}
function groupText(g) {
  return g.stories.map((name, i) => `${i + 1}. ${name}`).join("\n");
}
function rowOf(g) {
  const ota = otaMap.value[g.project] || {};
  return {
    project: g.project,
    date: queryDate.value,
    platform: g.needPackage ? "ota/ios/android" : "ota",
    version: ota.version ? `${g.project.toLowerCase()}/${ota.version}` : "",
    content: groupText(g),
    commit: resourceCommit.value,
  };
}

async function getJson(url) {
  const resp = await fetch(url);
  const text = await resp.text();
  if (!resp.ok) {
    let msg = text;
    try { msg = JSON.parse(text).error || text; } catch {}
    throw new Error(msg);
  }
  return JSON.parse(text);
}

async function fillSheet(g) {
  if (filling.value[g.project]) return;
  filling.value[g.project] = true;
  try {
    const resp = await fetch("/api/gsheet/fill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project: g.project, row: rowOf(g), releaser: releaserMap.value[g.project] }),
    });
    const text = await resp.text();
    if (!resp.ok) {
      let msg = text;
      try { msg = JSON.parse(text).error || text; } catch {}
      throw new Error(msg);
    }
    Message.success(`${g.project} 已填写到表格`);
  } catch (err) {
    Message.error(String(err.message || err));
  } finally {
    filling.value[g.project] = false;
  }
}

async function load() {
  if (loading.value) return;
  loading.value = true;
  errorMsg.value = "";
  try {
    const date = selectedDate.value ? toDateStr(new Date(selectedDate.value)) : "";
    queryDate.value = fmtDot(date);
    const [rel, ota, res] = await Promise.allSettled([
      getJson(`/api/feishu/release?date=${date}`),
      getJson("/api/git/ota"),
      getJson("/api/git/resources"),
    ]);
    if (rel.status !== "fulfilled") throw rel.reason;

    weekStart.value = rel.value.weekStart;
    weekEnd.value = rel.value.weekEnd;
    groups.value = rel.value.groups || [];
    otaMap.value = ota.status === "fulfilled"
      ? Object.fromEntries((ota.value.results || []).map(r => [r.project, r]))
      : {};
    resourceCommit.value = res.status === "fulfilled" ? res.value.commit : "";
    for (const g of groups.value) {
      if (!releaserMap.value[g.project]) releaserMap.value[g.project] = RELEASERS[0];
    }
  } catch (err) {
    errorMsg.value = String(err.message || err);
    groups.value = [];
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Alert v-if="errorMsg" type="error" show-icon closable @on-close="errorMsg = ''">{{ errorMsg }}</Alert>

  <div class="toolbar">
    <span>选择日期</span>
    <DatePicker v-model="selectedDate" type="date" transfer style="width: 180px"
      placeholder="默认今天" />
    <Button type="primary" :loading="loading" @click="load">查询</Button>
    <span v-if="weekStart" class="week-label">本周 {{ weekStart }} ~ {{ weekEnd }}</span>
  </div>

  <template v-if="groups.length">
    <template v-for="(g, i) in groups" :key="g.project">
      <Divider v-if="i > 0" />
      <div class="group">
        <div class="group-title">
          <Tag color="blue">{{ g.project }}</Tag>
          <span class="version-name">{{ g.versionName }}</span>
          <Tag :color="g.needPackage ? 'error' : 'default'">
            {{ g.needPackage ? "需要发包" : "无需发包" }}
          </Tag>
        </div>
        <Table :columns="columns" :data="[rowOf(g)]" border size="small">
          <template #releaser="{ row }">
            <Select v-model="releaserMap[row.project]" transfer size="small">
              <Option v-for="r in RELEASERS" :key="r" :value="r">{{ r }}</Option>
            </Select>
          </template>
          <template #content="{ row }">
            <div class="cell-multiline">{{ row.content }}</div>
          </template>
          <template #commit="{ row }">
            <span class="cell-commit">{{ row.commit }}</span>
          </template>
        </Table>

        <div class="target-section">
          <div class="target-head">
            <h4>发版计划表</h4>
            <a :href="SHEET_URLS[g.project]" target="_blank" class="sheet-link">{{ SHEET_URLS[g.project] }}</a>
          </div>
          <Button type="primary" :loading="filling[g.project]" @click="fillSheet(g)">填写到表格</Button>
        </div>
      </div>
    </template>
  </template>
  <div v-else-if="!loading && !errorMsg" class="empty">本周无发版内容</div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.week-label {
  margin-left: 8px;
  color: #808695;
}
.group {
  margin-top: 16px;
}
.group-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.version-name {
  font-size: 16px;
  font-weight: 600;
}
.cell-multiline {
  white-space: pre-line;
  padding: 6px 0;
}
.cell-commit {
  word-break: break-all;
}
.target-section {
  margin-top: 12px;
}
.target-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.target-head h4 {
  margin: 0;
}
.sheet-link {
  word-break: break-all;
}
.empty {
  padding: 24px;
  text-align: center;
  color: #c5c8ce;
}
</style>
