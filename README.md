# YastCraft 1.8.8 - By yast

网页版 Minecraft 1.8.8,由 **Yast** 完全本地化。

## 项目结构

```
mcjs-localized/
├── index.html              主入口(已本地化、接入本地化层)
├── classes.js.gz           游戏代码(已做全面品牌替换)
├── assets.epk.gz           游戏资源包(原样保留)
├── lang/                   ★ 中文语言文件
│   └── zh_CN.lang          Minecraft 1.8.8 完整中文翻译(2687行)
├── LICENSE                 MIT 许可证(作者:Yast)
└── localization/           ★ 本地化层(后续编辑只动这里)
    ├── config.js           品牌/网址/作者/中继器/加载文案配置
    └── patcher.js          字符串替换注入器
```

## 本地化说明

所有可变内容都集中在 `localization/config.js` 这个**可读的纯文本文件**里。
以后要修改品牌、网址、作者、加载文案、中继器列表,只需编辑 `config.js`,无需重新处理 89MB 的 classes.js。

### classes.js 中已完成的替换(共 300+ 处)

| 类别 | 替换内容 |
|------|----------|
| 品牌名 | `Eaglercraft` / `EaglercraftX` -> `YastCraft` |
| 作者 | `lax1dude` -> `Yast` |
| 网址 | `gitlab.com/lax1dude/...` -> `yast-code426.github.io/mcjs` |
| 配置变量 | `eaglercraftXOpts` -> `yastCraftOpts` |
| 光影设置 | Shader 界面全部文案汉化 |
| 皮肤选择 | 编辑资料界面汉化 |
| 调试控制台 | 控制台标题和按钮汉化 |
| 中继器 | 中继器列表界面汉化 |
| 离线下载 | 下载/导出界面汉化 |
| 启动菜单 | Boot Menu 界面汉化 |
| 兼容性检测 | 设备不兼容界面全文汉化 |
| 版本标识 | 所有版本号显示改为 YastCraft |
| 客户端日志 | ClientMain 日志品牌名替换 |
| 服务端标识 | Bungee/Velocity 标识替换 |
| 开屏黄字 | splash 文案汉化 |

### lang 文件

`lang/zh_CN.lang` 包含:
- Minecraft 1.8.8 官方简体中文翻译(2516行)
- YastCraft 特有界面翻译(171行):光影、皮肤、语音、中继器、屏幕录制等

> 注:`net.lax1dude.eaglercraft.v1_8` 等 Java 包名和 `relay.lax1dude.net` 等中继器域名**故意保留**,改动会导致类加载失败或连接中断。

## 部署

### GitHub Pages(推荐)
推送到 GitHub 仓库的 `main` 分支,在仓库 Settings → Pages 选择 GitHub Actions 即可自动部署。
部署地址:`https://yast-code426.github.io/mcjs`

### 本地测试
需要通过 HTTP 服务器运行,不能直接双击打开 index.html:

```bash
python3 -m http.server 8080
```

然后访问 `http://localhost:8080`。
