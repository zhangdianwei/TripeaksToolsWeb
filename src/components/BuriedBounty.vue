<template>
    <div class="buried-bounty-editor">
        <Tabs :animated="false" class="full-tabs">
            <TabPane label="高级设置" name="advanced">
                <div class="advanced-settings full-advanced">
                    <label style="display:block;margin-bottom:4px;">高级设置：</label>
                    <div class="treasure-list-scroll">
                        <Row gutter="8" v-for="item in treasures" :key="item.id" style="margin-bottom:4px;align-items:center;">
                            <Col :span="4">
                                <Tooltip placement="right">
                                    <template #content>
                                        <img :src="treasureImg(item.id)" style="width:96px;height:96px;object-fit:contain;box-shadow:0 2px 8px #aaa;background:#fff;border-radius:6px;" />
                                    </template>
                                    <img :src="treasureImg(item.id)" style="width:32px;height:32px;object-fit:contain;cursor:pointer;vertical-align:middle;border-radius:4px;background:#fff;box-shadow:0 1px 3px #eee;" />
                                </Tooltip>
                            </Col>
                            <Col :span="6"><span>宝藏{{ item.id }} 大小：</span></Col>
                            <Col :span="6">
                                <InputNumber v-model="item.size[0]" :min="1" :max="5" style="width:60px" />
                            </Col>
                            <Col :span="2" style="text-align:center;">x</Col>
                            <Col :span="6">
                                <InputNumber v-model="item.size[1]" :min="1" :max="5" style="width:60px" />
                            </Col>
                        </Row>
                    </div>
                    <div style="margin-top:12px;text-align:right;">
                        <Button @click="showAdvancedModal = true">显示高级设置</Button>
                    </div>
                    <Modal v-model="showAdvancedModal" title="高级设置 JSON" :footer-hide="true" width="600" class="advanced-modal">
                        <div class="advanced-modal-content">
                            <div class="advanced-modal-title">
                                <Icon type="ios-settings" style="color:#2d8cf0;font-size:22px;margin-right:8px;" />
                                <span>高级设置 JSON</span>
                            </div>
                            <textarea readonly :value="advancedJson" class="advanced-json-textarea" spellcheck="false" @focus="e=>e.target.select()"></textarea>
                            <div class="advanced-modal-btns">
                                <Button type="primary" @click="copyAdvanced">复制到剪贴板</Button>
                                <Button @click="showAdvancedModal = false">关闭</Button>
                            </div>
                        </div>
                    </Modal>
                </div>
            </TabPane>
            <TabPane label="关卡编辑" name="main">
                <div class="settings-bar">
                    <div class="level-settings">
                        <label>地图大小：</label>
                        <InputNumber v-model="level.gridN" :min="2" :max="12" style="width:60px" /> x
                        <InputNumber v-model="level.gridM" :min="2" :max="12" style="width:60px" />
                    </div>
                    <div class="treasure-settings">
                        <label>选择宝藏：</label>
                        <Select v-model="selectedTreasures" multiple style="min-width:120px;max-width:200px;">
                            <Option v-for="item in treasures" :key="item.id" :value="item.id">
                                宝藏{{ item.id }}
                            </Option>
                        </Select>
                        <span v-if="selectedTreasures.length">（共{{ selectedTreasures.length }}个）</span>
                    </div>
                    <Button type="primary" @click="generateArrangements">生成</Button>
                    <Button @click="saveLevel">保存</Button>
                    <Button @click="showResult">显示结果</Button>
                </div>
                <div class="main-content">
                    <div class="arrangement-list">
                        <h3>排列组合</h3>
                        <div v-if="arrangements.length === 0">无</div>
                        <ul>
                            <li v-for="(arr, idx) in arrangements" :key="arr.id"
                                :class="{ selected: idx === selectedArrangementIndex }">
                                <span @click="selectArrangement(idx)">组合{{ idx + 1 }}</span>
                                <Button size="small" type="error" @click="deleteArrangement(idx)">删除</Button>
                            </li>
                        </ul>
                    </div>
                    <div class="map-area">
                        <div class="map-grid" :style="mapGridStyle">
                            <div v-for="row in level.gridN" :key="row" class="map-row">
                                <div v-for="col in level.gridM" :key="col" class="map-cell" :style="cellStyle(row - 1, col - 1)">
                                    <img :src="tileImg" class="tile-bg" />
                                    <template v-for="(t, tIdx) in currentArrangement.treasures">
                                        <img v-if="isTreasureOnCell(t, row - 1, col - 1)" :src="treasureImg(t.treasureId)"
                                            :class="['treasure-img', t.rotated ? 'rotated' : '']" :style="treasureStyle(t)" />
                                    </template>
                                </div>
                            </div>
                        </div>
                        <div class="rotation-settings">
                            <h4>宝藏旋转设置</h4>
                            <div v-for="tid in selectedTreasures" :key="tid">
                                <span>宝藏{{ tid }}</span>
                                <label>
                                    <Checkbox v-model="rotationSettings[tid]">旋转90°</Checkbox>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-if="showResultModal" class="result-modal">
                    <h3>全局结果</h3>
                    <textarea readonly :value="JSON.stringify(globalResults, null, 2)"
                        style="width:90%;height:300px"></textarea>
                    <Button @click="copyResult">复制到剪贴板</Button>
                    <Button @click="showResultModal = false">关闭</Button>
                </div>
            </TabPane>
        </Tabs>
    </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { Row, Col, InputNumber, Select, Option, Button, Checkbox, Tabs, TabPane, Tooltip, Modal, Icon } from 'view-ui-plus'

