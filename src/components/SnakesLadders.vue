<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { Button, Card, Icon, Message, Upload } from "view-ui-plus";

const sizes = [7, 8, 9];
const activeMapId = ref("7-1");
const selectedOperation = ref("select");
const selectedRewardType = ref(1);
const selectedCell = ref(null);
const pendingEndpoint = ref(null);
const boardFrame = ref(null);
const dragState = ref(null);
let suppressCellClick = false;
const rewardOptions = [1, 2, 3, "dice", "shield"];
const rewardAssets = {
  dice: "/snakes_ladders/touzi.png",
  shield: "/snakes_ladders/shield.png",
};

const boardAssets = {
  7: "/snakes_ladders/snakes_ladders_qipan7x7.png",
  8: "/snakes_ladders/snakes_ladders_qipan8x8.png",
  9: "/snakes_ladders/snakes_ladders_qipan9x9.png",
};

const snakeAssets = {
  "1x2": [
    ["snakes/2x1_1.png", 87],
  ],
  "2x3": [
    ["snakes/2x3_1.png", 83],
    ["snakes/2x3_2.png", 91],
  ],
  "2x4": [
    ["snakes/2x4_1.png", 104],
    ["snakes/2x4_2.png", 106],
    ["snakes/2x4_3.png", 104],
  ],
  "2x5": [
    ["snakes/2x5_1.png", 105],
  ],
  "3x3": [
    ["snakes/3x3_1.png", 122],
    ["snakes/3x3_2.png", 122],
    ["snakes/3x3_3.png", 119],
  ],
  "3x4": [
    ["snakes/3x4_1.png", 106],
    ["snakes/3x4_2.png", 106],
  ],
  "3x5": [
    ["snakes/3x5_1.png", 102],
    ["snakes/3x5_2.png", 103],
    ["snakes/3x5_3.png", 105],
    ["snakes/3x5_4.png", 107],
  ],
};

const ladderAssets = {
  "2x2": ["ladders/2x2.png", 96],
  "2x3": ["ladders/2x3.png", 95],
  "2x4": ["ladders/2x4.png", 94],
  "2x5": ["ladders/2x5.png", 95],
  "2x6": ["ladders/2x6.png", 94],
  "3x3": ["ladders/3x3.png", 95],
  "3x4": ["ladders/3x4.png", 96],
  "3x5": ["ladders/3x5.png", 95],
  "3x6": ["ladders/3x6.png", 95],
  "4x4": ["ladders/4x4.png", 97],
  "4x5": ["ladders/4x5.png", 96],
  "4x6": ["ladders/4x6.png", 95],
};

const boardBounds = {
  7: {
    width: 753,
    height: 766,
    x: [44, 139, 234, 329, 424, 519, 614, 709],
    y: [34, 129, 224, 319, 414, 509, 604, 699],
  },
  8: {
    width: 847,
    height: 860,
    x: [44, 139, 234, 329, 424, 519, 614, 709, 804],
    y: [34, 129, 224, 319, 414, 509, 604, 699, 794],
  },
  9: {
    width: 942,
    height: 953,
    x: [44, 139, 234, 329, 424, 519, 614, 709, 804, 899],
    y: [34, 129, 224, 319, 414, 509, 604, 699, 794, 889],
  },
};

function createMap(size, index) {
  return {
    id: `${size}-${index}`,
    name: `地图${index}`,
    size,
    cells: {},
    snakes: [],
    ladders: [],
  };
}

const randomCounts = {
  7: { snakes: 2, ladders: 2, rewards: 6 },
  8: { snakes: 3, ladders: 3, rewards: 8 },
  9: { snakes: 4, ladders: 4, rewards: 10 },
};

function createRandomMap(size, index) {
  const map = createMap(size, index);
  const config = randomCounts[size];
  const rewardTypes = shuffle(Array.from({ length: config.rewards }, (_, i) => rewardOptions[i % rewardOptions.length]));
  return Object.assign(map, buildRandomLayout(size, config.snakes, config.ladders, rewardTypes));
}

