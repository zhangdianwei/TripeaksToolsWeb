<template>
    <div class="buried-bounty-editor">
        <Tabs :animated="false" class="full-tabs" v-model="activeTab">
            <TabPane label="高级设置" name="advanced">
                <div class="advanced-settings full-advanced">
                    <div class="advanced-header-row">
                        <Button type="primary" size="large" ghost style="margin-right:18px;"
                            @click="showAdvancedModal = true">
                            <Icon type="ios-eye" style="margin-right:6px;" />显示高级设置
                        </Button>
                        <label style="font-size:18px;font-weight:500;">高级设置：</label>
                    </div>
                    <div style="margin-bottom:12px;display:flex;align-items:center;gap:16px;">
                        <span style="font-weight:500;color:#2d8cf0;">示意图格子行数</span>
                        <InputNumber v-model="previewRows" :min="1" :max="12" style="width:60px;" />
                        <span style="font-weight:500;color:#2d8cf0;">列数</span>
                        <InputNumber v-model="previewCols" :min="1" :max="12" style="width:60px;" />
                    </div>
                    <div class="treasure-list-scroll">
                        <Row :gutter="8" v-for="item in treasures" :key="item.id"
                            style="margin-bottom:4px;align-items:center;">
                            <Col :span="1">
                            <Tooltip placement="right">
                                <template #content>
                                    <img :src="treasureImg(item.id)"
                                        style="width:96px;height:96px;object-fit:contain;box-shadow:0 2px 8px #aaa;background:#fff;border-radius:6px;" />
                                </template>
                                <img :src="treasureImg(item.id)"
                                    style="width:32px;height:32px;object-fit:contain;cursor:pointer;vertical-align:middle;border-radius:4px;background:#fff;box-shadow:0 1px 3px #eee;" />
                            </Tooltip>
                            </Col>
                            <Col :span="2">
                            宝藏{{ item.id }} 大小：
                            </Col>
                            <Col :span="6">
                            <InputNumber v-model="item.size[0]" :min="1" :max="previewCols" style="width:60px" />
                            x
                            <InputNumber v-model="item.size[1]" :min="1" :max="previewRows" style="width:60px" />
                            </Col>
                            <Col :span="12">
                                <div style="display:inline-block;vertical-align:middle;">
                                    <span style="margin-right:8px;">占用格子：</span>
                                    <div style="display:inline-block;vertical-align:middle;">
                                        <div :style="{
                                            position: 'relative',
                                            width: (previewCols*18 + (previewCols-1)*1 + 4) + 'px',
                                            height: (previewRows*18 + (previewRows-1)*1 + 4) + 'px',
                                            display: 'grid',
                                            gridTemplateColumns: `repeat(${previewCols},18px)`,
                                            gridTemplateRows: `repeat(${previewRows},18px)`,
                                            gap: '1px',
                                            background: '#eaeaea',
                                            padding: '2px',
                                            borderRadius: '4px',
                                            boxShadow: '0 1px 3px #eee'
                                        }">
                                            <div v-for="r in previewRows" :key="'row'+r" style="display:contents;">
                                                <div v-for="c in previewCols" :key="'cell'+r+'-'+c" style="position:relative;width:18px;height:18px;">
                                                    <img :src="tileImg" style="width:18px;height:18px;object-fit:cover;display:block;border-radius:2px;" />
                                                    <div v-if="r <= item.size[0] && c <= item.size[1]"
                                                        style="position:absolute;left:0;top:0;width:18px;height:18px;background:rgba(255,0,0,0.38);border-radius:2px;z-index:4;pointer-events:none;"></div>
                                                </div>
                                            </div>
                                            <img :src="treasureImg(item.id)"
                                                :style="{
                                                    position: 'absolute',
                                                    left: '2px',
                                                    top: '2px',
                                                    width: (item.size[1]*18 + (item.size[1]-1)*1) + 'px',
                                                    height: (item.size[0]*18 + (item.size[0]-1)*1) + 'px',
                                                    objectFit: 'contain',
                                                    zIndex: 10,
                                                    pointerEvents: 'none',
                                                    filter: 'drop-shadow(0 1px 2px #aaa)'
                                                }"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </div>
                    <Modal v-model="showAdvancedModal" title="高级设置 JSON" :footer-hide="true" width="600"
                        class="advanced-modal">
                        <div class="advanced-modal-content">
                            <div class="advanced-modal-title">
                                <Icon type="ios-settings" style="color:#2d8cf0;font-size:22px;margin-right:8px;" />
                                <span>高级设置 JSON</span>
                            </div>
                            <Input type="textarea" readonly v-model="advancedJson" autosize
                                style="width:100%;min-height:320px;max-height:480px;font-family:'Fira Mono','Menlo',monospace;font-size:15px;color:#222;border-radius:8px;background:#f8f8fa;padding:16px 12px;line-height:1.7;box-shadow:0 2px 8px #e5e5e5;resize:vertical;overflow:auto;white-space:pre;"
                                :spellcheck="false" />
                            <div class="advanced-modal-btns">
                                <Button type="primary" @click="copyAdvanced">复制到剪贴板</Button>
                                <Button @click="showAdvancedModal = false">关闭</Button>
                            </div>
                        </div>
                    </Modal>
                </div>
            </TabPane>
            <TabPane label="关卡编辑" name="main">
                <Row class="level-editor-row" :gutter="24">
                    <!-- 左侧设置区 -->
                    <Col :span="9" class="level-settings-panel">
                    <Card dis-hover class="settings-card">
                        <!-- 操作按钮 -->
                        <div class="settings-block settings-actions" style="display:flex;flex-direction:row;gap:8px;align-items:center;margin-bottom:8px;">
                            <Button @click="showResult">显示结果</Button>
                        </div>
                        <!-- 关卡设置 -->
                        <div class="settings-block">
                            <span class="settings-title">关卡总数</span>
                            <InputNumber v-model="levelCount" :min="1" :max="10"
                                style="width:60px;margin-right:18px;" />
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
                            <Select v-model="selectedTreasures" multiple transfer
                                :dropdown-style="{ maxHeight: '500px', overflowY: 'auto', zIndex: 3001 }" style="width:220px;">
                                <Option v-for="item in treasures" :key="item.id" :value="item.id">
                                    <Tooltip placement="right">
                                        <template #content>
                                            <img :src="treasureImg(item.id)"
                                                style="width:72px;height:72px;object-fit:contain;box-shadow:0 2px 8px #aaa;background:#fff;border-radius:6px;" />
                                        </template>
                                        <img :src="treasureImg(item.id)"
                                            style="width:22px;height:22px;object-fit:contain;vertical-align:middle;border-radius:4px;background:#fff;box-shadow:0 1px 2px #eee;" />
                                    </Tooltip>
                                    <span style="margin-left:7px;">宝藏{{ item.id }}</span>
                                </Option>
                            </Select>
                            <span v-if="selectedTreasures.length" style="margin-left:8px;">（共{{ selectedTreasures.length
                                }}个）</span>
                        </div>
                        <!-- 已选宝藏 -->
                        <div v-if="selectedTreasures.length" class="settings-block selected-treasure-list">
                            <div v-for="tid in selectedTreasures" :key="tid" class="selected-treasure-row">
                                <Tooltip placement="right">
                                    <template #content>
                                        <img :src="treasureImg(tid)"
                                            style="width:72px;height:72px;object-fit:contain;box-shadow:0 2px 8px #aaa;background:#fff;border-radius:6px;" />
                                    </template>
                                    <img :src="treasureImg(tid)"
                                        style="width:28px;height:28px;object-fit:contain;vertical-align:middle;border-radius:4px;background:#fff;box-shadow:0 1px 3px #eee;margin-right:8px;" />
                                </Tooltip>
                                <span style="margin-right:12px;">宝藏{{ tid }}</span>
                                <Checkbox v-model="rotationSettings[tid]" style="margin-right:12px;">旋转</Checkbox>
                                <Button size="small" type="error" ghost @click="removeTreasure(tid)" style="margin-right:10px;">
                                    <Icon type="ios-close" />
                                </Button>
                                <span class="treasure-divider" />
                                <span style="margin-left:auto;color:#888;">尺寸：{{ getTreasureSize(tid)[0] }} x {{ getTreasureSize(tid)[1] }}</span>
                            </div>
                        </div>
                        <!-- 排列组合展示区（无缩略图，可点击选中） -->
                        <div class="settings-block">
                            <span class="settings-title">排列组合</span>
                            <Button size="small" icon="md-add" style="margin-left:10px;vertical-align:middle;" @click="addRandomArrangement">新增排列</Button>
                            <Button size="small" icon="ios-trash" type="warning" style="margin-left:8px;vertical-align:middle;" @click="clearArrangements">清空</Button>
                            <span v-if="arrangements.length === 0" style="color:#aaa;">无</span>
                            <div v-else class="arrangement-list">
                                <div v-for="(arr, idx) in arrangements" :key="arr.id" class="arrangement-item"
                                    :class="{ selected: idx === selectedArrangementIndex }"
                                    @click="selectArrangement(idx)">
                                    <span>组合{{ idx + 1 }}（共{{ arr.treasures.length }}个宝藏）</span>
                                    <Button size="small" style="margin-left:12px;" @click.stop="refreshArrangement(idx)">刷新</Button>
                                    <Button size="small" type="error" ghost @click.stop="deleteArrangement(idx)" style="margin-left:16px;">删除</Button>
                                </div>
                            </div>
                        </div>
                    </Card>
                    </Col>
                    <!-- 右侧地图显示区（新版 iView 风格） -->
                    <Col :span="15" class="level-map-panel">
                        <Card dis-hover class="settings-card" title="关卡布局预览" style="margin-bottom:16px;">
                            <div class="map-area">
                                <div class="map-grid" :style="mapGridStyle">
                                    <div v-for="row in currentLevel.gridM" :key="row" class="map-row">
                                        <div v-for="col in currentLevel.gridN" :key="col" class="map-cell" :style="cellStyle(row - 1, col - 1)">
                                            <img :src="tileImg" class="tile-bg" />
                                        </div>
                                    </div>
                                    <!-- 上层宝藏渲染：每个宝藏只渲染一次，且图片覆盖其所占区域 -->
                                    <template v-for="(t, tIdx) in currentArrangement.treasures" :key="'treasure-' + tIdx">
                                        <img
                                            :src="treasureImg(t.treasureId)"
                                            :class="['treasure-img', t.rotated ? 'rotated-img' : '']"
                                            :style="treasureStyle(t)"
                                        />
                                    </template>
                                </div>
                            </div>
                        </Card>
                    </Col>
                </Row>
                <Modal v-model="showResultModal" title="全局结果" width="700" :footer-hide="true">
                    <textarea readonly :value="JSON.stringify(levels, null, 2)"
                        style="width:100%;height:300px;margin-bottom:16px;font-family:monospace;font-size:14px;line-height:1.5;" />
                    <div style="text-align:right;">
                        <Button @click="copyResult" type="primary">复制到剪贴板</Button>
                        <Button @click="showResultModal = false" style="margin-left:8px;">关闭</Button>
                    </div>
                </Modal>
            </TabPane>
        </Tabs>
    </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { Row, Col, Card, InputNumber, Select, Option, Button, Checkbox, Tabs, TabPane, Tooltip, Modal, Icon, Message, List, ListItem } from 'view-ui-plus'

