<script setup>
import { ref, reactive, computed, onMounted, shallowRef, watch } from "vue";
import { Image, Text, Group, Layer, Rect } from "konva"
import ViewUIPlus from 'view-ui-plus'
import VueKonva from "vue-konva"

const OffsetConfigY = {
    "1_2": 80,
    "1_3": -55,
    "1_4": 0,

    "2_1": 55,
    "2_2": 136,
    "2_3": 0,
    "2_4": 55,

    "3_1": -80,
    "3_3": -136,
    "3_4": -80,

    "5_1": 0,
    "5_2": 81,
    "5_3": -56,
}
const TileConfig = {
    "1": {
        img: "dog_run/dog_run_lu1_1.png",
        width: 606,
        height: 531,
        name: "平地",
    },
    "2": {
        img: "dog_run/dog_run_lu1_2.png",
        width: 606,
        height: 615,
        name: "下坡",
    },
    "3": {
        img: "dog_run/dog_run_lu1_3.png",
        width: 606,
        height: 615,
        name: "上坡",
    },
    "4": {
        img: "dog_run/dog_run_lu1_4.png",
        width: 606,
        height: 615,
        name: "悬崖开始",
    },
    "5": {
        img: "dog_run/dog_run_lu1_5.png",
        width: 606,
        height: 615,
        name: "悬崖结束",
    },
    "6": {
        img: "dog_run/dog_run_lu1_6.png",
        width: 520,
        height: 271,
        name: "高台",
    },
}
const BlockConfig = {
    "1": {
        img: "dog_run/block_stone.png",
        width: 180,
        height: 180,
    },
    "2": {
        img: "dog_run/block_stone2.png",
        width: 180,
        height: 180,
    }
}
const CoinConfig = {
    img: "common/common_item_0.png",
    width: 150,
    height: 150,
}

function getTileDefault() {
    return [
        {
            t: 1,
        },
        {
            t: 2,
        },
        {
            t: 1,
        },
        {
            t: 1,
        },
        {
            t: 3,
        },
        {
            t: 3,
        },
        {
            t: 3,
        },
        {
            t: 4,
        },
        {
            t: 6,
            platOffsetY: 200,
        },
        {
            t: 6,
        },
        {
            t: 6,
        },
        {
            t: 6,
        },
        {
            t: 6,
        },
        {
            t: 5,
            platOffsetY: -200,
        },
        {
            t: 1,
        },
        {
            t: 1,
        },
    ];
}

function getMapDefault() {
    return {
        startPos: { x: 0, y: 0 },
        tiles: getTileDefault(),
    }
}

const mapData = ref({
    maps: [
        {
            startPos: { x: 0, y: 0 },
            tiles: [
                { t: 1 },
                { t: 1 },
            ],
        },
        {
            startPos: { x: 1, y: 1 },
            tiles: [
                { t: 2 },
                { t: 2 },
            ],
        },
        {
            startPos: { x: 0, y: 0 },
            tiles: [
                { t: 1 },
                { t: 1 },
            ],
        },
        {
            startPos: { x: 1, y: 1 },
            tiles: [
                { t: 3 },
                { t: 3 },
            ],
        },
    ]
});

function getExportMapData() {
    var res = JSON.parse(JSON.stringify(mapData.value));
    for (let i = 0; i < res.maps.length; i++) {
        const map = res.maps[i];
        for (let j = 0; j < map.tiles.length; j++) {
            const tile = map.tiles[j];
            if (!tile.platOffsetY) {
                delete tile.platOffsetY;
            }
            if (!tile.b) {
                delete tile.b;
            }
            if (!tile.c) {
                delete tile.c;
            }
        }
    }
    return res;
}

function onClickCopy() {
    ViewUIPlus.Copy({ text: JSON.stringify(getExportMapData()) });
}

function onClickExport() {
    var text = JSON.stringify(getExportMapData());
    var blob = new Blob([text], { type: 'text/plain' });
    let a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = "map.json";
    a.click();
}

async function onClickImport(file) {
    try {
        selected.value = [];
        var text = await file.text();
        var obj = JSON.parse(text);
        // mapData.value = obj;
        mapData.value.maps = obj.maps;
    }
    catch (e) {
        console.error(e);
    }
    return false;
}

function onClickClearHistory() {
    localStorage.setItem("DogRun.mapData", null);
}