const maps = reactive({
  7: [createRandomMap(7, 1), createRandomMap(7, 2)],
  8: [createRandomMap(8, 1), createRandomMap(8, 2)],
  9: [createRandomMap(9, 1), createRandomMap(9, 2)],
});

const nextMapIndex = reactive({ 7: 3, 8: 3, 9: 3 });
const currentMap = computed(() => sizes.flatMap((size) => maps[size]).find((map) => map.id === activeMapId.value));
const activeSize = computed(() => currentMap.value?.size || 7);
const boardRows = computed(() => {
  const size = activeSize.value;
  const bounds = boardBounds[size];
  return bounds.y.slice(0, -1).map((top, rowIndex) => {
    const row = size - rowIndex - 1;
    const cells = Array.from({ length: size }, (_, col) => ({
      no: row % 2 === 0 ? row * size + col + 1 : row * size + size - col,
      col,
    }));
    return {
      cells,
      style: {
        top: `${top / bounds.height * 100}%`,
        left: `${bounds.x[0] / bounds.width * 100}%`,
        width: `${(bounds.x[bounds.x.length - 1] - bounds.x[0]) / bounds.width * 100}%`,
        height: `${(bounds.y[rowIndex + 1] - top) / bounds.height * 100}%`,
        gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
      },
    };
  });
});

function selectMap(map) {
  activeMapId.value = map.id;
  selectedCell.value = null;
  pendingEndpoint.value = null;
  dragState.value = null;
}

function isFixedCell(cellNo, size = activeSize.value) {
  return cellNo === 1 || cellNo === size * size;
}

function removePairAt(cellNo) {
  for (const type of ["snakes", "ladders"]) {
    const list = currentMap.value[type];
    for (let i = list.length - 1; i >= 0; i -= 1) {
      const pair = list[i];
      const hasCell = type === "snakes"
        ? pair.head === cellNo || pair.tail === cellNo
        : pair.bottom === cellNo || pair.top === cellNo;
      if (hasCell) list.splice(i, 1);
    }
  }
}

function removeCellOccupancy(cellNo) {
  removePairAt(cellNo);
  delete currentMap.value.cells[cellNo];
}

function isCellOccupied(cellNo, map = currentMap.value) {
  if (map.cells[cellNo]) return true;
  return map.snakes.some((pair) => pair.head === cellNo || pair.tail === cellNo)
    || map.ladders.some((pair) => pair.bottom === cellNo || pair.top === cellNo);
}

function applyReward(cellNo) {
  if (isFixedCell(cellNo) || isCellOccupied(cellNo)) return;
  currentMap.value.cells[cellNo] = selectedRewardType.value;
  selectedCell.value = cellNo;
}

function clearCell(cellNo) {
  if (isFixedCell(cellNo)) return;
  removeCellOccupancy(cellNo);
  selectedCell.value = cellNo;
}

function startPair(cellNo) {
  if (isFixedCell(cellNo) || isCellOccupied(cellNo)) return;
  pendingEndpoint.value = cellNo;
  selectedCell.value = cellNo;
}

function finishPair(cellNo) {
  if (!canPlacePair(pendingEndpoint.value, cellNo, selectedOperation.value)) return;
  const first = pendingEndpoint.value;
  const low = Math.min(first, cellNo);
  const high = Math.max(first, cellNo);
  if (selectedOperation.value === "snake") {
    currentMap.value.snakes.push({ head: high, tail: low });
  } else {
    currentMap.value.ladders.push({ bottom: low, top: high });
  }
  pendingEndpoint.value = null;
  selectedCell.value = null;
}

function selectCell(cell) {
  if (isCellDisabled(cell.no)) return;
  if (selectedOperation.value === "select") {
    selectedCell.value = cell.no;
    return;
  }
  if (selectedOperation.value === "snake" || selectedOperation.value === "ladder") {
    if (pendingEndpoint.value == null) startPair(cell.no);
    else finishPair(cell.no);
    return;
  }
  if (selectedOperation.value === "clear") clearCell(cell.no);
  else applyReward(cell.no);
}

