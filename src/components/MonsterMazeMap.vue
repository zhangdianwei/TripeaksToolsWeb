<script setup>
import { ref, reactive, computed } from "vue";

const mapDataOrigin = ref("");
const mapData = computed(() => {
    let linesOrigin = mapDataOrigin.value.split("\n").filter((x) => x);
    let ret = [];
    for (let i = 0; i < linesOrigin.length; ++i) {
        try {
            let tmp = JSON.parse(linesOrigin[i]);
            ret.push(tmp);
        }
        catch (ex) {
            return [];
        }
    }
    return ret;
});

function img_of(tileType) {
    return `/monster_maze/monster_maze_item_${tileType}.png`;
}

</script>

<template>
    <v-container>
        <v-row>
            <v-col>
                <v-textarea label="地图数据(对应monster_maze_map表)" v-model="mapDataOrigin"></v-textarea>
            </v-col>
            <v-col>
                <!-- <v-img src="/monster_maze/monster_maze_main_gezi.png" class="cross"></v-img> -->
                <v-row v-for="row in mapData" :no-gutters="true">
                    <v-col v-for="tile in row">
                        <v-img :src="img_of(tile)"></v-img>
                    </v-col>
                </v-row>
            </v-col>
        </v-row>
    </v-container>
</template>

<style>
.cross {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 1;
}
</style>