const tileImg = 'buried_bounty/tile.png'
function treasureImg(id) {
    return `buried_bounty/item/item_${id}_1.png`
}

const sizeOptions = [ [2,1], [1,2], [2,2], [1,1] ]
const treasures = reactive(
    Array.from({ length: 23 }, (_, i) => ({
        id: i + 1,
        size: sizeOptions[i % sizeOptions.length].slice(),
    }))
)

const level = reactive({ gridN: 6, gridM: 6 })
const selectedTreasures = ref([1, 2])
const rotationSettings = reactive({})
const arrangements = ref([])
const selectedArrangementIndex = ref(0)
const globalResults = ref([])
const showResultModal = ref(false)

const showAdvancedModal = ref(false)
const advancedJson = computed(() => JSON.stringify(treasures.map(t => ({ id: t.id, size: t.size })), null, 2))
function copyAdvanced() {
    navigator.clipboard.writeText(advancedJson.value)
    alert('已复制到剪贴板')
}

const mapGridStyle = computed(() => ({
    display: 'grid',
    gridTemplateRows: `repeat(${level.gridN}, 40px)`,
    gridTemplateColumns: `repeat(${level.gridM}, 40px)`,
    gap: '2px',
    background: '#ddd',
    margin: '0 auto',
    border: '1px solid #aaa',
    width: `${level.gridM * 42}px`,
    height: `${level.gridN * 42}px`,
    position: 'relative',
}))

function cellStyle(row, col) {
    return {
        width: '40px',
        height: '40px',
        position: 'relative',
        border: '1px solid #bbb',
        boxSizing: 'border-box',
        overflow: 'hidden',
    }
}

const currentArrangement = computed(() => {
    if (arrangements.value.length === 0) {
        return { treasures: [] }
    }
    return arrangements.value[selectedArrangementIndex.value] || { treasures: [] }
})

function isTreasureOnCell(t, row, col) {
    const tr = treasures.find(tt => tt.id === t.treasureId)
    if (!tr) return false
    const [w, h] = t.rotated ? [tr.size[1], tr.size[0]] : tr.size
    return (
        row >= t.row && row < t.row + h &&
        col >= t.col && col < t.col + w
    )
}

function treasureStyle(t) {
    const tr = treasures.find(tt => tt.id === t.treasureId)
    if (!tr) return {}
    const [w, h] = t.rotated ? [tr.size[1], tr.size[0]] : tr.size
    return {
        position: 'absolute',
        left: 0,
        top: 0,
        width: `${w * 40}px`,
        height: `${h * 40}px`,
        zIndex: 10,
        pointerEvents: 'none',
    }
}

function generateArrangements() {
    const arr = []
    let curRow = 0, curCol = 0
    for (const tid of selectedTreasures.value) {
        const rotated = !!rotationSettings[tid]
        const tr = treasures.find(t => t.id === tid)
        if (!tr) continue
        const [w, h] = rotated ? [tr.size[1], tr.size[0]] : tr.size
        if (curCol + w > level.gridM) {
            curRow += h
            curCol = 0
        }
        if (curRow + h > level.gridN) break
        arr.push({ treasureId: tid, row: curRow, col: curCol, rotated })
        curCol += w
    }
    arrangements.value.push({ id: Date.now() + Math.random(), treasures: JSON.parse(JSON.stringify(arr)) })
    selectedArrangementIndex.value = arrangements.value.length - 1
}

