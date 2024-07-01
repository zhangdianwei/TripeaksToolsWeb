<script setup>
import { ref, reactive, computed, onMounted, shallowRef, watch } from "vue";
import { Image, Text, Group } from "konva"
import ViewUIPlus from 'view-ui-plus'

const TileType = {
    Empty: 0,
    Road: 1,
    SlopeDown: 2,
    SlopeUp: 3,
    CliffStart: 4,
    CliffEnd: 5,
    Platform: 6,
    Random: 10,
}
const BlockType = {
    StyleA: 1,
    StyleB: 2,
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
    "0": {
        img: "dog_run/dog_run_lu_0.png",
        width: 200,
        height: 600,
        name: "空",
    },
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
    "10": {
        img: "dog_run/dog_run_lu_10.png",
        width: 605,
        height: 620,
        name: "随机地块",
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
const mapData = ref({
    blocks: [
        {
            type: 1,
        }
    ],
    startPos: { x: 0, y: 0 },
    tiles: [
        {
            type: 1,
        },
        {
            type: 10,
        },
        {
            type: 0,
        },
        {
            type: 0,
        },
        {
            type: 0,
        },
        {
            type: 0,
        },
        {
            type: 0,
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

function onClickExport() {
    var res = JSON.parse(JSON.stringify(mapData.value));
    delete res.startPos;
    for (let i = 0; i < res.tiles.length; i++) {
        const element = res.tiles[i];
        element.t = element.type;
        delete element.type;
        if (element.rands.length == 0) {
            delete element.rands;
        }
        if (element.platOffsetY == 0) {
            delete element.platOffsetY;
        }
    }

    var children = blockLayerRef.value.getNode().getChildren().concat([]);
    children = children.sort((a, b) => {
        return a.x() - b.x();
    });
    for (let i = 0; i < res.blocks.length; i++) {
        const element = res.blocks[i];
        element.t = element.type;
        delete element.type;
        element.x = Math.floor(children[i].x());
        element.y = Math.floor(children[i].y());
    }
    // console.log(res);
    ViewUIPlus.Copy({ text: JSON.stringify(res) });
}

function onClickAddMapTile() {
    if (!selectedData.value) {
        return;
    }
    var tileIndex = selectedData.value.index;
    var pre = mapData.value.tiles[tileIndex];
    var cur = JSON.parse(JSON.stringify(pre));
    cur.platOffsetY = 0;
    mapData.value.tiles.splice(tileIndex + 1, 0, cur);
    selected.value = [];
}

function onClickSubMapTile() {
    if (!selectedData.value) {
        return;
    }
    var tileIndex = selectedData.value.index;
    mapData.value.tiles.splice(tileIndex, 1);
    selected.value = [];
}

function onClickAddMapBlock() {
    if (selectedData.value) {
        var index = selectedData.value.index;
    }
    else {
        var index = 0;
    }
    var pre = mapData.value.blocks[index] || { type: 1 };
    var cur = JSON.parse(JSON.stringify(pre));
    mapData.value.blocks.splice(index + 1, 0, cur);
    selected.value = [];
    refreshBlockLayer();
}

function onClickSubMapBlock() {
    if (!selectedData.value) {
        return;
    }
    var index = selectedData.value.index;
    var group = blockLayerRef.value.getNode().findOne(`#block${index}`);
    if (!group) {
        return;
    }
    group.remove();
    mapData.value.blocks.splice(index, 1);
    selected.value = [];
    refreshBlockLayer();
}


watch(mapData.value.tiles, () => {
    refreshTileLayer();
});
watch(mapData.value.blocks, () => {
    refreshBlockLayer();
});


function refreshTileLayer() {
    var mapObj = mapData.value;
    var layer = tileLayerRef.value.getNode();

    layer.removeChildren();

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

        mapTile.platOffsetY |= 0;
        y -= mapTile.platOffsetY;

        const objY = y;

        var group = new Group({
            x: objX,
            y: objY,
            name: `tile select index${i}`,
            draggable: true,
        })
        group.myIndex = i;
        layer.add(group);

        var image = new Image({
            image: tileConfig.image,
        })
        group.add(image);

        var simpleText = new Text({
            x: tileConfig.width / 2,
            y: tileConfig.height / 2,
            text: i + 1 + "",
            fontSize: 100,
        });
        group.add(simpleText);
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
        group.myIndex = index;
        layer.add(group);
    }

    var children = layer.getChildren().concat([]);
    children = children.sort((a, b) => {
        return a.x() - b.x();
    });

    for (let i = 0; i < blocks.length; i++) {
        const blockData = blocks[i];
        const blockConfig = BlockConfig[blockData.type];
        var group = children[i];
        group = children[i];
        group.setAttrs({
            id: `block${i}`,
        })
        group.name("block select");
        group.myIndex = i;

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


const stageRef = shallowRef(null);
const tileLayerRef = shallowRef(null);
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

    window.tileLayerRef = tileLayerRef;
    window.stageRef = stageRef;
    window.mapData = mapData;
    refreshTileLayer();
    refreshBlockLayer();

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
});

function getParentCanSelect(shape) {
    var parent = shape;
    while (parent && !parent.hasName("select")) {
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
            index: element.myIndex,
        }
    }
    else {
        selectedData.value = null;
    }
});

const selectedData = ref(null);
const tileMenuEnabled = computed(() => {
    return selectedData.value && selectedData.value.shape.hasName("tile");
});
const blockMenuEnabled = computed(() => {
    return true;
    return selectedData.value && selectedData.value.shape.hasName("block");
});

const selectedMapTile = computed(() => {
    if (tileMenuEnabled.value) {
        return mapData.value.tiles[selectedData.value.index];
    }
    return null;
});
const selectedMapBlock = computed(() => {
    if (selectedData.value && selectedData.value.shape.hasName("block")) {
        return mapData.value.blocks[selectedData.value.index];
    }
    return null;
});

</script>

<template>
    <Row>
        <Col :span="16">
        <v-stage ref="stageRef" :config="{ width: 1136, height: 640, draggable: true }">
            <v-layer ref="tileLayerRef">
            </v-layer>
            <v-layer ref="blockLayerRef">
            </v-layer>
        </v-stage>
        </Col>
        <Col :span="8">

        <Divider>统计</Divider>
        <p>当前共有{{ mapData.tiles.length }}个地块</p>
        <p>当前共有{{ mapData.blocks.length }}个障碍</p>
        <Button @click="onClickExport">复制到剪贴板</Button>

        <Divider>地块操作</Divider>
        <ButtonGroup>
            <Button @click="onClickAddMapTile" :disabled="!tileMenuEnabled">添加地块</Button>
            <Button @click="onClickSubMapTile" :disabled="!tileMenuEnabled">删除地块</Button>
        </ButtonGroup>
        <template v-if="selectedMapTile">
            <div>地块类型</div>
            <Select v-model="selectedMapTile.type">
                <Option :value="0">空</Option>
                <Option :value="1">平地</Option>
                <Option :value="2">下坡</Option>
                <Option :value="3">上坡</Option>
                <Option :value="4">悬崖开始</Option>
                <Option :value="5">悬崖结束</Option>
                <Option :value="6">高台</Option>
                <Option :value="10">随机</Option>
            </Select>

            <div>额外高度偏移</div>
            <InputNumber v-model="selectedMapTile.platOffsetY" :step="100"></InputNumber>

            <template v-if="selectedMapTile.type == 10">
                <div>随机地块类型</div>
                <Select v-model="selectedMapTile.rands" :multiple="true">
                    <Option :value="0">空</Option>
                    <Option :value="1">平地</Option>
                    <Option :value="2">下坡</Option>
                    <Option :value="3">上坡</Option>
                    <Option :value="4">悬崖开始</Option>
                    <Option :value="5">悬崖结束</Option>
                    <Option :value="6">高台</Option>
                </Select>
            </template>

        </template>

        <Divider>障碍物操作</Divider>
        <ButtonGroup>
            <Button @click="onClickAddMapBlock" :disabled="!blockMenuEnabled">添加障碍</Button>
            <Button @click="onClickSubMapBlock" :disabled="!blockMenuEnabled">删除障碍</Button>
        </ButtonGroup>
        <template v-if="selectedMapBlock">
            <div>地块类型</div>
            <Select v-model="selectedMapBlock.type">
                <Option :value="1">障碍物A</Option>
                <Option :value="2">障碍物B</Option>
            </Select>
        </template>

        <!-- <Collapse model-value="2">
            <Panel>
                图块配置
                <template #content>

                    <template v-for="mapTile, i in mapData.tiles">
                        <Row>
                            <Col :span="1">
                            <p>{{ i + 1 }}</p>
                            </Col>
                            <Col :span="6">
                            <Select v-model="mapTile.type">
                                <Option :value="0">空</Option>
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
                            <Col :span="10" v-if="mapTile.platOffsetY != null">
                            <Tooltip content="高台高度">
                                <InputNumber v-model="mapTile.platOffsetY" :number="true" :step="100"></InputNumber>
                            </Tooltip>
                            </Col>
                        </Row>
                    </template>
                </template>
            </Panel>
            <Panel>
                障碍物配置
                <template #content>
                    <template v-if="mapData.blocks.length > 0">
                        <template v-for="blockData, i in mapData.blocks">
                            <Row>
                                <Col :span="1">
                                <p>{{ i + 1 }}</p>
                                </Col>
                                <Col :span="6">
                                <span>
                                    <Select v-model="blockData.type">
                                        <Option :value="1">障碍1</Option>
                                        <Option :value="2">障碍2</Option>
                                    </Select>
                                </span>
                                </Col>
                                <Col :span="4">
                                <Button @click="onClickAddMapBlock(i)">+</Button>
                                <Button @click="onClickSubMapBlock(i)">-</Button>
                                </Col>
                            </Row>
                        </template>

                    </template>
                    <template v-if="mapData.blocks.length == 0">
                        <Button @click="onClickAddMapBlock(null)">+</Button>
                    </template>
                </template>
            </Panel>
        </Collapse> -->
        </Col>
    </Row>
</template>
