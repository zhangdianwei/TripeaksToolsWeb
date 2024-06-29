<script setup>
import { forIn } from "lodash";
import { ref, reactive, computed, onMounted, shallowRef, watch } from "vue";
import { Image, Text, Group } from "konva"

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
            type: 6,
            grade: 100,
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

function onClickAddMapTile(tileIndex) {
    var pre = mapData.value.tiles[tileIndex];
    var cur = JSON.parse(JSON.stringify(pre));
    mapData.value.tiles.splice(tileIndex + 1, 0, cur);
}

function onClickSubMapTile(tileIndex) {
    mapData.value.tiles.splice(tileIndex, 1);
}

function onClickAddMapBlock(index) {
    var pre = mapData.value.blocks[index] || { type: 1 };
    var cur = JSON.parse(JSON.stringify(pre));
    mapData.value.blocks.splice(index + 1, 0, cur);
}

function onClickSubMapBlock(index) {
    var group = blockLayerRef.value.getNode().findOne(`#block${index}`);
    group.remove();
    mapData.value.blocks.splice(index, 1);
}


watch(mapData.value.tiles, () => {
    refreshTileLayer();
});
watch(mapData.value.blocks, () => {
    refreshBlockLayer();
});


function refreshTileLayer() {
    var mapObj = mapData.value;
    var tileLayer = tileLayerRef.value.getNode();

    tileLayer.removeChildren();

    var tiles = mapObj.tiles;

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

        if (mapTile.type == TileType.Platform || mapTile.type == TileType.CliffEnd) {
            mapTile.grade |= 0;
            y -= mapTile.grade;
        }

        const objY = y;

        var image = new Image({
            image: tileConfig.image,
            x: objX,
            y: objY,
            // draggable: true,
        })
        tileLayerRef.value.getNode().add(image);

        var simpleText = new Text({
            x: objX + tileConfig.width / 2,
            y: objY + tileConfig.height / 2,
            text: i + 1 + "",
            fontSize: 100,
        });
        tileLayerRef.value.getNode().add(simpleText);
    }
}

function refreshBlockLayer() {
    var mapObj = mapData.value;
    var layer = blockLayerRef.value.getNode();
    let blocks = mapObj.blocks;

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
            myIndex: index,
            id: `block${index}`,
            x, y,
        });
        layer.add(group);
    }

    for (let i = 0; i < blocks.length; i++) {
        const blockData = blocks[i];
        const blockConfig = BlockConfig[blockData.type];
        var group = layer.getChildren()[i];
        group.setAttrs({
            id: `block${i}`,
        })

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
        <Collapse model-value="2">
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
                            <Col :span="10" v-if="mapTile.grade != null">
                            <Tooltip content="高台高度">
                                <InputNumber v-model="mapTile.grade" :number="true" :step="100"></InputNumber>
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
        </Collapse>
        </Col>
    </Row>
</template>
