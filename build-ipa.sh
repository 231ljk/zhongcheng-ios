#!/bin/bash
# 中文程 iOS 版本地构建脚本（需在 macOS 上运行，需安装 Xcode）
set -e
cd "$(dirname "$0")"

echo "=== 解析依赖 ==="
xcodebuild -resolvePackageDependencies

echo "=== 构建 Release ==="
xcodebuild \
  -scheme ZhongchengApp \
  -destination 'generic/platform=iOS' \
  -configuration Release \
  -derivedDataPath build \
  CODE_SIGN_IDENTITY='' \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO \
  build

echo "=== 打包 IPA ==="
APP_PATH=$(find build/Build/Products -name "ZhongchengApp.app" -type d | head -1)
rm -rf Payload
mkdir -p Payload
cp -R "$APP_PATH" Payload/
zip -r 中文程-iOS-1.15.0.ipa Payload
rm -rf Payload

echo "=== 完成 ==="
echo "产物: 中文程-iOS-1.15.0.ipa"
echo "注意：未签名的 IPA 需用 Sideloadly/AltStore 等工具配合 Apple ID 签名后才能安装到真机。"
