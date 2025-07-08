<script setup>
import { ref, computed, reactive, watch, onMounted } from 'vue'
import { Card, Input, Button, Upload, Icon, Message, Row, Col, Alert, Exception } from 'view-ui-plus'
import JSZip from 'jszip'


const originalUrl = ref('https://playables.safedk.com/74616804a7dc29147dfb0afe122a9fd2/67518f8cfdac53eb0cf4ce54f52caec2/ad.html')
const parsedRes = reactive({
    srcHTMLContent: '', // 真正可玩的html内容
    srcItems: [],
}) //解析出的内容
const modifiedObj = reactive({
    resItems: [], //经过修改后的srcItems
    finalHTMLContent: '' //经过修改后的html内容
}) //修改后的内容

const iframeRef = ref(null)

const parsing = ref(false)

const serverAddress = computed(() => {
    try {
        if (originalUrl.value.endsWith('.html')) {
            const lastSlashIndex = originalUrl.value.lastIndexOf('/')
            return originalUrl.value.substring(0, lastSlashIndex + 1)
        }
        return originalUrl.value
    } catch (error) {
        console.error('解析URL失败:', error)
        return ''
    }
})

async function fetchByProxy(url, contentType = 'html') {
    const proxyServices = [
        `https://thingproxy.freeboard.io/fetch/${url}`,
        `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
        `https://corsproxy.io/?${encodeURIComponent(url)}`,
    ]

    const headers = contentType === 'js'
        ? {
            'Accept': 'application/javascript,*/*;q=0.8',
            'Cache-Control': 'no-cache'
        }
        : {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Cache-Control': 'no-cache'
        }

    for (const proxyUrl of proxyServices) {
        try {
            console.log(`尝试代理服务获取${contentType}:`, proxyUrl)
            const response = await fetch(proxyUrl, {
                method: 'GET',
                headers,
                timeout: 10000
            })

            if (response.ok) {
                const content = await response.text()
                console.log(`成功获取${contentType}内容成功:`)
                console.log(content)
                return content
            }
        } catch (error) {
            console.log(`代理服务失败:`, proxyUrl, error.message)
            continue
        }
    }

    throw new Error(`无法通过代理服务获取${contentType}内容`)
}

