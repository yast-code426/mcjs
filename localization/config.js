/**
 * YastCraft 本地化配置文件
 * ============================================
 * 所有可变内容集中在此处,方便后续编辑。
 * 修改后无需重新压缩 classes.js,刷新页面即可生效
 * (运行时 hook 部分);硬编码部分需重新执行替换。
 *
 * 作者:Yast
 */

window.MCJS_LOCALIZATION = {
    // ===== 构建版本(用于缓存校验,每次更新资源文件时递增) =====
    buildVersion: "20260704a",

    // ===== 品牌信息 =====
    brand: {
        name: "YastCraft",
        author: "Yast",
        version: "1.8.8",
        // 显示用网址
        website: "yast-code426.github.io/mcjs",
        websiteUrl: "https://yast-code426.github.io/mcjs"
    },

    // ===== 中继器列表(多人游戏连接用) =====
    relays: [
        { addr: "wss://relay.deev.is/", comment: "中继服务器 #1", primary: true },
        { addr: "wss://relay.lax1dude.net/", comment: "中继服务器 #2", primary: false },
        { addr: "wss://relay.shhnowisnottheti.me/", comment: "中继服务器 #3", primary: false }
    ],

    // ===== 加载界面文案 =====
    loading: {
        logoText: "YastCraft",
        versionText: "1.8.8 · By yast",
        initText: "正在初始化 ...",
        loadAssets: "正在加载游戏资源 ...",
        // ===== 分步下载文本 (动态键: download+名称、decompress+名称、verify+名称) =====
        downloadClasses: "正在下载游戏代码 ...",
        decompressClasses: "正在解压游戏代码 ...",
        verifyClasses: "正在校验游戏代码完整性...（对比缓存哈希）",
        downloadAssets: "正在下载资源包 ...",
        decompressAssets: "正在解压资源包 ...",
        verifyAssets: "正在校验资源包完整性...（对比缓存哈希）",
        // ===== 校验结果文本 =====
        reDownload: "检测到资源更新，正在重新下载以确保完整性...",
        updatedDone: "已更新至最新版本 ✓",
        cachedFirst: "首次加载，已缓存 ✓",
        unchanged: "无变化，使用缓存 ✓",
        validateDone: "资源校验全部完成 ✓",
        // ====== 后续步骤 =====
        executeCode: "正在执行游戏代码 ...",
        prepareAssets: "正在准备资源 ...",
        startGame: "正在启动游戏 ...",
        loadFailed: "加载失败: ",
        localFileWarning: "请通过 HTTP 服务器或 GitHub Pages 部署,不要在本地直接打开此文件。"
    },

    // ===== 开屏 splash 黄字(随机显示一条) =====
    splashes: [
        "由 Yast 制作!",
        "100% 纯净中文!",
        "玩得开心!",
        "新年快乐!",
        "万圣节快乐!BOO!",
        "圣诞节快乐!",
        "方块世界,无限可能!",
        "Yast 出品,必属精品!",
        "点击开始游戏!"
    ],

    // ===== 运行时字符串替换表 =====
    // 在 classes.js 加载前对源码做精准替换
    runtimeReplacements: [
        // 品牌归属
        { from: "Made by lax1dude", to: "Made by Yast" },
        // gitlab 源码仓库链接 -> 项目主页
        { from: "https://gitlab.com/lax1dude/eaglercraftx-1.8", to: "https://yast-code426.github.io/mcjs" },
        // eaglerxserver 链接
        { from: "https://lax1dude.net/eaglerxserver", to: "https://yast-code426.github.io/mcjs" },
        // 客户端品牌标识
        { from: "eaglercraft.brand = \\\"lax1dude\\\"", to: "eaglercraft.brand = \\\"Yast\\\"" },

        // === 剩余 eaglercraft 用户可见字符串替换 ===
        { from: "Failed to load eaglercraft high-poly mesh", to: "无法加载 YastCraft 高精度模型" },
        { from: "File is not an eaglercraft high-poly mesh!", to: "文件不是 YastCraft 高精度模型！" },
        { from: "Starting integrated eaglercraft server version", to: "正在启动 YastCraft 内置服务器版本" },
        { from: "eaglercraftx worker thread has exited", to: "YastCraft 工作线程已退出" },
        { from: "eaglercraftx worker thread is starting", to: "YastCraft 工作线程正在启动..." },
        { from: "eaglercraft.brand =", to: "yastcraft.brand =" },
        { from: "eaglercraft.es6shims", to: "yastcraft.es6shims" },
        { from: "eaglercraft.minecraft =", to: "yastcraft.minecraft =" },
        { from: "eaglercraft.username =", to: "yastcraft.username =" },
        { from: "eaglercraft.version =", to: "yastcraft.version =" },

        // === 常见错误消息汉化 ===
        { from: "Aborting decompression. Rejoin the server to try again.", to: "正在中止解压缩。请重新加入服务器以重试。" },
        { from: "An unknown error occured!", to: "发生了未知错误！" },
        { from: "Authentication Required:", to: "需要验证：" },
        { from: "Unable to connect to server", to: "无法连接到服务器" },
        { from: "Connection lost", to: "连接已断开" },
        { from: "Connection refused", to: "连接被拒绝" },
        { from: "Connection timed out", to: "连接超时" },
        { from: "Disconnected", to: "已断开连接" },
        { from: "Server closed connection", to: "服务器已关闭连接" },
        { from: "Loading world", to: "正在加载世界" },
        { from: "Saving world", to: "正在保存世界" },
        { from: "Saving chunks", to: "正在保存区块" },
        { from: "Building terrain", to: "正在生成地形" },
        { from: "Downloading terrain", to: "正在下载地形" },
        { from: "Preparing spawn area", to: "正在准备出生点区域" },
        { from: "Initializing world", to: "正在初始化世界" },
        { from: "Loading chunks", to: "正在加载区块" },
        { from: "Generating world", to: "正在生成世界" },
        { from: "Deleting world", to: "正在删除世界" },

        // === 游戏 UI 文本汉化 ===
        { from: "Basic Settings", to: "基本设置" },
        { from: "Auto Detect", to: "自动检测" },
        { from: "All players", to: "所有玩家" },
        { from: "Off", to: "关闭" },
        { from: "On", to: "开启" },
        { from: "Done", to: "完成" },
        { from: "Cancel", to: "取消" },
        { from: "Confirm", to: "确认" },
        { from: "Save", to: "保存" },
        { from: "Delete", to: "删除" },
        { from: "Reset", to: "重置" },
        { from: "Default", to: "默认" },
        { from: "Custom", to: "自定义" },
        { from: "Enabled", to: "已启用" },
        { from: "Disabled", to: "已禁用" },
        { from: "Close", to: "关闭" },
        { from: "Load defaults", to: "加载默认值" },
        { from: "Warning:", to: "警告：" },
        { from: "Error:", to: "错误：" },
        { from: "Info:", to: "信息：" },
        { from: "Debug:", to: "调试：" },

        // === 光影/着色器相关 ===
        { from: "Shaders enabled", to: "光影已启用" },
        { from: "Shaders disabled", to: "光影已禁用" },
        { from: "Reload shaders", to: "重新加载光影" },

        // === 服务器信息 ===
        { from: "Server address", to: "服务器地址" },
        { from: "Server name", to: "服务器名称" },
        { from: "Server list", to: "服务器列表" },
        { from: "Direct connect", to: "直接连接" },
        { from: "Add server", to: "添加服务器" },
        { from: "Edit server", to: "编辑服务器" },
        { from: "Delete server", to: "删除服务器" },
        { from: "Refresh", to: "刷新" },
        { from: "Ping", to: "延迟" },
        { from: "Players", to: "玩家" },
        { from: "Version", to: "版本" },
        { from: "MOTD", to: "服务器信息" },

        // === 世界/存档 ===
        { from: "Create new world", to: "创建新世界" },
        { from: "Load world", to: "加载世界" },
        { from: "Delete world", to: "删除世界" },
        { from: "Rename world", to: "重命名世界" },
        { from: "Duplicate world", to: "复制世界" },
        { from: "World name", to: "世界名称" },
        { from: "Game mode", to: "游戏模式" },
        { from: "Difficulty", to: "难度" },
        { from: "Allow cheats", to: "允许作弊" },
        { from: "Bonus chest", to: "奖励箱" },

        // === 皮肤名称汉化 ===
        { from: "Default Steve", to: "默认 Steve" },
        { from: "Default Alex", to: "默认 Alex" },
        { from: "Tennis Steve", to: "网球 Steve" },
        { from: "Tennis Alex", to: "网球 Alex" },
        { from: "Tuxedo Steve", to: "西装 Steve" },
        { from: "Tuxedo Alex", to: "西装 Alex" },
        { from: "Athlete Steve", to: "运动员 Steve" },
        { from: "Athlete Alex", to: "运动员 Alex" },
        { from: "Cyclist Steve", to: "自行车 Steve" },
        { from: "Cyclist Alex", to: "自行车 Alex" },
        { from: "Boxer Steve", to: "拳击 Steve" },
        { from: "Boxer Alex", to: "拳击 Alex" },
        { from: "Prisoner Steve", to: "囚犯 Steve" },
        { from: "Prisoner Alex", to: "囚犯 Alex" },
        { from: "Scottish Steve", to: "苏格兰 Steve" },
        { from: "Scottish Alex", to: "苏格兰 Alex" },
        { from: "Developer Steve", to: "开发者 Steve" },
        { from: "Developer Alex", to: "开发者 Alex" },
        { from: "Herobrine", to: "Herobrine" },
        { from: "Notch", to: "Notch" },

        // === 披风名称汉化 ===
        { from: "No Cape", to: "无披风" },
        { from: "Minecon 2011", to: "Minecon 2011" },
        { from: "Microsoft Account", to: "微软账户" },
        { from: "Realms Mapmaker", to: "领域制图师" },
        { from: "Mojang Old", to: "Mojang 旧版" },
        { from: "Mojang New", to: "Mojang 新版" },
        { from: "Jira Moderator", to: "Jira 版主" },
        { from: "Mojang Very Old", to: "Mojang 非常旧版" },
        { from: "Scrolls", to: "卷轴" },
        { from: "Cobalt", to: "钴" },
        { from: "Lang Translator", to: "语言翻译者" },
        { from: "Millionth Player", to: "第一百万玩家" },
        { from: "Spade", to: "铲子" },
        { from: "Birthday", to: "生日" },
        { from: "dB", to: "dB" },
        { from: "15th Anniversary", to: "15周年" },
        { from: "Vanilla", to: "原版" },
        { from: "TikTok", to: "TikTok" },
        { from: "Purple Heart", to: "紫心勋章" },
        { from: "Cherry Blossom", to: "樱花" },

        // === 标题文本汉化 ===
        { from: "Minecraft 1.8.8", to: "YastCraft 1.8.8" },

        // === 录屏编码格式汉化 ===
        { from: "MP4 (Default Codecs)", to: "MP4（默认编码）" },
        { from: "WEBM (Default Codecs)", to: "WEBM（默认编码）" },
        { from: "MP4 (video: H.264 Default, audio: AAC LC)", to: "MP4（视频：H.264 默认，音频：AAC LC）" },
        { from: "MP4 (video: H.264 Default, audio: Opus)", to: "MP4（视频：H.264 默认，音频：Opus）" },
        { from: "MP4 (video: VP9 Default, audio: AAC LC)", to: "MP4（视频：VP9 默认，音频：AAC LC）" },
        { from: "MP4 (video: VP9 Default, audio: Opus)", to: "MP4（视频：VP9 默认，音频：Opus）" },
        { from: "WEBM (video: H.264 Default, audio: Opus)", to: "WEBM（视频：H.264 默认，音频：Opus）" },
        { from: "WEBM (video: H.264 Default, audio: Vorbis)", to: "WEBM（视频：H.264 默认，音频：Vorbis）" },
        { from: "WEBM (video: VP8 Default, audio: Opus)", to: "WEBM（视频：VP8 默认，音频：Opus）" },
        { from: "WEBM (video: VP8 Default, audio: Vorbis)", to: "WEBM（视频：VP8 默认，音频：Vorbis）" },
        { from: "WEBM (video: VP9 Default, audio: Opus)", to: "WEBM（视频：VP9 默认，音频：Opus）" },
        { from: "WEBM (video: VP9 Default, audio: Vorbis)", to: "WEBM（视频：VP9 默认，音频：Vorbis）" }
    ]
};