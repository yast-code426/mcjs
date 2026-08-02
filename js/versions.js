// MCJS 镜像站 - 版本数据
// 所有 Eaglercraft/MCJS 版本及镜像链接
// 已加入可联机(multiplayer) & 整合包(modpack) 分类

const VERSIONS = [
  // === MCJS 优化版（推荐） ===
  {
    id: '1.8.8',
    name: 'EaglercraftX 1.8.8',
    version: 'MC JE 1.8.8 JS u53',
    author: 'lax1dude',
    type: 'recommended',
    engine: 'JS',
    size: '21.1MB',
    lang: ['简体中文', 'English'],
    features: ['远程联机', '局域网', '触屏支持', '光影渲染'],
    multiplayer: true,
    modpack: false,
    description: '兼容性最佳。支持 PC + 手机，局域网 & P2P 联机，光影效果。',
    recommendTag: '推荐 | 最佳兼容',
    detail: '🌏 语言：简体中文、英文\n' +
            '💻 性能：高\n' +
            '🎮 设备：电脑键鼠操作、手机触屏操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '📂 资源：自定义材质包、内置光影包',
    path: '1.8.8',
    mirrors: [
      { name: '镜像站 1', url: 'https://playmcjscc.pages.dev/1.8.8/' },
      { name: '镜像站 2', url: 'https://play.mcjs.144449.xyz/1.8.8/' },
      { name: '镜像站 3', url: 'https://ipv6.mcjs.cc/1.8.8/' },
      { name: '镜像站 4', url: 'https://mirror.mcjs.cc/1.8.8/' },
      { name: '镜像站 5', url: 'https://mcjs-mirror.144449.xyz/1.8.8/' },
      { name: '镜像站 6', url: 'https://mcjs-mirror-test.144449.xyz/1.8.8/' }
    ]
  },
  {
    id: '1.8.8wasm',
    name: 'EaglercraftX 1.8.8 WASM',
    version: 'MC JE 1.8.8 WASM-GC u53',
    author: 'lax1dude',
    type: 'recommended',
    engine: 'WASM',
    size: '9.6MB',
    lang: ['简体中文', 'English'],
    features: ['远程联机', '局域网', '触屏支持', '光影渲染', '高帧率'],
    multiplayer: true,
    modpack: false,
    description: '性能最佳。WASM 增强，更高 FPS。需要现代 Chrome 浏览器。',
    recommendTag: '推荐 | 最佳性能',
    detail: '🌏 语言：简体中文、英文\n' +
            '💻 性能：极高\n' +
            '🎮 设备：电脑键鼠操作、手机触屏操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '📂 资源：自定义材质包、内置光影包',
    path: '1.8.8wasm',
    mirrors: [
      { name: '镜像站 1', url: 'https://playmcjscc.pages.dev/1.8.8wasm/' },
      { name: '镜像站 2', url: 'https://play.mcjs.144449.xyz/1.8.8wasm/' },
      { name: '镜像站 3', url: 'https://ipv6.mcjs.cc/1.8.8wasm/' },
      { name: '镜像站 4', url: 'https://mirror.mcjs.cc/1.8.8wasm/' },
      { name: '镜像站 5', url: 'https://mcjs-mirror.144449.xyz/1.8.8wasm/' },
      { name: '镜像站 6', url: 'https://mcjs-mirror-test.144449.xyz/1.8.8wasm/' }
    ]
  },
  {
    id: '1.12.2',
    name: 'Eaglercraft 1.12.2',
    version: 'MC JE 1.12.2 JS u2',
    author: 'PeytonPlayz585',
    type: 'beta',
    engine: 'JS',
    size: '27.7MB',
    lang: ['简体中文', 'English'],
    features: ['单机'],
    multiplayer: false,
    modpack: false,
    description: '最新稳定客户端版本。支持中文。暂不支持多人联机或光影。',
    detail: '🧪 测试版\n' +
            '🌏 语言：简体中文、英文\n' +
            '💻 性能：中\n' +
            '🎮 设备：仅支持电脑键鼠操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✗ 远程联机 ✗\n' +
            '📂 资源：自定义材质包',
    path: '1.12.2',
    mirrors: [
      { name: '镜像站 1', url: 'https://playmcjscc.pages.dev/1.12.2/' },
      { name: '镜像站 2', url: 'https://play.mcjs.144449.xyz/1.12.2/' },
      { name: '镜像站 3', url: 'https://ipv6.mcjs.cc/1.12.2/' },
      { name: '镜像站 4', url: 'https://mirror.mcjs.cc/1.12.2/' },
      { name: '镜像站 5', url: 'https://mcjs-mirror.144449.xyz/1.12.2/' },
      { name: '镜像站 6', url: 'https://mcjs-mirror-test.144449.xyz/1.12.2/' }
    ]
  },
  {
    id: '1.12.2wasm',
    name: 'Eaglercraft 1.12.2 WASM',
    version: 'MC JE 1.12.2 WASM-GC u2',
    author: 'PeytonPlayz585',
    type: 'beta',
    engine: 'WASM',
    size: '15.9MB',
    lang: ['简体中文', 'English'],
    features: ['单机'],
    multiplayer: false,
    modpack: false,
    description: '1.12.2 的 WASM 版本。性能更好，仍在测试中。',
    detail: '🧪 测试版\n' +
            '🌏 语言：简体中文、英文\n' +
            '💻 性能：较高\n' +
            '🎮 设备：仅支持电脑键鼠操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✗ 远程联机 ✗\n' +
            '📂 资源：自定义材质包',
    path: '1.12.2wasm',
    mirrors: [
      { name: '镜像站 1', url: 'https://playmcjscc.pages.dev/1.12.2wasm/' },
      { name: '镜像站 2', url: 'https://play.mcjs.144449.xyz/1.12.2wasm/' },
      { name: '镜像站 3', url: 'https://ipv6.mcjs.cc/1.12.2wasm/' },
      { name: '镜像站 4', url: 'https://mirror.mcjs.cc/1.12.2wasm/' },
      { name: '镜像站 5', url: 'https://mcjs-mirror.144449.xyz/1.12.2wasm/' },
      { name: '镜像站 6', url: 'https://mcjs-mirror-test.144449.xyz/1.12.2wasm/' }
    ]
  },
  {
    id: '1.12.2u3wasm',
    name: 'Eaglercraft 1.12.2 WASM u3',
    version: 'MC JE 1.12.2 WASM-GC u3',
    author: 'PeytonPlayz585',
    type: 'beta',
    engine: 'WASM',
    size: '17.9MB',
    lang: ['English'],
    features: ['远程联机', '局域网', '导出存档'],
    multiplayer: true,
    modpack: false,
    description: 'u3：新增存档导出和远程多人联机。切换语言会导致游戏崩溃（仅限英文）。',
    detail: '🧪 测试版\n' +
            '❓ 与 1.12.2 u2 版的区别：此 u3 版新增了导出世界和远程联机支持，修复了部分渲染问题，但是有新 bug：切换语言会导致游戏崩溃，故只有英文版\n' +
            '🌏 语言：仅英文原版\n' +
            '💻 性能：较高\n' +
            '🎮 设备：仅支持电脑键鼠操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '📂 资源：自定义材质包',
    path: '1.12.2wasm-u3',
    mirrors: [
      { name: '镜像站 1', url: 'https://playmcjscc.pages.dev/1.12.2wasm-u3/' },
      { name: '镜像站 2', url: 'https://play.mcjs.144449.xyz/1.12.2wasm-u3/' },
      { name: '镜像站 3', url: 'https://ipv6.mcjs.cc/1.12.2wasm-u3/' },
      { name: '镜像站 4', url: 'https://mirror.mcjs.cc/1.12.2wasm-u3/' },
      { name: '镜像站 5', url: 'https://mcjs-mirror.144449.xyz/1.12.2wasm-u3/' },
      { name: '镜像站 6', url: 'https://mcjs-mirror-test.144449.xyz/1.12.2wasm-u3/' }
    ]
  },

  // === 新版 Beta 版本 ===
  {
    id: '1.16.5',
    name: 'Eaglercraft 1.16.5 WASM',
    version: 'MC JE 1.16.5 WASM-GC u2 beta',
    author: 'AcornDev',
    type: 'new-beta',
    engine: 'WASM',
    size: '50.6MB',
    lang: ['English'],
    features: ['远程联机', '局域网'],
    multiplayer: true,
    modpack: false,
    description: '下界更新移植版！非常早期的 Beta。需要高配电脑。仅限英文。',
    detail: '🚀 新版测试\n' +
            '🌏 语言：仅英文原版\n' +
            '💻 性能：低（建议使用高性能的电脑）\n' +
            '🎮 设备：仅支持电脑键鼠操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '📂 资源：自定义材质包',
    path: '1.16.5',
    mirrors: [
      { name: 'Beta 站', url: 'https://mcjs-beta.144449.xyz/1.16.5' }
    ],
    external: true
  },
  {
    id: '1.21.11',
    name: 'Eaglercraft 1.21.11 WASM',
    version: 'MC JE 1.21.11 WASM-GC u1 beta',
    author: 'Syntaxsavy',
    type: 'new-beta',
    engine: 'WASM',
    size: '49.5MB',
    lang: ['English'],
    features: ['单机', '局域网'],
    multiplayer: false,
    modpack: false,
    description: '棘巧试炼更新。极度早期版本，可能导致浏览器崩溃。仅限英文。',
    detail: '🚀 新版测试\n' +
            '⚠️ 巨卡慎选！容易导致浏览器崩溃\n' +
            '🌏 语言：仅英文原版\n' +
            '💻 性能：极低（建议使用高性能的电脑）\n' +
            '🎮 设备：仅支持电脑键鼠操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✓ 远程联机 ✗\n' +
            '📂 资源：自定义材质包',
    path: '1.21.11',
    mirrors: [
      { name: 'Beta 站', url: 'https://mcjs-beta.144449.xyz/1.21.11' }
    ],
    external: true
  },
  {
    id: '26.1.2',
    name: 'Eaglercraft 26.1.2',
    version: 'MC JE 26.1.2 u0-1.2',
    author: 'Novix',
    type: 'new-beta',
    engine: 'WASM',
    size: '61.6MB',
    lang: ['English'],
    features: ['单机', '局域网'],
    multiplayer: false,
    modpack: false,
    description: '前沿版本。非常不稳定，可能崩溃。仅限英文。',
    detail: '🚀 新版测试\n' +
            '⚠️ 巨卡慎选！容易导致浏览器崩溃\n' +
            '🌏 语言：仅英文原版\n' +
            '💻 性能：极低（建议使用高性能的电脑）\n' +
            '🎮 设备：仅支持电脑键鼠操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✓ 远程联机 ✗\n' +
            '📂 资源：自定义材质包',
    path: '26.1.2',
    mirrors: [
      { name: 'Beta 站', url: 'https://mcjs-beta.144449.xyz/26.1.2' }
    ],
    external: true
  },

  // === 模组整合包 Eaglercraft 客户端 (来源: mcjs.cc 2026-08-01 官方页面) ===
  // Forge 整合包官方文件大小: Lite 25.7MB / Tech 28.3MB / Skyfactory 26.5MB / Magic 30.3MB
  // 注意: 这些版本只支持英文,切换语言会导致游戏崩溃
  {
    id: '1.6.4-forge-lite',
    name: 'Eaglercraft 1.6.4 Forge "Lite" 轻量整合包',
    version: 'MC JE 1.6.4 Forge Modpack WASM-GC',
    author: 'lax1dude',
    type: 'beta',
    engine: 'WASM',
    size: '25.7MB',
    lang: ['English'],
    features: ['远程联机', '局域网', '模组支持'],
    multiplayer: true,
    modpack: true,
    description: '1.6.4 Forge 轻量模组整合包。需要高性能电脑。仅限英文。',
    detail: '🧪 测试版 | 模组整合包\n' +
            '🌏 语言：仅英文原版\n' +
            '💻 性能：较低\n' +
            '🎮 设备：仅支持电脑键鼠操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '📂 资源：自定义材质包、内置模组包',
    path: 'modpack/lite',
    mirrors: [
      { name: '镜像站 1', url: 'https://playmcjscc.pages.dev/modpack/lite/' },
      { name: '镜像站 2', url: 'https://play.mcjs.144449.xyz/modpack/lite/' },
      { name: '镜像站 3', url: 'https://ipv6.mcjs.cc/modpack/lite/' },
      { name: '镜像站 4', url: 'https://mirror.mcjs.cc/modpack/lite/' },
      { name: '镜像站 5', url: 'https://mcjs-mirror.144449.xyz/modpack/lite/' },
      { name: '镜像站 6', url: 'https://mcjs-mirror-test.144449.xyz/modpack/lite/' }
    ],
    external: true
  },
  {
    id: '1.6.4-forge-tech',
    name: 'Eaglercraft 1.6.4 Forge "Tech" 硬核科技整合包',
    version: 'MC JE 1.6.4 Forge Modpack WASM-GC',
    author: 'lax1dude',
    type: 'beta',
    engine: 'WASM',
    size: '28.3MB',
    lang: ['English'],
    features: ['远程联机', '局域网', '模组支持'],
    multiplayer: true,
    modpack: true,
    description: '1.6.4 Forge 硬核科技模组整合包。文件大，启动久。仅限英文。',
    detail: '🧪 测试版 | 模组整合包\n' +
            '⚠️ 文件较大，启动时间特别久\n' +
            '🌏 语言：仅英文原版\n' +
            '💻 性能：低（建议使用高性能的电脑）\n' +
            '🎮 设备：仅支持电脑键鼠操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '📂 资源：自定义材质包、内置模组包',
    path: 'modpack/tech',
    mirrors: [
      { name: '镜像站 1', url: 'https://playmcjscc.pages.dev/modpack/tech/' },
      { name: '镜像站 2', url: 'https://play.mcjs.144449.xyz/modpack/tech/' },
      { name: '镜像站 3', url: 'https://ipv6.mcjs.cc/modpack/tech/' },
      { name: '镜像站 4', url: 'https://mirror.mcjs.cc/modpack/tech/' },
      { name: '镜像站 5', url: 'https://mcjs-mirror.144449.xyz/modpack/tech/' },
      { name: '镜像站 6', url: 'https://mcjs-mirror-test.144449.xyz/modpack/tech/' }
    ],
    external: true
  },
  {
    id: '1.6.4-forge-skyfactory',
    name: 'Eaglercraft 1.6.4 Forge "Skyfactory" 天空工厂整合包',
    version: 'MC JE 1.6.4 Forge Modpack WASM-GC',
    author: 'lax1dude',
    type: 'beta',
    engine: 'WASM',
    size: '26.5MB',
    lang: ['English'],
    features: ['远程联机', '局域网', '模组支持'],
    multiplayer: true,
    modpack: true,
    description: '1.6.4 Forge 天空工厂模组整合包。文件大，启动久。仅限英文。',
    detail: '🧪 测试版 | 模组整合包\n' +
            '⚠️ 文件较大，启动时间特别久\n' +
            '🌏 语言：仅英文原版\n' +
            '💻 性能：低（建议使用高性能的电脑）\n' +
            '🎮 设备：仅支持电脑键鼠操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '📂 资源：自定义材质包、内置模组包',
    path: 'modpack/skyfactory',
    mirrors: [
      { name: '镜像站 1', url: 'https://playmcjscc.pages.dev/modpack/skyfactory/' },
      { name: '镜像站 2', url: 'https://play.mcjs.144449.xyz/modpack/skyfactory/' },
      { name: '镜像站 3', url: 'https://ipv6.mcjs.cc/modpack/skyfactory/' },
      { name: '镜像站 4', url: 'https://mirror.mcjs.cc/modpack/skyfactory/' },
      { name: '镜像站 5', url: 'https://mcjs-mirror.144449.xyz/modpack/skyfactory/' },
      { name: '镜像站 6', url: 'https://mcjs-mirror-test.144449.xyz/modpack/skyfactory/' }
    ],
    external: true
  },
  {
    id: '1.6.4-forge-magic',
    name: 'Eaglercraft 1.6.4 Forge "Magic" 神奇魔法整合包',
    version: 'MC JE 1.6.4 Forge Modpack WASM-GC',
    author: 'lax1dude',
    type: 'beta',
    engine: 'WASM',
    size: '30.3MB',
    lang: ['English'],
    features: ['远程联机', '局域网', '模组支持'],
    multiplayer: true,
    modpack: true,
    description: '1.6.4 Forge 神奇魔法模组整合包。文件大，启动久。仅限英文。',
    detail: '🧪 测试版 | 模组整合包\n' +
            '⚠️ 文件较大，启动时间特别久\n' +
            '🌏 语言：仅英文原版\n' +
            '💻 性能：低（建议使用高性能的电脑）\n' +
            '🎮 设备：仅支持电脑键鼠操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✓ 远程联机 ✓\n' +
            '📂 资源：自定义材质包、内置模组包',
    path: 'modpack/magic',
    mirrors: [
      { name: '镜像站 1', url: 'https://playmcjscc.pages.dev/modpack/magic/' },
      { name: '镜像站 2', url: 'https://play.mcjs.144449.xyz/modpack/magic/' },
      { name: '镜像站 3', url: 'https://ipv6.mcjs.cc/modpack/magic/' },
      { name: '镜像站 4', url: 'https://mirror.mcjs.cc/modpack/magic/' },
      { name: '镜像站 5', url: 'https://mcjs-mirror.144449.xyz/modpack/magic/' },
      { name: '镜像站 6', url: 'https://mcjs-mirror-test.144449.xyz/modpack/magic/' }
    ],
    external: true
  },

  // === 经典旧版 ===
  {
    id: '1.6.4',
    name: 'Eaglercraft 1.6.4',
    version: 'MC JE 1.6.4 JS',
    author: 'Catfoolyou',
    type: 'legacy',
    engine: 'JS',
    size: '23.5MB',
    lang: ['English'],
    features: ['单机'],
    multiplayer: false,
    modpack: false,
    description: '马匹更新。仅限英文，怀旧体验。',
    detail: '📜 经典版\n' +
            '🌏 语言：仅英文原版\n' +
            '🎮 设备：仅支持电脑键鼠操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✗ 远程联机 ✗',
    path: '1.6.4',
    mirrors: [
      { name: '镜像站 1', url: 'https://playmcjscc.pages.dev/1.6.4/' },
      { name: '镜像站 2', url: 'https://play.mcjs.144449.xyz/1.6.4/' },
      { name: '镜像站 3', url: 'https://ipv6.mcjs.cc/1.6.4/' },
      { name: '镜像站 4', url: 'https://mirror.mcjs.cc/1.6.4/' },
      { name: '镜像站 5', url: 'https://mcjs-mirror.144449.xyz/1.6.4/' },
      { name: '镜像站 6', url: 'https://mcjs-mirror-test.144449.xyz/1.6.4/' }
    ]
  },
  {
    id: '1.5.2',
    name: 'Eaglercraft 1.5.2',
    version: 'MC JE 1.5.2 JS SP2',
    author: 'lax1dude, ayunami2000',
    type: 'legacy',
    engine: 'JS',
    size: '20.2MB',
    lang: ['English'],
    features: ['单机'],
    multiplayer: false,
    modpack: false,
    description: '最初的 Eaglercraft 版本。红石更新时代。仅限英文。',
    detail: '📜 经典版\n' +
            '🌏 语言：仅英文原版\n' +
            '🎮 设备：仅支持电脑键鼠操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✗ 远程联机 ✗',
    path: '1.5.2',
    mirrors: [
      { name: '镜像站 1', url: 'https://playmcjscc.pages.dev/1.5.2/' },
      { name: '镜像站 2', url: 'https://play.mcjs.144449.xyz/1.5.2/' },
      { name: '镜像站 3', url: 'https://ipv6.mcjs.cc/1.5.2/' },
      { name: '镜像站 4', url: 'https://mirror.mcjs.cc/1.5.2/' },
      { name: '镜像站 5', url: 'https://mcjs-mirror.144449.xyz/1.5.2/' },
      { name: '镜像站 6', url: 'https://mcjs-mirror-test.144449.xyz/1.5.2/' }
    ]
  },
  {
    id: '1.2.5',
    name: 'Eaglercraft 1.2.5',
    version: 'MC JE 1.2.5 JS',
    author: 'Colbster937',
    type: 'legacy',
    engine: 'JS',
    size: '21.3MB',
    lang: ['English'],
    features: ['单机'],
    multiplayer: false,
    modpack: false,
    description: 'Minecraft 经典时代。仅限英文，复古体验。',
    detail: '📜 经典版\n' +
            '🌏 语言：仅英文原版\n' +
            '🎮 设备：仅支持电脑键鼠操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✗ 远程联机 ✗',
    path: '1.2.5',
    mirrors: [
      { name: '镜像站 1', url: 'https://playmcjscc.pages.dev/1.2.5/' },
      { name: '镜像站 2', url: 'https://play.mcjs.144449.xyz/1.2.5/' },
      { name: '镜像站 3', url: 'https://ipv6.mcjs.cc/1.2.5/' },
      { name: '镜像站 4', url: 'https://mirror.mcjs.cc/1.2.5/' },
      { name: '镜像站 5', url: 'https://mcjs-mirror.144449.xyz/1.2.5/' },
      { name: '镜像站 6', url: 'https://mcjs-mirror-test.144449.xyz/1.2.5/' }
    ]
  },
  {
    id: 'legacy/beta1.7.3',
    name: 'Eaglercraft Beta 1.7.3',
    version: 'MC Beta 1.7.3 JS',
    author: 'lax1dude',
    type: 'legacy',
    engine: 'JS',
    size: '15.6MB',
    lang: ['English'],
    features: ['单机'],
    multiplayer: false,
    modpack: false,
    description: 'Beta 时代 Minecraft。仅限英文，怀旧体验。',
    detail: '📜 经典版\n' +
            '🌏 语言：仅英文原版\n' +
            '🎮 设备：仅支持电脑键鼠操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✗ 远程联机 ✗',
    path: 'legacy/beta1.7.3',
    mirrors: [
      { name: '镜像站 1', url: 'https://playmcjscc.pages.dev/legacy/beta1.7.3/' },
      { name: '镜像站 2', url: 'https://play.mcjs.144449.xyz/legacy/beta1.7.3/' },
      { name: '镜像站 3', url: 'https://ipv6.mcjs.cc/legacy/beta1.7.3/' },
      { name: '镜像站 4', url: 'https://mirror.mcjs.cc/legacy/beta1.7.3/' },
      { name: '镜像站 5', url: 'https://mcjs-mirror.144449.xyz/legacy/beta1.7.3/' },
      { name: '镜像站 6', url: 'https://mcjs-mirror-test.144449.xyz/legacy/beta1.7.3/' }
    ]
  },
  {
    id: 'legacy/beta1.3',
    name: 'Eaglercraft Beta 1.3',
    version: 'MC Beta 1.3 JS',
    author: 'lax1dude',
    type: 'legacy',
    engine: 'JS',
    size: '4.3MB',
    lang: ['English'],
    features: ['单机'],
    multiplayer: false,
    modpack: false,
    description: '最早的 Eaglercraft 单机版本。仅限英文，非常复古。',
    detail: '📜 经典版\n' +
            '🌏 语言：仅英文原版\n' +
            '🎮 设备：仅支持电脑键鼠操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✗ 远程联机 ✗',
    path: 'legacy/beta1.3',
    mirrors: [
      { name: '镜像站 1', url: 'https://playmcjscc.pages.dev/legacy/beta1.3/' },
      { name: '镜像站 2', url: 'https://play.mcjs.144449.xyz/legacy/beta1.3/' },
      { name: '镜像站 3', url: 'https://ipv6.mcjs.cc/legacy/beta1.3/' },
      { name: '镜像站 4', url: 'https://mirror.mcjs.cc/legacy/beta1.3/' },
      { name: '镜像站 5', url: 'https://mcjs-mirror.144449.xyz/legacy/beta1.3/' },
      { name: '镜像站 6', url: 'https://mcjs-mirror-test.144449.xyz/legacy/beta1.3/' }
    ]
  },
  {
    id: 'legacy/alpha1.2.6',
    name: 'Eaglercraft Alpha 1.2.6',
    version: 'MC Alpha 1.2.6 JS',
    author: 'lax1dude',
    type: 'legacy',
    engine: 'JS',
    size: '8.2MB',
    lang: ['English'],
    features: ['单机'],
    multiplayer: false,
    modpack: false,
    description: 'Alpha 时代 Minecraft。最早的 Eaglercraft 可玩版本。仅限英文。',
    detail: '📜 经典版\n' +
            '🌏 语言：仅英文原版\n' +
            '🎮 设备：仅支持电脑键鼠操作\n' +
            '🔗 联机：单机 ✓ 局域网 ✗ 远程联机 ✗',
    path: 'legacy/alpha1.2.6',
    mirrors: [
      { name: '镜像站 1', url: 'https://playmcjscc.pages.dev/legacy/alpha1.2.6/' },
      { name: '镜像站 2', url: 'https://play.mcjs.144449.xyz/legacy/alpha1.2.6/' },
      { name: '镜像站 3', url: 'https://ipv6.mcjs.cc/legacy/alpha1.2.6/' },
      { name: '镜像站 4', url: 'https://mirror.mcjs.cc/legacy/alpha1.2.6/' },
      { name: '镜像站 5', url: 'https://mcjs-mirror.144449.xyz/legacy/alpha1.2.6/' },
      { name: '镜像站 6', url: 'https://mcjs-mirror-test.144449.xyz/legacy/alpha1.2.6/' }
    ]
  }
];

// 镜像备用链接
const MIRROR_BASES = [
  'https://playmcjscc.pages.dev',
  'https://play.mcjs.144449.xyz',
  'https://ipv6.mcjs.cc',
  'https://mirror.mcjs.cc',
  'https://mcjs-mirror.144449.xyz',
  'https://mcjs-mirror-test.144449.xyz'
];