function replace_al_renderHtml(html) {
    // 修复相对路径为绝对路径
    let result = html.replace(/src="/g, 'src="' + serverAddress.value + '');

    // 替换al_renderHtml函数
    let code1 = "document.write(str.html);"
    let code2 = `
        window.parent.postMessage({type:"html",content:str.html},"*")
        ${code1}
    `;
    result = result.replace(code1, code2);

    return result;
}

/**
 * 创建隐藏 iframe 并返回引用
 */
function createHiddenIframe() {
    const iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.sandbox = 'allow-scripts'
    document.body.appendChild(iframe)
    return iframe
}

/**
 * 监听 window message，返回移除监听的函数和内容 Promise
 */
function waitForHtmlMessage() {
    const timeoutMs = 60000;
    return new Promise((resolve, reject) => {
        let timer = null
        function handler(event) {
            console.log('接收到iframe消息:', event)
            if (event.data && event.data.type === 'html') {
                cleanup()
                resolve(event.data.content)
            }
        }
        function cleanup() {
            window.removeEventListener('message', handler)
            if (timer) clearTimeout(timer)
        }
        window.addEventListener('message', handler)
        timer = setTimeout(() => {
            cleanup()
            reject(new Error('等待iframe响应超时'))
        }, timeoutMs)
    })
}

/**
 * 主流程：解析原始URL，获取主HTML内容
 */
async function parseOriginalUrl() {
    if (!originalUrl.value) {
        Message.warning('请输入原始链接')
        return false
    }
    let iframe = null
    try {
        // 1. 创建 iframe
        iframe = createHiddenIframe()

        // 2. 获取原始HTML内容并处理
        let iframeHtml = await fetchByProxy(originalUrl.value, 'html')
        iframeHtml = replace_al_renderHtml(iframeHtml)
        console.log("iframeHtml")
        console.log(iframeHtml)

        // 3. 加载到 iframe
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(iframeHtml)
        iframe.src = dataUrl
        console.log('iframe已加载，等待al_renderHtml调用...')

        // 4. 等待 window message 返回主内容
        const htmlResult = await waitForHtmlMessage()
        parsedRes.srcHTMLContent = htmlResult
        return true
    } catch (error) {
        Message.error(`解析失败: ${error.message}`)
        console.error('详细错误:', error)
        return false
    } finally {
        // 5. 清理 iframe
        if (iframe) {
            document.body.removeChild(iframe)
        }
    }
}

async function handleParse() {
    // 重置所有相关变量
    parsedRes.srcHTMLContent = '';
    parsedRes.srcItems = [];
    modifiedObj.resItems = []
    modifiedObj.finalHTMLContent = ''
    iframeRef.value.srcdoc = ''

    parsing.value = true

    try {
        console.log('第一步：解析原始URL...')
        await parseOriginalUrl();
        if (!parsedRes.srcHTMLContent) {
            return;
        }
        console.log('原始URL解析完成！')

        if (!SrcAssetItemHelper.value) {
            Message.error('不支持的广告格式！');
            console.error('不支持的广告格式！')
            return
        }

        console.log('第二步：获取原始资源项...')
        parsedRes.srcItems = SrcAssetItemHelper.value.getAllSrcItems(parsedRes.srcHTMLContent);
        if (!parsedRes.srcItems) {
            console.warn('没有找到可解析的资源项')
            return
        }
        console.log(`找到 ${parsedRes.srcItems.length} 个原始资源项`)

        resetModifiedObj(parsedRes.srcItems)

        if (modifiedObj.finalHTMLContent) {
            Message.success('解析完成！')
        }
        else {
            Message.error('解析失败！')
        }

    } catch (error) {
        Message.error(`解析失败: ${error.message}`)
        console.error('详细错误:', error)
    } finally {
        parsing.value = false
    }
}

function findRangeByStack(orgStr, keyStr, seperator) {
    if (!orgStr || !keyStr || !seperator || seperator.length !== 2) {
        console.error('参数错误: orgStr、keyStr或seperator无效')
        return null
    }

    // 先找到keyStr的位置
    const keyIndex = orgStr.indexOf(keyStr)
    if (keyIndex === -1) {
        console.error(`未找到关键字: ${keyStr}`)
        return null
    }

    // 从keyStr后面开始查找
    const searchStart = keyIndex + keyStr.length
    const searchStr = orgStr.substring(searchStart)

    const openChar = seperator[0]  // 开始字符，如 '['
    const closeChar = seperator[1] // 结束字符，如 ']'

    let stack = 0
    let startPos = -1
    let endPos = -1

    for (let i = 0; i < searchStr.length; i++) {
        const char = searchStr[i]

        if (char === openChar) {
            if (stack === 0) {
                startPos = searchStart + i  // 记录在原始字符串中的位置
            }
            stack++
        } else if (char === closeChar) {
            stack--
            if (stack === 0) {
                endPos = searchStart + i  // 记录在原始字符串中的位置
                break
            }
        }
    }

    if (startPos === -1 || endPos === -1) {
        console.log(`在${keyStr}后面未找到匹配的${openChar}${closeChar}`)
        return null
    }

    return {
        start: startPos,
        end: endPos
    }
}

function base64ToBinary(base64String) {
    const base64Content = base64String.replace(/^data:[^;]+;base64,/, '')
    const binaryString = atob(base64Content)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i) & 0xff
    }
    return bytes
}

class ParseHelperBase {
    getAllSrcItems(html) {
        throw new Exception("未实现");
    }
    setAllSrcItems(html, srcItems) {
        throw new Exception("未实现");
    }

    async reloadAllFromFileMap(srcItems, fileMap) {
        throw new Exception("未实现");
    }
    async toAllDownloadItems(srcItems) {
        throw new Exception("未实现");
    }
}

class ParseHelper_Applovin_CreateJS extends ParseHelperBase {

