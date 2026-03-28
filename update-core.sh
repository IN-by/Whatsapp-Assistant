#!/bin/bash

echo "🚀 开始拉取最新版本的 WPPConnect-WA 库..."

# 创建必要的目录（防呆）
mkdir -p src/lib

# 使用 curl 拉取最新版本并覆盖本地文件
if curl -# -L -o src/lib/wppconnect-wa.js "https://unpkg.com/@wppconnect/wa-js@latest/dist/wppconnect-wa.js"; then
    echo "✅ 更新成功！已将最新的 WPPConnect-WA 下载到 src/lib/wppconnect-wa.js"
    echo "💡 提示：请去 Chrome 浏览器插件管理页面 (chrome://extensions) 点击【刷新】图标重新加载此插件，然后刷新 WhatsApp 网页版即可生效。"
else
    echo "❌ 更新失败！请检查您的网络连接。"
    exit 1
fi
