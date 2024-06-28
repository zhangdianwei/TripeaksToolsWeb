<script setup>
import { forIn } from "lodash";
import { ref, reactive, computed, onMounted, shallowRef, watch } from "vue";
import { Image } from "konva"

function onAnimationFrame(timestamp) {
    // requestAnimationFrame(onAnimationFrame);
    canvasRef.value.renderAll();
}

const TileType = {
    Road: 1,
    SlopeDown: 2,
    SlopeUp: 3,
    CliffStart: 4,
    CliffEnd: 5,
    Random: 10,
}

const OffsetConfigY = {
    "1_2": 0,
    "2_2": 99,
    "2_1": 100,
    "1_3": -86,
    "3_4": -12,
    "5_1": -12,
    "3_3": -100,
}

const TileConfig = {
    "1": {
        img: "dog_run/dog_run_lu_1.png",
        width: 605,
        height: 620,
        name: "平地",
    },
    "2": {
        img: "dog_run/dog_run_lu_5.png",
        width: 441,
        height: 619,
        name: "下坡",
    },
    "3": {
        img: "dog_run/dog_run_lu_4.png",
        width: 443,
        height: 605,
        name: "上坡",
    },
    "4": {
        img: "dog_run/dog_run_lu_2.png",
        width: 442,
        height: 708,
        name: "悬崖开始",
    },
    "5": {
        img: "dog_run/dog_run_lu_3.png",
        width: 356,
        height: 720,
        name: "悬崖结束",
    },
    "6": {
        img: "dog_run/dog_run_lu_6.png",
        width: 264,
        height: 251,
        name: "高台",
    },
}


const mapData = ref({
    startPos: { x: 0, y: 500 },
    tiles: [
        {
            type: 1,
        },
        {
            type: 1,
        },
        {
            type: 2,
        },
        {
            type: 2,
        },
        {
            type: 1,
        },
        {
            type: 1,
        },
        {
            type: 3,
        },
        {
            type: 3,
        },
        {
            type: 3,
        },
        {
            type: 4,
        },
        {
            type: 6,
        },
        {
            type: 6,
        },
        {
            type: 6,
        },
        {
            type: 6,
        },
        {
            type: 6,
        },
        {
            type: 5,
        },
        {
            type: 1,
        },
        {
            type: 1,
        },
    ]
});

function onClickAddMapTile(tileIndex) {
    var pre = mapData.value.tiles[tileIndex];
    var cur = JSON.parse(JSON.stringify(pre));
    mapData.value.tiles.splice(tileIndex + 1, 0, cur);
}

function onClickSubMapTile(tileIndex) {
    mapData.value.tiles.splice(tileIndex, 1);
}

watch(mapData.value.tiles, () => {
    console.log("mapData");
    refreshMap();
});


function refreshMap() {
    var mapObj = mapData.value;
    var canvas = canvasRef.value.getNode();

    var tiles = mapObj.tiles;

    canvas.removeChildren();
    // var objects = canvas.getObjects();
    // for (let i = 0; i < objects.length; i++) {
    //     const element = objects[i];
    //     canvas.remove(element);
    // }

    var x = 0;
    var y = mapObj.startPos.y;
    for (let i = 0; i < tiles.length; i++) {
        const mapTile = tiles[i];
        const tileConfig = TileConfig[mapTile.type];
        const objX = x;
        x += tileConfig.width;

        let tileMapPre = null;
        let tileConfigPre = null;
        let offsetYName = ``;
        let offsetY = 0;
        if (i > 0) {
            tileMapPre = tiles[i - 1];
            tileConfigPre = TileConfig[tileMapPre.type];
            offsetYName = `${tileMapPre.type}_${mapTile.type}`;
            offsetY = OffsetConfigY[offsetYName] || 0;
        }
        y += offsetY;
        const objY = y;
        const index = i;

        var image = new Image({
            image: tileConfig.image,
            x: objX,
            y: objY,
            // draggable: true,
        })
        canvasRef.value.getNode().add(image);
    }
}

const configCircle = ref({
    x: 100,
    y: 100,
    radius: 70,
    fill: 'red',
    stroke: 'black',
    strokeWidth: 4,
    draggable: true,
})

const stageRef = shallowRef(null);
const canvasRef = shallowRef(null);
onMounted(() => {
    for (const key in TileConfig) {
        const element = TileConfig[key];
        element.image = new window.Image();
        element.image.src = element.img;
    }



    window.canvasRef = canvasRef;
    window.stageRef = stageRef;
    refreshMap();

    var stage = stageRef.value.getNode();

    var scaleBy = 1.1;
    stage.on('wheel', (e) => {
        e.evt.preventDefault();

        var oldScale = stage.scaleX();
        var pointer = stage.getPointerPosition();

        var mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        // how to scale? Zoom in? Or zoom out?
        let direction = e.evt.deltaY > 0 ? 1 : -1;

        // when we zoom on trackpad, e.evt.ctrlKey is true
        // in that case lets revert direction
        if (e.evt.ctrlKey) {
            direction = -direction;
        }

        var newScale = direction < 0 ? oldScale * scaleBy : oldScale / scaleBy;

        stage.scale({ x: newScale, y: newScale });

        var newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        stage.position(newPos);
    });
});

</script>

<template>
    <Row>
        <Col :span="16">
        <v-stage ref="stageRef" :config="{ width: 1136, height: 640, draggable: true }">
            <v-layer ref="canvasRef">
            </v-layer>
        </v-stage>
        </Col>
        <Col :span="8">
        <Collapse model-value="1">
            <Panel>
                地图配置
                <template #content>
                    <template v-for="mapTile, i in mapData.tiles">
                        <Row>
                            <Col :span="6">
                            <Select v-model="mapTile.type">
                                <Option :value="1">平地</Option>
                                <Option :value="2">下坡</Option>
                                <Option :value="3">上坡</Option>
                                <Option :value="4">悬崖开始</Option>
                                <Option :value="5">悬崖结束</Option>
                                <Option :value="6">高台</Option>
                            </Select>
                            </Col>
                            <Col :span="4">
                            <Button @click="onClickAddMapTile(i)">+</Button>
                            <Button v-if="i > 0" @click="onClickSubMapTile(i)">-</Button>
                            </Col>
                        </Row>
                    </template>
                </template>
            </Panel>
        </Collapse>
        </Col>
    </Row>
</template>