    async reloadAllFromFileMap(items, fileMap) {
        // 遍历 srcItems，根据 fileName 去 fileMap 填充 content 字段
        for (const item of items) {
            const fileName = item.fileName || item.src;
            const fileMapName = fileName.replace("assets/", "");
            if (fileMap[fileMapName]) {
                item.content = fileMap[fileMapName];
            }
        }
    }
    async toAllDownloadItems(items) {
        // 返回 {fileName, content, type} 列表，content 为二进制
        const all = [];
        for (const item of items) {
            let fileName = item.fileName || item.src;
            let type = item.type;
            let content = item.content;
            // 如果是 dataurl，转为二进制
            if (typeof content === 'string' && content.startsWith('data:')) {
                content = base64ToBinary(content);
            }
            // 如果是 json，导出字符串内容
            if ((type === 'json' || (fileName && fileName.endsWith('.json'))) && item.json) {
                content = new TextEncoder().encode(JSON.stringify(item.json));
            }
            if (content) {
                all.push({ fileName, content, type });
            }
        }
        return all;
    }
    getAllSrcItems(html) {
        // 使用 findRangeByStack 定位 var CUST_ASSETS =  和 var ASSETS_64 = ，解析内容
        function parseObjectByStack(str, key, brackets) {
            const range = findRangeByStack(str, key, brackets);
            if (!range) return null;
            const code = str.substring(range.start, range.end + 1);
            return JSON.parse(code);
        }
        const custAssets = parseObjectByStack(html, 'var CUST_ASSETS = ', '{}');
        const assets64 = parseObjectByStack(html, 'var ASSETS_64 = ', '[]');
        if (!custAssets || !assets64) return [];
        const srcItems = [];
        for (const fileName in custAssets) {
            const idx = custAssets[fileName];
            const dataurl = assets64[idx];
            let type = 'unknown';
            if (fileName.endsWith('.png')) type = 'image';
            else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) type = 'image';
            else if (fileName.endsWith('.mp3')) type = 'audio';
            else if (fileName.endsWith('.json')) type = 'json';
            srcItems.push({
                key: fileName.replace(/\.[^.]+$/, ''),
                fileName,
                type,
                content: dataurl,
                src: fileName
            });
        }
        return srcItems;
    }
    setAllSrcItems(html, srcItems) {
        // 反向生成 var CUST_ASSETS = ... 和 var ASSETS_64=...，并替换原有内容
        // 1. 生成 ASSETS_64 数组和 CUST_ASSETS 索引
        const assets64 = [];
        const custAssets = {};
        for (const item of srcItems) {
            let dataurl = item.content;
            // 如果是二进制，转为 dataurl
            if (dataurl instanceof Uint8Array) {
                // 仅支持 png/jpg/mp3/json
                let mime = 'application/octet-stream';
                if (item.type === 'image' && item.fileName.endsWith('.png')) mime = 'image/png';
                else if (item.type === 'image' && (item.fileName.endsWith('.jpg') || item.fileName.endsWith('.jpeg'))) mime = 'image/jpeg';
                else if (item.type === 'audio') mime = 'audio/mpeg';
                else if (item.type === 'json') mime = 'application/json';
                dataurl = 'data:' + mime + ';base64,' + btoa(String.fromCharCode(...dataurl));
            }
            let idx = assets64.indexOf(dataurl);
            if (idx === -1) {
                idx = assets64.length;
                assets64.push(dataurl);
            }
            custAssets[item.fileName] = idx;
        }
        // 2. 替换 html 中 var CUST_ASSETS 和 var ASSETS_64
        function replaceByStack(str, key, brackets, newCode) {
            const range = findRangeByStack(str, key, brackets);
            if (!range) return str;
            return str.substring(0, range.start) + newCode + str.substring(range.end + 1);
        }
        const newCustAssets = JSON.stringify(custAssets, null, 2);
        const newAssets64 = JSON.stringify(assets64, null, 2);
        let html2 = replaceByStack(html, 'var CUST_ASSETS = ', '{}', newCustAssets);
        html2 = replaceByStack(html2, 'var ASSETS_64 = ', '[]', newAssets64);
        return html2;
    }
}

