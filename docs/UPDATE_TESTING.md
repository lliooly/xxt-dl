# 应用内更新测试流程

本文档用于验证桌面端应用内更新的完整链路，尤其是「检查更新 -> 下载更新 -> 重启安装」。

## 基本原则

不能使用 `v0.1.1` 这类旧正式版作为起点测试，因为旧包本身没有应用内更新功能。

一次完整测试至少需要两个都包含更新功能的预发布版本：

```text
v0.1.2-beta.2 -> v0.1.2-beta.4
```

预发布版本不会被默认稳定版检查命中，只有用户打开「包含预发布版本」开关后才会参与检查。

## 准备第一个 beta 版本

在当前更新功能分支上准备第一个测试版本：

```bash
npm run release:test-version -- v0.1.2-beta.2
npm run check
npm test
npm run build
git add package.json package-lock.json
git commit -m "chore(发布): 准备 v0.1.2-beta.2 测试版本"
git tag v0.1.2-beta.2
git push
git push origin v0.1.2-beta.2
```

等待 GitHub Actions 的 `Package Desktop Apps` workflow 完成，并确认 GitHub Release 中存在对应平台安装包和更新元数据。

安装第一个 beta 的真实包，不要用 `npm run desktop` 测试下载和安装。

## 准备第二个 beta 版本

安装第一个 beta 后，再准备第二个测试版本：

```bash
npm run release:test-version -- v0.1.2-beta.4
npm run check
npm test
npm run build
git add package.json package-lock.json
git commit -m "chore(发布): 准备 v0.1.2-beta.4 测试版本"
git tag v0.1.2-beta.4
git push
git push origin v0.1.2-beta.4
```

等待 GitHub Actions 完成并发布第二个 beta。

## 桌面端验证

在已安装的第一个 beta 中执行：

1. 点击左上角 `XXT DL · 当前版本号` 打开版本卡片。
2. 打开「包含预发布版本」。
3. 点击「最新版本」右上角的检查图标。
4. 确认最新版本显示为第二个 beta 版本号。
5. 点击「下载更新」。
6. 确认下载进度出现。
7. 下载完成后确认出现「重启安装」。
8. 点击「重启安装」。
9. 应用重新打开后，确认左上角版本变为第二个 beta 版本号。

## 平台建议

- Windows：优先验证完整下载和重启安装链路。
- Linux：验证 AppImage / Deb 包和更新元数据。
- macOS：未签名和未 notarization 前，优先验证检查更新和 Release 跳转；自动安装可能被系统安全策略拦截。

## 回到正式版本

`release:test-version` 只用于 beta 测试版本。准备正式版本时，把 `package.json` 和 `package-lock.json` 改为正式版本号，例如 `0.1.2`，再创建 `v0.1.2` tag。
