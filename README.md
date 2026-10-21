# 中文程 · iOS 版

## 方式一：GitHub Actions 自动构建 IPA（推荐，无需 Mac）

1. 把本目录推送到你的 GitHub 仓库
2. 打开仓库 → Actions → 选择 "Build iOS IPA" → Run workflow
3. 构建完成后在 Artifacts 下载 `中文程-iOS-1.15.0.ipa`
4. 用 [Sideloadly](https://sideloadly.io/)（Windows）或 AltStore（Mac）配合你的 Apple ID 签名后安装到 iPhone/iPad

## 方式二：本地 Mac 构建

```bash
chmod +x build-ipa.sh
./build-ipa.sh
```

产物：`中文程-iOS-1.15.0.ipa`（未签名）

## 关于签名

- 免费 Apple ID 签名有效期 7 天，到期需重签
- 付费开发者账号（$99/年）签名有效期 1 年
- 签名工具：Sideloadly（支持 Windows）、AltStore
