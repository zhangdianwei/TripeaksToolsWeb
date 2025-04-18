<template>
    <div class="buried-bounty-editor">
        <Tabs :animated="false" class="full-tabs" v-model="activeTab">
            <TabPane label="高级设置" name="advanced">
                <div class="advanced-settings full-advanced">
                    <div class="advanced-header-row">
                        <Button type="primary" size="large" ghost style="margin-right:18px;" @click="showAdvancedModal = true">
                            <Icon type="ios-eye" style="margin-right:6px;" />显示高级设置
                        </Button>
                        <label style="font-size:18px;font-weight:500;">高级设置：</label>
                    </div>
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
                <Row class="level-editor-row" gutter="24">
                    <!-- 左侧设置区 -->
                    <Col :span="9" class="level-settings-panel">
                        <Card dis-hover class="settings-card">
                            <!-- 关卡设置 -->
                            <div class="settings-block">
                                <span class="settings-title">关卡总数</span>
                                <InputNumber v-model="levelCount" :min="1" :max="10" style="width:60px;margin-right:18px;" />
                                <span class="settings-title">当前关卡</span>
                                <Select v-model="curLevelIdx" style="width:120px;">
                                    <Option v-for="option in levelOptions" :key="option.value" :value="option.value">
                                        {{ option.label }}
                                    </Option>
                                </Select>
                            </div>
                            <!-- 地图规格 -->
                            <div class="settings-block">
                                <span class="settings-title">地图大小</span>
                                <InputNumber v-model="gridN" :min="2" :max="12" style="width:60px;" /> x
                                <InputNumber v-model="gridM" :min="2" :max="12" style="width:60px;" />
                            </div>
                            <!-- 宝藏选择 -->
                            <div class="settings-block">
                                <span class="settings-title">选择宝藏</span>
                                <Select v-model="selectedTreasures" multiple transfer :dropdown-style="{maxHeight:'500px',overflowY:'auto',zIndex:3001}" style="width:220px;">
                                    <Option v-for="item in treasures" :key="item.id" :value="item.id">
                                        <Tooltip placement="right">
                                            <template #content>
                                                <img :src="treasureImg(item.id)" style="width:72px;height:72px;object-fit:contain;box-shadow:0 2px 8px #aaa;background:#fff;border-radius:6px;" />
                                            </template>
                                            <img :src="treasureImg(item.id)" style="width:22px;height:22px;object-fit:contain;vertical-align:middle;border-radius:4px;background:#fff;box-shadow:0 1px 2px #eee;" />
                                        </Tooltip>
                                        <span style="margin-left:7px;">宝藏{{ item.id }}</span>
                                    </Option>
                                </Select>
                                <span v-if="selectedTreasures.length" style="margin-left:8px;">（共{{ selectedTreasures.length }}个）</span>
                            </div>
                            <!-- 已选宝藏 -->
                            <div v-if="selectedTreasures.length" class="settings-block selected-treasure-list">
                                <div v-for="tid in selectedTreasures" :key="tid" class="selected-treasure-row">
                                    <Tooltip placement="right">
                                        <template #content>
                                            <img :src="treasureImg(tid)" style="width:72px;height:72px;object-fit:contain;box-shadow:0 2px 8px #aaa;background:#fff;border-radius:6px;" />
                                        </template>
                                        <img :src="treasureImg(tid)" style="width:28px;height:28px;object-fit:contain;vertical-align:middle;border-radius:4px;background:#fff;box-shadow:0 1px 3px #eee;margin-right:8px;" />
                                    </Tooltip>
                                    <span style="margin-right:12px;">宝藏{{ tid }}</span>
                                    <Checkbox v-model="rotationSettings[tid]" style="margin-right:12px;">旋转</Checkbox>
                                    <Button size="small" type="error" ghost @click="removeTreasure(tid)"><Icon type="ios-close" /></Button>
                                </div>
                            </div>
                            <!-- 操作按钮 -->
                            <div class="settings-block settings-actions">
                                <Button type="primary" @click="generateArrangements" style="margin-right:12px;">生成组合</Button>
                                <Button @click="saveLevel" style="margin-right:12px;">保存关卡</Button>
                                <Button @click="showResult">显示结果</Button>
                            </div>
                            <!-- 排列组合 -->
                            <div class="settings-block">
                                <span class="settings-title">排列组合</span>
                                <span v-if="arrangements.length === 0" style="color:#aaa;">无</span>
                                <span v-else>
                                    <Button size="small" v-for="(arr, idx) in arrangements" :key="arr.id"
                                        :type="idx === selectedArrangementIndex ? 'primary' : 'default'"
                                        style="margin-right:8px;margin-bottom:6px;"
                                        @click="selectArrangement(idx)">
                                        组合{{ idx + 1 }}
                                    </Button>
                                    <Button size="small" type="error" ghost v-for="(arr, idx) in arrangements" :key="'del'+arr.id"
                                        style="margin-right:8px;margin-bottom:6px;"
                                        @click="deleteArrangement(idx)">
                                        删除
                                    </Button>
                                </span>
                            </div>
                        </Card>
                    </Col>
                    <!-- 右侧地图显示区 -->
                    <Col :span="15" class="level-map-panel">
                        <div class="map-area">
                            <div class="map-grid" :style="mapGridStyle">
                                <div v-for="row in gridN" :key="row" class="map-row">
                                    <div v-for="col in gridM" :key="col" class="map-cell" :style="cellStyle(row - 1, col - 1)">
                                        <img :src="tileImg" class="tile-bg" />
                                        <template v-for="(t, tIdx) in currentArrangement.treasures">
                                            <img v-if="isTreasureOnCell(t, row - 1, col - 1)" :src="treasureImg(t.treasureId)"
                                                :class="['treasure-img', t.rotated ? 'rotated' : '']" :style="treasureStyle(t)" />
                                        </template>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Col>
                </Row>
                <div v-if="showResultModal" class="result-modal">
                    <h3>全局结果</h3>
                    <textarea readonly :value="JSON.stringify(levels, null, 2)"
                        style="width:90%;height:300px"></textarea>
                    <Button @click="copyResult">复制到剪贴板</Button>
                    <Button @click="showResultModal = false">关闭</Button>
                </div>
            </TabPane>
        </Tabs>
    </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { Row, Col, Card, InputNumber, Select, Option, Button, Checkbox, Tabs, TabPane, Tooltip, Modal, Icon } from 'view-ui-plus'