function onClickAddMapTile() {
    let { mapId, tileId } = selectedMapTileInfo.value;
    if (mapId == null) {
        return;
    }
    var mapObj = mapData.value.maps[mapId];
    var pre = mapObj.tiles[tileId];
    var cur = JSON.parse(JSON.stringify(pre));
    cur.platOffsetY = 0;
    mapObj.tiles.splice(tileId + 1, 0, cur);
    selected.value = [];
    refreshMapLayer();
}

function onClickSubMapTile() {
    let { mapId, tileId } = selectedMapTileInfo.value;
    if (mapId == null) {
        return;
    }
    var mapObj = mapData.value.maps[mapId];
    mapObj.tiles.splice(tileId, 1);
    selected.value = [];
    refreshMapLayer();
}

function onClickAddMap() {
    var { mapId, tileId } = selectedMapTileInfo.value;
    if (mapId == null) {
        return;
    }
    selected.value = [];

    var map = mapData.value.maps[mapId];
    var map = JSON.parse(JSON.stringify(map));
    mapData.value.maps.splice(mapId, 0, map);
}
function onClickSubMap() {
    var { mapId, tileId } = selectedMapTileInfo.value;
    if (mapId == null) {
        return;
    }

    selected.value = [];
    mapData.value.maps.splice(mapId, 1);
    // refreshMapLayer();
}


watch(mapData.value, () => {
    refreshMapLayer();
});
// watch(mapData.value.blocks, () => {
//     refreshBlockLayer();
// });


function refreshTileLayer(layer, mapObj, mapId) {

    var tiles = mapObj.tiles;

    for (let i = 0; i < tiles.length; i++) {
        const element = tiles[i];
        if (!element.rands == null) {
            element.rands = [];
        }
        if (element.platOffsetY == null) {
            element.platOffsetY = 0;
        }
    }

    var x = mapObj.startPos.x + 100;
    var y = mapObj.startPos.y + 640;
    for (let i = 0; i < tiles.length; i++) {
        const mapTile = tiles[i];
        const tileConfig = TileConfig[mapTile.t];
        const objX = x;
        x += tileConfig.width;

        let tileMapPre = null;
        let tileConfigPre = null;
        let offsetYName = ``;
        let offsetY = 0;
        if (i > 0) {
            tileMapPre = tiles[i - 1];
            tileConfigPre = TileConfig[tileMapPre.t];
            offsetYName = `${tileMapPre.t}_${mapTile.t}`;
            offsetY = OffsetConfigY[offsetYName] || 0;
        }
        y += offsetY;

        mapTile.platOffsetY |= 0;
        y -= mapTile.platOffsetY;

        const objY = y;

        var group = new Group({
            x: objX,
            y: objY,
        })
        group.index = i;
        group.isTile = true;
        group.mapId = mapId;
        group.tileId = i;
        layer.add(group);

        var image = new Image({
            image: tileConfig.image,
            x: 0,
            y: 640,
        })
        group.add(image);

        var simpleText = new Text({
            x: tileConfig.width / 2,
            y: tileConfig.height,
            text: i + 1 + "",
            fontSize: 200,
        });
        group.add(simpleText);

        if (mapTile.b) //有障碍
        {
            var block = new Image({
                image: BlockConfig[1].image,
                x: tileConfig.width / 2,
                y: tileConfig.height / 5,
                offsetX: BlockConfig[1].width / 2,
            })
            group.add(block);
        }

        if (mapTile.c) //有金币
        {
            var block = new Image({
                image: CoinConfig.image,
                x: tileConfig.width / 2,
                y: tileConfig.height / 5,
                offsetX: CoinConfig.width / 2,
                scale: { x: 0.5, y: 0.5 },
            })
            group.add(block);
        }
    }
}