function draggableItem(cellNo) {
  if (currentMap.value.cells[cellNo]) return { type: "reward", source: cellNo };
  for (const pair of currentMap.value.snakes) {
    if (pair.head === cellNo) return { type: "snake", pair, endpoint: "head", source: cellNo };
    if (pair.tail === cellNo) return { type: "snake", pair, endpoint: "tail", source: cellNo };
  }
  for (const pair of currentMap.value.ladders) {
    if (pair.top === cellNo) return { type: "ladder", pair, endpoint: "top", source: cellNo };
    if (pair.bottom === cellNo) return { type: "ladder", pair, endpoint: "bottom", source: cellNo };
  }
  return null;
}

function cellLabel(cellNo) {
  if (cellNo === 1) return "开始格";
  if (cellNo === activeSize.value * activeSize.value) return "结束格";
  const item = draggableItem(cellNo);
  if (!item) return "空白格";
  if (item.type === "reward") {
    const reward = currentMap.value.cells[cellNo];
    return `奖励格 ${reward === "dice" ? "骰子" : reward === "shield" ? "盾牌" : reward}`;
  }
  if (item.type === "snake") return item.endpoint === "head" ? "蛇头" : "蛇尾";
  return item.endpoint === "top" ? "梯子顶部" : "梯子底部";
}

function cellAtPoint(event) {
  const rect = boardFrame.value.getBoundingClientRect();
  const bounds = boardBounds[activeSize.value];
  const x = (event.clientX - rect.left) / rect.width * bounds.width;
  const y = (event.clientY - rect.top) / rect.height * bounds.height;
  const col = bounds.x.findIndex((start, index) => index < activeSize.value && x >= start && x < bounds.x[index + 1]);
  const visualRow = bounds.y.findIndex((start, index) => index < activeSize.value && y >= start && y < bounds.y[index + 1]);
  if (col < 0 || visualRow < 0) return null;
  const row = activeSize.value - visualRow - 1;
  return row % 2 === 0 ? row * activeSize.value + col + 1 : row * activeSize.value + activeSize.value - col;
}

function canMoveItem(item, target) {
  if (!target || target === item.source || isFixedCell(target) || isCellOccupied(target)) return false;
  if (item.type === "reward") return true;
  const otherEndpoint = item.type === "snake"
    ? item.pair[item.endpoint === "head" ? "tail" : "head"]
    : item.pair[item.endpoint === "top" ? "bottom" : "top"];
  const keepsDirection = item.endpoint === "head" || item.endpoint === "top"
    ? target > otherEndpoint
    : target < otherEndpoint;
  return keepsDirection && isPairGeometryValid(target, otherEndpoint, item.type);
}

function startDrag(cell, event) {
  if (selectedOperation.value !== "select") return;
  const item = draggableItem(cell.no);
  if (!item) return;
  dragState.value = { ...item, pointerId: event.pointerId, target: cell.no, moved: false, valid: false };
  event.currentTarget.setPointerCapture(event.pointerId);
}

function updateDrag(event) {
  if (!dragState.value || dragState.value.pointerId !== event.pointerId) return;
  const target = cellAtPoint(event);
  dragState.value.target = target;
  dragState.value.moved = target != null && target !== dragState.value.source;
  dragState.value.valid = dragState.value.moved && canMoveItem(dragState.value, target);
}

function finishDrag(event) {
  if (!dragState.value || dragState.value.pointerId !== event.pointerId) return;
  updateDrag(event);
  const drag = dragState.value;
  if (drag.moved && drag.valid) {
    if (drag.type === "reward") {
      currentMap.value.cells[drag.target] = currentMap.value.cells[drag.source];
      delete currentMap.value.cells[drag.source];
    } else {
      drag.pair[drag.endpoint] = drag.target;
    }
    selectedCell.value = drag.target;
  } else if (drag.moved) {
    selectedCell.value = drag.source;
  }
  if (drag.moved) {
    suppressCellClick = true;
    window.setTimeout(() => { suppressCellClick = false; });
  }
  dragState.value = null;
}

function cancelDrag() {
  dragState.value = null;
}

function handleCellClick(cell) {
  if (suppressCellClick) {
    suppressCellClick = false;
    return;
  }
  selectCell(cell);
}