class ParseHelper_Applovin_PhaserEditor extends ParseHelperBase {
    getKey(item) {
        return item.key || 'unknown'
    }
    getType(item) {
        return item.type || 'unknown'
    }
    getAtlasDataBase64Data(item) {
        return item.atlasURL || null
    }
    getMimeType(item) {
        const dataurl = this.getDataUrl(item)
        if (!dataurl) return null
        const mimeMatch = dataurl.match(/data:([^;]+);base64,/)
        return mimeMatch ? mimeMatch[1] : null
    }
    getBinaryContent(item) {
        const dataurl = this.getDataUrl(item)
        if (!dataurl) return null
        return base64ToBinary(dataurl)
    }
    getFileName(item) {
        const mimeType = this.getMimeType(item)
        const key = this.getKey(item)
        switch (this.getType(item)) {
            case 'image':
                if (mimeType === 'image/jpeg') {
                    return `${key}.jpeg`
                } else if (mimeType === 'image/png') {
                    return `${key}.png`
                }
                break
            case 'audio':
                return `${key}.mp3`
            case 'atlas':
                return `${key}_texture.png`
        }
        return `${key}.unknown`
    }
    getAtlasData(item) {
        const atlasBase64 = item.atlasURL
        if (!atlasBase64) return null
        try {
            return atob(atlasBase64.replace('data:text/json;base64,', ''))
        } catch (e) {
            console.log(`图集数据解析失败: ${e.message}`)
            return null
        }
    }
    toDownloadItem(item) {
        const binaryContent = this.getBinaryContent(item)
        if (!binaryContent) {
            return null
        }
        return {
            fileName: this.getFileName(item),
            content: binaryContent,
            type: this.getMimeType(item)
        }
    }
    async toDownloadItemAtlas(item) {
        let items = [];
        const key = this.getKey(item)
        const atlasData = this.getAtlasData(item)
        if (atlasData) {
            items.push({
                fileName: `atlas_src/${key}_atlas.json`,
                content: atlasData,
                type: 'text/json'
            })
            if (item.textureURL) {
                items.push({
                    fileName: `atlas_src/${key}_texture.png`,
                    content: base64ToBinary(item.textureURL),
                    type: 'image/png'
                })
            }
            try {
                const atlasJson = JSON.parse(atlasData)
                if (atlasJson && Array.isArray(atlasJson.frames) && item.textureURL) {
                    // 用 AtlasHelper.extractFrames 替代原有逐帧 canvas 逻辑
                    const frames = await AtlasHelper.extractFrames(atlasJson, item.textureURL, key, 'dataURL')
                    for (const frame of frames) {
                        // 转 Uint8Array，保持原有 items 结构
                        items.push({
                            fileName: `atlas/${key}/${frame.fileName}`,
                            content: base64ToBinary(frame.content),
                            type: 'image/png'
                        })
                    }
                }
            } catch (e) {
                console.warn('atlas json解析失败或图片裁剪失败', e)
            }
        }
        return items;
    }
    getAtlasDownloadItem(item) {
        const atlasData = this.getAtlasData(item)
        if (!atlasData) {
            return null
        }
        return {
            fileName: `${this.getKey(item)}_atlas.json`,
            content: atlasData,
            type: 'text/json'
        }
    }
    async toDownloadItems(item) {
        const type = this.getType(item)
        if (type === 'atlas') {
            return await AtlasHelper.toDownloadItems(item.key, item.atlasURL, item.textureURL)
        } else {
            const downloadItem = this.toDownloadItem(item)
            if (downloadItem) {
                return [downloadItem]
            }
        }
        return []
    }
    getSize(item) {
        const binaryContent = this.getBinaryContent(item)
        return binaryContent ? binaryContent.length : 0
    }
    getSizeFormatted(item) {
        const size = this.getSize(item)
        if (size < 1024) return size + ' B'
        if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
        return (size / (1024 * 1024)).toFixed(1) + ' MB'
    }
    getDataUrl(item) {
        if (item.urls && item.urls.length > 0) {
            return item.urls[0]
        }
        if (item.url) {
            return item.url
        }
        return null
    }
    setDataUrl(item, content_dataurl, extra_content_dataurl) {
        const type = this.getType(item);
        if (type === 'atlas') {
            if (content_dataurl) item.atlasURL = content_dataurl;
            if (extra_content_dataurl) item.textureURL = extra_content_dataurl;
        } else if (type === 'audio') {
            if (content_dataurl) item.urls = [content_dataurl];
        } else if (type === 'image') {
            if (content_dataurl) item.url = content_dataurl;
        } else {
            if (content_dataurl) item.url = content_dataurl;
        }
    }
    async reloadAllFromFileMap(items, fileMap) {
        for (const item of items) {
            if (item.type === 'atlas') {
                try {
                    const composed = await AtlasHelper.composeFromFileMap(item.key, item.atlasURL, fileMap);
                    if (composed && composed.json && composed.texture) {
                        this.setDataUrl(item, composed.json, composed.texture);
                    }
                } catch (e) {
                    console.warn('atlas大图合成失败', e)
                }

            } else {
                const fileName = this.getFileName(item)
                if (fileMap[fileName]) {
                    this.setDataUrl(item, fileMap[fileName])
                }
            }
        }
    }
    async toAllDownloadItems(items) {
        const all = []
        for (const item of items) {
            const files = await this.toDownloadItems(item)
            if (files && files.length) all.push(...files)
        }
        return all
    }
    getAllSrcItems(html) {
        const range = findRangeByStack(html, 'playableAssets:', '[]');
        if (!range) return [];
        const jsonStr = html.substring(range.start, range.end + 1);
        return eval(jsonStr);
    }
    setAllSrcItems(html, srcItems) {
        const range = findRangeByStack(html, 'playableAssets:', '[]');
        if (!range) return html;
        const str = JSON.stringify(srcItems)
        return html.substring(0, range.start) + str + html.substring(range.end + 1);
    }
}