const activeTab = ref('main')

const TREASURE_KEY = 'buried_bounty_treasures_v1'
const LEVELS_KEY = 'buried_bounty_levels_v1'

// 优先从localStorage恢复宝藏设置
function getInitialTreasures() {
    const sizeOptions = [[1, 1], [2, 1], [1, 2], [2, 2], [3, 1], [1, 3], [3, 2], [2, 3], [3, 3]]
    try {
        const str = localStorage.getItem(TREASURE_KEY)
        if (str) {
            const arr = JSON.parse(str)
            if (Array.isArray(arr) && arr.length === 23) {
                return arr.map(t => ({ id: t.id, size: t.size.slice() }))
            }
        }
    } catch (e) { }
    return Array.from({ length: 23 }, (_, i) => ({
        id: i + 1,
        size: sizeOptions[i % sizeOptions.length].slice()
    }))
}

const treasures = reactive(getInitialTreasures())

// 自动保存到localStorage
watch(treasures, (val) => {
    localStorage.setItem(TREASURE_KEY, JSON.stringify(val.map(t => ({ id: t.id, size: t.size }))))
}, { deep: true })

function loadLevels() {
    try {
        const str = localStorage.getItem(LEVELS_KEY)
        if (str) {
            const arr = JSON.parse(str)
            if (Array.isArray(arr)) return arr
        }
    } catch (e) {}
    return []
}

