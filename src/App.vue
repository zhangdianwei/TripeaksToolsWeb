<script setup>

import { ref, reactive, computed } from "vue";

import BingoTest from "./components/BingoTest.vue";
import ScavengeMap from "./components/ScavengeMap.vue";
import MonsterMazeMap from "./components/MonsterMazeMap.vue";
import EasyShushu from "./components/EasyShushu.vue";

const PageConfigs = [
  // { name: "BingoTest", comp: BingoTest },
  // { name: "ScavengeMap", comp: ScavengeMap },
  // { name: "MonsterMazeMap", comp: MonsterMazeMap },
  { name: "EasyShushu", comp: EasyShushu },
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