const SrcAssetItemHelper = computed(() => {
    if (parsedRes.srcHTMLContent.indexOf("playableAssets:") >= 0) {
        return new ParseHelper_Applovin_PhaserEditor()
    }
    else if (parsedRes.srcHTMLContent.indexOf("var CUST_ASSETS = ") >= 0) {
        return new ParseHelper_Applovin_CreateJS()
    }
    else {
        return null;
    }
})

// AtlasHelper: Web 环境下基于 canvas 实现
const AtlasHelper = {

    async toDownloadItems(atlasFileName, atlasDataUrl, textureDataUrl) {
        let items = [
            {
                fileName: `atlas_src/${atlasFileName}_atlas.json`,
                content: base64ToBinary(atlasDataUrl),
                type: 'application/json'
            },
            {
                fileName: `atlas_src/${atlasFileName}_texture.png`,
                content: base64ToBinary(textureDataUrl),
                type: 'image/png'
            }
        ];

        const frames = await this.extractFrames(atlasFileName, atlasDataUrl, textureDataUrl);
        items.push(...frames);

        return items;
    },

    formatAtlasJson(atlasJson) {
        let newAtlasJson = {};
        newAtlasJson.meta = atlasJson.meta;

        newAtlasJson.frames = atlasJson.frames;
        if (!Array.isArray(atlasJson.frames) && typeof atlasJson.frames === 'object' && atlasJson.frames !== null) {
            // 兼容对象格式，补充 filename 字段
            newAtlasJson.frames = Object.entries(atlasJson.frames).map(([key, value]) => ({ ...value, filename: key }));
        }
        return newAtlasJson;
    },

    async extractFrames(atlasFileName, atlasData, textureImg) {
        // 支持 dataURL 格式的 atlasData
        // 假设 atlasData 必为 dataURL，直接提取 base64 并解码
        const base64 = atlasData.split(',')[1] || '';

        let atlasJson = JSON.parse(atob(base64));
        atlasJson = this.formatAtlasJson(atlasJson);

        // 支持 dataURL 格式的 textureImg
        let img;
        try {
            img = await new Promise((resolve, reject) => {
                const i = new window.Image();
                i.onload = () => resolve(i);
                i.onerror = reject;
                i.src = textureImg;
            });
        } catch (e) {
            console.error('AtlasHelper.extractFrames: 图片加载失败', e);
            return [];
        }
        const items = [];

        let framesArr = atlasJson.frames;

        for (const frameObj of framesArr) {
            const frame = frameObj.frame;
            const filename = frameObj.filename;
            const spriteSourceSize = frameObj.spriteSourceSize || { x: 0, y: 0 };
            const sourceSize = frameObj.sourceSize;
            const canvas = document.createElement('canvas');
            canvas.width = sourceSize.w;
            canvas.height = sourceSize.h;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(0,0,0,0)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(
                img,
                frame.x, frame.y, frame.w, frame.h,
                spriteSourceSize.x, spriteSourceSize.y, frame.w, frame.h
            );
            const dataUrl = canvas.toDataURL('image/png');
            items.push({
                fileName: `atlas/${atlasFileName}/${filename}`,
                content: base64ToBinary(dataUrl),
                type: 'image/png'
            });
        }
        return items;
    },

    async composeFromFileMap(atlasFileName, atlasDataUrl, fileMap) {
        // 1. 解析 atlasJson
        const base64 = atlasDataUrl.split(',')[1] || '';
        let atlasJson = JSON.parse(atob(base64));
        atlasJson = this.formatAtlasJson(atlasJson);
        // 2. 收集所有帧图片
        const images = [];
        let framesArr = atlasJson.frames;
        for (const frameObj of framesArr) {
            const filename = frameObj.filename;
            const fullName = `atlas/${atlasFileName}/${filename}`;
            const dataUrl = fileMap[fullName] || fileMap[filename];
            if (!dataUrl) throw new Error(`缺少图片：${fullName}`);
            images.push({ filename, dataUrl });
        }
        // 3. 载入所有图片
        const loadedImgs = await Promise.all(images.map(imgInfo => new Promise((resolve, reject) => {
            const i = new window.Image();
            i.onload = () => resolve({ ...imgInfo, width: i.width, height: i.height, img: i });
            i.onerror = reject;
            i.src = imgInfo.dataUrl;
        })));
        // 4. 自动计算大图尺寸与排列（n/2行 n/2列，向上取整）
        const n = loadedImgs.length;
        const cols = Math.ceil(Math.sqrt(n));
        const rows = Math.ceil(n / cols);
        // 取最大宽高做格子
        const cellW = Math.max(...loadedImgs.map(i => i.width));
        const cellH = Math.max(...loadedImgs.map(i => i.height));
        const canvas = document.createElement('canvas');
        canvas.width = cols * cellW;
        canvas.height = rows * cellH;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // 5. 依次绘制并修正 frame 参数
        const newAtlasJson = JSON.parse(JSON.stringify(atlasJson));
        let idx = 0;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (idx >= loadedImgs.length) break;
                const imgInfo = loadedImgs[idx];
                const x = c * cellW;
                const y = r * cellH;
                ctx.drawImage(imgInfo.img, x, y, imgInfo.width, imgInfo.height);
                // 修正对应 frame
                const frameObj = newAtlasJson.frames[idx];
                frameObj.frame.x = x;
                frameObj.frame.y = y;
                frameObj.frame.w = imgInfo.width;
                frameObj.frame.h = imgInfo.height;
                frameObj.spriteSourceSize = { x: 0, y: 0, w: imgInfo.width, h: imgInfo.height };
                frameObj.sourceSize = { w: imgInfo.width, h: imgInfo.height };
                frameObj.rotated = false;
                frameObj.trimmed = false;
                idx++;
            }
        }
        // 6. 生成大图dataurl和新json
        const textureDataUrl = canvas.toDataURL('image/webp', 0.5);
        const jsonStr = JSON.stringify(newAtlasJson);
        const jsonDataUrl = 'data:text/json;base64,' + btoa(unescape(encodeURIComponent(jsonStr)));
        return { json: jsonDataUrl, texture: textureDataUrl };
    },

};