const activeTab = ref('main')

const TREASURE_KEY = 'buried_bounty_treasures_v1'

// 优先从localStorage恢复宝藏设置
function getInitialTreasures() {
    try {
        const str = localStorage.getItem(TREASURE_KEY)
        if (str) {
            const arr = JSON.parse(str)
            if (Array.isArray(arr) && arr.length === 23) {
                return arr.map(t => ({ id: t.id, size: t.size.slice() }))
            }
        }
    } catch(e) {}
    // 默认23个宝藏
    const sizeOptions = [ [2,1], [1,2], [2,2], [1,1] ]
    return Array.from({ length: 23 }, (_, i) => ({
        id: i + 1,
        size: sizeOptions[i % sizeOptions.length].slice(),
    }))
}

const treasures = reactive(getInitialTreasures())

// 自动保存到localStorage
watch(treasures, (val) => {
    localStorage.setItem(TREASURE_KEY, JSON.stringify(val.map(t => ({ id: t.id, size: t.size }))))
}, { deep: true })

const tileImg = 'buried_bounty/tile.png'
function treasureImg(id) {
    return `buried_bounty/item/item_${id}_1.png`
}

// ========== 多关卡编辑核心数据结构 ==========
const levelCount = ref(5)
const curLevelIdx = ref(0)

function makeEmptyLevel() {
    return {
        gridN: 6,
        gridM: 6,
        selectedTreasures: [],
        rotationSettings: {},
        arrangements: [],
        selectedArrangementIndex: 0
    }
}

const levels = reactive([])
function ensureLevels() {
    while (levels.length < levelCount.value) levels.push(makeEmptyLevel())
    while (levels.length > levelCount.value) levels.pop()
}
watch(levelCount, ensureLevels, { immediate: true })

// 切换关卡时，自动填充空关卡
watch(curLevelIdx, ensureLevels, { immediate: true })

// ========== 编辑区所有表单都绑定到当前关卡 ===========
const currentLevel = computed(() => levels[curLevelIdx.value] || makeEmptyLevel())