function newMap(size) {
  const index = nextMapIndex[size]++;
  const map = createRandomMap(size, index);
  maps[size].push(map);
  activeMapId.value = map.id;
  selectedCell.value = null;
  pendingEndpoint.value = null;
}

function removeMap(size, mapId) {
  const index = maps[size].findIndex((map) => map.id === mapId);
  maps[size].splice(index, 1);
  if (activeMapId.value !== mapId) return;
  const next = maps[size][index] || maps[size][index - 1] || sizes.flatMap((value) => maps[value])[0];
  activeMapId.value = next?.id || "";
  selectedCell.value = null;
  pendingEndpoint.value = null;
}

function setOperation(operation) {
  selectedOperation.value = operation;
  pendingEndpoint.value = null;
  selectedCell.value = null;
  dragState.value = null;
}

function setRewardType(type) {
  selectedRewardType.value = type;
  setOperation("reward");
}

function handleKeydown(event) {
  if (event.key >= "1" && event.key <= "3") {
    setRewardType(Number(event.key));
    return;
  }
  if (event.key.toLowerCase() === "q") setOperation("select");
  else if (event.key.toLowerCase() === "s") setOperation("snake");
  else if (event.key.toLowerCase() === "t") setOperation("ladder");
  else if (event.key.toLowerCase() === "d" || event.key === "Delete") setOperation("clear");
}

function cellPoint(cellNo) {
  const size = activeSize.value;
  const bounds = boardBounds[size];
  const index = cellNo - 1;
  const row = Math.floor(index / size);
  const offset = index % size;
  const col = row % 2 === 0 ? offset : size - offset - 1;
  const visualRow = size - row - 1;
  return {
    x: ((bounds.x[col] + bounds.x[col + 1]) / 2) / bounds.width * 100,
    y: ((bounds.y[visualRow] + bounds.y[visualRow + 1]) / 2) / bounds.height * 100,
  };
}

function cellPosition(cellNo, size = activeSize.value) {
  const index = cellNo - 1;
  const row = Math.floor(index / size);
  const offset = index % size;
  return {
    row,
    col: row % 2 === 0 ? offset : size - offset - 1,
  };
}

function pairAsset(first, second, type, size = activeSize.value) {
  const a = cellPosition(first, size);
  const b = cellPosition(second, size);
  const spans = [Math.abs(a.col - b.col) + 1, Math.abs(a.row - b.row) + 1].sort((x, y) => x - y);
  const key = `${spans[0]}x${spans[1]}`;
  if (type === "ladder") return ladderAssets[key];
  const variants = snakeAssets[key];
  return variants?.[(first + second) % variants.length];
}

function isPairGeometryValid(first, second, type, size = activeSize.value) {
  if (first === second || isFixedCell(first, size) || isFixedCell(second, size)) return false;
  const a = cellPosition(first, size);
  const b = cellPosition(second, size);
  if (a.row === b.row) return false;
  if (type === "snake" && cellPosition(Math.max(first, second), size).row === size - 1) return false;
  return !!pairAsset(first, second, type, size);
}

function canPlacePair(first, second, type, map = currentMap.value) {
  if (first == null || isCellOccupied(second, map)) return false;
  return isPairGeometryValid(first, second, type, map.size);
}

function hasValidPartner(cellNo, type) {
  if (isFixedCell(cellNo) || isCellOccupied(cellNo)) return false;
  for (let other = 2; other < activeSize.value * activeSize.value; other += 1) {
    if (!isCellOccupied(other) && isPairGeometryValid(cellNo, other, type)) return true;
  }
  return false;
}

function isCellDisabled(cellNo) {
  if (isFixedCell(cellNo)) return true;
  if (selectedOperation.value === "select") return false;
  if (selectedOperation.value === "clear") return !isCellOccupied(cellNo);
  if (selectedOperation.value === "reward") return isCellOccupied(cellNo);
  if (pendingEndpoint.value != null) return cellNo === pendingEndpoint.value || !canPlacePair(pendingEndpoint.value, cellNo, selectedOperation.value);
  return !hasValidPartner(cellNo, selectedOperation.value);
}