async function downloadAsFile(content, filename, mimeType = 'text/plain') {
    if (!content) {
        Message.warning('没有可下载的内容')
        return
    }
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    Message.success(filename + ' 下载完成')
}

async function downloadAsZip(items, filename = 'extracted_resources.zip') {
    if (!items || items.length === 0) {
        Message.warning('没有可下载的资源')
        return
    }
    const zip = new JSZip()
    items.forEach(file => {
        zip.file(file.fileName, file.content)
    })
    const zipBlob = await zip.generateAsync({ type: 'blob' })
    downloadAsFile(zipBlob, filename, 'application/zip')
}

function downloadSrcHTMLContent() {
    downloadAsFile(parsedRes.srcHTMLContent, 'index_src.html', 'text/html')
}

function downloadDstHTMLContent() {
    downloadAsFile(modifiedObj.finalHTMLContent, 'index_dst.html', 'text/html')
}

async function downloadSrcResources() {
    const dstItems = await SrcAssetItemHelper.value.toAllDownloadItems(parsedRes.srcItems)
    await downloadAsZip(dstItems, 'extracted_resources.zip')
}

async function downloadDstResources() {
    const dstItems = await SrcAssetItemHelper.value.toAllDownloadItems(modifiedObj.resItems)
    await downloadAsZip(dstItems, 'extracted_resources.zip')
}

