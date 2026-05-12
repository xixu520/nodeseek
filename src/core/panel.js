    // 显示历史浏览记录弹窗
    function showBrowseHistoryDialog() {
        if (window.NodeSeekHistory && window.NodeSeekHistory.showDialog) {
            return window.NodeSeekHistory.showDialog();
        }
    }

    // 新增：显示跳转名单设置弹窗
    function showJumpListDialog() {
        const existing = document.getElementById('jump-list-dialog');
        if (existing) {
            existing.remove();
            return;
        }

        const mode = getSkipJumpMode();
        const modeText = mode === 'whitelist' ? '白名单' : '全放行';
        const list = getSkipJumpList();

        const dialog = document.createElement('div');
        dialog.id = 'jump-list-dialog';
        dialog.style.position = 'fixed';
        dialog.style.top = '100px';
        dialog.style.left = '50%';
        dialog.style.transform = 'translateX(-50%)';
        dialog.style.zIndex = '10001';
        dialog.style.background = '#fff';
        dialog.style.border = '1px solid #ccc';
        dialog.style.borderRadius = '8px';
        dialog.style.boxShadow = '0 4px 16px rgba(0,0,0,0.2)';
        dialog.style.padding = '20px';
        dialog.style.width = '350px';
        dialog.style.maxHeight = '80vh';
        dialog.style.display = 'flex';
        dialog.style.flexDirection = 'column';
        dialog.style.overflow = 'hidden';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '15px';

        const title = document.createElement('div');
        title.textContent = `屏蔽URL跳转提醒 - ${modeText}设置`;
        title.style.fontWeight = 'bold';
        title.style.fontSize = '16px';

        const closeBtn = document.createElement('span');
        closeBtn.textContent = '×';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '24px';
        closeBtn.onclick = function () { dialog.remove(); };

        header.appendChild(title);
        header.appendChild(closeBtn);
        dialog.appendChild(header);

        const isMobile = (window.NodeSeekFilter && typeof window.NodeSeekFilter.isMobileDevice === 'function')
            ? window.NodeSeekFilter.isMobileDevice()
            : (window.innerWidth <= 767);

        if (isMobile) {
            dialog.style.width = '90%';
            dialog.style.maxWidth = '420px';
            dialog.style.left = '50%';
            dialog.style.top = '50%';
            dialog.style.transform = 'translate(-50%, -50%)';
            dialog.style.padding = '16px';
        }

        const dragHandle = document.createElement('div');
        dragHandle.style.position = 'absolute';
        dragHandle.style.top = '0';
        dragHandle.style.left = '0';
        dragHandle.style.width = '20px';
        dragHandle.style.height = '20px';
        dragHandle.style.cursor = isMobile ? 'default' : 'move';
        dragHandle.style.zIndex = '10002';
        dialog.appendChild(dragHandle);

        if (!isMobile) {
            let isDragging = false;
            let startX = 0;
            let startY = 0;
            let startLeft = 0;
            let startTop = 0;

            const onMouseMove = (e) => {
                if (!isDragging) return;
                const dx = e.clientX - startX;
                const dy = e.clientY - startY;
                const rect = dialog.getBoundingClientRect();
                const maxLeft = Math.max(0, window.innerWidth - rect.width);
                const maxTop = Math.max(0, window.innerHeight - rect.height);
                const nextLeft = Math.min(maxLeft, Math.max(0, startLeft + dx));
                const nextTop = Math.min(maxTop, Math.max(0, startTop + dy));
                dialog.style.left = nextLeft + 'px';
                dialog.style.top = nextTop + 'px';
            };

            const onMouseUp = () => {
                isDragging = false;
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
            };

            dragHandle.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const rect = dialog.getBoundingClientRect();
                dialog.style.transform = '';
                dialog.style.left = rect.left + 'px';
                dialog.style.top = rect.top + 'px';

                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                startLeft = rect.left;
                startTop = rect.top;

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
        }

        const desc = document.createElement('div');
        desc.style.fontSize = '12px';
        desc.style.color = '#666';
        desc.style.marginBottom = '12px';
        desc.textContent = mode === 'whitelist'
            ? '在此名单内的域名将直接跳转（不显示提醒）。'
            : '当前处于“全放行”模式，所有外链都将自动跳转。';
        dialog.appendChild(desc);

        // 输入区域
        const inputRow = document.createElement('div');
        inputRow.style.display = 'flex';
        inputRow.style.gap = '8px';
        inputRow.style.marginBottom = '15px';

        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = '输入域名，如: github.com';
        input.style.flex = '1';
        input.style.padding = '6px 10px';
        input.style.border = '1px solid #ddd';
        input.style.borderRadius = '4px';
        input.style.outline = 'none';

        const addBtn = document.createElement('button');
        addBtn.textContent = '添加';
        addBtn.style.padding = '6px 15px';
        addBtn.style.background = '#1890ff';
        addBtn.style.color = '#fff';
        addBtn.style.border = 'none';
        addBtn.style.borderRadius = '4px';
        addBtn.style.cursor = 'pointer';

        inputRow.appendChild(input);
        inputRow.appendChild(addBtn);
        dialog.appendChild(inputRow);

        // 名单显示区域
        const listContainer = document.createElement('div');
        listContainer.style.overflowY = 'auto';
        listContainer.style.flex = '1';
        listContainer.style.border = '1px solid #eee';
        listContainer.style.borderRadius = '4px';
        listContainer.style.background = '#f9f9f9';
        listContainer.style.padding = '5px';
        listContainer.style.minHeight = '150px';

        function renderList() {
            listContainer.innerHTML = '';
            const currentList = getSkipJumpList();
            if (currentList.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = '暂无记录';
                empty.style.textAlign = 'center';
                empty.style.color = '#999';
                empty.style.marginTop = '60px';
                empty.style.fontSize = '13px';
                listContainer.appendChild(empty);
                return;
            }

            currentList.forEach((domain, index) => {
                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.justifyContent = 'space-between';
                item.style.alignItems = 'center';
                item.style.padding = '6px 10px';
                item.style.borderBottom = '1px solid #eee';
                item.style.fontSize = '13px';

                const name = document.createElement('span');
                name.textContent = domain;
                name.style.wordBreak = 'break-all';

                const delBtn = document.createElement('span');
                delBtn.textContent = '删除';
                delBtn.style.color = '#ff4d4f';
                delBtn.style.cursor = 'pointer';
                delBtn.style.fontSize = '12px';
                delBtn.onclick = function () {
                    const newList = getSkipJumpList();
                    newList.splice(index, 1);
                    setSkipJumpList(newList);
                    renderList();
                    addLog(`从跳转${modeText}中删除域名: ${domain}`);
                    if (getSkipJumpPageEnabled()) {
                        // 立即应用更改：先恢复所有链接，再按更新后的名单重写
                        restoreJumpLinks();
                        rewriteJumpLinks();
                    }
                };

                item.appendChild(name);
                item.appendChild(delBtn);
                listContainer.appendChild(item);
            });
        }

        addBtn.onclick = function () {
            const domain = input.value.trim().toLowerCase();
            if (!domain) return;

            const currentList = getSkipJumpList();
            if (currentList.includes(domain)) {
                alert('该域名已在名单中');
                return;
            }

            currentList.unshift(domain);
            setSkipJumpList(currentList);
            input.value = '';
            renderList();
            addLog(`添加到跳转${modeText}: ${domain}`);
            if (getSkipJumpPageEnabled()) {
                // 立即应用更改：先恢复所有链接，再按更新后的名单重写
                restoreJumpLinks();
                rewriteJumpLinks();
            }
        };

        input.onkeydown = function (e) {
            if (e.key === 'Enter') addBtn.click();
        };

        renderList();
        dialog.appendChild(listContainer);
        document.body.appendChild(dialog);
    }

    // 日志记录功能
    const LOGS_KEY = 'nodeseek_sign_logs';

    // 添加日志
    function addLog(message) {
        const now = new Date();
        const timeStr = now.toLocaleString();
        const logEntry = `[${timeStr}] ${message}`;

        // 获取现有日志
        const logs = getLogs();

        // 添加新日志（限制最多保存100条）
        logs.unshift(logEntry);
        if (logs.length > 100) {
            logs.length = 100;
        }

        // 保存日志
        localStorage.setItem(LOGS_KEY, JSON.stringify(logs));

        // 如果日志对话框已打开，则更新其内容
        updateLogDialogIfOpen(logEntry);
    }

    window.addLog = addLog;

    // 新增：如果日志对话框已打开，立即更新其内容
    function updateLogDialogIfOpen(newLogEntry) {
        const logDialog = document.getElementById('logs-dialog');
        if (logDialog) {
            if (typeof logDialog._nsRenderLogs === 'function') {
                logDialog._nsRenderLogs();
                return;
            }
            const logContent = logDialog.querySelector('pre');
            if (logContent) {
                // 如果当前是空状态占位或空字符串，直接替换为首条日志
                const current = (logContent.textContent || '').trim();
                if (!current || current === '暂无日志记录') {
                    logContent.textContent = newLogEntry;
                } else {
                    // 在顶部添加新日志
                    logContent.textContent = newLogEntry + '\n' + logContent.textContent;
                }
            }
        }
    }

    // 获取日志
    function getLogs() {
        return JSON.parse(localStorage.getItem(LOGS_KEY) || '[]');
    }

    // 清除日志
    function clearLogs() {
        localStorage.removeItem(LOGS_KEY);
    }

    // 显示日志弹窗
    function showLogs() {
        const existingDialog = document.getElementById('logs-dialog');
        if (existingDialog) {
            existingDialog.remove();
            return;
        }

        const dialog = document.createElement('div');
        dialog.id = 'logs-dialog';
        dialog.style.position = 'fixed';
        dialog.style.top = '60px';
        dialog.style.right = '16px';
        dialog.style.zIndex = 10000;
        dialog.style.background = '#fff';
        dialog.style.border = '1px solid #ccc';
        dialog.style.borderRadius = '8px';
        dialog.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)';
        dialog.style.padding = '14px';
        if (window.innerWidth > 767) {
            dialog.style.width = '560px';
        }
        dialog.style.maxHeight = '80vh';
        dialog.style.overflowY = 'auto';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '10px';

        const title = document.createElement('div');
        title.textContent = '操作日志';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '14px';

        const closeBtn = document.createElement('span');
        closeBtn.textContent = '×';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '20px';
        closeBtn.onclick = function () { dialog.remove(); };
        closeBtn.className = 'close-btn';

        header.appendChild(title);
        header.appendChild(closeBtn);
        dialog.appendChild(header);

        const filterBar = document.createElement('div');
        filterBar.style.display = 'grid';
        filterBar.style.gridTemplateColumns = window.innerWidth <= 767 ? '1fr' : '1fr 120px 86px';
        filterBar.style.gap = '8px';
        filterBar.style.marginBottom = '10px';

        const searchInput = document.createElement('input');
        searchInput.placeholder = '搜索日志';
        searchInput.style.padding = '6px 8px';
        searchInput.style.boxSizing = 'border-box';

        const typeSelect = document.createElement('select');
        typeSelect.style.padding = '6px 8px';
        [
            ['all', '全部'],
            ['sync', '同步'],
            ['filter', '过滤'],
            ['reply', '回复'],
            ['friend', '好友'],
            ['blacklist', '黑名单'],
            ['other', '其他']
        ].forEach(item => {
            const option = document.createElement('option');
            option.value = item[0];
            option.textContent = item[1];
            typeSelect.appendChild(option);
        });

        const clearBtn = document.createElement('button');
        clearBtn.textContent = '清空';
        clearBtn.style.padding = '6px 8px';
        clearBtn.style.background = '#f44336';
        clearBtn.style.color = 'white';
        clearBtn.style.border = 'none';
        clearBtn.style.borderRadius = '6px';
        clearBtn.style.cursor = 'pointer';

        filterBar.appendChild(searchInput);
        filterBar.appendChild(typeSelect);
        filterBar.appendChild(clearBtn);
        dialog.appendChild(filterBar);

        const status = document.createElement('div');
        status.style.fontSize = '12px';
        status.style.color = '#666';
        status.style.marginBottom = '8px';
        dialog.appendChild(status);

        const logContent = document.createElement('div');
        logContent.style.display = 'flex';
        logContent.style.flexDirection = 'column';
        logContent.style.gap = '6px';
        logContent.style.maxHeight = '58vh';
        logContent.style.overflowY = 'auto';

        function logType(entry) {
            const text = String(entry || '');
            if (/WebDAV|同步/.test(text)) return 'sync';
            if (/过滤|高亮|屏蔽/.test(text)) return 'filter';
            if (/回复/.test(text)) return 'reply';
            if (/好友/.test(text)) return 'friend';
            if (/黑名单|拉黑/.test(text)) return 'blacklist';
            return 'other';
        }

        function renderLogs() {
            const keyword = searchInput.value.trim().toLowerCase();
            const selected = typeSelect.value;
            const all = getLogs();
            const list = all.filter(item => {
                const type = logType(item);
                const text = String(item || '').toLowerCase();
                return (selected === 'all' || selected === type) && (!keyword || text.includes(keyword));
            });

            status.textContent = '显示 ' + list.length + ' / ' + all.length;
            logContent.innerHTML = '';
            if (!list.length) {
                const empty = document.createElement('div');
                empty.textContent = '暂无匹配日志';
                empty.style.textAlign = 'center';
                empty.style.color = '#888';
                empty.style.padding = '18px 0';
                logContent.appendChild(empty);
                return;
            }
            list.forEach(item => {
                const row = document.createElement('div');
                row.style.padding = '8px 10px';
                row.style.border = '1px solid rgba(15,23,42,.08)';
                row.style.borderRadius = '8px';
                row.style.background = 'rgba(15,23,42,.035)';
                row.style.fontSize = '12px';
                row.style.lineHeight = '1.45';
                row.style.whiteSpace = 'pre-wrap';
                row.textContent = String(item || '').replace(/\\n/g, '\n');
                logContent.appendChild(row);
            });
        }

        searchInput.oninput = renderLogs;
        typeSelect.onchange = renderLogs;
        clearBtn.onclick = function () {
            if (!confirm('确定要清空所有日志吗？')) return;
            clearLogs();
            renderLogs();
        };

        dialog.appendChild(logContent);
        document.body.appendChild(dialog);
        dialog._nsRenderLogs = renderLogs;
        renderLogs();
        makeDraggable(dialog, { width: 50, height: 50 });
    }



    // 删除域名连通性检测功能模块

    // ====== 按钮插入到页面右上角 ======
    function addExportImportButtons() {
        if (document.getElementById('nodeseek-plugin-main-container')) return;

        // 创建主容器
        const mainContainer = document.createElement('div');
        mainContainer.id = 'nodeseek-plugin-main-container';
        mainContainer.className = 'ns-tw';
        mainContainer.style.position = 'fixed';
        mainContainer.style.top = '30px';
        mainContainer.style.right = '4px';
        mainContainer.style.zIndex = 9999;
        mainContainer.style.display = 'flex'; // 使用flex布局
        mainContainer.style.flexDirection = 'row'; // 水平方向
        const expandedPosition = {
            top: mainContainer.style.top,
            right: mainContainer.style.right,
            bottom: mainContainer.style.bottom || ''
        };

        // 创建按钮容器
        const container = document.createElement('div');
        container.id = 'nodeseek-plugin-buttons-container'; // 给容器一个ID，方便需要时获取
        container.className = 'ns-tw ns-tw-panel ns-tw-stack';
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.gap = '10px';
        container.style.background = 'rgba(255, 255, 255, 0.95)';
        container.style.padding = '10px';
        container.style.borderRadius = '5px';
        container.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
        container.style.transition = 'all 0.3s ease'; // 添加过渡效果
        container.style.width = 'auto'; // 确保初始宽度正确

        const collapsedRail = document.createElement('div');
        collapsedRail.id = 'ns-collapsed-action-rail';
        collapsedRail.className = 'ns-collapsed-action-rail';
        collapsedRail.style.display = 'none';

        function createCollapsedActionButton(label, title, handler) {
            const actionBtn = document.createElement('button');
            actionBtn.type = 'button';
            actionBtn.className = 'ns-collapsed-action-btn';
            actionBtn.textContent = label;
            actionBtn.title = title;
            actionBtn.onclick = function (event) {
                event.preventDefault();
                event.stopPropagation();
                handler();
            };
            return actionBtn;
        }

        function isPostDetailPage() {
            const path = window.location.pathname || '';
            return path.includes('/topic/') || path.includes('/article/') || /\/post-\d+/i.test(path);
        }

        function isHomePage() {
            const path = window.location.pathname || '/';
            return path === '/' || path === '/board';
        }

        function renderCollapsedActions() {
            collapsedRail.innerHTML = '';
            if (isPostDetailPage()) {
                let shortcuts = [];
                if (window.NodeSeekQuickReply && typeof window.NodeSeekQuickReply.getSelectedShortcuts === 'function') {
                    shortcuts = window.NodeSeekQuickReply.getSelectedShortcuts();
                }
                shortcuts.slice(0, 8).forEach((item, index) => {
                    const replyBtn = createCollapsedActionButton('回' + (index + 1), item.title || ('快捷回复' + (index + 1)), function () {
                        if (window.NodeSeekQuickReply && typeof window.NodeSeekQuickReply.insertReplyByKey === 'function') {
                            window.NodeSeekQuickReply.insertReplyByKey(item.key);
                        }
                    });
                    replyBtn.classList.add('ns-collapsed-reply-btn');
                    collapsedRail.appendChild(replyBtn);
                });
                const homeBtn = createCollapsedActionButton('首', '回到首页', function () {
                    window.location.href = 'https://www.nodeseek.com/';
                });
                homeBtn.classList.add('ns-collapsed-home-btn');
                collapsedRail.appendChild(homeBtn);
            }
            const reloadBtn = createCollapsedActionButton('刷', '刷新页面', function () {
                window.location.reload();
            });
            reloadBtn.classList.add('ns-collapsed-refresh-btn');
            collapsedRail.appendChild(reloadBtn);
            updateCollapsedHighlightCount();
        }

        window.NodeSeekCollapsedActions = {
            refresh: function () {
                renderCollapsedActions();
                updateCollapsedHighlightCount();
            }
        };

        // 新增：添加折叠按钮
        const collapseBtn = document.createElement('button');
        collapseBtn.id = 'collapse-btn';
        collapseBtn.className = 'collapse-btn';
        collapseBtn.innerHTML = '&lt;'; // 默认显示 <
        collapseBtn.title = '点击折叠/展开';

        const collapsedHighlightBtn = document.createElement('button');
        collapsedHighlightBtn.id = 'ns-collapsed-highlight-count';
        collapsedHighlightBtn.className = 'ns-collapsed-highlight-count';
        collapsedHighlightBtn.type = 'button';
        collapsedHighlightBtn.title = '高亮数目';
        collapsedHighlightBtn.style.display = 'none';
        collapsedHighlightBtn.onclick = function (event) {
            event.preventDefault();
            event.stopPropagation();
            if (window.NodeSeekFilter && typeof window.NodeSeekFilter.toggleHighlighted === 'function') {
                window.NodeSeekFilter.toggleHighlighted();
            } else if (window.NodeSeekFilter && typeof window.NodeSeekFilter.showOnlyHighlighted === 'function') {
                window.NodeSeekFilter.showOnlyHighlighted();
            }
        };

        function updateCollapsedHighlightCount() {
            if (!collapsedHighlightBtn) return;
            const stats = (window.NodeSeekFilter && typeof window.NodeSeekFilter.getStats === 'function')
                ? window.NodeSeekFilter.getStats()
                : { highlighted: 0 };
            const count = stats && Number.isFinite(Number(stats.highlighted)) ? Number(stats.highlighted) : 0;
            const active = stats && stats.mode === 'highlighted';
            collapsedHighlightBtn.innerHTML = '<span>高亮</span><strong>' + count + '</strong>';
            collapsedHighlightBtn.classList.toggle('ns-collapsed-highlight-active', !!active);
            collapsedHighlightBtn.title = active ? '正在只看高亮帖子，点击恢复全部' : '高亮数目：' + count + '，点击只看高亮帖子';
        }
        renderCollapsedActions();

        const themeToggleBtn = document.createElement('button');
        themeToggleBtn.id = 'theme-toggle-btn';
        themeToggleBtn.className = 'collapse-btn theme-toggle-btn';
        const initialThemeMode = getPanelThemeMode();
        themeToggleBtn.textContent = panelThemeModeLabel(initialThemeMode);
        themeToggleBtn.title = panelThemeModeTitle(initialThemeMode);
        themeToggleBtn.onclick = function (e) {
            e.stopPropagation();
            const mode = cyclePanelThemeMode();
            themeToggleBtn.textContent = panelThemeModeLabel(mode);
            themeToggleBtn.title = panelThemeModeTitle(mode);
        };

        // 组装UI - 先添加折叠按钮，再添加内容容器
        mainContainer.appendChild(collapsedRail);
        mainContainer.appendChild(collapseBtn);
        mainContainer.appendChild(collapsedHighlightBtn);
        mainContainer.appendChild(themeToggleBtn);
        mainContainer.appendChild(container);

        function applyCollapsedLayout(collapsed) {
            mainContainer.classList.toggle('nodeseek-plugin-main-collapsed', !!collapsed);
            if (collapsed) {
                mainContainer.style.flexDirection = 'column';
                mainContainer.style.alignItems = 'flex-end';
                collapsedRail.style.display = 'flex';
                renderCollapsedActions();
                collapsedHighlightBtn.style.display = isHomePage() ? 'inline-flex' : 'none';
                updateCollapsedHighlightCount();
                if (window.innerWidth <= 767) {
                    mainContainer.style.top = 'auto';
                    mainContainer.style.right = '0px';
                    mainContainer.style.bottom = 'calc(88px + env(safe-area-inset-bottom, 0px))';
                } else {
                    mainContainer.style.top = '40%';
                    mainContainer.style.right = '0px';
                    mainContainer.style.bottom = '';
                }
            } else {
                mainContainer.style.flexDirection = 'row';
                mainContainer.style.alignItems = '';
                collapsedRail.style.display = 'none';
                collapsedHighlightBtn.style.display = 'none';
                mainContainer.style.top = expandedPosition.top;
                mainContainer.style.right = expandedPosition.right;
                mainContainer.style.bottom = expandedPosition.bottom;
            }
        }

        // 处理折叠状态
        const isCollapsed = getCollapsedState();
        if (isCollapsed) {
            container.classList.add('nodeseek-plugin-container-collapsed');
            collapseBtn.innerHTML = '&gt;'; // 折叠状态显示 >
            themeToggleBtn.style.display = 'none'; // 折叠时隐藏主题按钮
            applyCollapsedLayout(true);
        }

        // 日志按钮
        const logBtn = document.createElement('button');
        logBtn.id = 'sign-log-btn';
        logBtn.className = 'blacklist-btn ns-tw-btn';
        logBtn.textContent = '日志';
        logBtn.style.background = '#795548';
        logBtn.onclick = showLogs;


        if (window.NodeSeekClockIn && window.NodeSeekClockIn.setAddLogFunction) {
            window.NodeSeekClockIn.setAddLogFunction(addLog);
        }
        if (window.NodeSeekRegister && window.NodeSeekRegister.setAddLogFunction) {
            window.NodeSeekRegister.setAddLogFunction(addLog);
        }

        const webdavSyncBtn = document.createElement('button');
        webdavSyncBtn.id = 'webdav-sync-btn';
        webdavSyncBtn.className = 'blacklist-btn ns-tw-btn';
        webdavSyncBtn.textContent = '同步';
        webdavSyncBtn.style.width = '100%';
        webdavSyncBtn.style.background = '#0d9488';
        webdavSyncBtn.onclick = function () {
            syncWithWebdav('manual');
        };

        const webdavContainer = document.createElement('div');
        webdavContainer.className = 'ns-tw-row';
        webdavContainer.style.display = 'flex';
        webdavContainer.style.flexDirection = 'row';
        webdavContainer.style.gap = '10px';
        webdavContainer.style.width = '100%';
        webdavContainer.appendChild(webdavSyncBtn);

        // 新增：查看黑名单按钮
        const viewBtn = document.createElement('button');
        viewBtn.id = 'blacklist-view-btn';
        viewBtn.className = 'blacklist-btn ns-tw-btn';
        viewBtn.textContent = '查看黑名单';
        viewBtn.style.background = '#2ea44f';
        viewBtn.onclick = showBlacklistDialog;

        // 新增：查看好友按钮
        const viewFriendsBtn = document.createElement('button');
        viewFriendsBtn.id = 'friends-view-btn';
        viewFriendsBtn.className = 'blacklist-btn ns-tw-btn';
        viewFriendsBtn.style.background = '#2ea44f';
        viewFriendsBtn.textContent = '查看好友';
        viewFriendsBtn.onclick = showFriendsDialog;
        // 调整按钮宽度使其统一
        const btnWidth = '100px';

        // 移除所有按钮的固定宽度设置，改为 minWidth
        // logBtn.style.width = btnWidth;
        logBtn.style.minWidth = btnWidth;

        // viewBtn.style.width = btnWidth;
        viewBtn.style.minWidth = btnWidth;

        // viewFriendsBtn.style.width = btnWidth;
        viewFriendsBtn.style.minWidth = btnWidth;

        // 新增：关键词过滤按钮
        const filterBtn = document.createElement('button');
        filterBtn.id = 'keyword-filter-btn';
        filterBtn.className = 'blacklist-btn ns-tw-btn';
        filterBtn.style.background = '#4CAF50';
        filterBtn.textContent = '关键词过滤';
        filterBtn.style.width = '100%';
        filterBtn.style.marginTop = '1px';
        filterBtn.onclick = function () {
            if (window.NodeSeekFilter && typeof window.NodeSeekFilter.createFilterUI === 'function') {
                window.NodeSeekFilter.createFilterUI();
            } else {
                alert('关键词过滤功能未加载');
            }
        };

        // 新增：关键词过滤按钮单独一行
        const filterBtnContainer = document.createElement('div');
        filterBtnContainer.className = 'ns-tw-row';
        filterBtnContainer.style.display = 'flex';
        filterBtnContainer.style.flexDirection = 'row';
        filterBtnContainer.style.gap = '10px';
        filterBtnContainer.style.width = '100%';
        filterBtnContainer.appendChild(filterBtn);

        // 新增：设置按钮
        const settingsBtn = document.createElement('button');
        settingsBtn.id = 'settings-btn';
        settingsBtn.className = 'blacklist-btn ns-tw-btn';
        settingsBtn.style.background = '#607D8B'; // 蓝灰色背景
        settingsBtn.textContent = '设置';
        settingsBtn.style.width = '100%';
        settingsBtn.style.marginTop = '1px';
        settingsBtn.onclick = showSettingsDialog;

        // 新增：设置按钮单独一行
        const settingsContainer = document.createElement('div');
        settingsContainer.className = 'ns-tw-row';
        settingsContainer.style.display = 'flex';
        settingsContainer.style.flexDirection = 'row';
        settingsContainer.style.gap = '10px';
        settingsContainer.style.width = '100%';
        settingsContainer.appendChild(settingsBtn);

        // 新增：快捷回复按钮
        const quickReplyBtn = document.createElement('button');
        quickReplyBtn.id = 'quick-reply-btn';
        quickReplyBtn.className = 'blacklist-btn ns-tw-btn';
        quickReplyBtn.style.background = '#9C27B0'; // 紫色背景
        quickReplyBtn.textContent = '快捷回复';
        quickReplyBtn.style.width = '100%';
        quickReplyBtn.style.marginTop = '1px';
        quickReplyBtn.onclick = function () {
            if (window.NodeSeekQuickReply && typeof window.NodeSeekQuickReply.showQuickReplyDialog === 'function') {
                window.NodeSeekQuickReply.showQuickReplyDialog();
            } else {
                alert('快捷回复功能未加载');
            }
        };

        // 新增：快捷回复按钮单独一行
        const quickReplyContainer = document.createElement('div');
        quickReplyContainer.className = 'ns-tw-row';
        quickReplyContainer.style.display = 'flex';
        quickReplyContainer.style.flexDirection = 'row';
        quickReplyContainer.style.gap = '10px';
        quickReplyContainer.style.width = '100%';
        quickReplyContainer.appendChild(quickReplyBtn);

        // 新增：NS 图床（NodeImage API，window.NodeSeekNodeImage）
        const nodeImageBtn = document.createElement('button');
        nodeImageBtn.id = 'ns-nodeimage-btn';
        nodeImageBtn.className = 'blacklist-btn ns-tw-btn';
        nodeImageBtn.style.background = '#0d9488';
        nodeImageBtn.textContent = 'NS图床';
        nodeImageBtn.style.width = '100%';
        nodeImageBtn.style.marginTop = '1px';
        nodeImageBtn.onclick = function () {
            openNodeImagePanel();
        };
        const nodeImageBtnContainer = document.createElement('div');
        nodeImageBtnContainer.className = 'ns-tw-row';
        nodeImageBtnContainer.style.display = 'flex';
        nodeImageBtnContainer.style.flexDirection = 'row';
        nodeImageBtnContainer.style.gap = '10px';
        nodeImageBtnContainer.style.width = '100%';
        nodeImageBtnContainer.appendChild(nodeImageBtn);

        // 新增：高亮统计显示区域
        const statsContainer = document.createElement('div');
        statsContainer.id = 'ns-highlight-stats-container';
        statsContainer.style.width = '100%';
        statsContainer.style.marginTop = '5px';
        statsContainer.style.backgroundColor = '#fff';
        statsContainer.style.borderRadius = '4px';
        statsContainer.style.border = '1px solid #eee';
        statsContainer.style.padding = '4px';
        statsContainer.style.boxSizing = 'border-box';

        // 初始提示（如果 filter.js 还没准备好）
        statsContainer.innerHTML = '<div style="text-align:center;padding:5px;font-size:12px;color:#999;">无高亮记录</div>';


        // 折叠按钮点击事件
        collapseBtn.onclick = function () {
            const isCurrentlyCollapsed = container.classList.contains('nodeseek-plugin-container-collapsed');

            if (isCurrentlyCollapsed) {
                // 展开
                container.classList.remove('nodeseek-plugin-container-collapsed');
                collapseBtn.innerHTML = '&lt;';
                themeToggleBtn.style.display = 'flex'; // 展开时显示主题按钮
                applyCollapsedLayout(false);
                setCollapsedState(false);
            } else {
                // 折叠
                container.classList.add('nodeseek-plugin-container-collapsed');
                collapseBtn.innerHTML = '&gt;';
                themeToggleBtn.style.display = 'none'; // 折叠时隐藏主题按钮
                applyCollapsedLayout(true);
                setCollapsedState(true);
            }
        };

        // 按照指定顺序添加按钮
        container.appendChild(settingsContainer); // 设置按钮行
        container.appendChild(webdavContainer); // WebDAV同步
        container.appendChild(logBtn);        // 日志
        container.appendChild(viewBtn);       // 查看黑名单
        container.appendChild(viewFriendsBtn); // 查看好友
        container.appendChild(filterBtnContainer); // 关键词过滤按钮行
        container.appendChild(quickReplyContainer); // 快捷回复按钮行
        container.appendChild(nodeImageBtnContainer); // NS 图床
        container.appendChild(statsContainer); // 高亮统计显示区域

        // 尝试立即渲染（如果统计数据已就绪）
        if (window.NodeSeekFilter && typeof window.NodeSeekFilter.renderHighlightStatsToContainer === 'function') {
            window.NodeSeekFilter.renderHighlightStatsToContainer();
        }


        document.body.appendChild(mainContainer);
    }
