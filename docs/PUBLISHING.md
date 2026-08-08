# MCJS 远程插件市场 - 发布指南

本目录演示如何发布一个 MCJS 远程插件市场(third-party marketplace)。

## 目录结构

```
docs/
├── remote-market-example.json   # 仓库 manifest(列出所有插件)
└── example-plugins/
    └── greet-plugin.json        # 单个插件 manifest(完整定义)
```

## 1. 准备插件 manifest

每个插件都是一个 JSON 文件,包含完整定义。例如 `greet-plugin.json`:

```json
{
  "id": "example.greet-plugin",
  "name": "问候语插件",
  "version": "1.0.0",
  "author": "Your Name",
  "category": "utility",
  "description": "在游戏页面顶部显示欢迎横幅",
  "hooks": ["launch:after"],
  "permissions": ["game.modify"],
  "code": "(function(){ /* 注入到游戏的 JS */ })();",
  "signatureType": "sha256",
  "signature": "<SHA-256 hex>"
}
```

## 2. 创建仓库 manifest

把仓库的 manifest 放到 `manifest.json` 或类似名称,例如 `remote-market-example.json`:

```json
{
  "name": "我的市场",
  "version": "1.0.0",
  "plugins": [
    {
      "id": "example.greet-plugin",
      "name": "问候语插件",
      "version": "1.0.0",
      "url": "https://my-site.com/plugins/greet-plugin.json"
    }
  ]
}
```

`url` 字段必须可访问,返回单个插件的完整 manifest。

## 3. 上传到任何 HTTPS 服务器

- **GitHub Pages / raw.githubusercontent.com** - 免费,需开启仓库公开
- **个人服务器** - 完全自主
- **对象存储** - AWS S3 / Cloudflare R2 / 阿里云 OSS 等
- **CDN** - jsDelivr、unpkg 等

> ⚠️ 必须使用 HTTPS,启动器会拒绝 HTTP URL。

## 4. 在启动器中添加

用户打开 MCJS 启动器 → 插件市场 → "远程仓库" 标签 → 点击 "➕ 添加仓库":
- 填入你的 manifest URL
- 起一个名字
- 点击确认

之后你的市场就会出现在仓库源列表中,用户可以浏览/安装/更新你的插件。

## 5. 签名(可选但推荐)

为防止插件在传输中被篡改,可以在插件 manifest 中加入 SHA-256 签名:

```bash
# 使用 Node.js 生成签名
node -e "
const crypto = require('crypto');
const fs = require('fs');
const plugin = JSON.parse(fs.readFileSync('greet-plugin.json', 'utf8'));
const p = Object.assign({}, plugin);
delete p.signature;
delete p.signatureType;
delete p.publicKey;
const ordered = Object.keys(p).sort().reduce((o,k)=>(o[k]=p[k],o),{});
const hash = crypto.createHash('sha256')
  .update(JSON.stringify(ordered))
  .digest('hex');
plugin.signatureType = 'sha256';
plugin.signature = hash;
fs.writeFileSync('greet-plugin.signed.json', JSON.stringify(plugin, null, 2));
console.log('Signature:', hash);
"
```

> 高安全场景推荐使用 RSA-SHA256(`signatureType: "rsa-sha256"`)+ 公钥。

## 6. 最佳实践

- **版本号**:用语义化版本 (MAJOR.MINOR.PATCH),启动器据此判断更新。
- **图标**:用 emoji 即可,显示在卡片左上角。
- **描述**:简短一行 + 在 `longDescription` 中详细说明。
- **权限**:只申请必需的权限,信任度更高。
- **幂等**:插件代码用 `window.__MCJS_xxx__` 标记避免重复执行。
- **优雅降级**:失败时用 `console.warn`,不要崩溃游戏。
- **可卸载**:确保禁用后游戏行为完全恢复。

## 7. 远程仓库(用户自行添加)

启动器不内置任何官方/社区仓库 —— 避免引用不存在的 repo 出现 404。

你可以在「插件市场 → 远程」标签页里点「添加仓库」填入自己的 URL,或者用「从 URL 导入」直接拉一个 manifest.json。

## 协议参考

仓库 manifest 协议见 `app.js` 中的 `buildPluginDocsHTML()` 函数的"远程加载"章节。