// 上传文件/文件夹/zip生成fileMap
async function buildFileMapFromUpload(fileOrEvent) {
    let fileMap = {};
    let fileList = [];
    let isZip = false;
    // zip 文件
    if (fileOrEvent instanceof File && fileOrEvent.name.endsWith('.zip')) {
        isZip = true;
    }
    // 拖拽文件夹（DataTransferItemList）
    else if (fileOrEvent.dataTransfer && fileOrEvent.dataTransfer.items) {
        fileList = Array.from(fileOrEvent.dataTransfer.items);
    }
    // input[type=file][webkitdirectory] 文件夹上传
    else if ((fileOrEvent.target && fileOrEvent.target.files && fileOrEvent.target.files.length > 0 && fileOrEvent.target.files[0].webkitRelativePath) ||
        (fileOrEvent.files && fileOrEvent.files.length > 0 && fileOrEvent.files[0].webkitRelativePath)) {
        const files = fileOrEvent.target ? fileOrEvent.target.files : fileOrEvent.files;
        fileList = Array.from(files);
    }
    // 单文件
    else if (fileOrEvent instanceof File) {
        fileList = [fileOrEvent];
    }

    // 处理 zip
    if (isZip) {
        const zip = await JSZip.loadAsync(fileOrEvent);
        const entries = Object.keys(zip.files);
        // 计算根目录前缀
        let prefix = '';
        if (entries.length > 0) {
            const paths = entries.filter(e => !zip.files[e].dir);
            if (paths.length > 0) {
                const parts = paths[0].split('/');
                if (parts.length > 1) {
                    prefix = parts[0] + '/';
                    // 检查所有文件都以同一前缀开头
                    if (!paths.every(p => p.startsWith(prefix))) {
                        prefix = '';
                    }
                }
            }
        }
        for (const entry of entries) {
            const zipEntry = zip.files[entry];
            if (!zipEntry.dir) {
                let content = await zipEntry.async('base64');
                let key = entry;
                if (prefix && key.startsWith(prefix)) {
                    key = key.slice(prefix.length);
                }
                fileMap[key] = 'data:;base64,' + content;
            }
        }
        return fileMap;
    }

    // 处理拖拽文件夹（DataTransferItemList）
    if (fileList.length > 0 && fileList[0] && fileList[0].webkitGetAsEntry) {
        // 递归读取所有文件
        async function readEntries(items, path = '') {
            for (const item of items) {
                if (item.webkitGetAsEntry) {
                    const entry = item.webkitGetAsEntry();
                    if (entry.isFile) {
                        await new Promise((resolve) => {
                            entry.file(file => {
                                const reader = new FileReader();
                                reader.onload = () => {
                                    // 计算根目录前缀
                                    let relPath = path + file.name;
                                    let key = relPath;
                                    if (key.startsWith('/')) key = key.slice(1);
                                    const parts = key.split('/');
                                    if (parts.length > 1 && path === '') {
                                        key = parts.slice(1).join('/');
                                    }
                                    fileMap[key] = reader.result;
                                    resolve();
                                };
                                reader.readAsDataURL(file);
                            });
                        });
                    } else if (entry.isDirectory) {
                        const dirReader = entry.createReader();
                        await new Promise((resolve) => {
                            dirReader.readEntries(async entries => {
                                await readEntries(entries, path + entry.name + '/');
                                resolve();
                            });
                        });
                    }
                }
            }
        }
        await readEntries(fileList);
        return fileMap;
    }

    // 处理 input[type=file][webkitdirectory] 或多文件
    if (fileList.length > 0) {
        // 计算根目录前缀
        let prefix = '';
        if (fileList[0].webkitRelativePath) {
            const paths = fileList.map(f => f.webkitRelativePath);
            if (paths.length > 0) {
                const parts = paths[0].split('/');
                if (parts.length > 1) {
                    prefix = parts[0] + '/';
                    if (!paths.every(p => p.startsWith(prefix))) {
                        prefix = '';
                    }
                }
            }
        }
        for (const file of fileList) {
            await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => {
                    let key = file.webkitRelativePath || file.name;
                    if (prefix && key.startsWith(prefix)) {
                        key = key.slice(prefix.length);
                    }
                    fileMap[key] = reader.result;
                    resolve();
                };
                reader.readAsDataURL(file);
            });
        }
        return fileMap;
    }

    Message.error('不支持的上传类型');
    return null;
}