const levels = reactive(loadLevels())

// 自动保存到localStorage
watch(levels, (val) => {
    localStorage.setItem(LEVELS_KEY, JSON.stringify(val))
}, { deep: true })

const tileImg = 'buried_bounty/tile.png'
function treasureImg(id) {
    return `buried_bounty/item/item_${id}_1.png`
}

// ========== 多关卡编辑核心数据结构 ==========
const levelCount = ref(5)
const curLevelIdx = ref(0)

// 初始化标记，防止启动/自动填充时触发限制提示
let isInitializing = true

// ========== 编辑区所有表单都绑定到当前关卡 ===========
const currentLevel = computed(() => levels[curLevelIdx.value] || makeEmptyLevel())
window.currentLevel = currentLevel;
// 宝藏选择的响应式变量，直接代理到当前关卡
const selectedTreasures = computed({
    get: () => currentLevel.value.selectedTreasures,
    set: val => {
        if (!isInitializing && currentLevel.value.arrangements && currentLevel.value.arrangements.length) {
            Message.info('当前关卡已有排列组合，无法修改宝藏设置！')
            return
        }
        currentLevel.value.selectedTreasures = val
    }
})
const rotationSettings = computed({
    get: () => currentLevel.value.rotationSettings,
    set: val => {
        if (!isInitializing && currentLevel.value.arrangements && currentLevel.value.arrangements.length) {
            Message.info('当前关卡已有排列组合，无法修改旋转设置！')
            return
        }
        currentLevel.value.rotationSettings = val
    }
})
const arrangements = computed({
    get: () => currentLevel.value.arrangements,
    set: val => currentLevel.value.arrangements = val
})
const gridN = computed({
    get: () => currentLevel.value.gridN,
    set: val => {
        if (!isInitializing && currentLevel.value.arrangements && currentLevel.value.arrangements.length) {
            Message.info('当前关卡已有排列组合，无法修改地图大小！')
            return
        }
        currentLevel.value.gridN = val
    }
})
const gridM = computed({
    get: () => currentLevel.value.gridM,
    set: val => {
        if (!isInitializing && currentLevel.value.arrangements && currentLevel.value.arrangements.length) {
            Message.info('当前关卡已有排列组合，无法修改地图大小！')
            return
        }
        currentLevel.value.gridM = val
    }
})
const selectedArrangementIndex = computed({
    get: () => currentLevel.value.selectedArrangementIndex,
    set: val => currentLevel.value.selectedArrangementIndex = val
})