function isCellDimmed(cellNo) {
  if (dragState.value?.moved) {
    return cellNo !== dragState.value.source && !canMoveItem(dragState.value, cellNo);
  }
  return (selectedOperation.value === "snake" || selectedOperation.value === "ladder") && isCellDisabled(cellNo);
}

function shuffle(items) {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function buildRandomLayout(size, snakeCount, ladderCount, rewardTypes) {
  const pairCandidates = {};
  for (const type of ["snake", "ladder"]) {
    pairCandidates[type] = [];
    for (let first = 2; first < size * size; first += 1) {
      for (let second = first + 1; second < size * size; second += 1) {
        if (isPairGeometryValid(first, second, type, size)) pairCandidates[type].push([first, second]);
      }
    }
  }
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const occupied = new Set([1, size * size]);
    const layout = { cells: {}, snakes: [], ladders: [] };
    const tasks = shuffle([
      ...Array(snakeCount).fill("snake"),
      ...Array(ladderCount).fill("ladder"),
    ]);
    let failed = false;
    for (const type of tasks) {
      const candidates = shuffle(pairCandidates[type]).filter(([a, b]) => !occupied.has(a) && !occupied.has(b));
      if (!candidates.length) {
        failed = true;
        break;
      }
      const [low, high] = candidates[0];
      occupied.add(low);
      occupied.add(high);
      if (type === "snake") layout.snakes.push({ head: high, tail: low });
      else layout.ladders.push({ bottom: low, top: high });
    }
    if (failed) continue;
    const emptyCells = shuffle(Array.from({ length: size * size - 2 }, (_, i) => i + 2).filter((cell) => !occupied.has(cell)));
    if (emptyCells.length < rewardTypes.length) continue;
    rewardTypes.forEach((type, index) => {
      layout.cells[emptyCells[index]] = type;
    });
    return layout;
  }
  return { cells: {}, snakes: [], ladders: [] };
}

function rearrangeMap() {
  const rewardTypes = Object.values(currentMap.value.cells);
  const layout = buildRandomLayout(activeSize.value, currentMap.value.snakes.length, currentMap.value.ladders.length, rewardTypes);
  currentMap.value.cells = layout.cells;
  currentMap.value.snakes = layout.snakes;
  currentMap.value.ladders = layout.ladders;
  selectedCell.value = null;
  pendingEndpoint.value = null;
}

function pairImage(pair, type) {
  const asset = pairAsset(
    type === "snake" ? pair.head : pair.bottom,
    type === "snake" ? pair.tail : pair.top,
    type,
  );
  return `/snakes_ladders/${asset[0]}`;
}

function pairImageStyle(pair, type) {
  const firstCell = type === "snake" ? pair.tail : pair.bottom;
  const secondCell = type === "snake" ? pair.head : pair.top;
  const from = cellPoint(firstCell);
  const to = cellPoint(secondCell);
  const asset = pairAsset(firstCell, secondCell, type);
  const angle = Math.atan2(to.x - from.x, -(to.y - from.y)) * 180 / Math.PI;
  const bounds = boardBounds[activeSize.value];
  return {
    left: `${(from.x + to.x) / 2}%`,
    top: `${(from.y + to.y) / 2}%`,
    width: `${asset[1] / bounds.width * 100}%`,
    transform: `translate(-50%, -50%) rotate(${angle}deg)`,
  };
}

function isValidMap(map) {
  const size = map.size;
  if (!sizes.includes(size) || !map.cells || !Array.isArray(map.snakes) || !Array.isArray(map.ladders)) return false;
  const occupied = new Set([1, size * size]);
  for (const [cellText, rewardType] of Object.entries(map.cells)) {
    const cell = Number(cellText);
    if (!Number.isInteger(cell) || cell < 2 || cell >= size * size || !rewardOptions.includes(rewardType) || occupied.has(cell)) return false;
    occupied.add(cell);
  }
  for (const pair of map.snakes) {
    if (!Number.isInteger(pair.head) || !Number.isInteger(pair.tail) || pair.head <= pair.tail || occupied.has(pair.head) || occupied.has(pair.tail) || !isPairGeometryValid(pair.head, pair.tail, "snake", size)) return false;
    occupied.add(pair.head);
    occupied.add(pair.tail);
  }
  for (const pair of map.ladders) {
    if (!Number.isInteger(pair.top) || !Number.isInteger(pair.bottom) || pair.top <= pair.bottom || occupied.has(pair.top) || occupied.has(pair.bottom) || !isPairGeometryValid(pair.top, pair.bottom, "ladder", size)) return false;
    occupied.add(pair.top);
    occupied.add(pair.bottom);
  }
  return true;
}

