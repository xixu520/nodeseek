    // 红色高亮样式
    const style = document.createElement('style');
    style.innerHTML = `.friend-user { color: #2ea44f !important; font-weight: bold; white-space: nowrap; } .blacklisted-user { color: red !important; font-weight: bold; white-space: nowrap; } .blacklist-remark { color: #d00; font-size: 12px; margin-left: 4px; max-width: 220px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: text-bottom; } .friend-remark { color: #2ea44f; font-size: 12px; margin-left: 4px; max-width: 220px; display: inline-block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: text-bottom; } .ns-viewed-title { color: var(--ns-viewed-color, #9aa0a6) !important; }
    .ns-page-notification .app-switch a,
    .ns-page-notification .app-switch a.btn,
    .ns-page-notification .app-switch a[class*="btn-"] {
        background: transparent !important;
        background-image: none !important;
        box-shadow: none !important;
    }
    .ns-filter-highlighted {
        background: color-mix(in srgb, var(--ns-filter-highlight-color, #facc15) 16%, transparent) !important;
        border-left: 3px solid var(--ns-filter-highlight-color, #facc15) !important;
        box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ns-filter-highlight-color, #facc15) 24%, transparent) !important;
    }
    :root {
        --ns-panel-bg: rgba(248, 255, 253, 0.96);
        --ns-panel-border: rgba(20, 184, 166, 0.18);
        --ns-panel-shadow: 0 10px 28px rgba(15, 118, 110, 0.12);
        --ns-panel-surface-bg: #f8fffd;
        --ns-panel-surface-border: rgba(20, 184, 166, 0.16);
        --ns-panel-surface-text: #111;
        --ns-panel-collapse-bg: #f0fdfa;
        --ns-panel-collapse-border: rgba(20, 184, 166, 0.28);
        --ns-panel-collapse-color: #0f766e;
        --ns-panel-collapse-hover-bg: #ccfbf1;
    }
    #nodeseek-plugin-buttons-container {
        background: var(--ns-panel-bg) !important;
        border: 1px solid var(--ns-panel-border) !important;
        box-shadow: var(--ns-panel-shadow) !important;
    }
    #ns-highlight-stats-container {
        background: var(--ns-panel-surface-bg) !important;
        border: 1px solid var(--ns-panel-surface-border) !important;
        color: var(--ns-panel-surface-text) !important;
    }
    .collapse-btn {
        background: var(--ns-panel-collapse-bg) !important;
        border-color: var(--ns-panel-collapse-border) !important;
        color: var(--ns-panel-collapse-color) !important;
    }
    .collapse-btn:hover { background: var(--ns-panel-collapse-hover-bg) !important; }
    @media (prefers-color-scheme: dark) {
        :root {
            --ns-panel-bg: rgba(28, 28, 30, 0.92);
            --ns-panel-border: rgba(255, 255, 255, 0.12);
            --ns-panel-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
            --ns-panel-surface-bg: rgba(17, 17, 19, 0.88);
            --ns-panel-surface-border: rgba(255, 255, 255, 0.12);
            --ns-panel-surface-text: rgba(255, 255, 255, 0.86);
            --ns-panel-collapse-bg: rgba(44, 44, 46, 0.95);
            --ns-panel-collapse-border: rgba(255, 255, 255, 0.12);
            --ns-panel-collapse-color: rgba(255, 255, 255, 0.78);
            --ns-panel-collapse-hover-bg: rgba(58, 58, 60, 0.95);
        }
    }
    html[data-theme="dark"], html.dark, body.dark, body.theme-dark {
        --ns-panel-bg: rgba(28, 28, 30, 0.92);
        --ns-panel-border: rgba(255, 255, 255, 0.12);
        --ns-panel-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
        --ns-panel-surface-bg: rgba(17, 17, 19, 0.88);
        --ns-panel-surface-border: rgba(255, 255, 255, 0.12);
        --ns-panel-surface-text: rgba(255, 255, 255, 0.86);
        --ns-panel-collapse-bg: rgba(44, 44, 46, 0.95);
        --ns-panel-collapse-border: rgba(255, 255, 255, 0.12);
        --ns-panel-collapse-color: rgba(255, 255, 255, 0.78);
        --ns-panel-collapse-hover-bg: rgba(58, 58, 60, 0.95);
    }
    html[data-ns-theme="dark"] {
        --ns-panel-bg: rgba(28, 28, 30, 0.92);
        --ns-panel-border: rgba(255, 255, 255, 0.12);
        --ns-panel-shadow: 0 6px 20px rgba(0, 0, 0, 0.55);
        --ns-panel-surface-bg: rgba(17, 17, 19, 0.88);
        --ns-panel-surface-border: rgba(255, 255, 255, 0.12);
        --ns-panel-surface-text: rgba(255, 255, 255, 0.86);
        --ns-panel-collapse-bg: rgba(44, 44, 46, 0.95);
        --ns-panel-collapse-border: rgba(255, 255, 255, 0.12);
        --ns-panel-collapse-color: rgba(255, 255, 255, 0.78);
        --ns-panel-collapse-hover-bg: rgba(58, 58, 60, 0.95);
    }
    html[data-ns-theme="light"] {
        --ns-panel-bg: rgba(248, 255, 253, 0.96);
        --ns-panel-border: rgba(20, 184, 166, 0.18);
        --ns-panel-shadow: 0 10px 28px rgba(15, 118, 110, 0.12);
        --ns-panel-surface-bg: #f8fffd;
        --ns-panel-surface-border: rgba(20, 184, 166, 0.16);
        --ns-panel-surface-text: #111;
        --ns-panel-collapse-bg: #f0fdfa;
        --ns-panel-collapse-border: rgba(20, 184, 166, 0.28);
        --ns-panel-collapse-color: #0f766e;
        --ns-panel-collapse-hover-bg: #ccfbf1;
    }
    .blacklist-btn {
        margin-left: 7px;
        cursor: pointer;
        color: #fff;
        background: #000;
        border: none;
        border-radius: 3px;
        padding: 1.8px 5.4px;
        font-size: 10.8px;
    }
    .blacklist-btn.red { background: #d00 !important; }
    .blacklist-time { color: #d00; font-size: 10px; margin-left: 4px; }
    /* 新增：折叠按钮样式 */
    .collapse-btn {
        position: absolute;
        left: -34px;
        top: 10px;
        width: 34px;
        height: 34px;
        background: #f0f0f0;
        border: 1px solid #ccc;
        border-right: none;
        border-radius: 4px 0 0 4px;
        cursor: pointer;
        display: flex;
        justify-content: center;
        align-items: center;
        color: #666;
        font-weight: bold;
        font-size: 14px;
        z-index: 9998;
        transition: transform 0.3s ease;
    }
    .theme-toggle-btn { top: 50px; }
    .collapse-btn:hover { background: #e0e0e0; }
    .nodeseek-plugin-container-collapsed {
        width: 0 !important;
        height: 0 !important;
        padding: 0 !important;
        margin: 0 !important;
        overflow: hidden !important;
        border: none !important;
        box-shadow: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
    }

    #nodeseek-plugin-main-container.nodeseek-plugin-main-collapsed {
        right: 0 !important;
        top: 40% !important;
        align-items: center !important;
    }

    #nodeseek-plugin-main-container.nodeseek-plugin-main-collapsed #collapse-btn {
        position: static !important;
        width: 34px !important;
        height: 34px !important;
        border-radius: 8px 0 0 8px !important;
        border: 1px solid var(--ns-panel-collapse-border) !important;
        border-right: none !important;
        transform: none !important;
        opacity: .92 !important;
    }

    #nodeseek-plugin-main-container.nodeseek-plugin-main-collapsed #theme-toggle-btn {
        display: none !important;
    }

    /* 新增：确保用户弹窗能完全遮盖用户信息显示 */
    .hover-user-card, .user-card {
        z-index: 1000 !important;
        background-color: var(--bg-main-color, #fff) !important;
    }

    /* 移动设备适配样式 */
    @media (max-width: 767px) {
        /* 弹窗样式移动适配 */
        #nodeseek-plugin-main-container {
            top: auto !important;
            right: 10px !important;
            bottom: calc(12px + env(safe-area-inset-bottom, 0px)) !important;
            left: auto !important;
            max-width: calc(100vw - 20px) !important;
            align-items: flex-end !important;
        }

        #nodeseek-plugin-buttons-container {
            width: min(300px, calc(100vw - 60px)) !important;
            max-height: min(70vh, 560px) !important;
            overflow-y: auto !important;
            -webkit-overflow-scrolling: touch !important;
            gap: 6px !important;
            padding: 8px !important;
            border-radius: 8px !important;
            box-sizing: border-box !important;
        }

        #nodeseek-plugin-buttons-container.nodeseek-plugin-container-collapsed {
            width: 0 !important;
            height: 0 !important;
            max-height: 0 !important;
            padding: 0 !important;
            overflow: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
        }

        #nodeseek-plugin-buttons-container > button,
        #nodeseek-plugin-buttons-container .blacklist-btn {
            min-width: 0 !important;
            min-height: 34px !important;
            margin-left: 0 !important;
            font-size: 12px !important;
            box-sizing: border-box !important;
        }

        #nodeseek-plugin-buttons-container > div {
            gap: 6px !important;
        }

        #nodeseek-plugin-buttons-container > div > button {
            min-width: 0 !important;
            flex: 1 1 0 !important;
        }

        #ns-highlight-stats-container {
            max-height: 130px !important;
            overflow: auto !important;
        }

        .collapse-btn {
            left: -38px !important;
            top: auto !important;
            bottom: 0 !important;
            width: 34px !important;
            height: 34px !important;
            border: 1px solid var(--ns-panel-collapse-border) !important;
            border-radius: 8px !important;
            font-size: 16px !important;
        }

        .theme-toggle-btn {
            top: auto !important;
            bottom: 40px !important;
        }

        #logs-dialog, #blacklist-dialog, #friends-dialog, #favorites-dialog, #browse-history-dialog,
        #settings-dialog, #webdav-sync-dialog, #jump-list-dialog, #ns-nodeimage-safari-dialog {
            position: fixed !important;
            width: calc(100vw - 20px) !important;
            min-width: unset !important;
            max-width: calc(100vw - 20px) !important;
            left: 10px !important;
            right: 10px !important;
            top: 10px !important;
            transform: none !important;
            box-sizing: border-box !important;
            max-height: calc(100vh - 24px - env(safe-area-inset-bottom, 0px)) !important; /* 增加最大高度 */
            padding: 12px 8px 8px 8px !important; /* 减少内部填充 */
            overflow-y: auto !important;
            overflow-x: hidden !important;
            border-radius: 10px !important;
            box-shadow: 0 2px 20px rgba(0,0,0,0.2) !important;
        }

        #settings-dialog > div:last-child,
        #webdav-sync-dialog > div:last-child,
        #jump-list-dialog > div:last-child,
        #ns-nodeimage-safari-dialog > div:last-child {
            max-height: calc(100vh - 110px - env(safe-area-inset-bottom, 0px)) !important;
            overflow-y: auto !important;
        }

        /* 弹窗关闭按钮适配 */
        #logs-dialog .close-btn, #blacklist-dialog .close-btn,
        #friends-dialog .close-btn, #favorites-dialog .close-btn, #browse-history-dialog .close-btn {
            right: 8px !important;
            top: 5px !important;
            font-size: 24px !important;
            width: 30px !important;
            height: 30px !important;
            line-height: 30px !important;
            text-align: center !important;
        }

        /* 按钮适配 */
        .blacklist-btn {
            padding: 3px 6px !important;
            font-size: 12px !important;
            margin-left: 0 !important; /* 移除左边距，避免布局错乱 */
            width: auto !important; /* 强制自适应宽度 */
            min-width: unset !important; /* 移除最小宽度限制 */
            max-width: 100% !important; /* 确保不超出容器 */
            white-space: nowrap !important; /* 防止文字换行 */
        }

        /* 针对签到按钮的特殊适配 */
        #sign-in-btn {
            width: 100% !important; /* 签到按钮占满一行 */
        }

        /* 修复按钮容器内间距 */
        #nodeseek-plugin-buttons-container {
            gap: 5px !important; /* 减小间距 */
            padding: 8px !important;
        }

        /* 表格容器适配 - 移动端纵向布局 */
        #blacklist-dialog table, #friends-dialog table, #favorites-dialog table, #browse-history-dialog table,
        #blacklist-dialog tbody, #friends-dialog tbody, #favorites-dialog tbody, #browse-history-dialog tbody {
            width: 100% !important;
            display: block !important;
        }

        /* 移动端表格行转为卡片式布局 */
        #blacklist-dialog tr, #friends-dialog tr, #favorites-dialog tr, #browse-history-dialog tr {
            display: block !important;
            border: 1px solid #e0e0e0 !important;
            border-radius: 8px !important;
            margin-bottom: 8px !important; /* 减少卡片间距 */
            padding: 6px !important; /* 减少内部填充 */
            background-color: #f9f9f9 !important;
        }

        /* 移动端表头隐藏 */
        #blacklist-dialog thead, #friends-dialog thead, #favorites-dialog thead, #browse-history-dialog thead {
            display: none !important;
        }

        /* 表格单元格纵向排列 */
        #blacklist-dialog td, #friends-dialog td, #favorites-dialog td, #browse-history-dialog td {
            display: block !important;
            width: 100% !important;
            max-width: 100% !important;
            padding: 1px 0 !important; /* 减少上下填充 */
            border: none !important;
            text-align: left !important;
            font-size: 13px !important;
            margin-bottom: 2px !important; /* 减少单元格间距 */
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            line-height: 1.3 !important; /* 减少行高 */
        }

        /* 用户名和标题样式特殊处理 */
        #blacklist-dialog td:first-child, #friends-dialog td:first-child, #favorites-dialog td:first-child, #browse-history-dialog td:first-child {
            font-size: 15px !important;
            font-weight: bold !important;
            border-bottom: 1px solid #eaeaea !important;
            padding-bottom: 3px !important; /* 减少下边距 */
            margin-bottom: 4px !important; /* 减少下边距 */
        }

        /* 备注特殊处理 - 显示为单独一行带前缀 */
        #blacklist-dialog td:nth-child(2)::before,
        #friends-dialog td:nth-child(2)::before,
        #favorites-dialog td:nth-child(2)::before {
            content: "备注：" !important;
            font-weight: bold !important;
            color: #666 !important;
            font-size: 12px !important; /* 减小前缀字体大小 */
        }

        /* 备注行样式 */
        #blacklist-dialog td:nth-child(2),
        #friends-dialog td:nth-child(2),
        #favorites-dialog td:nth-child(2) {
            white-space: normal !important; /* 允许备注内容换行 */
            line-height: 1.3 !important; /* 减少行高 */
            max-height: 50px !important; /* 减少最大高度 */
            overflow-y: auto !important;
            padding: 2px 0 !important; /* 减少上下填充 */
            margin-bottom: 3px !important; /* 减少下边距 */
        }

        /* 时间特殊处理 */
        #blacklist-dialog td:nth-child(3)::before,
        #friends-dialog td:nth-child(3)::before,
        #favorites-dialog td:nth-child(4)::before {
            content: "时间：" !important;
            font-weight: bold !important;
            color: #666 !important;
            font-size: 12px !important; /* 减小前缀字体大小 */
        }

        /* 拉黑页面特殊处理 */
        #blacklist-dialog td:nth-child(4)::before {
            content: "页面：" !important;
            font-weight: bold !important;
            color: #666 !important;
            font-size: 12px !important; /* 减小前缀字体大小 */
        }

        /* 操作按钮放在底部，居中显示 */
        #blacklist-dialog td:last-child,
        #friends-dialog td:last-child,
        #favorites-dialog td:last-child,
        #browse-history-dialog td:last-child {
            text-align: center !important;
            padding-top: 4px !important; /* 减少上填充 */
            border-top: 1px solid #eaeaea !important;
            margin-top: 2px !important; /* 减少上边距 */
        }

        /* 移除按钮在移动端内更显眼 */
        #blacklist-dialog td:last-child button,
        #friends-dialog td:last-child button,
        #favorites-dialog td:last-child button,
        #browse-history-dialog td:last-child button {
            width: 65px !important; /* 稍微减少按钮宽度 */
            padding: 3px 0 !important; /* 减少按钮内部填充 */
            font-size: 12px !important; /* 减小字体 */
        }

        /* 弹窗内部滚动区域 */
        #logs-dialog pre, #blacklist-dialog div, #friends-dialog div, #favorites-dialog div, #browse-history-dialog div {
            max-height: 65vh !important;
            overflow-y: auto !important;
        }

        /* 当备注为空时显示提示文本 */
        #blacklist-dialog td:nth-child(2):empty::after,
        #friends-dialog td:nth-child(2):empty::after,
        #favorites-dialog td:nth-child(2):empty::after {
            content: "无" !important;
            color: #999 !important;
            font-style: italic !important;
        }

        /* 历史浏览记录弹窗移动端特殊处理 */
        @media (max-width: 767px) {
            /* 访问时间特殊处理 */
            #browse-history-dialog td:nth-child(2)::before {
                content: "访问：" !important;
                font-weight: bold !important;
                color: #666 !important;
                font-size: 12px !important;
            }

            /* 访问次数特殊处理 */
            #browse-history-dialog td:nth-child(3)::before {
                content: "次数：" !important;
                font-weight: bold !important;
                color: #666 !important;
                font-size: 12px !important;
            }

            /* 访问次数样式 */
            #browse-history-dialog td:nth-child(3) {
                text-align: left !important;
                white-space: nowrap !important;
            }
        }

        /* 历史浏览记录表格行高度控制 */
        #browse-history-dialog table {
            table-layout: fixed !important;
        }

        #browse-history-dialog tr {
            height: auto !important;
            min-height: 35px !important;
        }

        #browse-history-dialog td {
            vertical-align: middle !important;
            box-sizing: border-box !important;
            word-wrap: break-word !important;
        }

        /* 确保访问次数列在所有设备上都不换行 */
        #browse-history-dialog td:nth-child(3) {
            white-space: nowrap !important;
        }
    }`;
    document.head.appendChild(style);

    function injectNsModernUiStyle() {
        if (document.getElementById('ns-modern-ui-style')) return;
        const modernStyle = document.createElement('style');
        modernStyle.id = 'ns-modern-ui-style';
        modernStyle.textContent = `
        :root {
            --ns-ui-bg: rgba(248, 255, 253, 0.96);
            --ns-ui-bg-solid: #fbfffe;
            --ns-ui-text: #1f2937;
            --ns-ui-muted: #64748b;
            --ns-ui-line: rgba(20, 184, 166, 0.18);
            --ns-ui-soft: #effaf7;
            --ns-ui-hover: #dff7f0;
            --ns-ui-primary: #38bdf8;
            --ns-ui-green: #22c55e;
            --ns-ui-teal: #14b8a6;
            --ns-ui-red: #fb7185;
            --ns-ui-purple: #a78bfa;
            --ns-ui-brown: #f59e0b;
            --ns-ui-radius: 8px;
            --ns-ui-shadow: 0 12px 30px rgba(15, 118, 110, 0.14);
            --ns-ui-font: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        html[data-theme="dark"], html.dark, body.dark, body.theme-dark, html[data-ns-theme="dark"] {
            --ns-ui-bg: rgba(24, 26, 30, 0.96);
            --ns-ui-bg-solid: #181a1e;
            --ns-ui-text: rgba(255, 255, 255, 0.88);
            --ns-ui-muted: rgba(255, 255, 255, 0.62);
            --ns-ui-line: rgba(255, 255, 255, 0.14);
            --ns-ui-soft: rgba(255, 255, 255, 0.07);
            --ns-ui-hover: rgba(255, 255, 255, 0.1);
            --ns-ui-shadow: 0 16px 42px rgba(0, 0, 0, 0.48);
        }

        .ns-tw, .ns-tw * {
            box-sizing: border-box !important;
            letter-spacing: 0 !important;
        }

        .ns-tw {
            font-family: var(--ns-ui-font) !important;
            color: var(--ns-ui-text) !important;
        }

        .ns-tw-panel {
            background: var(--ns-ui-bg) !important;
            border: 1px solid var(--ns-ui-line) !important;
            border-radius: 8px !important;
            box-shadow: var(--ns-ui-shadow) !important;
            backdrop-filter: blur(14px) saturate(140%) !important;
            -webkit-backdrop-filter: blur(14px) saturate(140%) !important;
        }

        .ns-tw-row {
            display: flex !important;
            flex-direction: row !important;
            gap: 8px !important;
            width: 100% !important;
        }

        .ns-tw-stack {
            display: flex !important;
            flex-direction: column !important;
            gap: 6px !important;
            width: 100% !important;
        }

        .ns-tw-btn {
            min-height: 24px !important;
            padding: 4px 7px !important;
            border: 0 !important;
            border-radius: 7px !important;
            color: #fff !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            line-height: 1.2 !important;
            white-space: nowrap !important;
            cursor: pointer !important;
            transition: transform .12s ease, filter .12s ease, box-shadow .12s ease !important;
        }

        .ns-tw-btn:hover {
            filter: brightness(1.06) !important;
            transform: translateY(-1px) !important;
        }

        #nodeseek-plugin-main-container {
            font-family: var(--ns-ui-font) !important;
        }

        #nodeseek-plugin-buttons-container {
            width: 118px !important;
            padding: 8px !important;
            gap: 6px !important;
            border-radius: var(--ns-ui-radius) !important;
            background: var(--ns-ui-bg) !important;
            border: 1px solid var(--ns-ui-line) !important;
            box-shadow: var(--ns-ui-shadow) !important;
            backdrop-filter: blur(14px) saturate(140%) !important;
            -webkit-backdrop-filter: blur(14px) saturate(140%) !important;
        }

        #nodeseek-plugin-buttons-container > div {
            gap: 8px !important;
            width: 100% !important;
        }

        #nodeseek-plugin-buttons-container .blacklist-btn,
        #nodeseek-plugin-buttons-container > button,
        .blacklist-btn {
            min-height: 30px !important;
            padding: 6px 9px !important;
            margin-left: 0 !important;
            border: 0 !important;
            border-radius: 8px !important;
            box-shadow: 0 1px 2px rgba(15,118,110,0.08) !important;
            color: #fff !important;
            font-family: var(--ns-ui-font) !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            line-height: 1.2 !important;
            letter-spacing: 0 !important;
            white-space: nowrap !important;
            text-align: center !important;
            cursor: pointer !important;
            transition: transform .12s ease, filter .12s ease, box-shadow .12s ease !important;
        }

        #nodeseek-plugin-buttons-container .blacklist-btn,
        #nodeseek-plugin-buttons-container > button,
        #nodeseek-plugin-buttons-container > div > button {
            width: 100% !important;
            min-width: 100% !important;
            max-width: 100% !important;
            height: 32px !important;
            min-height: 32px !important;
            max-height: 32px !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            box-sizing: border-box !important;
        }

        #nodeseek-plugin-buttons-container .blacklist-btn:hover,
        #nodeseek-plugin-buttons-container > button:hover {
            filter: brightness(1.06) !important;
            transform: translateY(-1px) !important;
            box-shadow: inset 0 -1px 0 rgba(0,0,0,0.12), 0 4px 10px rgba(15,23,42,0.12) !important;
        }

        #settings-btn { background: #64748b !important; }
        #keyword-filter-btn { background: var(--ns-ui-primary) !important; }
        #webdav-sync-btn, #ns-nodeimage-btn { background: var(--ns-ui-teal) !important; }
        #blacklist-view-btn, #friends-view-btn { background: var(--ns-ui-green) !important; }
        #quick-reply-btn { background: var(--ns-ui-purple) !important; }
        #sign-log-btn { background: var(--ns-ui-brown) !important; }
        .blacklist-btn.red { background: var(--ns-ui-red) !important; }

        .userscript-nodeseek-interaction-btn.ns-user-action-btn {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            width: auto !important;
            min-width: 0 !important;
            max-width: none !important;
            height: 20px !important;
            min-height: 20px !important;
            max-height: 20px !important;
            margin-left: 4px !important;
            padding: 0 6px !important;
            border: 1px solid rgba(148, 163, 184, .42) !important;
            border-radius: 5px !important;
            background: rgba(248, 250, 252, .92) !important;
            box-shadow: none !important;
            color: #475569 !important;
            font-family: var(--ns-ui-font) !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            line-height: 18px !important;
            vertical-align: middle !important;
            white-space: nowrap !important;
            transform: none !important;
        }

        .userscript-nodeseek-interaction-btn.ns-user-action-btn:hover {
            background: rgba(241, 245, 249, .96) !important;
            border-color: rgba(100, 116, 139, .45) !important;
            color: #334155 !important;
            filter: none !important;
            transform: none !important;
            box-shadow: none !important;
        }

        .userscript-nodeseek-interaction-btn.ns-user-block-btn {
            background: rgba(254, 242, 242, .82) !important;
            border-color: rgba(248, 113, 113, .28) !important;
            color: #9f1239 !important;
        }

        .userscript-nodeseek-interaction-btn.ns-user-block-btn.ns-is-active,
        .userscript-nodeseek-interaction-btn.ns-user-block-btn.red {
            background: rgba(255, 228, 230, .88) !important;
            border-color: rgba(244, 63, 94, .34) !important;
            color: #9f1239 !important;
        }

        .userscript-nodeseek-interaction-btn.ns-user-friend-btn {
            background: rgba(240, 253, 250, .86) !important;
            border-color: rgba(45, 212, 191, .3) !important;
            color: #0f766e !important;
        }

        .userscript-nodeseek-interaction-btn.ns-user-friend-btn.ns-is-active {
            background: rgba(241, 245, 249, .9) !important;
            border-color: rgba(148, 163, 184, .42) !important;
            color: #64748b !important;
        }

        #collapse-btn,
        #theme-toggle-btn {
            border-radius: 7px 0 0 7px !important;
            background: var(--ns-ui-bg-solid) !important;
            border: 1px solid var(--ns-ui-line) !important;
            color: var(--ns-ui-text) !important;
            box-shadow: 0 5px 14px rgba(15,23,42,0.12) !important;
            width: 34px !important;
            height: 34px !important;
            min-width: 34px !important;
            min-height: 34px !important;
            max-width: 34px !important;
            max-height: 34px !important;
            padding: 0 !important;
            line-height: 1 !important;
            box-sizing: border-box !important;
        }

        #ns-highlight-stats-container {
            margin-top: 1px !important;
            padding: 5px !important;
            border-radius: 7px !important;
            background: var(--ns-ui-soft) !important;
            border: 1px solid var(--ns-ui-line) !important;
            color: var(--ns-ui-muted) !important;
        }

        #logs-dialog, #blacklist-dialog, #friends-dialog, #favorites-dialog, #browse-history-dialog,
        #settings-dialog, #webdav-sync-dialog, #jump-list-dialog, #ns-nodeimage-safari-dialog,
        #favorite-add-dialog, #chicken-leg-stats-dialog, #hot-topics-dialog, #vps-calculator-dialog,
        #notes-dialog, #ns-filter-dialog, #quick-reply-dialog {
            font-family: var(--ns-ui-font) !important;
            color: var(--ns-ui-text) !important;
            background: var(--ns-ui-bg-solid) !important;
            border: 1px solid var(--ns-ui-line) !important;
            border-radius: 8px !important;
            box-shadow: var(--ns-ui-shadow) !important;
        }

        #logs-dialog button, #blacklist-dialog button, #friends-dialog button, #favorites-dialog button,
        #browse-history-dialog button, #settings-dialog button, #webdav-sync-dialog button,
        #jump-list-dialog button, #ns-nodeimage-safari-dialog button, #favorite-add-dialog button,
        #chicken-leg-stats-dialog button, #hot-topics-dialog button, #vps-calculator-dialog button,
        #notes-dialog button, #ns-filter-dialog button, #quick-reply-dialog button {
            border-radius: 6px !important;
            min-height: 26px !important;
        }

        #logs-dialog input, #blacklist-dialog input, #friends-dialog input, #favorites-dialog input,
        #browse-history-dialog input, #settings-dialog input, #webdav-sync-dialog input,
        #jump-list-dialog input, #ns-nodeimage-safari-dialog input, #favorite-add-dialog input,
        #chicken-leg-stats-dialog input, #hot-topics-dialog input, #vps-calculator-dialog input,
        #notes-dialog input, #ns-filter-dialog input, #quick-reply-dialog input,
        #logs-dialog textarea, #blacklist-dialog textarea, #friends-dialog textarea, #favorites-dialog textarea,
        #browse-history-dialog textarea, #settings-dialog textarea, #webdav-sync-dialog textarea,
        #jump-list-dialog textarea, #ns-nodeimage-safari-dialog textarea, #favorite-add-dialog textarea,
        #notes-dialog textarea, #ns-filter-dialog textarea, #quick-reply-dialog textarea,
        #settings-dialog select, #webdav-sync-dialog select, #jump-list-dialog select {
            border: 1px solid var(--ns-ui-line) !important;
            border-radius: 7px !important;
            background: var(--ns-ui-bg-solid) !important;
            color: var(--ns-ui-text) !important;
            outline: none !important;
        }

        #logs-dialog input:focus, #blacklist-dialog input:focus, #friends-dialog input:focus,
        #favorites-dialog input:focus, #browse-history-dialog input:focus, #settings-dialog input:focus,
        #webdav-sync-dialog input:focus, #jump-list-dialog input:focus, #ns-nodeimage-safari-dialog input:focus,
        #favorite-add-dialog input:focus, #notes-dialog input:focus, #ns-filter-dialog input:focus,
        #quick-reply-dialog input:focus, #notes-dialog textarea:focus, #ns-filter-dialog textarea:focus,
        #quick-reply-dialog textarea:focus {
            border-color: rgba(37, 99, 235, .65) !important;
            box-shadow: 0 0 0 3px rgba(37, 99, 235, .12) !important;
        }

        .ns-filter-token-field {
            width: 100% !important;
            min-height: 36px !important;
            padding: 5px !important;
            border: 1px solid var(--ns-ui-line) !important;
            border-radius: 8px !important;
            background: var(--ns-ui-bg-solid) !important;
            box-sizing: border-box !important;
            cursor: text !important;
            transition: border-color .14s ease, box-shadow .14s ease, background .14s ease !important;
        }

        .ns-filter-token-field:focus-within {
            border-color: rgba(20, 184, 166, .72) !important;
            box-shadow: 0 0 0 3px rgba(20, 184, 166, .14) !important;
            background: #ffffff !important;
        }

        html[data-theme="dark"] .ns-filter-token-field:focus-within,
        html.dark .ns-filter-token-field:focus-within,
        body.dark .ns-filter-token-field:focus-within,
        body.theme-dark .ns-filter-token-field:focus-within,
        html[data-ns-theme="dark"] .ns-filter-token-field:focus-within {
            background: var(--ns-ui-bg-solid) !important;
        }

        .ns-filter-token-list {
            display: flex !important;
            flex-wrap: wrap !important;
            align-items: center !important;
            gap: 7px 6px !important;
            width: 100% !important;
            min-width: 0 !important;
        }

        #ns-filter-dialog .ns-filter-token-input,
        .ns-filter-token-input {
            flex: 1 1 96px !important;
            min-width: 76px !important;
            max-width: 100% !important;
            height: 28px !important;
            min-height: 28px !important;
            padding: 3px 5px !important;
            border: 0 !important;
            box-shadow: none !important;
            background: transparent !important;
            color: var(--ns-ui-text) !important;
            font-size: 12px !important;
            line-height: 1.4 !important;
            outline: none !important;
            box-sizing: border-box !important;
        }

        #ns-filter-dialog .ns-filter-token-input:focus,
        .ns-filter-token-input:focus {
            border: 0 !important;
            box-shadow: none !important;
        }

        .ns-filter-chip {
            position: relative !important;
            display: inline-flex !important;
            align-items: center !important;
            max-width: 100% !important;
            min-height: 28px !important;
            padding: 5px 13px !important;
            border: 1px solid transparent !important;
            border-radius: 8px !important;
            font-size: 13px !important;
            font-weight: 750 !important;
            line-height: 1.2 !important;
            word-break: break-word !important;
            color: var(--ns-chip-fg, #fff) !important;
            background: var(--ns-chip-bg, #22c55e) !important;
            box-shadow: 0 3px 8px rgba(15, 23, 42, .1) !important;
            box-sizing: border-box !important;
        }

        .ns-filter-chip-hide {
            border-color: rgba(255, 255, 255, .18) !important;
        }

        .ns-filter-chip-highlight {
            border-color: rgba(255, 255, 255, .18) !important;
        }

        .ns-filter-chip-allow {
            border-color: rgba(255, 255, 255, .18) !important;
        }

        .ns-filter-chip-text {
            display: inline-block !important;
            max-width: 100% !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            white-space: nowrap !important;
        }

        html[data-theme="dark"] .ns-filter-chip,
        html.dark .ns-filter-chip,
        body.dark .ns-filter-chip,
        body.theme-dark .ns-filter-chip,
        html[data-ns-theme="dark"] .ns-filter-chip {
            color: var(--ns-chip-fg, #fff) !important;
        }

        #ns-filter-dialog .ns-filter-chip-close,
        .ns-filter-chip-close {
            position: absolute !important;
            right: -5px !important;
            top: -6px !important;
            width: 16px !important;
            height: 16px !important;
            min-width: 16px !important;
            min-height: 16px !important;
            padding: 0 !important;
            border: 2px solid var(--ns-ui-bg-solid) !important;
            border-radius: 999px !important;
            background: rgba(15, 23, 42, .78) !important;
            color: #ffffff !important;
            box-shadow: 0 2px 6px rgba(15, 23, 42, .24) !important;
            font-size: 11px !important;
            font-weight: 700 !important;
            line-height: 12px !important;
            text-align: center !important;
            cursor: pointer !important;
        }

        #ns-filter-dialog .ns-filter-chip-close:hover,
        .ns-filter-chip-close:hover {
            background: #0f172a !important;
            color: #ffffff !important;
        }

        #blacklist-dialog table, #friends-dialog table, #favorites-dialog table, #browse-history-dialog table {
            border-collapse: separate !important;
            border-spacing: 0 !important;
            overflow: hidden !important;
        }

        #blacklist-dialog th, #friends-dialog th, #favorites-dialog th, #browse-history-dialog th {
            padding: 8px 6px !important;
            color: var(--ns-ui-muted) !important;
            background: var(--ns-ui-soft) !important;
            border-bottom: 1px solid var(--ns-ui-line) !important;
        }

        #blacklist-dialog td, #friends-dialog td, #favorites-dialog td, #browse-history-dialog td {
            border-bottom: 1px solid var(--ns-ui-line) !important;
        }

        #blacklist-dialog tr:hover, #friends-dialog tr:hover, #favorites-dialog tr:hover, #browse-history-dialog tr:hover {
            background: var(--ns-ui-hover) !important;
        }

        #logs-dialog pre, #chicken-leg-stats-dialog pre, #hot-topics-dialog pre, #vps-calculator-dialog pre {
            background: var(--ns-ui-soft) !important;
            color: var(--ns-ui-text) !important;
            border: 1px solid var(--ns-ui-line) !important;
            border-radius: 8px !important;
        }

        #ns-filter-dialog.ns-filter-dialog {
            background: rgba(248, 255, 253, .98) !important;
            border: 1px solid rgba(20, 184, 166, .2) !important;
            border-radius: 12px !important;
        }

        .ns-filter-dialog-header {
            display: flex !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 10px !important;
            margin-bottom: 12px !important;
        }

        .ns-filter-dialog-header strong {
            color: #0f172a !important;
            font-size: 16px !important;
            line-height: 1.3 !important;
        }

        #ns-filter-dialog .ns-filter-dialog-close {
            width: 28px !important;
            height: 28px !important;
            min-width: 28px !important;
            min-height: 28px !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 8px !important;
            background: #e5e7eb !important;
            color: #111827 !important;
            box-shadow: 2px 2px 0 rgba(17, 24, 39, .35) !important;
            font-size: 20px !important;
            font-weight: 700 !important;
            line-height: 1 !important;
        }

        .ns-filter-field {
            display: block !important;
            margin-bottom: 12px !important;
        }

        .ns-filter-field-label {
            margin-bottom: 6px !important;
            color: #525252 !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            line-height: 1.35 !important;
        }

        #ns-filter-dialog .ns-filter-color-input {
            width: 64px !important;
            height: 34px !important;
            padding: 5px !important;
            border-radius: 8px !important;
            background: #f8fffd !important;
        }

        .ns-filter-check-row {
            display: flex !important;
            align-items: center !important;
            gap: 10px !important;
            margin: 2px 0 12px !important;
            color: #404040 !important;
            font-size: 13px !important;
            font-weight: 700 !important;
        }

        .ns-filter-check-row input {
            width: 16px !important;
            height: 16px !important;
        }

        .ns-filter-actions {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
            gap: 10px !important;
        }

        #ns-filter-dialog .ns-filter-actions button {
            width: 100% !important;
            min-height: 34px !important;
            border-radius: 8px !important;
            font-size: 13px !important;
            font-weight: 750 !important;
        }

        #ns-filter-dialog .ns-filter-save {
            background: #000000 !important;
        }

        @media (max-width: 767px) {
            #nodeseek-plugin-main-container {
                right: 12px !important;
                bottom: calc(14px + env(safe-area-inset-bottom, 0px)) !important;
                max-width: calc(100vw - 24px) !important;
            }

            #nodeseek-plugin-buttons-container {
                width: min(300px, calc(100vw - 60px)) !important;
                max-height: min(62vh, 500px) !important;
                padding: 8px !important;
                gap: 6px !important;
                border-radius: 9px !important;
            }

            #nodeseek-plugin-buttons-container > div {
                display: grid !important;
                grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) !important;
                gap: 6px !important;
            }

            #nodeseek-plugin-buttons-container .blacklist-btn,
            #nodeseek-plugin-buttons-container > button {
                width: 100% !important;
                min-height: 32px !important;
                padding: 6px 8px !important;
                font-size: 12px !important;
                text-align: center !important;
            }

            #nodeseek-plugin-buttons-container > div > button:only-child {
                grid-column: 1 / -1 !important;
            }

            #collapse-btn, #theme-toggle-btn {
                left: -40px !important;
                width: 34px !important;
                height: 34px !important;
                min-width: 34px !important;
                min-height: 34px !important;
                max-width: 34px !important;
                max-height: 34px !important;
                border-radius: 9px !important;
            }

            #nodeseek-plugin-main-container.nodeseek-plugin-main-collapsed {
                right: 0 !important;
                bottom: calc(88px + env(safe-area-inset-bottom, 0px)) !important;
                top: auto !important;
            }

            #nodeseek-plugin-main-container.nodeseek-plugin-main-collapsed #collapse-btn {
                width: 34px !important;
                height: 34px !important;
                min-width: 34px !important;
                min-height: 34px !important;
                max-width: 34px !important;
                max-height: 34px !important;
                border-radius: 10px 0 0 10px !important;
            }

            .ns-filter-token-field {
                min-height: 36px !important;
                padding: 5px !important;
            }

            .ns-filter-token-input {
                flex-basis: 82px !important;
                height: 28px !important;
                min-height: 28px !important;
                font-size: 12px !important;
            }

            .ns-filter-chip {
                max-width: calc(100vw - 66px) !important;
                min-height: 28px !important;
                padding: 5px 13px !important;
                font-size: 13px !important;
            }

            .ns-filter-dialog-header strong {
                font-size: 15px !important;
            }

            .ns-filter-field-label,
            .ns-filter-check-row {
                font-size: 13px !important;
            }

            .ns-filter-actions {
                gap: 10px !important;
            }

            #logs-dialog, #blacklist-dialog, #friends-dialog, #favorites-dialog, #browse-history-dialog,
            #settings-dialog, #webdav-sync-dialog, #jump-list-dialog, #ns-nodeimage-safari-dialog,
            #favorite-add-dialog, #chicken-leg-stats-dialog, #hot-topics-dialog, #vps-calculator-dialog,
            #notes-dialog, #ns-filter-dialog, #quick-reply-dialog {
                left: 10px !important;
                right: 10px !important;
                top: auto !important;
                bottom: calc(10px + env(safe-area-inset-bottom, 0px)) !important;
                width: calc(100vw - 20px) !important;
                max-width: calc(100vw - 20px) !important;
                max-height: min(82vh, 720px) !important;
                padding: 12px !important;
                border-radius: 12px !important;
                overflow-y: auto !important;
                transform: none !important;
            }

            #ns-filter-dialog.ns-filter-dialog {
                padding: 10px !important;
                max-height: min(74vh, 620px) !important;
                border-radius: 10px !important;
            }

            #blacklist-dialog tr, #friends-dialog tr, #favorites-dialog tr, #browse-history-dialog tr {
                background: var(--ns-ui-soft) !important;
                border: 1px solid var(--ns-ui-line) !important;
                border-radius: 10px !important;
                padding: 8px !important;
            }

            #blacklist-dialog td, #friends-dialog td, #favorites-dialog td, #browse-history-dialog td {
                border: 0 !important;
                line-height: 1.45 !important;
            }

            #blacklist-dialog td:last-child button,
            #friends-dialog td:last-child button,
            #favorites-dialog td:last-child button,
            #browse-history-dialog td:last-child button {
                width: 100% !important;
                min-height: 34px !important;
            }
        }`;
        document.head.appendChild(modernStyle);
    }

    injectNsModernUiStyle();