// 关卡/宝藏等初始化流程结束后，关闭初始化标记
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => { isInitializing = false }, 0)
})
watch([levels, curLevelIdx], () => {
    setTimeout(() => { isInitializing = false }, 0)
}, { immediate: true, deep: true })

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

function ensureLevels() {
    while (levels.length < levelCount.value) levels.push(makeEmptyLevel())
    while (levels.length > levelCount.value) levels.pop()
}
watch(levelCount, ensureLevels, { immediate: true })

// 切换关卡时，自动填充空关卡
watch(curLevelIdx, ensureLevels, { immediate: true })

// ========== 编辑区所有表单都绑定到当前关卡 ===========
// 宝藏选择的响应式变量，直接代理到当前关卡
// ...

// ========== 保存所有关卡设置的全局结果 =============
const showResultModal = ref(false)

// ========== 生成所有可能排列组合 =============
function generateArrangements() {
    const treasuresList = selectedTreasures.value.map(tid => {
        const tr = treasures.find(t => t.id === tid)
        return {
            treasureId: tid,
            size: tr ? tr.size.slice() : [1, 1],
            canRotate: !!rotationSettings.value[tid]
        }
    })
    const _gridRows = gridN.value
    const _gridCols = gridM.value
    const maxResults = 50
    const results = []

    function canPlace(board, row, col, w, h) {
        if (row + h > _gridRows || col + w > _gridCols) return false
        for (let r = row; r < row + h; r++) {
            for (let c = col; c < col + w; c++) {
                if (board[r][c]) return false
            }
        }
        return true
    }
    function place(board, row, col, w, h, val) {
        for (let r = row; r < row + h; r++) {
            for (let c = col; c < col + w; c++) {
                board[r][c] = val
            }
        }
    }
    function backtrack(idx, board, placed) {
        if (results.length >= maxResults) return
        if (idx === treasuresList.length) {
            results.push({
                id: Date.now() + Math.random(),
                treasures: placed.map(p => ({ ...p }))
            })
            return
        }
        const t = treasuresList[idx]
        const tryRotations = t.canRotate ? [false, true] : [false]
        for (const rotated of tryRotations) {
            const [w, h] = rotated ? t.size : [t.size[1], t.size[0]]
            for (let row = 0; row <= _gridRows - h; row++) {
                for (let col = 0; col <= _gridCols - w; col++) {
                    if (canPlace(board, row, col, w, h)) {
                        place(board, row, col, w, h, 1)
                        placed.push({ treasureId: t.treasureId, row, col, rotated })
                        backtrack(idx + 1, board, placed)
                        placed.pop()
                        place(board, row, col, w, h, 0)
                        if (results.length >= maxResults) return
                    }
                }
            }
        }
    }
    // 初始化空棋盘
    const board = Array.from({ length: _gridRows }, () => Array(_gridCols).fill(0))
    backtrack(0, board, [])
    // 清空并写入arrangements
    arrangements.value.splice(0, arrangements.value.length)
    for (const r of results) arrangements.value.push(r)
    selectedArrangementIndex.value = arrangements.value.length ? 0 : -1
}
// ========== 生成组合、保存关卡、显示结果等逻辑 ==========
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
        currentLevel.value.selectedTreasures = currentLevel.value.selectedTreasures.slice()
    }
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
    // 已不再用于图片渲染，仅保留逻辑判断（如需高亮单格可用）
    const tr = treasures.find(tt => tt.id === t.treasureId)
    let w, h
    if (tr) {
        if (t.size && Array.isArray(t.size) && t.size.length === 2) {
            [w, h] = t.rotated ? t.size : [t.size[1], t.size[0]]
        } else {
            [w, h] = t.rotated ? tr.size : [tr.size[1], tr.size[0]]
        }
    } else {
        return false
    }
    return (
        row >= t.row && row < t.row + h &&
        col >= t.col && col < t.col + w
    )
}
function treasureStyle(t) {
    const tr = treasures.find(tt => tt.id === t.treasureId)
    if (!tr) return {}
    let w, h
    if (t.size && Array.isArray(t.size) && t.size.length === 2) {
        [w, h] = t.rotated ? t.size : [t.size[1], t.size[0]]
    } else {
        [w, h] = t.rotated ? tr.size : [tr.size[1], tr.size[0]]
    }
    return {
        position: 'absolute',
        left: `${t.col * 40}px`,
        top: `${t.row * 40}px`,
        width: `${(t.rotated ? h : w) * 40}px`,
        height: `${(t.rotated ? w : h) * 40}px`,
        zIndex: 10,
        pointerEvents: 'none',
        transform: t.rotated ? 'rotate(90deg) translateY(-100%)' : '',
        transformOrigin: 'top left',
    }
}
const mapGridStyle = computed(() => ({
    display: 'grid',
    gridTemplateRows: `repeat(${currentLevel.value.gridN}, 40px)`,
    gridTemplateColumns: `repeat(${currentLevel.value.gridM}, 40px)`,
    gap: '0', // 取消格子间隙
    background: '#ddd',
    margin: '0 auto',
    border: '1px solid #aaa',
    width: `${currentLevel.value.gridM * 40}px`,
    height: `${currentLevel.value.gridN * 40}px`,
    position: 'relative',
}))
const currentArrangement = computed(() => {
    if (!arrangements.value.length) return { treasures: [] }
    return arrangements.value[selectedArrangementIndex.value] || { treasures: [] }
})

