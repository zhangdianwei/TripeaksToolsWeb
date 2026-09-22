<script setup>

import { ref, computed, watch, onMounted, onUnmounted } from "vue";

import BingoTest from "./components/BingoTest.vue";
import ScavengeMap from "./components/ScavengeMap.vue";
import MonsterMazeMap from "./components/MonsterMazeMap.vue";
import EasyShushu from "./components/EasyShushu.vue";
import DogRun from "./components/DogRun.vue";
import BuriedBounty from "./components/BuriedBounty.vue";
import PlayableAds from "./components/PlayableAds.vue";
import ReleaseFlow from "./components/ReleaseFlow.vue";
import BackgroundTasks from "./components/BackgroundTasks.vue";
import SnakesLadders from "./components/SnakesLadders.vue";

const PageConfigs = [
  { name: "蛇梯地图编辑器", comp: SnakesLadders },
  { name: "小狗快跑地图编辑器", comp: DogRun },
  { name: "敲格子UI编辑器", comp: BuriedBounty },
  { name: "PlayableAds", comp: PlayableAds },
  { name: "后台任务", comp: BackgroundTasks },
  { name: "发版流程", comp: ReleaseFlow },
  { name: "数数（程序版）", comp: EasyShushu },
];

const PageNames = computed(() => PageConfigs.map((x) => x.name));
const routeKey = (x) => x.comp.__name || x.comp.name || x.name;
function pageFromHash() {
  const k = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  return PageConfigs.find((x) => routeKey(x) === k || x.name === k);
}
const selectedPageName = ref((pageFromHash() || PageConfigs[PageConfigs.length - 1]).name);
const selectedPage = computed(() => PageConfigs.find((x) => x.name == selectedPageName.value));

watch(selectedPageName, (n) => {
  const p = PageConfigs.find((x) => x.name === n);
  if (p) location.hash = routeKey(p);
});
function onHashChange() {
  const p = pageFromHash();
  if (p) selectedPageName.value = p.name;
}
onMounted(() => {
  window.addEventListener("hashchange", onHashChange);
  if (selectedPage.value) location.hash = routeKey(selectedPage.value);
});
onUnmounted(() => window.removeEventListener("hashchange", onHashChange));
</script>

<template>
  选择功能：
  <Select v-model="selectedPageName" size="large">
    <Option v-for="name in PageNames" :value="name"></Option>
  </Select>

  <Card>
    <component v-if="selectedPage" :is="selectedPage.comp"></component>
  </Card>



</template>
