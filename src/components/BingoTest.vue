<script setup>
import { ref, reactive, computed } from "vue";
import * as lodash from "lodash"

class SimulateAny {
  constructor() {
    this.total_sim_count = 2;
    this.total_ball_count = 30;
    this.ball_hit_count = 4;
    this.sim_per_frame = 1000;
    this.map_count = 1; //同时模拟几张图

    this.siming = false; //正在模拟中
    this.want_stop = false; //外部想让模拟中断

    this.on_progress = null;
    this.on_finish = null;

    this.bingo_results = [];
  }

  start() {
    this.siming = true;
    this.want_stop = false;
    this.bingo_results = [];
    this.inter = window.setInterval(this.check_sim_frame.bind(this), 20);
  }

  check_sim_frame() {
    if (this.want_stop) {
      window.clearInterval(this.inter);
      this.siming = false;
      this.on_finish();
      return;
    }

    for (let i = 0; i < this.sim_per_frame; ++i) {
      let result = this.sim_one();
      this.bingo_results.push(result);

      if (this.bingo_results.length >= this.total_sim_count) {
        break;
      }
    }
    if (this.on_progress)
      this.on_progress();

    if (this.bingo_results.length >= this.total_sim_count) {
      window.clearInterval(this.inter);
      this.siming = false;
      this.on_finish();
      return;
    }
  }

  sim_one() {

    // 生成2张地图
    let maps = [];
    for (let i = 0; i < this.map_count; ++i) {
      maps.push(genBingoMap());
    }

    // 从所有maps里挑出可以随机的数字
    let plain_pool = []
    for (let i = 0; i < maps.length; ++i) {
      plain_pool = plain_pool.concat(maps[i]);
    }
    plain_pool = plain_pool.filter((x) => x != 0);
    plain_pool = new Set(plain_pool);
    plain_pool = Array.from(plain_pool);

    let hit_balls = genRandomInt(plain_pool, this.ball_hit_count);
    let unhit_balls = getRandomIntExcept(this.total_ball_count - hit_balls.length, plain_pool);
    let total_balls = hit_balls.concat(unhit_balls);
    total_balls = lodash.shuffle(total_balls);

    let bingo = false;
    let left_balls = total_balls.concat([]);
    while (left_balls.length > 0) {
      let value = left_balls.shift();
      for (let i = 0; i < maps.length; ++i) {
        combineMap(maps[i], [value]);
      }

      bingo = maps.every((map) => judgeMapBingo(map));
      if (bingo) {
        break;
      }
    }



    return {
      maps: maps,
      bingo: bingo,
      total_balls,
      left_balls,
    };
  }
}

function setMergeArray(set, array) {
  for (let i = 0; i < array.length; ++i) {
    set.add(array[i]);
  }
}

// total_sim_count
// ball_hit_count
// bingo_count
const sim_history = reactive([]);
const total_sim_count = ref(10000);
const total_ball_count = ref(30);
const ball_hit_count = ref(4);
const total_map_count = ref(1);
const show_last_result = ref(false); //显示部分模拟结果

let sim_proc = reactive(new SimulateAny());
sim_proc.on_finish = function () {
  if (sim_proc.want_stop)
    return;
  sim_history.push({
    total_sim_count: sim_proc.total_sim_count,
    ball_hit_count: sim_proc.ball_hit_count,
    map_count: sim_proc.map_count,
    bingo_count: sim_proc.bingo_results.filter((result) => result.bingo).length,
    bingo_results: sim_proc.bingo_results,
  })
};

function onClickSim() {
  if (sim_proc.siming) {
    sim_proc.want_stop = true;
  }
  else {
    if (!total_sim_count.value || !ball_hit_count.value || !total_map_count.value || !total_ball_count.value) {
      return;
    }
    sim_proc.total_sim_count = total_sim_count.value;
    sim_proc.ball_hit_count = ball_hit_count.value;
    sim_proc.map_count = total_map_count.value;
    sim_proc.total_ball_count = total_ball_count.value;
    sim_proc.start();
  }
}