function exportMaps() {
  const data = {
    version: 1,
    maps: sizes.flatMap((size) => maps[size]),
  };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "snakes_ladders_maps.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importMaps(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data.version !== 1 || !Array.isArray(data.maps) || !data.maps.every(isValidMap)) throw new Error();
    for (const size of sizes) {
      const group = data.maps.filter((map) => map.size === size).map((map, index) => ({
        ...JSON.parse(JSON.stringify(map)),
        id: `${size}-${index + 1}`,
        name: map.name || `地图${index + 1}`,
      }));
      maps[size].splice(0, maps[size].length, ...group);
      nextMapIndex[size] = group.length + 1;
    }
    const firstMap = sizes.flatMap((size) => maps[size])[0];
    activeMapId.value = firstMap?.id || "";
    selectedCell.value = null;
    pendingEndpoint.value = null;
    Message.success("导入成功");
  } catch {
    Message.error("导入失败，地图数据不符合规则");
  }
  return false;
}

onMounted(() => window.addEventListener("keydown", handleKeydown));
onUnmounted(() => window.removeEventListener("keydown", handleKeydown));
</script>

<template>
  <div class="snakes-ladders-editor">
    <div class="editor-toolbar">
      <div>
        <div class="editor-title">蛇梯地图编辑器</div>
        <div class="editor-subtitle">按地图尺寸管理多张布局</div>
      </div>
      <div class="global-actions">
        <Upload accept=".json" action="" :show-upload-list="false" :before-upload="importMaps">
          <Button icon="ios-cloud-upload-outline">导入 JSON</Button>
        </Upload>
        <Button icon="ios-cloud-download-outline" @click="exportMaps">导出 JSON</Button>
      </div>
    </div>

    <div class="editor-layout">
      <Card class="map-list-card" dis-hover>
        <template #title>地图</template>
        <div v-for="size in sizes" :key="size" class="map-group">
          <div class="map-group-header">
            <span>{{ size }}x{{ size }}</span>
            <Button size="small" icon="md-add" @click="newMap(size)">新建</Button>
          </div>
          <div v-if="maps[size].length" class="map-group-list">
            <div
              v-for="map in maps[size]"
              :key="map.id"
              class="map-list-item"
              :class="{ active: map.id === activeMapId }"
              @click="selectMap(map)"
            >
              <span>{{ map.name }}</span>
              <Button
                class="map-delete-button"
                size="small"
                type="text"
                icon="md-trash"
                @click.stop="removeMap(size, map.id)"
              />
            </div>
          </div>
          <div v-else class="empty-map-list">暂无地图</div>
        </div>
      </Card>

      <Card class="map-area-card" dis-hover>
        <template #title>
          <span v-if="currentMap">地图大小（{{ activeSize }}x{{ activeSize }}）</span>
          <span v-else>地图区域</span>
        </template>
        <div v-if="currentMap" class="map-area-content">
          <div class="map-tools">
            <div class="operation-types">
              <Button
                :type="selectedOperation === 'select' ? 'primary' : 'default'"
                @click="setOperation('select')"
              >
                选择(q)
              </Button>
              <Button
                :type="selectedOperation === 'snake' ? 'primary' : 'default'"
                @click="setOperation('snake')"
              >
                蛇(s)
              </Button>
              <Button
                :type="selectedOperation === 'ladder' ? 'primary' : 'default'"
                @click="setOperation('ladder')"
              >
                梯子(t)
              </Button>
            </div>
            <div class="reward-types">
              <Button
                v-for="rewardType in rewardOptions"
                :key="rewardType"
                size="small"
                :type="selectedOperation === 'reward' && selectedRewardType === rewardType ? 'primary' : 'default'"
                @click="setRewardType(rewardType)"
              >
                <span v-if="rewardType === 'dice'" class="reward-option">
                  <img :src="rewardAssets.dice" alt="" />
                  骰子
                </span>
                <span v-else-if="rewardType === 'shield'" class="reward-option">
                  <img :src="rewardAssets.shield" alt="" />
                  盾牌
                </span>
                <span v-else>{{ rewardType }}</span>
              </Button>
            </div>
            <span class="tool-divider" />
            <Button
              :type="selectedOperation === 'clear' ? 'primary' : 'default'"
              icon="md-eraser"
              @click="setOperation('clear')"
            >
              清除(d)
            </Button>
            <span class="tool-divider" />
            <Button icon="md-shuffle" @click="rearrangeMap">重排</Button>
          </div>

          <div class="board-stage">
            <div
              ref="boardFrame"
              class="board-frame"
              @pointermove="updateDrag"
              @pointerup="finishDrag"
              @pointercancel="cancelDrag"
            >
              <img class="board-background" :src="boardAssets[activeSize]" alt="蛇梯棋盘" />
              <img
                v-for="pair in currentMap.snakes"
                :key="`snake-${pair.head}-${pair.tail}`"
                class="pair-image"
                :src="pairImage(pair, 'snake')"
                :style="pairImageStyle(pair, 'snake')"
                alt=""
              />
              <img
                v-for="pair in currentMap.ladders"
                :key="`ladder-${pair.bottom}-${pair.top}`"
                class="pair-image"
                :src="pairImage(pair, 'ladder')"
                :style="pairImageStyle(pair, 'ladder')"
                alt=""
              />
              <div v-for="(row, rowIndex) in boardRows" :key="rowIndex" class="board-row" :style="row.style">
                <button
                  v-for="cell in row.cells"
                  :key="cell.no"
                  class="board-cell"
                  :class="{
                    selected: selectedCell === cell.no,
                    pending: pendingEndpoint === cell.no,
                    reward: currentMap.cells[cell.no],
                    start: cell.no === 1,
                    finish: cell.no === activeSize * activeSize,
                    draggable: selectedOperation === 'select' && isCellOccupied(cell.no),
                    dimmed: isCellDimmed(cell.no),
                    'drag-source': dragState?.source === cell.no,
                    'drag-target': dragState?.moved && dragState?.target === cell.no,
                    'drag-invalid': dragState?.moved && dragState?.target === cell.no && !dragState?.valid,
                  }"
                  type="button"
                  :data-cell="cell.no"
                  :disabled="isCellDisabled(cell.no)"
                  :aria-label="cellLabel(cell.no)"
                  @pointerdown="startDrag(cell, $event)"
                  @click="handleCellClick(cell)"
                >
                  <span v-if="typeof currentMap.cells[cell.no] === 'number'" class="reward-number">{{ currentMap.cells[cell.no] }}</span>
                  <img
                    v-else-if="currentMap.cells[cell.no]"
                    class="reward-image"
                    :src="rewardAssets[currentMap.cells[cell.no]]"
                    alt=""
                    draggable="false"
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-map-area">
          <Icon type="ios-map-outline" />
          <div>暂无地图</div>
        </div>
      </Card>
    </div>
  </div>
