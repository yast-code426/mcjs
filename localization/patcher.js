/**
 * MCJS 本地化注入器 (patcher.js)
 * ============================================
 * 职责:
 *   1. 提供 patchClassesSource(code) —— 在 classes.js 执行前
 *      对源码做精准字符串替换(品牌、作者、网址、水印)。
 *   2. 提供 applyRuntimeHooks() —— 游戏启动后做运行时
 *      定制(splash 文案、中继器、菜单显示等)。
 *
 * 依赖:需在 config.js 之后、classes.js 之前加载。
 * 作者:Yast
 */
(function () {
    "use strict";

    var cfg = window.MCJS_LOCALIZATION || {};

    /**
     * 对 classes.js 源码做字符串替换。
     * @param {string} code 解压后的 classes.js 文本
     * @returns {string} 替换后的文本
     */
    function patchClassesSource(code) {
        if (!code || typeof code !== "string") return code;

        var rules = cfg.runtimeReplacements || [];
        for (var i = 0; i < rules.length; i++) {
            var r = rules[i];
            if (r && r.from && r.to && r.from !== r.to) {
                // 普通字符串替换(非正则,避免误伤)
                var parts = r.from.split("{REGEX}");
                // 支持 {REGEX}前缀 转正则,否则按字面量替换
                if (r.from.indexOf("{REGEX}") === 0) {
                    var reSrc = r.from.substring(7);
                    try {
                        code = code.replace(new RegExp(reSrc, "g"), r.to);
                    } catch (e) {
                        console.warn("[MCJS本地化] 正则替换失败:", reSrc, e);
                    }
                } else {
                    code = code.split(r.from).join(r.to);
                }
            }
        }

        // ===== 额外的结构性替换 =====
        // splash 黄字列表中的品牌文案已由配置替换;
        // 这里再做几处必要的硬编码替换,确保完全去水印。

        // "lax1dude relay #N" -> "中继服务器 #N"
        code = code.split("lax1dude relay #1").join("中继服务器 #1");
        code = code.split("lax1dude relay #2").join("中继服务器 #2");
        // ayunami relay 注释
        code = code.split("ayunami relay #1").join("中继服务器 #3");

        // ===== 更多品牌和文字替换 =====

        // 离线模板文件名 (只在字符串中出现)
        code = code.split("Loading offline_template_eaglercraftX_1_8.html").join("正在加载 YastCraft 1.8 离线模板...");
        code = code.split("Loading offline_template_eaglercraftX_1_8_fat_offline.html").join("正在加载 YastCraft 1.8 完整离线模板...");
        code = code.split("Loading offline_template_eaglercraftX_1_8_fat_signed.html").join("正在加载 YastCraft 1.8 完整签名模板...");
        code = code.split("Loading offline_template_eaglercraftX_1_8_signed.html").join("正在加载 YastCraft 1.8 签名模板...");
        code = code.split("Loading offline_template_eaglercraft_1_5.html").join("正在加载 YastCraft 1.5 离线模板...");
        code = code.split("Loading offline_template_eaglercraft_1_5_legacy.html").join("正在加载 YastCraft 1.5 旧版模板...");
        code = code.split("Loading offline_template_eaglercraft_b1_3.html").join("正在加载 YastCraft Beta 1.3 模板...");

        // 文件路径中的 eaglercraft 引用
        code = code.split("offline_template_eaglercraftX_1_8.html").join("offline_template_YastCraft_1_8.html");
        code = code.split("offline_template_eaglercraftX_1_8_fat_offline.html").join("offline_template_YastCraft_1_8_fat_offline.html");
        code = code.split("offline_template_eaglercraftX_1_8_fat_signed.html").join("offline_template_YastCraft_1_8_fat_signed.html");
        code = code.split("offline_template_eaglercraftX_1_8_signed.html").join("offline_template_YastCraft_1_8_signed.html");
        code = code.split("offline_template_eaglercraft_1_5.html").join("offline_template_YastCraft_1_5.html");
        code = code.split("offline_template_eaglercraft_1_5_legacy.html").join("offline_template_YastCraft_1_5_legacy.html");
        code = code.split("offline_template_eaglercraft_b1_3.html").join("offline_template_YastCraft_b1_3.html");

        // 文件头检测格式文本汉化
        code = code.split("Detected format: EAGLERCRAFTX_1_8_SIGNED").join("检测到格式: YastCraftX 1.8 签名版");
        code = code.split("Detected format: EAGLERCRAFTX_1_8_OFFLINE").join("检测到格式: YastCraftX 1.8 离线版");
        code = code.split("Detected format: EAGLERCRAFTX_1_5_NEW_OFFLINE").join("检测到格式: YastCraftX 1.5 新版离线版");
        code = code.split("Detected format: EAGLERCRAFTX_1_5_OLD_OFFLINE").join("检测到格式: YastCraftX 1.5 旧版离线版");
        code = code.split("Detected format: EAGLERCRAFT_BETA_B1_3_OFFLINE").join("检测到格式: YastCraft Beta 1.3 离线版");
        code = code.split("Detected format: EAGLERCRAFT_EPK_FILE").join("检测到格式: YastCraft EPK 文件");
        code = code.split("Attempting to parse as: EAGLERCRAFTX_1_8_OFFLINE").join("正在尝试解析为: YastCraftX 1.8 离线版");
        code = code.split("Attempting to parse as: EAGLERCRAFTX_1_8_SIGNED").join("正在尝试解析为: YastCraftX 1.8 签名版");
        code = code.split("Attempting to parse as: EAGLERCRAFTX_1_8_FAT_OFFLINE").join("正在尝试解析为: YastCraftX 1.8 完整离线版");
        code = code.split("Attempting to parse as: EAGLERCRAFTX_1_8_FAT_SIGNED").join("正在尝试解析为: YastCraftX 1.8 完整签名版");
        code = code.split("Attempting to parse as: EAGLERCRAFTX_1_5_NEW_OFFLINE").join("正在尝试解析为: YastCraftX 1.5 新版离线版");
        code = code.split("Attempting to parse as: EAGLERCRAFTX_1_5_OLD_OFFLINE").join("正在尝试解析为: YastCraftX 1.5 旧版离线版");
        code = code.split("Attempting to parse as: EAGLERCRAFT_BETA_B1_3_OFFLINE").join("正在尝试解析为: YastCraft Beta 1.3 离线版");

        // 导出文件名字符串汉化
        code = code.split("YastCraft 1.8 离线版 .HTML").join("YastCraft 1.8 离线版.html");

        // 全局变量名引用
        code = code.split("window.eaglercraftXClientScriptURL").join("window.yastCraftXClientScriptURL");

        // localStorage 命名空间值
        code = code.split("\"_eaglercraftX\"").join("\"_yastcraft\"");

        return code;
    }

    /**
     * 游戏启动后应用运行时 hook。
     * 在 main() 调用前调用,修改 eaglercraftXOpts。
     */
    function applyRuntimeHooks() {
        // 用配置中的中继器覆盖默认列表
        if (cfg.relays && cfg.relays.length && window.eaglercraftXOpts) {
            var relayId = 0;
            window.eaglercraftXOpts.relays = cfg.relays.map(function (r, i) {
                if (r.primary) relayId = i;
                return {
                    addr: r.addr,
                    comment: r.comment,
                    primary: !!r.primary
                };
            });
        }

        // 注入 splash 文案(若游戏读取了全局变量)
        if (cfg.splashes && cfg.splashes.length) {
            window.MCJS_SPLASHES = cfg.splashes;
        }
    }

    // 暴露 API
    window.MCJS_Patcher = {
        patchClassesSource: patchClassesSource,
        applyRuntimeHooks: applyRuntimeHooks
    };
})();