<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { Button, Message } from "view-ui-plus";

const ACTION_LABEL = { query_jserror_report: "数数报错查询" };
const tasks = ref([]);
const nowMs = ref(Date.now());
let tick = null, poll = null;

async function getJson(url) {
  const r = await fetch(url); const t = await r.text();
  if (!r.ok) { let m = t; try { m = JSON.parse(t).error || t; } catch {} throw new Error(m); }
  return JSON.parse(t);
}
async function load() {
  try { tasks.value = (await getJson("/api/schedule?status=pending")).tasks || []; }
  catch (e) { Message.error(String(e.message || e)); }
}
async function cancel(id) {
  await fetch(`/api/schedule/${id}`, { method: "DELETE" });
  await load();
}
function pad2(n) { return String(n).padStart(2, "0"); }
function remain(t) {
  const ms = Math.max(0, Date.parse(t.dueAt) - nowMs.value);
  const s = Math.floor(ms / 1000);
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}
function label(t) { return ACTION_LABEL[t.action] || `${t.module}.${t.action}`; }
function desc(t) { const p = t.params || {}; return [p.project, p.version].filter(Boolean).join(" / "); }

onMounted(() => {
  load();
  tick = setInterval(() => { nowMs.value = Date.now(); }, 1000);
  poll = setInterval(load, 15000);
});
onUnmounted(() => { clearInterval(tick); clearInterval(poll); });
</script>

<template>
  <div class="bg-root">
    <div class="head">
      <h3>正在倒计时的后台任务</h3>
      <Button size="small" @click="load">刷新</Button>
    </div>
    <table class="tbl">
      <thead><tr><th>任务</th><th>对象</th><th>剩余</th><th>操作</th></tr></thead>
      <tbody>
        <tr v-for="t in tasks" :key="t.id">
          <td>{{ label(t) }}</td>
          <td>{{ desc(t) }}</td>
          <td class="cd">{{ remain(t) }}</td>
          <td><Button size="small" type="error" ghost @click="cancel(t.id)">取消</Button></td>
        </tr>
        <tr v-if="!tasks.length"><td colspan="4" class="empty">暂无正在倒计时的任务</td></tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.bg-root { max-width: 720px; }
.head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.head h3 { margin: 0; }
.tbl { width: 100%; border-collapse: collapse; }
.tbl th, .tbl td { border: 1px solid #e8eaec; padding: 8px 12px; text-align: left; }
.tbl th { background: #f8f9fb; color: #515a6e; font-weight: 500; }
.cd { font-variant-numeric: tabular-nums; }
.empty { text-align: center; color: #808695; }
</style>