function refreshBlockLayer() {
    var mapObj = mapData.value;
    var layer = blockLayerRef.value.getNode();
    let blocks = mapObj.blocks;

    // layer.removeChildren();

    while (layer.getChildren().length < blocks.length) {
        var index = layer.getChildren().length;
        var preGroup = null;
        if (index > 0) {
            preGroup = layer.getChildren()[index - 1];
        }

        var x = preGroup ? preGroup.x() + 100 : 100;
        var y = preGroup ? preGroup.y() + 50 : 100;
        var group = new Group({
            draggable: true,
            id: `block${index}`,
            x, y,
        });
        group.index = index;
        layer.add(group);
    }

    var children = layer.getChildren().concat([]);
    children = children.sort((a, b) => {
        return a.x() - b.x();
    });

    for (let i = 0; i < blocks.length; i++) {
        const blockData = blocks[i];
        const blockConfig = BlockConfig[blockData.t];
        var group = children[i];
        group = children[i];
        group.setAttrs({
            id: `block${i}`,
        })
        group.name("block select");
        group.index = i;

        var image = group.findOne("#myimage");
        var text = group.findOne("#mytext");

        if (!image) {
            image = new Image({
                id: "myimage",
            });
            group.add(image);
        }
        image.setAttrs({
            image: blockConfig.image,
        })

        if (!text) {
            text = new Text({
                fontSize: 100,
                id: "mytext",
            });
            group.add(text);
        }
        text.setAttrs({
            text: i + 1 + "",
            x: 0 + blockConfig.width / 2,
            y: 0 + blockConfig.height / 2,
        })

        // var image = new Image({
        //     image: blockConfig.image,
        //     x: 0,
        //     y: 0,
        // })
        // group.add(image);

        // var simpleText = new Text({
        //     x: 0 + blockConfig.width / 2,
        //     y: 0 + blockConfig.height / 2,
        //     text: i + 1 + "",
        //     fontSize: 100,
        // });
        // group.add(simpleText);
    }
}

function getRandColor() {
    var r = Math.floor(Math.random() * 255);
    var g = Math.floor(Math.random() * 255);
    var b = Math.floor(Math.random() * 255);
    return `rgb(${r},${g},${b})`;
}

function refreshMapLayer() {
    var stage = stageRef.value.getNode();
    stage.removeChildren();

    var layerHeight = 640 * 2;

    var y = 0;
    for (let i = 0; i < mapData.value.maps.length; i++) {
        const mapObj = mapData.value.maps[i];

        var layer = new Layer({
            x: 0,
            y: y,
            // draggable: true,
        });
        stage.add(layer);

        var guideRect = new Rect({
            x: 0,
            y: 0,
            width: 100,
            height: layerHeight * 2,
            fill: getRandColor(),
        });
        layer.add(guideRect);

        var simpleText = new Text({
            x: 0,
            y: layerHeight / 2,
            text: i + 1 + "",
            fontSize: 100,
        });
        layer.add(simpleText);

        refreshTileLayer(layer, mapObj, i);

        y += layerHeight * 2;
    }
}

const stageRef = shallowRef(null);
// const mapLayerRef = shallowRef(null);
const tileLayers = shallowRef([]);
const blockLayerRef = shallowRef(null);
const selected = ref([]);
onMounted(() => {
    for (const key in TileConfig) {
        const element = TileConfig[key];
        element.image = new window.Image();
        element.image.src = element.img;
    }
    for (const key in BlockConfig) {
        const element = BlockConfig[key];
        element.image = new window.Image();
        element.image.src = element.img;
    }

    CoinConfig.image = new window.Image();
    CoinConfig.image.src = CoinConfig.img;

    // window.mapLayerRef = mapLayerRef;
    window.stageRef = stageRef;
    window.stage = stageRef.value.getNode();
    window.mapData = mapData;
    window.VueKonva = VueKonva;
    refreshMapLayer();
    // refreshTileLayer();
    // refreshBlockLayer();

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

    stage.on('click', (e) => {
        var temp = [];
        var canSelectShape = getParentCanSelect(e.target);
        if (canSelectShape) {
            temp.push(canSelectShape);
        }
        selected.value = temp;
    });

    var history = localStorage.getItem('DogRun.mapData');
    try {
        var text = history;
        var obj = JSON.parse(text);
        mapData.value.maps = obj.maps;
    }
    catch (e) {
    }
    setInterval(() => {
        localStorage.setItem('DogRun.mapData', JSON.stringify(mapData.value));
    }, 5000);
});

function getParentCanSelect(shape) {
    var parent = shape;
    while (parent && !parent.isTile) {
        parent = parent.getParent();
    }
    return parent;
}