</template>

<style scoped>
.snakes-ladders-editor {
  min-height: 720px;
  padding: 4px;
}

.editor-toolbar,
.card-title-row {
  display: flex;
  align-items: center;
}

.editor-toolbar {
  gap: 24px;
  justify-content: space-between;
  margin-bottom: 16px;
}

.global-actions {
  display: flex;
  gap: 8px;
}

.editor-title {
  color: #17233c;
  font-size: 22px;
  font-weight: 600;
}

.editor-subtitle {
  color: #808695;
  font-size: 13px;
  margin-top: 4px;
}

.editor-layout {
  display: grid;
  grid-template-columns: 210px minmax(560px, 1fr);
  gap: 16px;
  align-items: start;
}

.map-list-card,
.map-area-card {
  min-height: 720px;
}

.map-group + .map-group {
  margin-top: 18px;
}

.map-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px 6px;
  color: #515a6e;
  font-size: 14px;
  font-weight: 600;
}

.map-group-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.empty-map-list {
  padding: 6px 10px;
  color: #c5c8ce;
  font-size: 13px;
}

.map-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 38px;
  padding: 0 10px;
  border-radius: 4px;
  color: #515a6e;
  cursor: pointer;
}

.map-list-item:hover,
.map-list-item.active {
  color: #2d8cf0;
  background: #f0faff;
}