// 宝藏选择的响应式变量，直接代理到当前关卡
const selectedTreasures = computed({
    get: () => currentLevel.value.selectedTreasures,
    set: val => currentLevel.value.selectedTreasures = val
})
const rotationSettings = computed({
    get: () => currentLevel.value.rotationSettings,
    set: val => currentLevel.value.rotationSettings = val
})
const arrangements = computed({
    get: () => currentLevel.value.arrangements,
    set: val => currentLevel.value.arrangements = val
})
const selectedArrangementIndex = computed({
    get: () => currentLevel.value.selectedArrangementIndex,
    set: val => currentLevel.value.selectedArrangementIndex = val
})

// ========== 关卡规格 NxM 直接绑定到 currentLevel ==========
const gridN = computed({
    get: () => currentLevel.value.gridN,
    set: val => currentLevel.value.gridN = val
})
const gridM = computed({
    get: () => currentLevel.value.gridM,
    set: val => currentLevel.value.gridM = val
})

// ========== 保存所有关卡设置的全局结果 =============
const showResultModal = ref(false)

// ========== 生成组合、保存关卡、显示结果等逻辑 ==========
function generateArrangements() {
    const arr = []
    let curRow = 0, curCol = 0
    for (const tid of selectedTreasures.value) {
        const rotated = !!rotationSettings.value[tid]
        const tr = treasures.find(t => t.id === tid)
        if (!tr) continue
        const [w, h] = rotated ? [tr.size[1], tr.size[0]] : tr.size
        if (curCol + w > gridM.value) {
            curRow += h
            curCol = 0
        }
        if (curRow + h > gridN.value) break
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
function removeTreasure(tid) {
    const idx = selectedTreasures.value.indexOf(tid)
    if (idx !== -1) {
        selectedTreasures.value.splice(idx, 1)
        delete rotationSettings.value[tid]
    }
}
function saveLevel() {
    // 当前关卡设置已自动保存在 levels[curLevelIdx.value]，可选：弹提示
    alert('当前关卡已保存')
}
function showResult() {
    showResultModal.value = true
}
function copyResult() {
    navigator.clipboard.writeText(JSON.stringify(levels, null, 2))
    alert('已复制到剪贴板')
}

// ========== UI 关卡选择下拉选项 ===========
const levelOptions = computed(() => Array.from({ length: levelCount.value }, (_, i) => ({ label: `关卡${i + 1}`, value: i })))

// ========== 地图渲染相关 ===========
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
const mapGridStyle = computed(() => ({
    gridTemplateRows: `repeat(${gridN.value}, 40px)`,
    gridTemplateColumns: `repeat(${gridM.value}, 40px)`,
    gap: '2px',
    background: '#ddd',
    margin: '0 auto',
    border: '1px solid #aaa',
    width: `${gridM.value * 42}px`,
    height: `${gridN.value * 42}px`,
    position: 'relative',
}))
const currentArrangement = computed(() => {
    if (!arrangements.value.length) return { treasures: [] }
    return arrangements.value[selectedArrangementIndex.value] || { treasures: [] }
})

// ========== 宝藏选择下拉项带缩略图 ===========
// 可选：如需自定义 Option 渲染，可用 slot 或 render

// ========== 其余功能保持不变 ===========
const advancedJson = computed(() => JSON.stringify(treasures.map(t => ({ id: t.id, size: t.size })), null, 2))
function copyAdvanced() {
    navigator.clipboard.writeText(advancedJson.value)
    alert('已复制到剪贴板')
}

const showAdvancedModal = ref(false)

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

selectedTreasures.value.forEach(tid => {
    if (!(tid in rotationSettings.value)) rotationSettings.value[tid] = false
})
</script>

<style scoped>
.settings-title {
    display: inline-block;
    font-weight: 500;
    color: #2d8cf0;
    margin-right: 10px;
    white-space: nowrap;
}
.level-settings-panel {
    min-width: 380px;
    max-width: 520px;
}
.settings-card {
    padding: 16px 18px;
}
.settings-block {
  margin-bottom: 22px;
}
.selected-treasure-list {
  background: #f8f9fb;
  border-radius: 8px;
  padding: 8px 10px 6px 10px;
  box-shadow: 0 1px 4px #f2f2f2;
}
.selected-treasure-row {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
}
.settings-actions {
  margin-top: 18px;
}
</style>
