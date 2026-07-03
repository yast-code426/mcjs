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
        decompressClasses: "正在解压游戏代码 ...",
        decompressAssets: "正在解压资源包 ...",
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
        { from: "eaglercraft.brand = \\\"lax1dude\\\"", to: "eaglercraft.brand = \\\"Yast\\\"" }
    ]
};
