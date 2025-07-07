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
    let result = html.replace(/src="js\//g, 'src="' + serverAddress.value + 'js/');

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
function waitForHtmlMessage(timeoutMs = 10000) {
    return new Promise((resolve, reject) => {
        let timer = null
        function handler(event) {
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

        // 3. 加载到 iframe
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(iframeHtml)
        iframe.src = dataUrl
        console.log('iframe已加载，等待al_renderHtml调用...')

        // 4. 等待 window message 返回主内容
        const htmlResult = await waitForHtmlMessage(10000)
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
    if (!originalUrl.value) {
        Message.warning('请输入原始链接')
        return
    }

    // if (!SrcAssetItemHelper.value) {
    //     Message.error('资源处理工具未初始化，无法解析资源！')
    //     return
    // }

    parsing.value = true

    try {
        console.log('第一步：解析原始URL...')
        await parseOriginalUrl();
        if (!parsedRes.srcHTMLContent) {
            return;
        }
        console.log('原始URL解析完成！')

        console.log('第二步：获取原始资源项...')
        parsedRes.srcItems = getAllOrgResourceItems()
        if (!parsedRes.srcItems) {
            console.warn('没有找到可解析的资源项')
            return
        }
        console.log(`找到 ${parsedRes.srcItems.length} 个原始资源项`)

        resetModifiedObj(parsedRes.srcItems)

        Message.success('解析完成！')

    } catch (error) {
        Message.error(`解析失败: ${error.message}`)
        console.error('详细错误:', error)
    } finally {
        parsing.value = false
    }
}

function findRangeByStack(orgStr, keyStr, seperator) {
    if (!orgStr || !keyStr || !seperator || seperator.length !== 2) {
        console.log('参数错误: orgStr、keyStr或seperator无效')
        return null
    }

    // 先找到keyStr的位置
    const keyIndex = orgStr.indexOf(keyStr)
    if (keyIndex === -1) {
        console.log(`未找到关键字: ${keyStr}`)
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

function getAllOrgResourceItems() {
    // 提取JSON字符串
    const jsonStr = SrcAssetItemHelper.value.getResContent(parsedRes.srcHTMLContent);
    console.log('提取的JSON字符串:', jsonStr.substring(0, 200) + '...')

    try {
        const jsonObj = eval(jsonStr)
        console.log('解析成功，资源数量:', jsonObj.length)
        return jsonObj
    } catch (error) {
        console.error('JSON解析失败:', error)
        return null
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
    async reloadAllFromFileMap(srcItems, fileMap) {
        throw new Exception("未实现");
    }
    async toAllDownloadItems(srcItems) {
        throw new Exception("未实现");
    }
    getResContent(html) {
        throw new Exception("未实现");
    }
    replaceResContent(html, str) {
        throw new Exception("未实现");
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
        const base64Data = this.getBase64Data(item)
        if (!base64Data) return null
        const mimeMatch = base64Data.match(/data:([^;]+);base64,/)
        return mimeMatch ? mimeMatch[1] : null
    }
    getBinaryContent(item) {
        const base64Data = this.getBase64Data(item)
        if (!base64Data) return null
        return base64ToBinary(base64Data)
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
        const atlasBase64 = this.getAtlasDataBase64Data(item)
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
                    const image = await new Promise((resolve, reject) => {
                        const img = new window.Image()
                        img.onload = () => resolve(img)
                        img.onerror = reject
                        img.src = item.textureURL
                    })
                    for (const frameObj of atlasJson.frames) {
                        const frame = frameObj.frame
                        const filename = frameObj.filename
                        const spriteSourceSize = frameObj.spriteSourceSize
                        const sourceSize = frameObj.sourceSize
                        const canvas = document.createElement('canvas')
                        canvas.width = sourceSize.w
                        canvas.height = sourceSize.h
                        const ctx = canvas.getContext('2d')
                        ctx.clearRect(0, 0, canvas.width, canvas.height)
                        ctx.fillStyle = 'rgba(0,0,0,0)'
                        ctx.fillRect(0, 0, canvas.width, canvas.height)
                        ctx.drawImage(
                            image,
                            frame.x, frame.y, frame.w, frame.h,
                            spriteSourceSize.x, spriteSourceSize.y, frame.w, frame.h
                        )
                        const dataUrl = canvas.toDataURL('image/png')
                        const base64Content = dataUrl.replace(/^data:[^;]+;base64,/, '')
                        const binaryString = atob(base64Content)
                        const bytes = new Uint8Array(binaryString.length)
                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i) & 0xff
                        }
                        items.push({
                            fileName: `atlas/${key}/${filename}`,
                            content: bytes,
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
            return await this.toDownloadItemAtlas(item)
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
    getBase64Data(item) {
        if (item.urls && item.urls.length > 0) {
            return item.urls[0]
        }
        if (item.url) {
            return item.url
        }
        return null
    }
    setBase64Data(item, content, extra_content) {
        function toDataUrl(type, data) {
            if (typeof data === 'string') {
                if (data.startsWith('data:')) return data;
                if (type.startsWith('image/')) return `data:${type};base64,${data}`;
                if (type.startsWith('audio/')) return `data:${type};base64,${data}`;
                if (type === 'text/json') return `data:text/json;base64,${btoa(unescape(encodeURIComponent(data)))}`;
                return data;
            } else if (data instanceof Uint8Array) {
                let binary = '';
                for (let i = 0; i < data.length; i++) binary += String.fromCharCode(data[i]);
                const base64 = btoa(binary);
                if (type.startsWith('image/')) return `data:${type};base64,${base64}`;
                if (type.startsWith('audio/')) return `data:${type};base64,${base64}`;
                if (type === 'text/json') return `data:text/json;base64,${base64}`;
                return base64;
            }
            return data;
        }
        const type = this.getType(item);
        if (type === 'atlas') {
            if (content) item.atlasURL = toDataUrl('text/json', content);
            if (extra_content) item.textureURL = toDataUrl('image/png', extra_content);
        } else if (type === 'audio') {
            if (content) item.urls = [toDataUrl('audio/mp3', content)];
        } else if (type === 'image') {
            const mimeType = this.getMimeType(item) || 'image/png';
            if (content) item.url = toDataUrl(mimeType, content);
        } else {
            if (content) item.url = content;
        }
    }
    async reloadAllFromFileMap(items, fileMap) {
        for (const item of items) {
            if (item.type === 'atlas') {
                const key = item.key
                const texPath = `atlas_src/${key}_texture.png`
                const jsonPath = `atlas_src/${key}_atlas.json`
                let jsonContent = fileMap[jsonPath] || null;
                let textureContent = fileMap[texPath] || null;
                if (jsonContent) {
                    try {
                        const atlasJson = typeof jsonContent === 'string' ? JSON.parse(jsonContent) : jsonContent
                        if (atlasJson && Array.isArray(atlasJson.frames)) {
                            const composed = await composeAtlasTextureFromFrames(atlasJson, key, fileMap, texPath)
                            if (composed) {
                                textureContent = composed
                            }
                        }
                    } catch (e) {
                        console.warn('atlas大图合成失败', e)
                    }
                }
                this.setBase64Data(item, jsonContent, textureContent)
            } else {
                const fileName = this.getFileName(item)
                if (fileMap[fileName]) {
                    this.setBase64Data(item, fileMap[fileName])
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
    getResContent(html) {
        const range = findRangeByStack(html, 'playableAssets:', '[]');
        if (!range) return '';
        return html.substring(range.start, range.end + 1);
    }
    replaceResContent(html, str) {
        const range = findRangeByStack(html, 'playableAssets:', '[]');
        if (!range) return html;
        return html.substring(0, range.start) + str + html.substring(range.end + 1);
    }
}

const SrcAssetItemHelper = computed(() => {
    return new ParseHelper_Applovin_PhaserEditor()
})

async function composeAtlasTextureFromFrames(atlasJson, key, fileMap, texPath) {
    if (!atlasJson || !Array.isArray(atlasJson.frames) || atlasJson.frames.length === 0) return null;

    let maxW = 0, maxH = 0;
    for (const frameObj of atlasJson.frames) {
        const frame = frameObj.frame;
        if (frame.x + frame.w > maxW) maxW = frame.x + frame.w;
        if (frame.y + frame.h > maxH) maxH = frame.y + frame.h;
    }
    if (maxW === 0 || maxH === 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = maxW;
    canvas.height = maxH;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const frameObj of atlasJson.frames) {
        const frame = frameObj.frame;
        const filename = frameObj.filename;
        let imgData = fileMap[`atlas/${key}/${filename}`] || fileMap[filename];
        if (!imgData) continue;
        await new Promise((resolve, reject) => {
            const img = new window.Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, img.width, img.height, frame.x, frame.y, frame.w, frame.h);
                resolve();
            };
            img.onerror = reject;
            img.src = imgData;
        });
    }
    return canvas.toDataURL('image/png');
}

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
    downloadAsFile(finalHTMLContent.value, 'index_dst.html', 'text/html')
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
    const jsonStr = JSON.stringify(modifiedObj.resItems)
    modifiedObj.finalHTMLContent = SrcAssetItemHelper.value.replaceResContent(parsedRes.srcHTMLContent, jsonStr);
    iframeRef.value.srcdoc = modifiedObj.finalHTMLContent
}

async function handleUpload(fileOrEvent) {
    // 1. 解析上传内容为 { 路径: 文件内容(base64/文本/Uint8Array) }
    const fileMap = await buildFileMapFromUpload(fileOrEvent)
    if (!fileMap) return false

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


const iframeRef = ref(null)

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