function selectArrangement(idx) {
    selectedArrangementIndex.value = idx
}

function deleteArrangement(idx) {
    arrangements.value.splice(idx, 1)
    if (selectedArrangementIndex.value >= arrangements.value.length) {
        selectedArrangementIndex.value = arrangements.value.length - 1
    }
}

function saveLevel() {
    globalResults.value.push({
        gridN: level.gridN,
        gridM: level.gridM,
        arrangements: JSON.parse(JSON.stringify(arrangements.value)),
        treasures: selectedTreasures.value.map(tid => {
            const tr = treasures.find(t => t.id === tid)
            return {
                id: tid,
                size: tr ? tr.size.slice() : [1, 1],
                rotated: !!rotationSettings[tid],
            }
        }),
    })
    arrangements.value = []
    selectedArrangementIndex.value = 0
}

function showResult() {
    showResultModal.value = true
}

function copyResult() {
    navigator.clipboard.writeText(JSON.stringify(globalResults.value, null, 2))
    alert('已复制到剪贴板')
}

selectedTreasures.value.forEach(tid => {
    if (!(tid in rotationSettings)) rotationSettings[tid] = false
})
</script>

<style scoped>
.buried-bounty-editor {
    display: flex;
    flex-direction: column;
    gap: 0;
    font-family: Arial, sans-serif;
    width: 100vw;
    height: 100vh;
    min-height: 0;
}
.full-tabs {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
}
.full-advanced {
    height: calc(100vh - 90px);
    min-height: 0;
    display: flex;
    flex-direction: column;
}
.treasure-list-scroll {
    flex: 1;
    overflow-y: auto;
    max-height: 100%;
    min-height: 0;
    padding-right: 6px;
}
.advanced-settings {
    min-width: 220px;
    max-width: 420px;
}
.settings-bar {
    display: flex;
    gap: 24px;
    align-items: center;
    background: #f7f7f7;
    padding: 8px 12px;
    border-radius: 6px;
}
.main-content {
    display: flex;
    gap: 24px;
}
.arrangement-list {
    min-width: 140px;
    background: #fafafa;
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 8px;
}
.arrangement-list ul {
    padding: 0;
    margin: 0;
    list-style: none;
}
.arrangement-list li {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
    cursor: pointer;
}
.arrangement-list li.selected {
    background: #e0f3ff;
}
.map-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
}
.map-grid {
    box-shadow: 0 2px 12px #ddd;
    margin-bottom: 12px;
    background: #eee;
    border-radius: 8px;
    overflow: hidden;
}
.map-row {
    display: flex;
}
.map-cell {
    position: relative;
    width: 40px;
    height: 40px;
    background: #fff;
}
.tile-bg {
    width: 100%;
    height: 100%;
    object-fit: cover;
    position: absolute;
    left: 0;
    top: 0;
    z-index: 1;
}
.treasure-img {
    transition: transform 0.2s;
    z-index: 10;
}
.treasure-img.rotated {
    transform: rotate(90deg);
}
.rotation-settings {
    background: #f4f4f4;
    border-radius: 6px;
    padding: 8px;
    margin-top: 8px;
    min-width: 200px;
}
.result-modal {
    position: fixed;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 100;
}
.result-modal textarea {
    font-family: monospace;
    font-size: 14px;
    margin-bottom: 12px;
}
.advanced-modal >>> .ivu-modal {
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.20);
    background: rgba(255,255,255,0.97);
    backdrop-filter: blur(2px);
}
.advanced-modal-content {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
    padding: 12px 0 0 0;
}
.advanced-modal-title {
    display: flex;
    align-items: center;
    font-size: 18px;
    font-weight: 500;
    color: #2d8cf0;
    margin-bottom: 8px;
}
.advanced-json-textarea {
    width: 100%;
    height: 320px;
    border-radius: 8px;
    background: #f8f8fa;
    font-family: 'Fira Mono', 'Menlo', monospace;
    font-size: 15px;
    color: #222;
    border: 1px solid #e0e0e0;
    padding: 12px;
    box-sizing: border-box;
    resize: none;
    outline: none;
    transition: box-shadow 0.2s;
    box-shadow: 0 2px 8px #f0f0f0;
}
.advanced-json-textarea:focus {
    border: 1.5px solid #2d8cf0;
    box-shadow: 0 2px 12px #e0eaff;
}
.advanced-modal-btns {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 6px;
}
</style>
