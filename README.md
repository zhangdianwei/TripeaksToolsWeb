# 介绍

有时策划会要求做几个简单的小工具，帮助他们自动生成一些内容。
纯脚本的方式不利于策划使用，最好是带ui界面的，所以有了这样一个项目。
项目特点是可以直接在web上访问，所以很方便。

# 环境准备

*   Node.js>=v14.17.6
*   运行命令：`npm install`

# 开发步骤

1.   启动项目：`npm run dev`
2.   复制HelloWorld.vue修改为新功能的名字。
3.   在App.vue中的PageConfigs加入新功能的组件。
4.   如果要使用图片，建议放在public/xxx目录下。

# 发布步骤

1.   上传代码
2.   打开jenkins项目并构建：http://10.10.31.17:8080/job/TripeaksToolsWeb/
3.   构建完成后通知策划刷新浏览器体验新功能

# 体验步骤

1.   浏览器打开：http://10.10.31.17:9090/

# 其他说明
## easy_shushu
* 数数查询需要token，不能保存在代码仓库里。
* token应该放在`public/easy_shushu/config.json`里面，但是现在里面是空的。
* token的配置在打包机的`~/Desktop/script/easy_shushu_config.json`。
* jenkins打包时会自动把这个文件拷贝到最终输出目录。