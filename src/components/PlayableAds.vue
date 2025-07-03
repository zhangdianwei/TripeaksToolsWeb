<script setup>
import { ref, computed, reactive } from 'vue'
import { Card, Input, Button, Upload, Icon, Message, Row, Col, Alert } from 'view-ui-plus'
import JSZip from 'jszip'


const originalUrl = ref('https://playables.safedk.com/74616804a7dc29147dfb0afe122a9fd2/67518f8cfdac53eb0cf4ce54f52caec2/ad.html')
const srcObj = reactive({
    applovinJSContent: '', //带al_renderHtml前缀的
    srcHTMLContent: '' //真正可玩的html内容
})
const parsedRes = reactive({
    srcItems: [],
    dstItems: [],
}) //解析出的内容
const ghostStudioContent = ref('')
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

function getAbstractUrl(url) {
    if (url.startsWith('http')) {
        return url
    }
    if (url.startsWith('/')) {
        return serverAddress.value + url.slice(1)
    }
    return serverAddress.value + url
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

async function parseOriginalUrl() {
    if (!originalUrl.value) {
        Message.warning('请输入原始链接')
        return false
    }

    let iframe = null
    let messageHandler = null

    try {
        // 创建iframe
        iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        iframe.sandbox = 'allow-scripts'
        document.body.appendChild(iframe)

        // 监听消息
        let htmlResult = null
        messageHandler = (event) => {
            console.log('messageHandler', event)
            if (event.data.type === 'html') {
                htmlResult = event.data.content
                srcObj.srcHTMLContent = htmlResult
            }
        }
        window.addEventListener('message', messageHandler)

        // 创建HTML内容
        let iframeHtml = await fetchByProxy(originalUrl.value, 'html')
        iframeHtml = replace_al_renderHtml(iframeHtml)
        console.log('iframeHtml')
        console.log(iframeHtml)

        // 创建data URL并加载
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(iframeHtml);
        iframe.src = dataUrl;

        // 添加调试信息
        console.log('iframe已加载，等待al_renderHtml调用...');

        // 等待结果（最多10秒）
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.log('超时：未收到al_renderHtml调用');
                reject(new Error('等待iframe响应超时'))
            }, 10000)

            const checkResult = () => {
                if (htmlResult) {
                    clearTimeout(timeout)
                    resolve()
                } else {
                    setTimeout(checkResult, 100)
                }
            }
            checkResult()
        })
        // 设置结果
        srcObj.applovinJSContent = htmlResult
        return true

    } catch (error) {
        Message.error(`解析失败: ${error.message}`)
        console.error('详细错误:', error)
        return false
    } finally {
        // 清理资源
        if (messageHandler) {
            window.removeEventListener('message', messageHandler)
        }
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

    parsing.value = true

    try {
        // 第一步：解析原始URL
        console.log('第一步：解析原始URL...')
        const parseSuccess = await parseOriginalUrl()
        if (!parseSuccess) {
            return
        }
        console.log('原始URL解析完成！')

        // 第二步：获取原始资源项
        console.log('第二步：获取原始资源项...')
        parsedRes.srcItems = getAllOrgResourceItems()
        if (!parsedRes.srcItems) {
            console.warn('没有找到可解析的资源项')
            return
        }
        console.log(`找到 ${parsedRes.srcItems.length} 个原始资源项`)

        // 第三步：解析所有资源项
        console.log('第三步：解析所有资源项...')
        parsedRes.dstItems = await parseAllOrgResourceItems(parsedRes.srcItems)
        if (!parsedRes.dstItems || parsedRes.dstItems.length === 0) {
            console.warn('解析资源失败')
            return
        }
        console.log(`解析完成，共生成 ${parsedRes.dstItems.length} 个文件`)
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
    if (!srcObj.srcHTMLContent) {
        console.log('srcHTMLContent为空')
        return null
    }

    const content = srcObj.srcHTMLContent

    // 使用findRangeByStack查找playableAssets:后面的JSON数组
    const range = findRangeByStack(content, 'playableAssets:', '[]')

    if (!range) {
        console.log('未找到playableAssets数组')
        return null
    }

    // 提取JSON字符串
    const jsonStr = content.substring(range.start, range.end + 1)
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

// AssetItem 类
class AssetItem {
    constructor(srcAssetItem) {
        this.originalItem = srcAssetItem
    }

    getKey() {
        return this.originalItem.key || 'unknown'
    }

    getType() {
        return this.originalItem.type || 'unknown'
    }



    getAtlasDataBase64Data() {
        return this.originalItem.atlasURL || null
    }

    getMimeType() {
        const base64Data = this.getBase64Data()
        if (!base64Data) return null

        const mimeMatch = base64Data.match(/data:([^;]+);base64,/)
        return mimeMatch ? mimeMatch[1] : null
    }

    getBase64Data() {
        // 尝试音频URL数组
        if (this.originalItem.urls && this.originalItem.urls.length > 0) {
            return this.originalItem.urls[0]
        }

        // 尝试普通URL
        if (this.originalItem.url) {
            return this.originalItem.url
        }

        // 都没有找到
        return null
    }

    getBinaryContent() {
        const base64Data = this.getBase64Data()
        if (!base64Data) return null
        return base64ToBinary(base64Data)
    }

    getFileName() {
        const mimeType = this.getMimeType()
        const key = this.getKey()

        switch (this.getType()) {
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

    getAtlasData() {
        const atlasBase64 = this.getAtlasDataBase64Data()
        if (!atlasBase64) return null

        try {
            return atob(atlasBase64.replace('data:text/json;base64,', ''))
        } catch (e) {
            console.log(`图集数据解析失败: ${e.message}`)
            return null
        }
    }

    toDownloadItem() {
        const binaryContent = this.getBinaryContent()
        if (!binaryContent) {
            return null
        }

        // console.log(`  解析成功: ${this.getFileName()} (${binaryContent.length} bytes)`)

        return {
            fileName: this.getFileName(),
            content: binaryContent,
            type: this.getMimeType()
        }
    }



    async toDownloadItemAtlas() {
        let items = [];
        const key = this.getKey()
        const atlasData = this.getAtlasData()
        if (atlasData) {
            // 保存atlas json
            items.push({
                fileName: `atlas_src/${key}_atlas.json`,
                content: atlasData,
                type: 'text/json'
            })
            // 保存大图
            if (this.originalItem.textureURL) {
                items.push({
                    fileName: `atlas_src/${key}_texture.png`,
                    content: base64ToBinary(this.originalItem.textureURL),
                    type: 'image/png'
                })
            }
            try {
                const atlasJson = JSON.parse(atlasData)
                if (atlasJson && Array.isArray(atlasJson.frames) && this.originalItem.textureURL) {
                    // 只加载一次大图
                    const image = await new Promise((resolve, reject) => {
                        const img = new window.Image()
                        img.onload = () => resolve(img)
                        img.onerror = reject
                        img.src = this.originalItem.textureURL
                    })
                    for (const frameObj of atlasJson.frames) {
                        const frame = frameObj.frame
                        const filename = frameObj.filename
                        const spriteSourceSize = frameObj.spriteSourceSize
                        const sourceSize = frameObj.sourceSize
                        // 新建canvas，尺寸为sourceSize
                        const canvas = document.createElement('canvas')
                        canvas.width = sourceSize.w
                        canvas.height = sourceSize.h
                        const ctx = canvas.getContext('2d')
                        ctx.clearRect(0, 0, canvas.width, canvas.height)
                        // 绘制透明底
                        ctx.fillStyle = 'rgba(0,0,0,0)'
                        ctx.fillRect(0, 0, canvas.width, canvas.height)
                        // 将大图frame区域绘制到spriteSourceSize.x/y
                        ctx.drawImage(
                            image,
                            frame.x, frame.y, frame.w, frame.h,
                            spriteSourceSize.x, spriteSourceSize.y, frame.w, frame.h
                        )
                        // 导出为png
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

    getAtlasDownloadItem() {
        const atlasData = this.getAtlasData()
        if (!atlasData) {
            return null
        }

        return {
            fileName: `${this.getKey()}_atlas.json`,
            content: atlasData,
            type: 'text/json'
        }
    }

    async toDownloadItems() {
        const type = this.getType();
        if (type === 'atlas') {
            return await this.toDownloadItemAtlas();
        } else {
            const downloadItem = this.toDownloadItem();
            if (downloadItem) {
                return [downloadItem];
            }
        }
        return [];
    }

    getSize() {
        const binaryContent = this.getBinaryContent()
        return binaryContent ? binaryContent.length : 0
    }

    getSizeFormatted() {
        const size = this.getSize()
        if (size < 1024) return size + ' B'
        if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB'
        return (size / (1024 * 1024)).toFixed(1) + ' MB'
    }
}

// 解析所有原始资源项
// parseAllOrgResourceItems 需支持await
async function parseAllOrgResourceItems(srcItems) {
    if (!srcItems || !Array.isArray(srcItems)) {
        console.log('srcItems无效或不是数组')
        return null
    }

    console.log(`开始解析 ${srcItems.length} 个资源...`)

    const extractedFiles = []

    for (const asset of srcItems) {
        const assetItem = new AssetItem(asset)
        const files = await assetItem.toDownloadItems()
        extractedFiles.push(...files)
    }

    console.log(`解析完成，共 ${extractedFiles.length} 个文件`)
    return extractedFiles
}

async function downloadAllResources() {
    try {
        const dstItems = parsedRes.dstItems;
        if (!dstItems || dstItems.length === 0) {
            console.warn('没有可下载的资源')
            return
        }

        console.log('正在创建压缩包...')

        // 使用JSZip创建压缩包
        const zip = new JSZip()

        // 添加所有文件到压缩包
        dstItems.forEach(file => {
            // 兼容base64和Uint8Array
            let content = file.content
            if (typeof content === 'string' && content.startsWith('data:')) {
                // base64字符串，去掉前缀
                const base64Content = content.replace(/^data:[^;]+;base64,/, '')
                zip.file(file.fileName, base64Content, { base64: true })
            } else {
                zip.file(file.fileName, content)
            }
        })

        // 生成压缩包
        const zipBlob = await zip.generateAsync({ type: 'blob' })

        // 创建下载链接
        const url = URL.createObjectURL(zipBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'extracted_resources.zip'
        a.click()

        // 清理
        URL.revokeObjectURL(url)
    }
    catch (ex) {
        console.error(ex)
    }
}

function handleZipUpload(file) {
    if (!file) {
        Message.warning('请选择文件')
        return false
    }

    if (!file.name.endsWith('.zip')) {
        Message.error('请上传ZIP格式的文件')
        return false
    }

    Message.success('ZIP文件上传成功，开始处理...')

    setTimeout(() => {
        ghostStudioContent.value = 'processed_content'
        Message.success('ZIP处理完成！')
    }, 2000)

    return false
}

function downloadApplovinVersion() {
    if (!ghostStudioContent.value) {
        console.warn('没有可下载的内容')
        return
    }

    const content = `// GhostStudio Applovin Version
// Generated from: ${originalUrl.value}
// Processed content: ${ghostStudioContent.value}

${srcObj.srcHTMLContent}`

    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'ghoststudio_applovin_version.txt'
    a.click()
    URL.revokeObjectURL(url)
    Message.success('Applovin版本下载完成')
}

function downloadJSContent() {
    if (!srcObj.applovinJSContent) {
        Message.warning('没有可下载的内容')
        return
    }
    const blob = new Blob([srcObj.applovinJSContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'index.html'
    a.click()
    URL.revokeObjectURL(url)
    Message.success('HTML文件下载完成')
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
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
                            </Col>
                            <Col>
                            <Button type="primary" size="large" @click="downloadJSContent"
                                :disabled="!srcObj.applovinJSContent">
                                <Icon type="ios-download" />
                                下载解析后的HTML({{ formatFileSize(srcObj.applovinJSContent.length) }})
                            </Button>
                            </Col>
                            <Col>
                            <Button type="primary" size="large" @click="downloadAllResources"
                                :disabled="!srcObj.applovinJSContent">
                                <Icon type="ios-download" />
                                下载所有资源
                            </Button>
                            </Col>
                        </Row>
                    </div>
                </Card>

                <Card style="margin-top: 24px;">
                    <template #title>
                        美术替图结果
                    </template>
                    <div>
                        <Alert type="info" show-icon>
                            <template #desc>
                                <p>上传的压缩包要和下载的压缩包一模一样，不能多文件也不能少文件。</p>
                            </template>
                        </Alert>
                        <Upload accept=".zip" :show-upload-list="false" :before-upload="handleZipUpload" action="" drag
                            style="margin-top: 16px;">
                            <div style="padding: 20px;">
                                <Icon type="ios-cloud-upload" size="52" />
                                <p style="margin: 10px 0;">点击或拖拽文件到此区域上传</p>
                                <p style="color: #c5c8ce;">支持 .zip 格式文件</p>
                            </div>
                        </Upload>
                    </div>
                </Card>

                <Card style="margin-top: 24px;">
                    <template #title>
                        改版结果
                    </template>
                    <div>
                        <Button type="primary" size="large" long @click="downloadApplovinVersion"
                            :disabled="!ghostStudioContent">
                            <Icon type="ios-download" />
                            下载Applovin版
                        </Button>
                    </div>
                </Card>
            </div>
            </Col>
        </Row>
    </div>
</template>
