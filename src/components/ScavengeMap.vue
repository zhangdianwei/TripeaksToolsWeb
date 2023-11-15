<script setup>
import { ref, reactive, computed } from "vue";

const count_poster_item = ref(0);
const count_bigbox = ref(0);
const count_smallbox = ref(2);
const count_gift = ref(5);
const count_coin = ref(4);
const count_prop = ref(3);
const count_iron = ref(6);
const count_soil = computed(() => {
    return 42 - count_poster_item.value - count_bigbox.value - count_smallbox.value - count_coin.value - count_prop.value - count_iron.value - count_gift.value;
});

const results = reactive([])
const plain_results = computed(() => {
    let ret = [];
    for (let r = 0; r < results.length; r++) {
        let row = results[r];
        ret = ret.concat(row);
    }
    return ret;
});

function img_of(t) {
    return `scavenge/spring_scavenge_main_dikuai${t}.png`
}

// const count_smallbox = ref(2);

function rand_int(start, end) {
    return Math.floor(Math.random() * (end - start) + start);
}

function rand_rc_big() {
    return [rand_int(0, 5), rand_int(0, 6)];
}

function rand_rc() {
    return [rand_int(0, 6), rand_int(0, 7)];
}

function onClickGenerate() {
    results.length = 0;
    for (let r = 0; r < 6; r++) {
        let row = [];
        results.push(row);
        for (let c = 0; c < 7; c++) {
            row.push(0);
        }
    }

    // 找个地方把海报物品放进去
    if (count_poster_item.value > 0) {
        let [r, c] = rand_rc_big();
        results[r][c] = 8;
        results[r][c + 1] = 8;
        results[r + 1][c] = 8;
        results[r + 1][c + 1] = 8;
    }

    // 找个地方把大宝箱放进去
    if (count_bigbox.value > 0) {
        let [r, c] = rand_rc_big();
        results[r][c] = 7;
        results[r][c + 1] = 7;
        results[r + 1][c] = 7;
        results[r + 1][c + 1] = 7;
    }

    // 硬石头格子放进去
    let count = count_iron.value;
    while (count > 0) {
        let [r, c] = rand_rc();
        if (!results[r][c]) {
            results[r][c] = 3;
            count -= 1;
        }
    }

    // 金币格子放进去
    count = count_coin.value;
    while (count > 0) {
        let [r, c] = rand_rc();
        if (!results[r][c]) {
            results[r][c] = 5;
            count -= 1;
        }
    }

    // 矿石格子放进去
    count = count_prop.value;
    while (count > 0) {
        let [r, c] = rand_rc();
        if (!results[r][c]) {
            results[r][c] = 4;
            count -= 1;
        }
    }

    // 小宝箱格子放进去
    count = count_smallbox.value;
    while (count > 0) {
        let [r, c] = rand_rc();
        if (!results[r][c]) {
            results[r][c] = 9;
            count -= 1;
        }
    }

    // 礼包格子放进去
    count = count_gift.value;
    while (count > 0) {
        let [r, c] = rand_rc();
        if (!results[r][c]) {
            results[r][c] = 6;
            count -= 1;
        }
    }

    // 所有剩余的都填充土格子
    for (let r = 0; r < results.length; r++) {
        const row = results[r];
        for (let c = 0; c < row.length; c++) {
            const col = row[c];
            if (!col)
                row[c] = 2;
        }
    }
}

</script>

<template>
    <div class="simple-grid">
        <div class="simple-grid__cell simple-grid__cell--1/4">
            <v-text-field label="海报物品数量" v-model="count_poster_item" />
            <v-text-field label="大宝箱的数量" v-model="count_bigbox" />
            <v-text-field label="小宝箱的数量" v-model="count_smallbox" />
            <v-text-field label="礼包格子数量" v-model="count_gift" />
            <v-text-field label="金币格子数量" v-model="count_coin" />
            <v-text-field label="矿石格子数量" v-model="count_prop" />
            <v-text-field label="石头格子数量" v-model="count_iron" />
            <v-text-field label="无奖励的数量" v-model="count_soil" />
        </div>
        <div class="grid">
            <div v-for="tile in plain_results" class="grid-item">
                <v-img :src="img_of(tile)"></v-img>
            </div>
        </div>
        <div style="width: 20px;"></div>

        <div>
            <div v-for="row in results">
                [{{ row.join(",") }}]
            </div>
        </div>
    </div>
    <div>

    </div>
    <v-btn @click="onClickGenerate">生成</v-btn>
</template>

<style scoped>
.simple-grid {
    display: flex;

    margin-left: -0.25rem;
    margin-right: -0.25rem;
}

.simple-grid__cell {
    padding-left: 0.25rem;
    padding-right: 0.25rem;
}

.simple-grid__cell--fill {
    flex: 1;
}

/* Cell with given width */
.simple-grid__cell--1\/2 {
    flex: 0 0 50%;
}

.simple-grid__cell--1\/3 {
    flex: 0 0 33.3333333%;
}

.simple-grid__cell--1\/4 {
    flex: 0 0 25%;
}

.grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-template-rows: repeat(6, 1fr);
    gap: 0px;
    /* 可选的网格间距 */
}

.grid-item {
    background-color: lightgray;
    padding: 0px;
    text-align: center;
}
</style>