function makeSelectedMark(shape, mark) {

    if (mark) {
        var oldZIndex = shape.zIndex();
        shape.moveToTop();
        shape.oldZIndex = oldZIndex;
    }
    else {
        shape.zIndex(shape.oldZIndex);
    }

    for (let i = 0; i < shape.getChildren().length; i++) {
        const element = shape.getChildren()[i];

        if (mark) {
            element.shadowColor("red");
            element.shadowOffset({ x: 5, y: -5 });
            element.shadowBlur(3);
        }
        else {
            element.shadowColor("black");
            element.shadowOffset({ x: 0, y: 0 });
            element.shadowBlur(0);
        }
    }

}

watch(selected, (newValue, oldValue) => {
    if (oldValue) {
        for (let i = 0; i < oldValue.length; i++) {
            const element = oldValue[i];
            if (!element.getParent()) {
                continue;
            }
            makeSelectedMark(element, false);
        }
    }

    for (let i = 0; i < newValue.length; i++) {
        const element = newValue[i];
        makeSelectedMark(element, true);
    }

    var element = newValue[0];
    if (element) {
        selectedData.value = {
            shape: element,
            index: element.index,
        }
    }
    else {
        selectedData.value = null;
    }
});

const selectedData = ref(null);
const selectedShape = computed(() => {
    return selected.value[0];
});
const tileMenuEnabled = computed(() => {
    let { mapId, tileId } = selectedMapTileInfo.value;
    if (mapId == null) {
        return false;
    }
    if (tileId == null) {
        return false;
    }
    return true;
});
const tileMenu2Enabled = computed(() => {
    let { mapId, tileId } = selectedMapTileInfo.value;
    if (mapId == null) {
        return false;
    }
    if (tileId == null) {
        return false;
    }
    return mapData.value.maps[mapId].tiles.length > 1;
});
const mapMenuEnabled = computed(() => {
    return selectedData.value;
    return selectedData.value && selectedData.value.shape.hasName("tile");
});
const mapMenu2Enabled = computed(() => {
    return selectedData.value && mapData.value.maps.length > 1;
    return selectedData.value && selectedData.value.shape.hasName("tile");
});

const blockMenuEnabled = computed(() => {
    return true;
    return selectedData.value && selectedData.value.shape.hasName("block");
});

const selectedMapTile = computed(() => {
    let { mapId, tileId } = selectedMapTileInfo.value;
    if (mapId >= 0 && tileId >= 0) {
        return mapData.value.maps[mapId].tiles[tileId];
    }
    return null;
});
const selectedMapTileInfo = computed(() => {
    if (selectedShape.value) {
        return { mapId: selectedShape.value.mapId, tileId: selectedShape.value.tileId, node: selectedShape.value };
    }
    return {};
});

const coin1Count = computed(() => {
    let { mapId, tileId } = selectedMapTileInfo.value;
    if (mapId == null || tileId == null) {
        return 0;
    }
    var map = mapData.value.maps[mapId];
    let count = 0;
    for (let i = 0; i < map.tiles.length; i++) {
        const tile = map.tiles[i];
        if (tile.c == 1) {
            count += 1;
        }
    }
    return count;
});
const coin2Count = computed(() => {
    let { mapId, tileId } = selectedMapTileInfo.value;
    if (mapId == null || tileId == null) {
        return 0;
    }
    let map = mapData.value.maps[mapId];
    let count = 0;
    for (let i = 0; i < map.tiles.length; i++) {
        const tile = map.tiles[i];
        if (tile.c == 2) {
            count += 1;
        }
    }
    return count;
});
const coin3Count = computed(() => {
    let { mapId, tileId } = selectedMapTileInfo.value;
    if (mapId == null || tileId == null) {
        return 0;
    }
    let map = mapData.value.maps[mapId];
    let count = 0;
    for (let i = 0; i < map.tiles.length; i++) {
        const tile = map.tiles[i];
        if (tile.c == 3) {
            count += 1;
        }
    }
    return count;
});

const coin1TotalCount = computed(() => {
    let count = 0;
    for (let mapId = 0; mapId < mapData.value.maps.length; mapId++) {
        const map = mapData.value.maps[mapId];
        for (let i = 0; i < map.tiles.length; i++) {
            const tile = map.tiles[i];
            if (tile.c == 1) {
                count += 1;
            }
        }
    }
    return count;
});
const coin2TotalCount = computed(() => {
    let count = 0;
    for (let mapId = 0; mapId < mapData.value.maps.length; mapId++) {
        const map = mapData.value.maps[mapId];
        for (let i = 0; i < map.tiles.length; i++) {
            const tile = map.tiles[i];
            if (tile.c == 2) {
                count += 1;
            }
        }
    }
    return count;
});
const coin3TotalCount = computed(() => {
    let count = 0;
    for (let mapId = 0; mapId < mapData.value.maps.length; mapId++) {
        const map = mapData.value.maps[mapId];
        for (let i = 0; i < map.tiles.length; i++) {
            const tile = map.tiles[i];
            if (tile.c == 3) {
                count += 1;
            }
        }
    }
    return count;
});

