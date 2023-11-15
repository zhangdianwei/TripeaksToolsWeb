<script setup>

import { ref, reactive, computed } from "vue";

import BingoTest from "./components/BingoTest.vue";
import ScavengeMap from "./components/ScavengeMap.vue";
import MonsterMazeMap from "./components/MonsterMazeMap.vue";

const PageConfigs = [
  { name: "BingoTest", value: BingoTest },
  { name: "ScavengeMap", value: ScavengeMap },
  { name: "MonsterMazeMap", value: MonsterMazeMap },
]
const PageNames = computed(() => PageConfigs.map((x) => x.name))
const selectedPage = ref(PageNames.value[PageNames.value.length - 1]);

</script>

<template>
  <v-select label="选择功能" :items="PageNames" v-model="selectedPage"></v-select>
  <v-divider></v-divider>
  <v-window v-model="selectedPage">
    <v-window-item v-for="cfg in PageConfigs" :value="cfg.name">
      <component :is="cfg.value"></component>
    </v-window-item>
  </v-window>
</template>