.map-delete-button {
  opacity: 1;
}

.map-area-content {
  display: flex;
  flex-direction: column;
  min-height: 635px;
}

.map-tools {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 10px;
  min-height: 52px;
  padding: 4px 0 16px;
  border-bottom: 1px solid #e8eaec;
}

.operation-types,
.reward-types {
  display: flex;
  align-items: center;
  gap: 6px;
}

.operation-types {
  display: flex;
}

.tool-divider {
  width: 1px;
  height: 24px;
  background: #dcdee2;
}

.board-stage {
  display: flex;
  justify-content: center;
  padding: 22px 8px 8px;
}

.board-frame {
  position: relative;
  width: min(100%, 720px);
  line-height: 0;
}

.board-background {
  display: block;
  width: 100%;
  height: auto;
}

.board-row {
  position: absolute;
  display: grid;
  z-index: 3;
}

.board-cell {
  position: relative;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  line-height: 1;
}

.board-cell:hover,
.board-cell.selected {
  background: rgba(45, 140, 240, 0.2);
  box-shadow: inset 0 0 0 2px #2d8cf0;
}

.board-cell.pending {
  background: rgba(255, 128, 0, 0.28);
  box-shadow: inset 0 0 0 3px #ff8a00;
}

.board-cell.draggable {
  cursor: grab;
  touch-action: none;
}

.board-cell.drag-source {
  cursor: grabbing;
}

.board-cell.reward {
  background: rgba(255, 193, 7, 0.34);
}

.board-cell.dimmed {
  background: rgba(23, 35, 61, 0.85);
  box-shadow: none;
}

.board-cell.drag-target {
  background: rgba(25, 190, 107, 0.24);
  box-shadow: inset 0 0 0 3px #19be6b;
}

.board-cell.drag-target.drag-invalid {
  background: rgba(23, 35, 61, 0.85);
  box-shadow: inset 0 0 0 3px #ed4014;
}

.board-cell.start,
.board-cell.finish {
  cursor: not-allowed;
}

.reward-number {
  color: #8d4d00;
  font-size: clamp(22px, 4vw, 42px);
  font-weight: 700;
  line-height: 1;
  text-shadow: 0 1px 1px rgba(255, 255, 255, 0.8);
}

.reward-option {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.reward-option img {
  width: 17px;
  height: 17px;
  object-fit: contain;
  pointer-events: none;
}

.reward-image {
  display: block;
  width: 66%;
  height: 66%;
  margin: auto;
  object-fit: contain;
  pointer-events: none;
  user-select: none;
  -webkit-user-drag: none;
}

.pair-image {
  position: absolute;
  z-index: 2;
  pointer-events: none;
  transform-origin: center;
}

.empty-map-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 620px;
  gap: 16px;
  color: #808695;
}

.empty-map-area > .ivu-icon {
  color: #c5c8ce;
  font-size: 48px;
}

@media (max-width: 1100px) {
  .editor-toolbar {
    flex-wrap: wrap;
  }

  .editor-layout {
    grid-template-columns: 180px minmax(420px, 1fr);
  }
}

@media (max-width: 720px) {
  .editor-layout {
    grid-template-columns: 1fr;
  }

  .map-list-card,
  .map-area-card {
    min-height: auto;
  }

  .map-tools {
    justify-content: flex-start;
  }

  .global-actions {
    width: 100%;
  }
}
</style>