</script>

<template>
    <Row>
        <Col :span="16">
        <v-stage ref="stageRef" :config="{ width: 1136, height: 640, draggable: true }">
            <!-- <v-layer ref="mapLayerRef">
            </v-layer>
            <v-layer :config="{ draggable: true, fill: 'red' }">
                <v-rect :config="{ width: 50, height: 640, fill: 'black', draggable: false }"></v-rect>
                <v-rect :config="{ width: 100, height: 640, fill: 'black', x: 200, draggable: false }"></v-rect>
            </v-layer>
            <v-layer :config="{ draggable: true, fill: 'red' }">
                <v-rect :config="{ width: 50, height: 640, fill: 'green', draggable: false }"></v-rect>
                <v-rect :config="{ width: 100, height: 640, fill: 'green', x: 200, draggable: false }"></v-rect>
            </v-layer>
            <v-layer :config="{ draggable: true, fill: 'red' }">
                <v-rect :config="{ width: 50, height: 640, fill: 'red', draggable: false }"></v-rect>
                <v-rect :config="{ width: 100, height: 640, fill: 'red', x: 200, draggable: false }"></v-rect>
            </v-layer>
            <v-layer ref="blockLayerRef">
            </v-layer> -->
        </v-stage>
        </Col>
        <Col :span="8">

        <Divider>统计</Divider>
        <p>当前共有{{ mapData.maps.length }}个地图段</p>
        <p>{{ coin1TotalCount }}个小金币，{{ coin2TotalCount }}个中金币，{{ coin3TotalCount }}个大金币</p>
        <Button @click="onClickCopy">复制到剪贴板</Button>
        <Button @click="onClickExport">下载地图</Button>
        <Upload :before-upload="onClickImport" action="" accept=".json">
            <Button>导入地图</Button>
        </Upload>
        <Button @click="onClickClearHistory">清除历史</Button>

        <Divider>地块操作</Divider>

        <div v-if="selectedData">
            共有小金币{{ coin1Count }}个，中金币{{ coin2Count }}个，大金币{{ coin3Count }}个。
        </div>

        <ButtonGroup>
            <Button @click="onClickAddMapTile" :disabled="!tileMenuEnabled">添加地块</Button>
            <Button @click="onClickSubMapTile" :disabled="!tileMenu2Enabled">删除地块</Button>
        </ButtonGroup>
        <br />
        <br />
        <ButtonGroup>
            <Button @click="onClickAddMap" :disabled="!mapMenuEnabled">添加地图段</Button>
            <Button @click="onClickSubMap" :disabled="!mapMenu2Enabled">删除地图段</Button>
        </ButtonGroup>

        <Divider>地块详细信息</Divider>

        <template v-if="selectedMapTile">

            <div>地块类型</div>
            <Select v-model="selectedMapTile.t">
                <Option :value="1">平地</Option>
                <Option :value="2">下坡</Option>
                <Option :value="3">上坡</Option>
                <Option :value="4">悬崖开始</Option>
                <Option :value="5">悬崖结束</Option>
                <Option :value="6">高台</Option>
            </Select>
            <div>额外高度偏移</div>
            <InputNumber v-model="selectedMapTile.platOffsetY" :step="100"></InputNumber>

            <!-- <div>
                <Checkbox v-model="selectedMapTile.b">是否有障碍</Checkbox>
            </div> -->

            <div>
                金币类型
                <!-- <Checkbox v-model="selectedMapTile.c">是否有金币</Checkbox> -->
                <Select v-model="selectedMapTile.c">
                    <Option :value="0">无</Option>
                    <Option :value="1">小金币</Option>
                    <Option :value="2">中金币</Option>
                    <Option :value="3">大金币</Option>
                </Select>
            </div>

        </template>

        </Col>
    </Row>
</template>