function genBingoMap() {
  let pool = [];
  for (let i = 0; i < 75; ++i) {
    pool.push(i + 1);
  }

  let map = genRandomInt(pool, 25);
  map[12] = 0;

  return map;
}

// 从pool里，随机挑出count个数
function genRandomInt(pool, count) {
  pool = pool.concat([])

  let result = [];
  for (let i = 0; i < count; ++i) {
    let index = Math.floor(Math.random() * pool.length);
    let num = pool.splice(index, 1)[0];
    result.push(num);
  }

  return result;
}

// 获取[1,75]的随机数字，但是不包含在except_ints里
function getRandomIntExcept(count, except_ints) {
  let pool = [];
  for (let i = 0; i < 75; ++i) {
    if (except_ints.indexOf(i + 1) < 0) {
      pool.push(i + 1);
    }
  }

  return genRandomInt(pool, count);
}

function combineMap(map, random_balls) {
  for (let i = 0; i < map.length; ++i) {
    if (random_balls.indexOf(map[i]) >= 0)
      map[i] = 0;
  }
}

function getLeftBallDesc(bingo_results) {
  let bingos = bingo_results.filter((result) => result.bingo);
  let counts = [];
  bingos.forEach((result) => {
    let index = result.left_balls.length;
    if (index >= 10) {
      index = 10;
    }

    if (!counts[index]) {
      counts[index] = 0;
    }
    counts[index] += 1;
  });

  let total_ball = 0; //总共剩余几个球
  bingos.forEach((result) => {
    let index = result.left_balls.length;
    total_ball += index;
  });


  let desc = "剩余球数量[";
  counts.forEach((count, i) => {
    desc += `${i}=${(100 * count / bingos.length).toFixed(2)}%;`;
  });
  desc += "]";

  desc += `平均数=${(total_ball / bingos.length).toFixed(2)}`;
  return desc;
}

function judgeMapBingo(map) {
  let winMap = [[1, 2, 3, 4, 5], [6, 7, 8, 9, 10], [11, 12, 13, 14, 15], [16, 17, 18, 19, 20], [21, 22, 23, 24, 25],
  [1, 6, 11, 16, 21], [2, 7, 12, 17, 22], [3, 8, 13, 18, 23], [4, 9, 14, 19, 24], [5, 10, 15, 20, 25],
  [1, 7, 13, 19, 25], [5, 9, 13, 17, 21]
  ];

  for (let i = 0; i < winMap.length; ++i) {
    let pattern = winMap[i];
    let bingo = pattern.every((pi) => map[pi - 1] == 0);
    if (bingo)
      return true;
  }
  return false;
}

</script>

<template>
  <div class="card">
    <div>
      <v-text-field label="总共模拟的次数" v-model="total_sim_count"></v-text-field>
    </div>
    <div>
      <v-text-field label="总共有多少个球" v-model="total_ball_count"></v-text-field>
    </div>
    <div>
      <v-text-field label="每次击中几个球" v-model="ball_hit_count"></v-text-field>
    </div>
    <div>
      <v-text-field label="同时模拟几张图" v-model="total_map_count"></v-text-field>
    </div>
    <v-btn @click="onClickSim">{{ sim_proc.siming ? "停止模拟" : "开始模拟(每秒能模拟5w次)" }}</v-btn>
    <div v-if="sim_proc.siming">
      <progress :max="sim_proc.total_sim_count" :value="sim_proc.bingo_results.length"></progress>
    </div>
  </div>

  <ol>
    <li v-for="result in sim_history">
      {{ result.map_count }}张地图，模拟了{{ result.total_sim_count }}次，总共有{{ result.total_ball_count }}个球，每次{{
        result.ball_hit_count }}个球击中，bingo了{{
    result.bingo_count }}次，胜率={{ (result.bingo_count / result.total_sim_count * 100).toFixed(2) }}%，剩余球数量={{
    getLeftBallDesc(result.bingo_results) }}
    </li>
  </ol>

  <div style="height: 10px;"></div>
</template>
