<script setup>

import { ref, reactive, computed } from "vue";

import BingoTest from "./components/BingoTest.vue";
import ScavengeMap from "./components/ScavengeMap.vue";
import MonsterMazeMap from "./components/MonsterMazeMap.vue";
import EasyShushu from "./components/EasyShushu.vue";
import DogRun from "./components/DogRun.vue";
import BuriedBounty from "./components/BuriedBounty.vue";

const PageConfigs = [
  // { name: "BingoTest", comp: BingoTest },
  // { name: "ScavengeMap", comp: ScavengeMap },
  // { name: "MonsterMazeMap", comp: MonsterMazeMap },
  { name: "数数（程序版）", comp: EasyShushu },
  // { name: "小狗快跑地图编辑器", comp: DogRun },
  { name: "敲格子UI编辑器", comp: BuriedBounty },
];

const PageNames = computed(() => PageConfigs.map((x) => x.name));
const selectedPageName = ref(PageNames.value[PageNames.value.length - 1]);
const selectedPage = computed(() => PageConfigs.find((x) => x.name == selectedPageName.value));
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