// ========== 宝藏选择下拉项带缩略图 ===========
// 可选：如需自定义 Option 渲染，可用 slot 或 render

// ========== 其余功能保持不变 ===========
const advancedJson = computed(() => {
    return JSON.stringify(treasures, null, 2)
})

function copyAdvanced() {
    navigator.clipboard.writeText(advancedJson.value)
    Message.success('已复制到剪贴板')
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

// 新增排列按钮逻辑：生成一个不与现有arrangements重复的随机排列
function addRandomArrangement() {
    // 前置校验
    const ts = selectedTreasures.value.slice()
    if (!ts.length) {
        Message.info('请先选择宝藏')
        return
    }
    // 获取宝藏属性
    const treasuresList = ts.map(tid => {
        const tr = treasures.find(t => t.id === tid)
        return {
            treasureId: tid,
            size: tr ? tr.size.slice() : [1, 1],
            allowRotate: rotationSettings.value[tid] || false
        }
    })
    // 检查所有宝藏尺寸是否都能放进地图
    const _gridRows = gridN.value
    const _gridCols = gridM.value
    for (const t of treasuresList) {
        const sizes = t.allowRotate ? [t.size, [t.size[1], t.size[0]]] : [t.size]
        const canFit = sizes.some(([w, h]) => (w <= _gridCols && h <= _gridRows))
        if (!canFit) {
            Message.info('宝藏尺寸或旋转后超出地图范围，无法生成排列')
            return
        }
    }
    // 随机打乱顺序
    for (let i = treasuresList.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[treasuresList[i], treasuresList[j]] = [treasuresList[j], treasuresList[i]]
    }
    const gridRows = gridN.value
    const gridCols = gridM.value
    // 检查是否重叠
    function isOverlap(placed, row, col, w, h) {
        for (const p of placed) {
            const [pw, ph] = p.rotated ? [p.size[1], p.size[0]] : p.size
            if (
                row + h > gridRows || col + w > gridCols ||
                row + h <= p.row || row >= p.row + ph ||
                col + w <= p.col || col >= p.col + pw
            ) {
                continue
            }
            return true
        }
        return false
    }
    // 回溯递归查找一个新解
    function dfs(placed, idx) {
        if (idx === treasuresList.length) {
            // 检查是否重复
            const isSame = (a, b) => {
                if (a.treasures.length !== b.treasures.length) return false
                for (let i = 0; i < a.treasures.length; i++) {
                    const t1 = a.treasures[i], t2 = b.treasures[i]
                    if (!t1 || !t2) return false
                    if (t1.treasureId !== t2.treasureId || t1.row !== t2.row || t1.col !== t2.col || !!t1.rotated !== !!t2.rotated) return false
                }
                return true
            }
            if (!arrangements.value.some(a => isSame(a, { treasures: placed }))) {
                arrangements.value.push({ id: Date.now() + Math.random(), treasures: placed })
                selectedArrangementIndex.value = arrangements.value.length - 1
                return true
            }
            return false
        }
        const t = treasuresList[idx]
        const rotOptions = t.allowRotate ? [false, true] : [false]
        // 随机旋转顺序
        for (const rotated of rotOptions.sort(() => Math.random() - 0.5)) {
            const [w, h] = rotated ? t.size : [t.size[1], t.size[0]]
            // 随机遍历所有格子
            const posArr = []
            for (let r = 0; r <= gridRows - h; r++) {
                for (let c = 0; c <= gridCols - w; c++) {
                    posArr.push([r, c])
                }
            }
            for (const [row, col] of posArr.sort(() => Math.random() - 0.5)) {
                if (!isOverlap(placed, row, col, w, h)) {
                    if (dfs([...placed, { treasureId: t.treasureId, row, col, rotated, size: t.size }], idx + 1)) {
                        return true
                    }
                }
            }
        }
        return false
    }
    if (!dfs([], 0)) {
        Message.info('所有随机结果已用完，无法生成新的排列')
    }
}

// 刷新单个排列
function refreshArrangement(idx) {
    // 重新生成一个不重复的新排列，替换当前idx项
    // 逻辑与addRandomArrangement一致，但不能与其它项重复
    const ts = selectedTreasures.value.slice()
    if (!ts.length) {
        Message.info('请先选择宝藏')
        return
    }
    const treasuresList = ts.map(tid => {
        const tr = treasures.find(t => t.id === tid)
        return {
            treasureId: tid,
            size: tr ? tr.size.slice() : [1, 1],
            allowRotate: rotationSettings.value[tid] || false
        }
    })
    // 检查尺寸
    const _gridRows = gridN.value
    const _gridCols = gridM.value
    for (const t of treasuresList) {
        const sizes = t.allowRotate ? [t.size, [t.size[1], t.size[0]]] : [t.size]
        const canFit = sizes.some(([w, h]) => (w <= _gridCols && h <= _gridRows))
        if (!canFit) {
            Message.info('宝藏尺寸或旋转后超出地图范围，无法生成排列')
            return
        }
    }
    // 回溯递归生成新解
    const gridRows = gridN.value
    const gridCols = gridM.value
    function isOverlap(placed, row, col, w, h) {
        for (const p of placed) {
            const [pw, ph] = p.rotated ? [p.size[1], p.size[0]] : p.size
            if (
                row + h > gridRows || col + w > gridCols ||
                row + h <= p.row || row >= p.row + ph ||
                col + w <= p.col || col >= p.col + pw
            ) {
                continue
            }
            return true
        }
        return false
    }
    function isSame(a, b) {
        if (a.treasures.length !== b.treasures.length) return false
        for (let i = 0; i < a.treasures.length; i++) {
            const t1 = a.treasures[i], t2 = b.treasures[i]
            if (!t1 || !t2) return false
            if (t1.treasureId !== t2.treasureId || t1.row !== t2.row || t1.col !== t2.col || !!t1.rotated !== !!t2.rotated) return false
        }
        return true
    }
    function dfs(placed, idxTry) {
        if (idxTry === treasuresList.length) {
            // 不与其它项重复即可
            if (!arrangements.value.some((a, i) => i!==idx && isSame(a, { treasures: placed }))) {
                arrangements.value[idx] = { id: Date.now() + Math.random(), treasures: placed }
                selectedArrangementIndex.value = idx
                return true
            }
            return false
        }
        const t = treasuresList[idxTry]
        const rotOptions = t.allowRotate ? [false, true] : [false]
        for (const rotated of rotOptions.sort(() => Math.random() - 0.5)) {
            const [w, h] = rotated ? t.size : [t.size[1], t.size[0]]
            const posArr = []
            for (let r = 0; r <= gridRows - h; r++) {
                for (let c = 0; c <= gridCols - w; c++) {
                    posArr.push([r, c])
                }
            }
            for (const [row, col] of posArr.sort(() => Math.random() - 0.5)) {
                if (!isOverlap(placed, row, col, w, h)) {
                    if (dfs([...placed, { treasureId: t.treasureId, row, col, rotated, size: t.size }], idxTry + 1)) {
                        return true
                    }
                }
            }
        }
        return false
    }
    if (!dfs([], 0)) {
        Message.info('所有随机结果已用完，无法生成新的排列')
    }
}

// 获取并绑定宝藏大小（高级设置中的 treasures）
function getTreasureSize(tid) {
    const t = treasures.find(x => x.id === tid)
    if (!t) return [1, 1]
    // 保证响应式
    return t.size
}

function clearArrangements() {
    arrangements.value.splice(0, arrangements.value.length)
    selectedArrangementIndex.value = -1
}

const previewRows = ref(4)
const previewCols = ref(4)

// 自动修正宝藏尺寸不超过格子
watch([previewRows, previewCols], ([newRows, newCols]) => {
    treasures.forEach(item => {
        if (item.size[0] > newCols) item.size[0] = newCols
        if (item.size[1] > newRows) item.size[1] = newRows
    })
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

.advanced-modal-btns {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 6px;
}

.advanced-modal>>>.ivu-modal {
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.20);
    background: rgba(255, 255, 255, 0.97);
    backdrop-filter: blur(2px);
}

.tile-bg {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
}

.arrangement-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 8px;
}
.arrangement-item {
    display: flex;
    align-items: center;
    background: #f8f8f8;
    border-radius: 5px;
    padding: 8px 12px;
    box-shadow: 0 1px 3px #eee;
    cursor: pointer;
    transition: background 0.2s, border 0.2s;
}
.arrangement-item.selected {
    background: #e6f7ff;
    border: 1.5px solid #1890ff;
}
.treasure-divider {
    display: inline-block;
    vertical-align: middle;
    width: 1px;
    height: 22px;
    background: #ddd;
    margin: 0 10px 0 0;
}
.treasure-img {
    transition: transform 0.2s;
    object-fit: contain;
    display: block;
}
.rotated-img {
    /* 旋转图片并保证拉伸方向正确 */
    /* transform 由 style 绑定动态控制，避免和style冲突 */
}
</style>
