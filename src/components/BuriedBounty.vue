<template>
    <div class="buried-bounty-editor">
        <!-- 顶部设置区 -->
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
            <div class="advanced-settings">
                <label style="display:block;margin-bottom:4px;">高级设置：</label>
                <div style="max-height:120px;overflow:auto;">
                    <Row gutter="8" v-for="item in treasures" :key="item.id" style="margin-bottom:4px;">
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
            </div>
            <Button type="primary" @click="generateArrangements">生成</Button>
            <Button @click="saveLevel">保存</Button>
            <Button @click="showResult">显示结果</Button>
        </div>
        <div class="main-content">
            <!-- 左侧排列组合列表 -->
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
            <!-- 右侧地图区域 -->
            <div class="map-area">
                <div class="map-grid" :style="mapGridStyle">
                    <div v-for="row in level.gridN" :key="row" class="map-row">
                        <div v-for="col in level.gridM" :key="col" class="map-cell" :style="cellStyle(row - 1, col - 1)">
                            <img :src="tileImg" class="tile-bg" />
                            <!-- 渲染宝藏 -->
                            <template v-for="(t, tIdx) in currentArrangement.treasures">
                                <img v-if="isTreasureOnCell(t, row - 1, col - 1)" :src="treasureImg(t.treasureId)"
                                    :class="['treasure-img', t.rotated ? 'rotated' : '']" :style="treasureStyle(t)" />
                            </template>
                        </div>
                    </div>
                </div>
                <!-- 宝藏旋转设置 -->
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
        <!-- 结果弹窗 -->
        <div v-if="showResultModal" class="result-modal">
            <h3>全局结果</h3>
            <textarea readonly :value="JSON.stringify(globalResults, null, 2)"
                style="width:90%;height:300px"></textarea>
            <Button @click="copyResult">复制到剪贴板</Button>
            <Button @click="showResultModal = false">关闭</Button>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { Row, Col, InputNumber, Select, Option, Button, Checkbox } from 'view-ui-plus'

// 宝藏图片和tile图片路径
const tileImg = 'buried_bounty/tile.png'
function treasureImg(id) {
    return `item/item_${id}.png`
}

// 宝藏数据
const treasures = reactive([
    { id: 1, size: [2, 1] },
    { id: 2, size: [1, 2] },
    { id: 3, size: [2, 2] },
    { id: 4, size: [1, 1] },
])

// 关卡数据
const level = reactive({
    gridN: 6,
    gridM: 6,
})

// 选中的宝藏ID
const selectedTreasures = ref([1, 2])

// 宝藏旋转设置（tid: bool）
const rotationSettings = reactive({})

// 当前排列组合列表
const arrangements = ref([])
const selectedArrangementIndex = ref(0)

// 全局结果
const globalResults = ref([])

// 结果弹窗
const showResultModal = ref(false)

// 地图样式
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

// 当前排列
const currentArrangement = computed(() => {
    if (arrangements.value.length === 0) {
        // 默认空地图
        return { treasures: [] }
    }
    return arrangements.value[selectedArrangementIndex.value] || { treasures: [] }
})

// 判断宝藏是否在该格子
function isTreasureOnCell(t, row, col) {
    // t: {treasureId, row, col, rotated}
    const tr = treasures.find(tt => tt.id === t.treasureId)
    if (!tr) return false
    const [w, h] = t.rotated ? [tr.size[1], tr.size[0]] : tr.size
    return (
        row >= t.row && row < t.row + h &&
        col >= t.col && col < t.col + w
    )
}

function treasureStyle(t) {
    // 让宝藏图片覆盖其占据的格子
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

// 生成排列组合（简化：只生成一种放法，后续可扩展为所有合法组合）
function generateArrangements() {
    // 只做简单顺序摆放，后续可用回溯法生成所有组合
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
    // 保存当前关卡的所有组合
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

// 初始化rotationSettings
selectedTreasures.value.forEach(tid => {
    if (!(tid in rotationSettings)) rotationSettings[tid] = false
})
</script>

<style scoped>
.buried-bounty-editor {
    display: flex;
    flex-direction: column;
    gap: 12px;
    font-family: Arial, sans-serif;
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

.advanced-settings {
    min-width: 220px;
    max-width: 360px;
}
</style>