function resetModifiedObj(resItems) {
    modifiedObj.resItems = resItems;
    if (!modifiedObj.resItems || modifiedObj.resItems.length == 0) {
        return;
    }
    modifiedObj.finalHTMLContent = SrcAssetItemHelper.value.setAllSrcItems(parsedRes.srcHTMLContent, modifiedObj.resItems);
    iframeRef.value.srcdoc = modifiedObj.finalHTMLContent
}

async function handleUpload(fileOrEvent) {
    // 1. 解析上传内容为 { 路径: 文件内容(base64/文本/Uint8Array) }
    const fileMap = await buildFileMapFromUpload(fileOrEvent)
    if (!fileMap) return false
    console.log(fileMap)

    const resItems = JSON.parse(JSON.stringify(modifiedObj.resItems));
    await SrcAssetItemHelper.value.reloadAllFromFileMap(resItems, fileMap)
    resetModifiedObj(resItems)

    Message.success('美术替换完成！')
    return false
}

function uploadModifiedResource() {
    // 创建一个 input[type=file][webkitdirectory] 选择器
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.directory = true;
    input.multiple = true;
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', (e) => {
        handleUpload(e);
        document.body.removeChild(input);
    });
    input.click();
}

</script>

<template>
    <div>
        <Row :gutter="24" justify="center">
            <Col :span="16">
            <div>
                <Card>
                    <template #title>
                        原始链接解析
                    </template>
                    <div>
                        <Row :gutter="12">
                            <Col :span="20">
                            <Input v-model="originalUrl" placeholder="请输入原始链接" size="large" />
                            </Col>
                            <Col :span="4">
                            <Button type="primary" @click="handleParse" :loading="parsing" :disabled="!originalUrl"
                                size="large" long>
                                解析
                            </Button>
                            </Col>
                        </Row>
                    </div>
                </Card>

                <Card style="margin-top: 24px;">
                    <template #title>
                        解析结果
                    </template>
                    <div>
                        <Row :gutter="12">
                            <Col>
                            <Button type="primary" size="large" @click="downloadSrcHTMLContent"
                                :disabled="!parsedRes.srcHTMLContent">
                                <Icon type="ios-download" />
                                下载原版HTML
                            </Button>
                            <Button type="primary" size="large" @click="downloadSrcResources"
                                :disabled="parsedRes.srcItems.length == 0">
                                <Icon type="ios-download" />
                                下载原版资源
                            </Button>
                            <Divider type="vertical"></Divider>
                            <Button type="primary" size="large" @click="uploadModifiedResource"
                                :disabled="parsedRes.srcItems.length == 0">
                                <Icon type="ios-download" />
                                上传改版资源
                            </Button>
                            <Divider type="vertical"></Divider>
                            <Button type="primary" size="large" @click="downloadDstHTMLContent"
                                :disabled="!modifiedObj.finalHTMLContent">
                                <Icon type="ios-download" />
                                下载改版HTML
                            </Button>
                            <Button type="primary" size="large" @click="downloadDstResources"
                                :disabled="modifiedObj.resItems.length == 0">
                                <Icon type="ios-download" />
                                下载改版资源
                            </Button>
                            </Col>
                        </Row>
                        <div style="margin-top:16px;">
                            <iframe ref="iframeRef" style="width:100%;height:600px;border:1px solid #eee;"></iframe>
                        </div>
                    </div>
                </Card>
            </div>
            </Col>
        </Row>
    </div>
</template>
