    // 防止重复记录的变量
    let lastRecordedUrl = '';
    let lastRecordedTime = 0;

    // 自动记录浏览历史
    function recordBrowseHistory() {
        // 防止短时间内重复记录同一页面
        const currentUrl = window.location.href;
        const currentTime = Date.now();

        // 标准化URL进行比较
        const normalizeUrl = (urlStr) => {
            try {
                const urlObj = new URL(urlStr);
                let pathname = urlObj.pathname;

                // 处理NodeSeek帖子分页格式：/post-数字-页码 -> /post-数字-1
                const postMatch = pathname.match(/^\/post-(\d+)-\d+$/);
                if (postMatch) {
                    pathname = `/post-${postMatch[1]}-1`; // 统一为第一页
                }

                return urlObj.origin + pathname + urlObj.search;
            } catch (e) {
                // 如果URL解析失败，简单处理
                let cleanUrl = urlStr.split('#')[0];
                // 处理帖子分页格式
                const postMatch = cleanUrl.match(/\/post-(\d+)-\d+/);
                if (postMatch) {
                    cleanUrl = cleanUrl.replace(/\/post-(\d+)-\d+/, `/post-${postMatch[1]}-1`);
                }
                return cleanUrl;
            }
        };

        const normalizedCurrentUrl = normalizeUrl(currentUrl);
        const normalizedLastUrl = normalizeUrl(lastRecordedUrl);

        if (normalizedLastUrl === normalizedCurrentUrl && (currentTime - lastRecordedTime) < 5000) {
            return; // 5秒内不重复记录同一页面
        }

        // 只记录帖子和文章页面
        if (window.location.pathname.includes('/topic/') ||
            window.location.pathname.includes('/article/') ||
            window.location.pathname.includes('/space/') ||
            window.location.pathname.match(/\/post-\d+/)) { // 添加对 /post-数字 格式的支持

            // 获取页面标题，去除网站名称后缀
            let title = document.title.replace(' - NodeSeek', '').trim();

            // 如果标题为空，尝试从其他元素获取
            if (!title || title === 'NodeSeek') {
                const titleElement = document.querySelector('.topic-title, .article-title, h1, .thread-title, .post-title, .content-title');
                if (titleElement) {
                    title = titleElement.textContent.trim();
                }
            }

            // 特别处理post-数字格式的页面，尝试从页面中找到帖子标题
            if ((!title || title === 'NodeSeek') && window.location.pathname.match(/\/post-\d+/)) {
                // 尝试多种可能的标题选择器
                const titleSelectors = [
                    'h1', 'h2', 'h3',
                    '.subject', '.title', '.topic-title', '.thread-title',
                    '[class*="title"]', '[class*="subject"]',
                    '.nsk-content-title'
                ];

                for (const selector of titleSelectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim() &&
                        element.textContent.trim().length > 3 &&
                        !element.textContent.includes('NodeSeek')) {
                        title = element.textContent.trim();
                        break;
                    }
                }
            }

            // 如果仍然没有标题，使用URL路径作为标题
            if (!title || title === 'NodeSeek') {
                title = window.location.pathname.split('/')[1] + ' - ' + window.location.pathname.split('/')[2];
            }

            // 记录浏览历史
            const url = window.location.href;
            addToBrowseHistory(title, url);

            // 更新防重复记录变量
            lastRecordedUrl = url;
            lastRecordedTime = Date.now();

            // 不再在控制台输出浏览记录
        }
    }

    // 多次尝试记录浏览历史，以适应不同的页面加载情况
    setTimeout(recordBrowseHistory, 500);  // 第一次尝试
    setTimeout(recordBrowseHistory, 1500); // 第二次尝试
    setTimeout(recordBrowseHistory, 3000); // 第三次尝试，确保页面完全加载

    // 监听页面完全加载事件
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', recordBrowseHistory);
    }

    // 监听窗口加载完成事件
    window.addEventListener('load', recordBrowseHistory);

    function runNsWhenIdle(fn, timeout) {
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(fn, { timeout: timeout || 1200 });
            return;
        }
        setTimeout(fn, 0);
    }

    // 首次加载
    ensureNsModules();
    addExportImportButtons();
    nsRequestAnimationFrame(function () {
        if (typeof scheduleUpdateAll === 'function') scheduleUpdateAll(0);
        else updateAll();
    });

    // 清理重复的浏览历史记录
    setTimeout(() => {
        const cleaned = cleanupDuplicateHistory();
        if (cleaned) {
            addLog('已自动清理重复的浏览历史记录');
        }
    }, 2500);

    // 新增：初始化关键词过滤 observer
    runNsWhenIdle(function () {
        if (window.NodeSeekFilter && typeof window.NodeSeekFilter.initFilterObserver === 'function') {
            window.NodeSeekFilter.initFilterObserver();
        }
    }, 2000);

    // 新增：实时更新黑名单弹窗中的内容
    function updateBlacklistDialogWithNewUser(username, remark, userLinkElement, buttonElement) {
        const blacklistDialog = document.getElementById('blacklist-dialog');
        if (!blacklistDialog) return;

        // 移除可能存在的空提示
        const emptyDiv = blacklistDialog.querySelector('div:last-child');
        if (emptyDiv && emptyDiv.textContent === '暂无黑名单用户') {
            emptyDiv.remove();
        }

        // 获取最新的黑名单信息
        const list = getBlacklist();
        const info = list[username];
        if (!info) return;

        // 查找或创建表格
        let table = blacklistDialog.querySelector('table');
        if (!table) {
            // 如果没有表格，创建一个
            table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            table.style.verticalAlign = 'bottom';
            table.innerHTML = '<thead><tr><th style="text-align:left;font-size:13px;vertical-align:bottom;">用户名</th><th style="text-align:left;font-size:13px;padding-left:5px;min-width:135px;vertical-align:bottom;">备注</th><th style="text-align:left;font-size:13px;padding-left:0;position:relative;left:-2px;vertical-align:bottom;">拉黑时间</th><th style="text-align:left;font-size:13px;padding-left:5px;vertical-align:bottom;">页面</th><th style="vertical-align:bottom;"></th></tr></thead>';

            const tbody = document.createElement('tbody');
            table.appendChild(tbody);
            blacklistDialog.appendChild(table);
        }

        const tbody = table.querySelector('tbody');
        if (!tbody) return;

        // 创建新行
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #eee';
        tr.style.opacity = '0'; // 初始透明
        tr.style.transition = 'opacity 0.3s ease-in';

        // 用户名列
        const tdUser = document.createElement('td');
        tdUser.style.verticalAlign = 'bottom';

        const nameLink = document.createElement('a');
        nameLink.textContent = username;
        nameLink.style.color = '#d00';
        nameLink.style.fontWeight = 'bold';
        nameLink.style.fontSize = '13px';
        nameLink.style.whiteSpace = 'nowrap';
        nameLink.title = '点击访问主页';
        nameLink.target = '_blank';

        // 设置用户主页链接
        if (info.userId) {
            nameLink.href = 'https://www.nodeseek.com/space/' + info.userId + '#/general';
        } else if (info.url) {
            let targetUrl = info.url;
            if (info.postId && !targetUrl.includes('#post-') && !targetUrl.includes('#' + info.postId.replace('post-', ''))) {
                targetUrl = targetUrl.split('#')[0];
                targetUrl += '#' + info.postId.replace('post-', '');
            }
            nameLink.href = targetUrl;
        }

        tdUser.appendChild(nameLink);
        tr.appendChild(tdUser);

        // 备注列
        const tdRemark = document.createElement('td');
        const isMobile = window.innerWidth <= 767;

        if (!isMobile) {
            tdRemark.textContent = info.remark || '　';
            tdRemark.style.fontSize = '12px';
            tdRemark.style.minWidth = '135px';
            tdRemark.style.maxWidth = '135px';
            tdRemark.style.overflow = 'hidden';
            tdRemark.style.textOverflow = 'ellipsis';
            tdRemark.style.whiteSpace = 'nowrap';
            tdRemark.style.display = 'inline-block';
            tdRemark.style.verticalAlign = 'bottom';
            tdRemark.style.paddingTop = '2px';
        } else {
            tdRemark.textContent = info.remark || '　';
            tdRemark.style.verticalAlign = 'bottom';
        }

        tdRemark.style.textAlign = 'left';
        tdRemark.style.cssText += 'text-align:left !important;';
        tdRemark.style.cursor = 'pointer';
        tdRemark.style.paddingLeft = '5px';
        tdRemark.title = info.remark ? info.remark : '点击编辑备注';

        // 添加备注编辑功能（复用现有逻辑）
        tdRemark.onclick = function (e) {
            e.stopPropagation();
            e.preventDefault();

            if (document.getElementById('blacklist-edit-overlay')) return;

            const currentText = (info.remark || '');
            const cellRect = tdRemark.getBoundingClientRect();

            // 创建编辑器（复用blacklist.js中的逻辑）
            const overlay = document.createElement('div');
            overlay.id = 'blacklist-edit-overlay';
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'transparent';
            overlay.style.zIndex = '10001';

            const editor = document.createElement('div');
            editor.style.position = 'fixed';
            editor.style.top = cellRect.top + 'px';
            editor.style.left = cellRect.left + 'px';
            editor.style.width = cellRect.width + 'px';
            editor.style.height = cellRect.height + 'px';
            editor.style.zIndex = '10002';
            editor.style.backgroundColor = '#fff';
            editor.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
            editor.style.padding = '0';
            editor.style.boxSizing = 'border-box';
            editor.style.borderRadius = '3px';

            const input = document.createElement('input');
            input.type = 'text';
            input.value = currentText;
            input.style.width = '100%';
            input.style.height = '100%';
            input.style.border = '1px solid #d00';
            input.style.borderRadius = '3px';
            input.style.padding = '0 5px';
            input.style.boxSizing = 'border-box';
            input.style.fontSize = '12px';
            input.style.outline = 'none';

            editor.appendChild(input);
            overlay.appendChild(editor);
            document.body.appendChild(overlay);

            input.focus();
            const textLength = input.value.length;
            input.setSelectionRange(textLength, textLength);

            const closeEditor = function (save) {
                const newText = save ? input.value : currentText;
                document.body.removeChild(overlay);

                if (save && newText !== currentText) {
                    tdRemark.textContent = newText || '　';
                    tdRemark.title = newText || '点击编辑备注';

                    // 调用blacklist.js中的更新函数
                    if (window.NodeSeekBlacklistViewer && window.NodeSeekBlacklistViewer.updateBlacklistRemark) {
                        window.NodeSeekBlacklistViewer.updateBlacklistRemark(username, newText);
                    }

                    info.remark = newText;
                }
            };

            overlay.addEventListener('mousedown', function (e) {
                if (e.target === overlay) {
                    closeEditor(true);
                }
            });

            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    closeEditor(true);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    closeEditor(false);
                }
            });
        };

        tr.appendChild(tdRemark);

        // 拉黑时间列
        const tdTime = document.createElement('td');
        tdTime.style.verticalAlign = 'bottom';
        if (info.timestamp) {
            const date = new Date(info.timestamp);
            tdTime.textContent = date.getFullYear() + '-' +
                String(date.getMonth() + 1).padStart(2, '0') + '-' +
                String(date.getDate()).padStart(2, '0') + ' ' +
                String(date.getHours()).padStart(2, '0') + ':' +
                String(date.getMinutes()).padStart(2, '0') + ':' +
                String(date.getSeconds()).padStart(2, '0');
        } else {
            tdTime.textContent = '';
        }
        tdTime.style.fontSize = '11px';
        tdTime.style.whiteSpace = 'nowrap';
        tdTime.style.textAlign = 'left';
        tdTime.style.paddingLeft = '0';
        tdTime.style.position = 'relative';
        tdTime.style.left = '-2px';
        tr.appendChild(tdTime);

        // 拉黑页面列
        const tdUrl = document.createElement('td');
        tdUrl.style.verticalAlign = 'bottom';
        tdUrl.style.paddingLeft = '5px';
        if (info.url) {
            const a = document.createElement('a');
            let targetUrl = info.url;

            if (info.postId && !targetUrl.includes('#post-') && !targetUrl.includes('#' + info.postId.replace('post-', ''))) {
                targetUrl = targetUrl.split('#')[0];
                targetUrl += '#' + info.postId.replace('post-', '');
            }

            a.href = targetUrl;
            a.textContent = info.postId ? `楼层#${info.postId.replace('post-', '')}` : '页面';
            a.target = '_blank';
            a.style.fontSize = '11px';
            a.style.color = '#06c';
            tdUrl.appendChild(a);
        }
        tr.appendChild(tdUrl);

        // 操作列
        const tdOp = document.createElement('td');
        tdOp.style.verticalAlign = 'bottom';
        tdOp.style.paddingLeft = '3px';
        const removeBtn = document.createElement('button');
        removeBtn.textContent = '移除';
        removeBtn.className = 'blacklist-btn red';
        removeBtn.style.fontSize = '11px';
        removeBtn.onclick = function () {
            if (confirm('确定要移除该用户？')) {
                removeFromBlacklist(username);

                tr.style.opacity = '0.5';
                tr.style.transition = 'opacity 0.2s';

                setTimeout(function () {
                    tr.remove();

                    if (tbody && tbody.children.length === 0) {
                        const empty = document.createElement('div');
                        empty.textContent = '暂无黑名单用户';
                        empty.style.textAlign = 'center';
                        empty.style.color = '#888';
                        empty.style.margin = '18px 0 8px 0';
                        table.after(empty);
                    }

                    // 更新页面上的用户显示
                    document.querySelectorAll('a.author-name').forEach(function (link) {
                        if (link.textContent.trim() === username) {
                            link.classList.remove('blacklisted-user');
                            const oldRemark = link.parentNode.querySelector('.blacklist-remark');
                            if (oldRemark) oldRemark.remove();
                            const oldUrl = link.parentNode.querySelector('.blacklist-url');
                            if (oldUrl) oldUrl.remove();
                            const metaInfo = link.closest('.nsk-content-meta-info');
                            if (metaInfo) {
                                const oldTime = metaInfo.querySelector('.blacklist-time');
                                if (oldTime) oldTime.remove();
                            }
                        }
                    });
                }, 200);
            }
        };
        tdOp.appendChild(removeBtn);
        tr.appendChild(tdOp);

        // 将新行添加到表格顶部（最新的在最前面）
        if (tbody.firstChild) {
            tbody.insertBefore(tr, tbody.firstChild);
        } else {
            tbody.appendChild(tr);
        }

        // 添加淡入动画效果
        setTimeout(function () {
            tr.style.opacity = '1';
        }, 50);
    }

    const SCRIPT_AUTO_UPDATE_ENABLED_KEY = 'nodeseek_script_auto_update_enabled';
    const SCRIPT_AUTO_UPDATE_NEXT_AT_KEY = 'nodeseek_script_auto_update_next_at';
    const SCRIPT_AUTO_UPDATE_LAST_PROMPT_KEY = 'nodeseek_script_auto_update_last_prompt';
    const SCRIPT_UPDATE_DEFAULT_URL = 'https://cdn.jsdelivr.net/gh/xixu520/nodeseek@main/Ns.user.js';

    function isScriptAutoUpdateEnabled() {
        return nsLocalStorage.getItem(SCRIPT_AUTO_UPDATE_ENABLED_KEY) !== 'false';
    }

    function setScriptAutoUpdateEnabled(enabled) {
        nsLocalStorage.setItem(SCRIPT_AUTO_UPDATE_ENABLED_KEY, enabled ? 'true' : 'false');
        if (enabled) scheduleAutoScriptUpdateCheck(true);
    }

    function getScriptMetaForUpdate() {
        const script = (typeof GM_info !== 'undefined' && GM_info.script) ? GM_info.script : {};
        return {
            name: script.name || 'NodeseekLite',
            version: script.version || '',
            updateURL: script.updateURL || '',
            downloadURL: script.downloadURL || ''
        };
    }

    function parseScriptVersion(text) {
        const match = String(text || '').match(/\/\/\s*@version\s+([^\s]+)/);
        return match ? match[1].trim() : '';
    }

    function parseScriptMetaField(text, field) {
        const pattern = new RegExp('^\\s*//\\s*@' + field + '\\s+(.+)$', 'm');
        const match = String(text || '').match(pattern);
        return match ? match[1].trim() : '';
    }

    function compareScriptVersions(a, b) {
        const left = String(a || '').split(/[^\dA-Za-z]+/).filter(Boolean);
        const right = String(b || '').split(/[^\dA-Za-z]+/).filter(Boolean);
        const len = Math.max(left.length, right.length);
        for (let i = 0; i < len; i++) {
            const x = left[i] || '0';
            const y = right[i] || '0';
            const xn = /^\d+$/.test(x) ? parseInt(x, 10) : null;
            const yn = /^\d+$/.test(y) ? parseInt(y, 10) : null;
            if (xn !== null && yn !== null) {
                if (xn !== yn) return xn > yn ? 1 : -1;
            } else if (x !== y) {
                return x > y ? 1 : -1;
            }
        }
        return 0;
    }

    function normalizeScriptInstallUrl(value) {
        const source = String(value || '').trim();
        if (!source) return SCRIPT_UPDATE_DEFAULT_URL;
        const clean = source.replace(/[?#].*$/, '');
        const rawMatch = clean.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/i);
        if (rawMatch) {
            const path = rawMatch[4].replace(/\/Ns\.js$/i, '/Ns.user.js');
            return 'https://cdn.jsdelivr.net/gh/' + rawMatch[1] + '/' + rawMatch[2] + '@' + rawMatch[3] + '/' + path;
        }
        const githubRawMatch = clean.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/raw\/(?:refs\/heads\/)?([^/]+)\/(.+)$/i);
        if (githubRawMatch) {
            const path = githubRawMatch[4].replace(/\/Ns\.js$/i, '/Ns.user.js');
            return 'https://cdn.jsdelivr.net/gh/' + githubRawMatch[1] + '/' + githubRawMatch[2] + '@' + githubRawMatch[3] + '/' + path;
        }
        return clean.replace(/\/Ns\.js$/i, '/Ns.user.js');
    }

    function getPreferredScriptUpdateUrl(meta) {
        return normalizeScriptInstallUrl(meta.updateURL || meta.downloadURL || SCRIPT_UPDATE_DEFAULT_URL);
    }

    function openScriptInstallPage(url) {
        const installText = String(normalizeScriptInstallUrl(url) || SCRIPT_UPDATE_DEFAULT_URL);
        try {
            const link = document.createElement('a');
            link.href = installText;
            link.target = '_self';
            link.rel = 'noopener noreferrer';
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(function () { link.remove(); }, 1000);
            return true;
        } catch (e) { }
        try {
            if (typeof GM_openInTab === 'function') {
                GM_openInTab(installText, { active: true, insert: true, setParent: true });
                return true;
            }
        } catch (e) { }
        try {
            const tab = window.open(installText, '_blank', 'noopener,noreferrer');
            if (tab) return true;
        } catch (e2) { }
        try {
            window.location.href = installText;
            return true;
        } catch (e3) {
            return false;
        }
    }

    function scheduleScriptUpdateRestart(statusEl) {
        try {
            sessionStorage.setItem('nodeseek_pending_script_update_restart', '1');
        } catch (e) { }
        setTimeout(function () {
            if (statusEl) statusEl.textContent = '正在刷新页面以重启脚本...';
            location.reload();
        }, 8000);
    }

    function nextAutoUpdateDelay() {
        return 12 * 60 * 60 * 1000 + Math.floor(Math.random() * 24 * 60 * 60 * 1000);
    }

    async function checkScriptUpdateCore(options) {
        const opts = options || {};
        const statusEl = opts.statusEl || null;
        const silent = !!opts.silent;
        const meta = getScriptMetaForUpdate();
        const url = getPreferredScriptUpdateUrl(meta);
        if (statusEl) statusEl.textContent = '正在检查更新...';
        try {
            const response = await gmRequestText('GET', url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now());
            if (response.status < 200 || response.status >= 300) throw new Error('状态码 ' + response.status);
            const latestVersion = parseScriptVersion(response.responseText);
            if (!latestVersion) throw new Error('远端脚本没有 @version');
            const currentVersion = meta.version || '';
            if (compareScriptVersions(latestVersion, currentVersion) <= 0) {
                if (statusEl) statusEl.textContent = '已是最新版本：' + currentVersion;
                if (!silent) alert('当前已是最新版本：' + currentVersion);
                return false;
            }

            if (silent) {
                const lastPrompt = JSON.parse(nsLocalStorage.getItem(SCRIPT_AUTO_UPDATE_LAST_PROMPT_KEY) || 'null');
                if (lastPrompt && lastPrompt.version === latestVersion && Date.now() - Number(lastPrompt.time || 0) < 6 * 60 * 60 * 1000) {
                    return true;
                }
                nsLocalStorage.setItem(SCRIPT_AUTO_UPDATE_LAST_PROMPT_KEY, JSON.stringify({ version: latestVersion, time: Date.now() }));
            }

            if (statusEl) statusEl.textContent = '发现新版本：' + latestVersion;
            const latestName = parseScriptMetaField(response.responseText, 'name') || meta.name || 'NodeseekLite';
            const latestDesc = parseScriptMetaField(response.responseText, 'description') || '';
            const downloadUrl = normalizeScriptInstallUrl(parseScriptMetaField(response.responseText, 'downloadURL') || url);
            const message = [
                '发现脚本新版本，是否立即更新？',
                '',
                '脚本：' + latestName,
                '当前版本：' + (currentVersion || '未知'),
                '最新版本：' + latestVersion,
                latestDesc ? '说明：' + latestDesc : '',
                '',
                '点击确定后会打开脚本更新页面。'
            ].filter(Boolean).join('\n');
            if (confirm(message)) {
                if (statusEl) statusEl.textContent = '正在打开更新页面...';
                if (openScriptInstallPage(downloadUrl)) {
                    scheduleScriptUpdateRestart(statusEl);
                } else {
                    throw new Error('无法打开更新页面');
                }
            }
            return true;
        } catch (error) {
            if (statusEl) statusEl.textContent = '检查失败：' + error.message;
            if (!silent) alert('检查更新失败：' + error.message);
            return false;
        }
    }

    function scheduleAutoScriptUpdateCheck(forceSoon) {
        if (!isScriptAutoUpdateEnabled()) return;
        let nextAt = parseInt(nsLocalStorage.getItem(SCRIPT_AUTO_UPDATE_NEXT_AT_KEY) || '0', 10) || 0;
        const now = Date.now();
        if (forceSoon || !nextAt) {
            nextAt = now + 45 * 1000 + Math.floor(Math.random() * 150 * 1000);
            nsLocalStorage.setItem(SCRIPT_AUTO_UPDATE_NEXT_AT_KEY, String(nextAt));
        }
        const delay = Math.max(30 * 1000, Math.min(nextAt - now, 4 * 60 * 60 * 1000));
        setTimeout(async function () {
            if (!isScriptAutoUpdateEnabled()) return;
            const latestNext = parseInt(nsLocalStorage.getItem(SCRIPT_AUTO_UPDATE_NEXT_AT_KEY) || '0', 10) || 0;
            if (Date.now() < latestNext - 1000) {
                scheduleAutoScriptUpdateCheck(false);
                return;
            }
            nsLocalStorage.setItem(SCRIPT_AUTO_UPDATE_NEXT_AT_KEY, String(Date.now() + nextAutoUpdateDelay()));
            await checkScriptUpdateCore({ silent: true });
            scheduleAutoScriptUpdateCheck(false);
        }, delay);
    }

    scheduleAutoScriptUpdateCheck(false);

    // 新增：显示设置弹窗
    function showSettingsDialog() {
        // 打开弹窗时先更新一次标题状态，确保样式类已添加且内联样式已清除，以便颜色预览生效
        if (getViewedHistoryEnabled()) {
            setTimeout(() => markViewedTitles(true), 0);
        }

        const existingDialog = document.getElementById('settings-dialog');
        if (existingDialog) {
            existingDialog.remove();
            return;
        }

        const dialog = document.createElement('div');
        dialog.id = 'settings-dialog';
        dialog.style.position = 'fixed';
        dialog.style.top = '60px';
        dialog.style.right = '16px';
        dialog.style.zIndex = '10000';
        dialog.style.background = '#fff';
        dialog.style.border = '1px solid #ccc';
        dialog.style.borderRadius = '8px';
        dialog.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)';
        dialog.style.padding = '18px 20px';
        dialog.style.width = '300px';

        // 移动端适配
        const isMobile = (window.NodeSeekFilter && typeof window.NodeSeekFilter.isMobileDevice === 'function')
            ? window.NodeSeekFilter.isMobileDevice()
            : (window.innerWidth <= 767);
        if (isMobile) {
            dialog.style.width = '90%';
            dialog.style.left = '50%';
            dialog.style.top = '50%';
            dialog.style.transform = 'translate(-50%, -50%)';
            dialog.style.right = 'auto';
        }

        // 标题栏
        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.marginBottom = '15px';
        header.style.borderBottom = '1px solid #eee';
        header.style.paddingBottom = '8px';
        // if (!isMobile) {
        //    header.style.cursor = 'move'; // PC端显示拖动光标
        // }

        const title = document.createElement('div');
        title.textContent = 'NodeseekLite 设置';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '16px';
        title.style.color = '#333';
        // 阻止标题文字被选中，避免拖动时体验不佳
        title.style.userSelect = 'none';

        const closeBtn = document.createElement('span');
        closeBtn.textContent = '×';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '24px';
        closeBtn.style.lineHeight = '20px';
        closeBtn.style.color = '#999';
        closeBtn.onclick = function () { dialog.remove(); };

        header.appendChild(title);
        header.appendChild(closeBtn);
        dialog.appendChild(header);

        // 新增：左上角20px拖动区域
        const dragHandle = document.createElement('div');
        dragHandle.style.position = 'absolute';
        dragHandle.style.top = '0';
        dragHandle.style.left = '0';
        dragHandle.style.width = '20px';
        dragHandle.style.height = '20px';
        dragHandle.style.cursor = 'move';
        dragHandle.style.zIndex = '10001'; // 确保在最上层
        dragHandle.title = '按住拖动';
        // 可选：添加一点微弱的背景色或边框提示，或者完全透明
        // dragHandle.style.background = 'rgba(0,0,0,0.05)';
        dialog.appendChild(dragHandle);

        // 拖动逻辑实现
        if (!isMobile) {
            let isDragging = false;
            let startX, startY, initialLeft, initialTop;

            dragHandle.onmousedown = function (e) {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;

                const rect = dialog.getBoundingClientRect();
                initialLeft = rect.left;
                initialTop = rect.top;

                // 防止选中文本
                e.preventDefault();

                document.onmousemove = function (e) {
                    if (isDragging) {
                        const dx = e.clientX - startX;
                        const dy = e.clientY - startY;

                        // 移除 right 定位，改为 left/top 定位以支持拖动
                        dialog.style.right = 'auto';
                        dialog.style.left = (initialLeft + dx) + 'px';
                        dialog.style.top = (initialTop + dy) + 'px';
                    }
                };

                document.onmouseup = function () {
                    isDragging = false;
                    document.onmousemove = null;
                    document.onmouseup = null;
                };
            };
        }

        // 设置项容器
        const content = document.createElement('div');
        content.style.display = 'flex';
        content.style.flexDirection = 'column';
        content.style.gap = '15px';

        const DEFAULT_USERSCRIPT_URL = SCRIPT_UPDATE_DEFAULT_URL;

        function getScriptMeta() {
            const script = (typeof GM_info !== 'undefined' && GM_info.script) ? GM_info.script : {};
            return {
                name: script.name || 'NodeseekLite',
                version: script.version || '',
                updateURL: script.updateURL || '',
                downloadURL: script.downloadURL || ''
            };
        }

        function parseVersionFromScript(text) {
            const match = String(text || '').match(/\/\/\s*@version\s+([^\s]+)/);
            return match ? match[1].trim() : '';
        }

        function parseMetaFieldFromScript(text, field) {
            const pattern = new RegExp('^\\\\s*//\\\\s*@' + field + '\\\\s+(.+)$', 'm');
            const match = String(text || '').match(pattern);
            return match ? match[1].trim() : '';
        }

        function compareVersionText(a, b) {
            const left = String(a || '').split(/[^\dA-Za-z]+/).filter(Boolean);
            const right = String(b || '').split(/[^\dA-Za-z]+/).filter(Boolean);
            const len = Math.max(left.length, right.length);
            for (let i = 0; i < len; i++) {
                const x = left[i] || '0';
                const y = right[i] || '0';
                const xn = /^\d+$/.test(x) ? parseInt(x, 10) : null;
                const yn = /^\d+$/.test(y) ? parseInt(y, 10) : null;
                if (xn !== null && yn !== null) {
                    if (xn !== yn) return xn > yn ? 1 : -1;
                } else if (x !== y) {
                    return x > y ? 1 : -1;
                }
            }
            return 0;
        }

        function openScriptUpdatePage(url) {
            if (!url) return false;
            const installUrl = normalizeUserscriptInstallUrl(url);
            const installText = String(installUrl || '');
            try {
                const link = document.createElement('a');
                link.href = installText;
                link.target = '_self';
                link.rel = 'noopener noreferrer';
                link.style.display = 'none';
                document.body.appendChild(link);
                link.click();
                setTimeout(function () { link.remove(); }, 1000);
                return true;
            } catch (e) { }
            try {
                if (typeof GM_openInTab === 'function') {
                    GM_openInTab(installText, { active: true, insert: true, setParent: true });
                    return true;
                }
            } catch (e) { }
            try {
                const tab = window.open(installText, '_blank', 'noopener,noreferrer');
                if (tab) return true;
            } catch (e2) { }
            try {
                window.location.href = installText;
                return true;
            } catch (e3) {
                return false;
            }
        }

        function normalizeUserscriptInstallUrl(value) {
            const source = String(value || '').trim();
            if (!source) return DEFAULT_USERSCRIPT_URL;
            const clean = source.replace(/[?#].*$/, '');
            const rawMatch = clean.match(/^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/i);
            if (rawMatch) {
                const path = rawMatch[4].replace(/\/Ns\.js$/i, '/Ns.user.js');
                return 'https://cdn.jsdelivr.net/gh/' + rawMatch[1] + '/' + rawMatch[2] + '@' + rawMatch[3] + '/' + path;
            }
            const githubRawMatch = clean.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/raw\/(?:refs\/heads\/)?([^/]+)\/(.+)$/i);
            if (githubRawMatch) {
                const path = githubRawMatch[4].replace(/\/Ns\.js$/i, '/Ns.user.js');
                return 'https://cdn.jsdelivr.net/gh/' + githubRawMatch[1] + '/' + githubRawMatch[2] + '@' + githubRawMatch[3] + '/' + path;
            }
            return clean.replace(/\/Ns\.js$/i, '/Ns.user.js');
        }

        function getPreferredScriptUrl(meta) {
            const source = meta.updateURL || meta.downloadURL || DEFAULT_USERSCRIPT_URL;
            const normalized = normalizeUserscriptInstallUrl(source);
            if (/\/Ns\.js(?:[?#].*)?$/i.test(normalized)) return DEFAULT_USERSCRIPT_URL;
            return normalized || DEFAULT_USERSCRIPT_URL;
        }

        function scheduleScriptRestart(statusEl) {
            try {
                sessionStorage.setItem('nodeseek_pending_script_update_restart', '1');
            } catch (e) { }
            setTimeout(function () {
                if (statusEl) statusEl.textContent = '正在刷新页面以重启脚本...';
                location.reload();
            }, 8000);
        }

        async function checkScriptUpdate(statusEl) {
            checkScriptUpdateCore({ statusEl: statusEl, silent: false });
        }

        const dataRow = document.createElement('div');
        dataRow.style.display = 'grid';
        dataRow.style.gridTemplateColumns = isMobile ? '1fr' : '1fr 1fr 1fr';
        dataRow.style.gap = '8px';

        function createSettingsActionButton(text, color, handler) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = text;
            btn.className = 'blacklist-btn ns-tw-btn';
            btn.style.background = color;
            btn.style.width = '100%';
            btn.style.minHeight = '30px';
            btn.onclick = handler;
            return btn;
        }

        dataRow.appendChild(createSettingsActionButton('导出', '#2563eb', exportBlacklist));
        dataRow.appendChild(createSettingsActionButton('导入', '#2563eb', importBlacklist));
        dataRow.appendChild(createSettingsActionButton('同步设置', '#475569', showWebdavSyncDialog));
        content.appendChild(dataRow);

        const collapsedMoveLockRow = document.createElement('div');
        collapsedMoveLockRow.style.display = 'flex';
        collapsedMoveLockRow.style.justifyContent = 'space-between';
        collapsedMoveLockRow.style.alignItems = 'center';
        if (isMobile) collapsedMoveLockRow.style.flexWrap = 'wrap';

        const collapsedMoveLockLabel = document.createElement('label');
        collapsedMoveLockLabel.textContent = '最小化移动锁定';
        collapsedMoveLockLabel.style.fontWeight = '500';
        collapsedMoveLockLabel.style.color = '#555';

        const collapsedMoveLockSwitch = document.createElement('input');
        collapsedMoveLockSwitch.type = 'checkbox';
        collapsedMoveLockSwitch.checked = getCollapsedMoveLockState();
        collapsedMoveLockSwitch.style.transform = 'scale(1.2)';
        collapsedMoveLockSwitch.onchange = function () {
            setCollapsedMoveLockState(this.checked);
            addLog('最小化移动锁定：' + (this.checked ? '开启' : '关闭'));
        };

        collapsedMoveLockRow.appendChild(collapsedMoveLockLabel);
        collapsedMoveLockRow.appendChild(collapsedMoveLockSwitch);
        content.appendChild(collapsedMoveLockRow);

        // 1. 阅读记忆开关（含颜色选择）
        const historyRow = document.createElement('div');
        historyRow.style.display = 'flex';
        historyRow.style.justifyContent = 'space-between';
        historyRow.style.alignItems = 'center';

        const historyLabel = document.createElement('label');
        historyLabel.textContent = '开启阅读记忆';
        historyLabel.style.fontWeight = '500';
        historyLabel.style.color = '#555';

        // 右侧容器：包含 颜色选择器 + 重置 + 开关
        const rightContainer = document.createElement('div');
        rightContainer.style.display = 'flex';
        rightContainer.style.alignItems = 'center';
        rightContainer.style.gap = '12px';

        // 颜色选择部分
        const colorInputContainer = document.createElement('div');
        colorInputContainer.style.display = 'flex';
        colorInputContainer.style.alignItems = 'center';
        colorInputContainer.style.gap = '6px';

        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.value = getViewedColor();
        colorPicker.style.border = 'none';
        colorPicker.style.width = '24px';
        colorPicker.style.height = '24px';
        colorPicker.style.padding = '0';
        colorPicker.style.cursor = 'pointer';
        colorPicker.style.background = 'none';
        colorPicker.title = '选择已读标题颜色';

        const colorResetBtn = document.createElement('span');
        colorResetBtn.textContent = '颜色重置';
        colorResetBtn.style.fontSize = '12px';
        colorResetBtn.style.color = '#1890ff';
        colorResetBtn.style.cursor = 'pointer';
        colorResetBtn.style.textDecoration = 'underline';
        colorResetBtn.onclick = function () {
            if (confirm('确定要重置阅读记忆颜色吗？')) {
                colorPicker.value = '#9aa0a6';
                colorPicker.dispatchEvent(new Event('input')); // 触发实时预览
                colorPicker.dispatchEvent(new Event('change')); // 触发保存
            }
        };

        // 实时预览颜色
        colorPicker.oninput = function () {
            const newColor = this.value;
            document.documentElement.style.setProperty('--ns-viewed-color', newColor);
        };

        colorPicker.onchange = function () {
            const newColor = this.value;
            setViewedColor(newColor);
            document.documentElement.style.setProperty('--ns-viewed-color', newColor);
            if (getViewedHistoryEnabled()) {
                markViewedTitles(true); // 立即应用
            }
        };

        colorInputContainer.appendChild(colorPicker);
        colorInputContainer.appendChild(colorResetBtn);

        // 新增：清除阅读记录按钮
        const clearHistoryBtn = document.createElement('span');
        clearHistoryBtn.textContent = '清除';
        clearHistoryBtn.style.fontSize = '12px';
        clearHistoryBtn.style.color = '#ff4d4f';
        clearHistoryBtn.style.cursor = 'pointer';
        clearHistoryBtn.style.textDecoration = 'underline';
        clearHistoryBtn.style.marginLeft = '4px'; // 增加一点间距
        clearHistoryBtn.title = '清除所有已记录的阅读历史';
        clearHistoryBtn.onclick = function () {
            if (confirm('确定要清除所有阅读记忆吗？此操作不可恢复。')) {
                // 清除本地存储
                setViewedTitlesData([]);
                // 清除内存缓存
                cachedVisitedUrlSet = new Set();
                // 刷新页面显示
                markViewedTitles(true); // 传入 true 强制刷新，此时 Set 为空，会清除页面上的灰色样式
                addLog('已清除所有阅读记忆');
                // alert('阅读记忆已清除！');
            }
        };
        colorInputContainer.appendChild(clearHistoryBtn);

        // 开关部分
        const historySwitch = document.createElement('input');
        historySwitch.type = 'checkbox';
        historySwitch.checked = getViewedHistoryEnabled();
        historySwitch.style.transform = 'scale(1.2)';
        historySwitch.onchange = function () {
            const newState = this.checked;
            setViewedHistoryEnabled(newState);
            markViewedTitles(); // 立即应用
            addLog('阅读记忆：' + (newState ? '开启' : '关闭'));
        };

        // 将组件加入右侧容器
        rightContainer.appendChild(colorInputContainer);
        rightContainer.appendChild(historySwitch);

        historyRow.appendChild(historyLabel);
        historyRow.appendChild(rightContainer);
        content.appendChild(historyRow);

        const commentAutoLoadRow = document.createElement('div');
        commentAutoLoadRow.style.display = 'flex';
        commentAutoLoadRow.style.justifyContent = 'space-between';
        commentAutoLoadRow.style.alignItems = 'center';
        if (isMobile) commentAutoLoadRow.style.flexWrap = 'wrap';

        const commentAutoLoadLabel = document.createElement('label');
        commentAutoLoadLabel.textContent = '评论区自动加载更多';
        commentAutoLoadLabel.style.fontWeight = '500';
        commentAutoLoadLabel.style.color = '#555';

        const commentAutoLoadSwitch = document.createElement('input');
        commentAutoLoadSwitch.type = 'checkbox';
        commentAutoLoadSwitch.checked = getCommentAutoLoadMoreEnabled();
        commentAutoLoadSwitch.style.transform = 'scale(1.2)';
        commentAutoLoadSwitch.onchange = function () {
            setCommentAutoLoadMoreEnabled(this.checked);
            addLog('评论区自动加载更多：' + (this.checked ? '开启' : '关闭'));
        };

        commentAutoLoadRow.appendChild(commentAutoLoadLabel);
        commentAutoLoadRow.appendChild(commentAutoLoadSwitch);
        content.appendChild(commentAutoLoadRow);

        // 3. 自动签到设置
        const signRow = document.createElement('div');
        signRow.style.display = 'flex';
        signRow.style.justifyContent = 'space-between';
        signRow.style.alignItems = 'center';

        const signLabel = document.createElement('label');
        signLabel.textContent = '自动签到';
        signLabel.style.fontWeight = '500';
        signLabel.style.color = '#555';

        const signRightContainer = document.createElement('div');
        signRightContainer.style.display = 'flex';
        signRightContainer.style.alignItems = 'center';
        signRightContainer.style.gap = '12px';

        // 模式选择容器
        const signModeContainer = document.createElement('div');
        signModeContainer.style.display = 'flex';
        signModeContainer.style.alignItems = 'center';
        signModeContainer.style.gap = '8px';
        signModeContainer.style.fontSize = '12px';
        signModeContainer.style.color = '#666';

        // 获取当前模式，默认为 fixed
        const currentSignMode = nsLocalStorage.getItem('nodeseek_sign_mode') || 'fixed';
        // 确保如果是第一次使用，也存入 fixed
        if (!nsLocalStorage.getItem('nodeseek_sign_mode')) {
            nsLocalStorage.setItem('nodeseek_sign_mode', 'fixed');
        }

        // 固定签到单选
        const fixedRadio = document.createElement('input');
        fixedRadio.type = 'radio';
        fixedRadio.name = 'sign-mode';
        fixedRadio.value = 'fixed';
        fixedRadio.checked = currentSignMode === 'fixed';
        fixedRadio.style.cursor = 'pointer';
        fixedRadio.onchange = function () {
            if (this.checked) {
                nsLocalStorage.setItem('nodeseek_sign_mode', 'fixed');
                if (window.NodeSeekClockIn && window.NodeSeekClockIn.setSignMode) {
                    window.NodeSeekClockIn.setSignMode('fixed');
                }
                addLog('签到模式：固定');
            }
        };

        const fixedLabel = document.createElement('label');
        fixedLabel.textContent = '固定';
        fixedLabel.style.cursor = 'pointer';
        fixedLabel.onclick = function () { fixedRadio.click(); };

        // 随机签到单选
        const randomRadio = document.createElement('input');
        randomRadio.type = 'radio';
        randomRadio.name = 'sign-mode';
        randomRadio.value = 'random';
        randomRadio.checked = currentSignMode === 'random';
        randomRadio.style.cursor = 'pointer';
        randomRadio.onchange = function () {
            if (this.checked) {
                nsLocalStorage.setItem('nodeseek_sign_mode', 'random');
                if (window.NodeSeekClockIn && window.NodeSeekClockIn.setSignMode) {
                    window.NodeSeekClockIn.setSignMode('random');
                }
                addLog('签到模式：随机');
            }
        };

        const randomLabel = document.createElement('label');
        randomLabel.textContent = '随机';
        randomLabel.style.cursor = 'pointer';
        randomLabel.onclick = function () { randomRadio.click(); };

        signModeContainer.appendChild(fixedRadio);
        signModeContainer.appendChild(fixedLabel);
        signModeContainer.appendChild(randomRadio);
        signModeContainer.appendChild(randomLabel);

        // 签到开关
        const signSwitch = document.createElement('input');
        signSwitch.type = 'checkbox';
        signSwitch.checked = nsLocalStorage.getItem('nodeseek_sign_enabled') !== 'false';
        signSwitch.style.transform = 'scale(1.2)';
        signSwitch.onchange = function () {
            const newState = this.checked;
            nsLocalStorage.setItem('nodeseek_sign_enabled', newState.toString());
            addLog('自动签到：' + (newState ? '开启' : '关闭'));

            // 立即触发一次状态更新（如果是开启）
            if (newState && window.NodeSeekClockIn && window.NodeSeekClockIn.scheduleNextHourlySign) {
                window.NodeSeekClockIn.scheduleNextHourlySign();
                if (window.NodeSeekClockIn.runDailyBoardSign) {
                    window.NodeSeekClockIn.runDailyBoardSign(true);
                }
            }
        };

        signRightContainer.appendChild(signModeContainer);
        signRightContainer.appendChild(signSwitch);

        signRow.appendChild(signLabel);
        signRow.appendChild(signRightContainer);
        content.appendChild(signRow);

        // 新增：新标签页打开帖子开关
        const openPostNewTabRow = document.createElement('div');
        openPostNewTabRow.style.display = 'flex';
        openPostNewTabRow.style.justifyContent = 'space-between';
        openPostNewTabRow.style.alignItems = 'center';

        const openPostNewTabLabel = document.createElement('label');
        openPostNewTabLabel.textContent = '新标签页打开帖子';
        openPostNewTabLabel.style.fontWeight = '500';
        openPostNewTabLabel.style.color = '#555';

        const openPostNewTabSwitch = document.createElement('input');
        openPostNewTabSwitch.type = 'checkbox';
        openPostNewTabSwitch.checked = getOpenPostNewTabEnabled();
        openPostNewTabSwitch.style.transform = 'scale(1.2)';
        openPostNewTabSwitch.onchange = function () {
            const newState = this.checked;
            setOpenPostNewTabEnabled(newState);
            applyNewTabLinks(); // 立即应用
            addLog('新标签页打开帖子：' + (newState ? '开启' : '关闭'));
        };

        openPostNewTabRow.appendChild(openPostNewTabLabel);
        openPostNewTabRow.appendChild(openPostNewTabSwitch);
        content.appendChild(openPostNewTabRow);

        // 4. 跳过跳转页面开关 -> 改为 屏蔽URL跳转提醒
        const skipJumpRow = document.createElement('div');
        skipJumpRow.style.display = 'flex';
        skipJumpRow.style.justifyContent = 'space-between';
        skipJumpRow.style.alignItems = 'center';
        skipJumpRow.style.marginBottom = '12px';
        skipJumpRow.style.gap = '4px'; // 紧凑间距

        const skipJumpLabel = document.createElement('label');
        skipJumpLabel.textContent = '屏蔽URL跳转提醒';
        skipJumpLabel.style.fontWeight = '500';
        skipJumpLabel.style.color = '#555';
        skipJumpLabel.style.fontSize = '12px';
        skipJumpLabel.style.whiteSpace = 'nowrap';
        skipJumpLabel.style.overflow = 'hidden';
        skipJumpLabel.style.textOverflow = 'ellipsis';

        const skipJumpRightContainer = document.createElement('div');
        skipJumpRightContainer.style.display = 'flex';
        skipJumpRightContainer.style.alignItems = 'center';
        skipJumpRightContainer.style.gap = '6px';

        const modeSelect = document.createElement('select');
        modeSelect.style.fontSize = '12px';
        modeSelect.style.padding = '1px 2px';
        modeSelect.style.borderRadius = '4px';
        modeSelect.style.border = '1px solid #ddd';
        modeSelect.style.outline = 'none';
        modeSelect.style.cursor = 'pointer';
        modeSelect.style.width = '75px'; // 固定宽度更整齐

        const optAll = document.createElement('option');
        optAll.value = 'all';
        optAll.textContent = '全放行';
        const optWhite = document.createElement('option');
        optWhite.value = 'whitelist';
        optWhite.textContent = '白名单';

        modeSelect.appendChild(optAll);
        modeSelect.appendChild(optWhite);
        modeSelect.value = getSkipJumpMode();

        const configBtn = document.createElement('button');
        configBtn.textContent = '编辑';
        configBtn.style.fontSize = '12px';
        configBtn.style.padding = '2px 6px';
        configBtn.style.background = '#1890ff';
        configBtn.style.color = '#fff';
        configBtn.style.border = 'none';
        configBtn.style.borderRadius = '4px';
        configBtn.style.cursor = 'pointer';
        configBtn.style.whiteSpace = 'nowrap';
        configBtn.title = '管理白名单域名';
        configBtn.onclick = function () {
            showJumpListDialog();
        };

        // 更新设置按钮状态的函数
        const updateConfigBtnStatus = () => {
            if (modeSelect.value === 'whitelist') {
                configBtn.disabled = false;
                configBtn.style.opacity = '1';
                configBtn.style.cursor = 'pointer';
                configBtn.style.background = '#1890ff';
            } else {
                configBtn.disabled = true;
                configBtn.style.opacity = '0.5';
                configBtn.style.cursor = 'not-allowed';
                configBtn.style.background = '#ccc';
            }
        };

        // 初始化按钮状态
        updateConfigBtnStatus();

        modeSelect.onchange = function () {
            setSkipJumpMode(this.value);
            updateConfigBtnStatus();
            addLog('屏蔽URL跳转提醒模式：' + (this.value === 'whitelist' ? '白名单' : '全放行'));

            // 立即应用模式更改
            if (getSkipJumpPageEnabled()) {
                // 切换模式前先恢复所有链接，确保逻辑干净
                restoreJumpLinks();
                // 再按新模式重写
                rewriteJumpLinks();
            } else {
                restoreJumpLinks();
            }
        };

        const skipJumpSwitch = document.createElement('input');
        skipJumpSwitch.type = 'checkbox';
        skipJumpSwitch.checked = getSkipJumpPageEnabled();
        skipJumpSwitch.style.transform = 'scale(1.1)';
        skipJumpSwitch.onchange = function () {
            const newState = this.checked;
            setSkipJumpPageEnabled(newState);
            addLog('屏蔽URL跳转提醒：' + (newState ? '开启' : '关闭'));
            if (newState) {
                rewriteJumpLinks(); // 立即尝试重写当前页面的链接
            } else {
                restoreJumpLinks(); // 立即恢复原始链接
            }
        };

        skipJumpRightContainer.appendChild(modeSelect);
        skipJumpRightContainer.appendChild(configBtn);
        skipJumpRightContainer.appendChild(skipJumpSwitch);

        skipJumpRow.appendChild(skipJumpLabel);
        skipJumpRow.appendChild(skipJumpRightContainer);
        content.appendChild(skipJumpRow);

        const webdavRow = document.createElement('div');
        webdavRow.style.display = 'flex';
        webdavRow.style.justifyContent = 'space-between';
        webdavRow.style.alignItems = 'center';
        webdavRow.style.gap = '8px';

        const webdavLabel = document.createElement('label');
        webdavLabel.textContent = 'WebDAV同步';
        webdavLabel.style.fontWeight = '500';
        webdavLabel.style.color = '#555';

        const webdavRightContainer = document.createElement('div');
        webdavRightContainer.style.display = 'flex';
        webdavRightContainer.style.alignItems = 'center';
        webdavRightContainer.style.gap = '6px';

        const webdavOpenBtn = document.createElement('button');
        webdavOpenBtn.textContent = '配置';
        webdavOpenBtn.style.fontSize = '12px';
        webdavOpenBtn.style.padding = '2px 6px';
        webdavOpenBtn.style.background = '#0d9488';
        webdavOpenBtn.style.color = '#fff';
        webdavOpenBtn.style.border = 'none';
        webdavOpenBtn.style.borderRadius = '4px';
        webdavOpenBtn.style.cursor = 'pointer';
        webdavOpenBtn.onclick = showWebdavSyncDialog;

        const webdavNowBtn = document.createElement('button');
        webdavNowBtn.textContent = '同步';
        webdavNowBtn.style.fontSize = '12px';
        webdavNowBtn.style.padding = '2px 6px';
        webdavNowBtn.style.background = '#1890ff';
        webdavNowBtn.style.color = '#fff';
        webdavNowBtn.style.border = 'none';
        webdavNowBtn.style.borderRadius = '4px';
        webdavNowBtn.style.cursor = 'pointer';
        webdavNowBtn.onclick = function () {
            syncWithWebdav('manual');
        };

        webdavRightContainer.appendChild(webdavNowBtn);
        webdavRightContainer.appendChild(webdavOpenBtn);
        webdavRow.appendChild(webdavLabel);
        webdavRow.appendChild(webdavRightContainer);
        content.appendChild(webdavRow);

        const updateRow = document.createElement('div');
        updateRow.style.display = 'flex';
        updateRow.style.justifyContent = 'space-between';
        updateRow.style.alignItems = 'center';
        updateRow.style.gap = '8px';

        const updateMeta = getScriptMeta();
        const updateLabel = document.createElement('label');
        updateLabel.textContent = '脚本更新';
        updateLabel.style.fontWeight = '500';
        updateLabel.style.color = '#555';

        const updateRightContainer = document.createElement('div');
        updateRightContainer.style.display = 'flex';
        updateRightContainer.style.alignItems = 'center';
        updateRightContainer.style.gap = '6px';

        const updateStatus = document.createElement('span');
        updateStatus.textContent = updateMeta.version ? '当前 ' + updateMeta.version : '当前版本未知';
        updateStatus.style.fontSize = '12px';
        updateStatus.style.color = '#666';

        const updateBtn = document.createElement('button');
        updateBtn.textContent = '检查更新';
        updateBtn.style.fontSize = '12px';
        updateBtn.style.padding = '2px 6px';
        updateBtn.style.background = '#1890ff';
        updateBtn.style.color = '#fff';
        updateBtn.style.border = 'none';
        updateBtn.style.borderRadius = '4px';
        updateBtn.style.cursor = 'pointer';
        updateBtn.onclick = function () {
            checkScriptUpdate(updateStatus);
        };

        const autoUpdateLabel = document.createElement('label');
        autoUpdateLabel.style.display = 'inline-flex';
        autoUpdateLabel.style.alignItems = 'center';
        autoUpdateLabel.style.gap = '3px';
        autoUpdateLabel.style.fontSize = '12px';
        autoUpdateLabel.style.color = '#666';
        autoUpdateLabel.style.cursor = 'pointer';

        const autoUpdateCheckbox = document.createElement('input');
        autoUpdateCheckbox.type = 'checkbox';
        autoUpdateCheckbox.checked = isScriptAutoUpdateEnabled();
        autoUpdateCheckbox.onchange = function () {
            setScriptAutoUpdateEnabled(autoUpdateCheckbox.checked);
            updateStatus.textContent = autoUpdateCheckbox.checked ? '已开启自动检查' : '已关闭自动检查';
        };
        autoUpdateLabel.appendChild(autoUpdateCheckbox);
        autoUpdateLabel.appendChild(document.createTextNode('自动'));

        updateRightContainer.appendChild(updateStatus);
        updateRightContainer.appendChild(autoUpdateLabel);
        updateRightContainer.appendChild(updateBtn);
        updateRow.appendChild(updateLabel);
        updateRow.appendChild(updateRightContainer);
        content.appendChild(updateRow);



        dialog.appendChild(content);
        document.body.appendChild(dialog);
    }

    // ========== 快捷回复功能UI ==========

    // 为快捷回复模块暴露日志函数
    window.addQuickReplyLog = addLog;

    function findTalkTitleElementFast() {
        const selectors = [
            'h1', 'h2', 'h3', 'h4',
            '.card-header', '.panel-heading', '.message-header', '.talk-header', '.chat-header',
            '.card-title', '.panel-title', '.talk-title', '.chat-title'
        ];
        const nodes = [];
        selectors.forEach(sel => {
            try {
                document.querySelectorAll(sel).forEach(el => nodes.push(el));
            } catch (e) { }
        });
        for (const el of nodes) {
            const t = (el.textContent || '').trim().replace(/\s+/g, ' ');
            if (!t) continue;
            if (/^与.{1,32}的对话$/.test(t)) return el;
        }
        return null;
    }

    function formatIsoToLocalText(timestamp) {
        try {
            if (!timestamp) return '';
            const date = new Date(timestamp);
            if (Number.isNaN(date.getTime())) return String(timestamp);
            return date.getFullYear() + '-' +
                String(date.getMonth() + 1).padStart(2, '0') + '-' +
                String(date.getDate()).padStart(2, '0') + ' ' +
                String(date.getHours()).padStart(2, '0') + ':' +
                String(date.getMinutes()).padStart(2, '0') + ':' +
                String(date.getSeconds()).padStart(2, '0');
        } catch (e) {
            return '';
        }
    }

    function buildBlacklistTargetUrl(info) {
        try {
            if (!info || !info.url) return '';
            let targetUrl = String(info.url);
            if (info.postId && !targetUrl.includes('#post-') && !targetUrl.includes('#' + String(info.postId).replace('post-', ''))) {
                targetUrl = targetUrl.split('#')[0];
                targetUrl += '#' + String(info.postId).replace('post-', '');
            }
            return targetUrl;
        } catch (e) {
            return '';
        }
    }

    function getCurrentTalkBlacklistedMatch() {
        try {
            const to = getHashQueryParam('to');
            if (to) {
                const byId = getBlacklistedEntryByUserId(to);
                if (byId) return byId;
            }

            const titleEl = findTalkTitleElementFast();
            if (!titleEl) return null;
            const titleText = (titleEl.textContent || '').trim().replace(/\s+/g, ' ');
            const nameMatch = titleText.match(/^与(.+)的对话$/);
            const talkUsername = nameMatch ? nameMatch[1].trim() : '';
            if (!talkUsername) return null;

            if (!isBlacklisted(talkUsername)) return null;
            const list = getBlacklist();
            return { username: talkUsername, info: list[talkUsername] };
        } catch (e) {
            return null;
        }
    }

    function getCurrentTalkFriendMatch() {
        try {
            const friends = getFriends();
            const to = getHashQueryParam('to');

            if (to) {
                const match = friends.find(f => {
                    if (!f.pmUrl) return false;
                    const matchId = f.pmUrl.match(/[?&]to=(\d+)/);
                    return matchId && matchId[1] === to;
                });
                if (match) return match;
            }

            const titleEl = findTalkTitleElementFast();
            if (!titleEl) return null;
            const titleText = (titleEl.textContent || '').trim().replace(/\s+/g, ' ');
            const nameMatch = titleText.match(/^与(.+)的对话$/);
            const talkUsername = nameMatch ? nameMatch[1].trim() : '';
            if (!talkUsername) return null;

            return friends.find(f => f.username === talkUsername);
        } catch (e) {
            return null;
        }
    }

    function ensureBlacklistNavEntryAndMeta(force = false) {
        const appSwitch = document.querySelector('.app-switch');
        if (!appSwitch) return;

        const links = appSwitch.querySelectorAll('a');
        let pmLink = null;
        for (const link of links) {
            if ((link.textContent || '').includes('私信')) {
                pmLink = link;
                break;
            }
        }
        if (!pmLink) return;

        try {
            appSwitch.querySelectorAll('.ns-blacklist-entry').forEach(el => el.remove());
        } catch (e) { }

        let meta = appSwitch.querySelector('.ns-blacklist-entry-meta');
        const isMobile = window.innerWidth <= 767;
        if (!meta) {
            meta = document.createElement('span');
            meta.className = 'ns-blacklist-entry-meta';
            meta.style.marginLeft = isMobile ? '10px' : '30px';
            meta.style.fontSize = isMobile ? '12px' : '14px';
            meta.style.color = '#fc5154ff';
            meta.style.whiteSpace = isMobile ? 'normal' : 'nowrap';
            meta.style.verticalAlign = 'middle';
            meta.style.display = 'inline-flex';
            meta.style.alignItems = 'center';
            meta.style.flexWrap = isMobile ? 'wrap' : 'nowrap';
            meta.style.columnGap = isMobile ? '6px' : '';
            meta.style.rowGap = isMobile ? '2px' : '';
            meta.style.lineHeight = isMobile ? '12px' : '14px';
            meta.style.display = 'none';
        }
        meta.style.fontSize = isMobile ? '12px' : '14px';
        meta.style.marginLeft = isMobile ? '10px' : '30px';
        meta.style.whiteSpace = isMobile ? 'normal' : 'nowrap';
        meta.style.flexWrap = isMobile ? 'wrap' : 'nowrap';
        meta.style.columnGap = isMobile ? '6px' : '';
        meta.style.rowGap = isMobile ? '2px' : '';
        meta.style.lineHeight = isMobile ? '12px' : '14px';

        if (pmLink.nextSibling) {
            if (meta.parentNode !== pmLink.parentNode || pmLink.nextSibling !== meta) {
                pmLink.parentNode.insertBefore(meta, pmLink.nextSibling);
            }
        } else {
            if (meta.parentNode !== pmLink.parentNode || meta !== pmLink.parentNode.lastChild) {
                pmLink.parentNode.appendChild(meta);
            }
        }

        const routeKey = (window.location.pathname || '') + '|' + (window.location.hash || '');
        const now = Date.now();
        const lastRouteKey = ensureBlacklistNavEntryAndMeta._lastRouteKey || '';
        const lastCheckAt = ensureBlacklistNavEntryAndMeta._lastCheckAt || 0;
        const minInterval = (routeKey === lastRouteKey) ? 1500 : 0;
        if (!force && minInterval && (now - lastCheckAt) < minInterval) return;
        ensureBlacklistNavEntryAndMeta._lastCheckAt = now;

        const matched = getCurrentTalkBlacklistedMatch();
        const friendMatched = getCurrentTalkFriendMatch();

        const key = [
            matched ? 'BL' : 'NB',
            matched?.username || '',
            matched?.info?.timestamp || '',
            matched?.info?.remark || '',
            matched?.info?.url || '',
            matched?.info?.postId || '',
            friendMatched ? 'FR' : 'NF',
            friendMatched?.username || '',
            friendMatched?.timestamp || '',
            friendMatched?.remark || ''
        ].join('|');

        if (ensureBlacklistNavEntryAndMeta._lastKey === key) return;
        ensureBlacklistNavEntryAndMeta._lastKey = key;
        ensureBlacklistNavEntryAndMeta._lastRouteKey = routeKey;

        if ((!matched || !matched.info) && !friendMatched) {
            meta.textContent = '';
            meta.style.display = 'none';
            return;
        }

        while (meta.firstChild) meta.removeChild(meta.firstChild);

        // 优先显示黑名单
        if (matched && matched.info) {
            meta.style.color = '#fc5154ff';

            const timeText = formatIsoToLocalText(matched.info.timestamp);
            const remark = matched.info.remark ? String(matched.info.remark) : '';
            const url = buildBlacklistTargetUrl(matched.info);
            const pageText = matched.info.postId ? `楼层#${String(matched.info.postId).replace('post-', '')}` : '页面';

            const timeSpan = document.createElement('span');
            timeSpan.textContent = `拉黑时间：${timeText || '未知'}`;
            timeSpan.style.lineHeight = isMobile ? '12px' : '14px';
            meta.appendChild(timeSpan);

            const remarkSpan = document.createElement('span');
            remarkSpan.style.marginLeft = '8px';
            remarkSpan.style.maxWidth = 'none';
            remarkSpan.style.display = 'inline';
            remarkSpan.style.overflow = 'visible';
            remarkSpan.style.textOverflow = 'clip';
            remarkSpan.style.whiteSpace = 'nowrap';
            remarkSpan.style.flex = '0 0 auto';
            remarkSpan.style.lineHeight = isMobile ? '12px' : '14px';

            const rawRemarkText = remark || '无';
            const remarkChars = Array.from(String(rawRemarkText));
            const shownRemark = remarkChars.length > 20 ? remarkChars.slice(0, 20).join('') + '…' : String(rawRemarkText);
            remarkSpan.textContent = `备注：${shownRemark}`;
            remarkSpan.title = rawRemarkText;
            meta.appendChild(remarkSpan);

            if (url) {
                const pageLink = document.createElement('a');
                pageLink.href = url;
                pageLink.target = '_blank';
                pageLink.rel = 'noopener noreferrer';
                pageLink.style.marginLeft = '8px';
                pageLink.style.color = 'rgba(74, 162, 250, 1)';
                pageLink.style.textDecoration = 'none';
                pageLink.style.whiteSpace = 'nowrap';
                pageLink.style.lineHeight = isMobile ? '12px' : '14px';
                pageLink.textContent = `拉黑页面：${pageText}`;
                pageLink.onmouseenter = function () { pageLink.style.textDecoration = 'underline'; };
                pageLink.onmouseleave = function () { pageLink.style.textDecoration = 'none'; };
                meta.appendChild(pageLink);
            } else {
                const none = document.createElement('span');
                none.style.marginLeft = '8px';
                none.style.color = '#06c';
                none.style.lineHeight = isMobile ? '12px' : '14px';
                none.textContent = `拉黑页面：${pageText}`;
                meta.appendChild(none);
            }
        } else if (friendMatched) {
            meta.style.color = '#2ea44f';

            const timeText = formatIsoToLocalText(friendMatched.timestamp);
            const remark = friendMatched.remark ? String(friendMatched.remark) : '';

            const timeSpan = document.createElement('span');
            timeSpan.textContent = `添加时间：${timeText || '未知'}`;
            timeSpan.style.lineHeight = isMobile ? '12px' : '14px';
            meta.appendChild(timeSpan);

            const remarkSpan = document.createElement('span');
            remarkSpan.style.marginLeft = '8px';
            remarkSpan.style.maxWidth = 'none';
            remarkSpan.style.display = 'inline';
            remarkSpan.style.overflow = 'visible';
            remarkSpan.style.textOverflow = 'clip';
            remarkSpan.style.whiteSpace = 'nowrap';
            remarkSpan.style.flex = '0 0 auto';
            remarkSpan.style.lineHeight = isMobile ? '12px' : '14px';

            const rawRemarkText = remark || '无';
            const remarkChars = Array.from(String(rawRemarkText));
            const shownRemark = remarkChars.length > 20 ? remarkChars.slice(0, 20).join('') + '…' : String(rawRemarkText);
            remarkSpan.textContent = `备注：${shownRemark}`;
            remarkSpan.title = rawRemarkText;
            meta.appendChild(remarkSpan);
        }

        meta.style.display = 'inline-flex';
    }

    function decodeJumpTargetValue(value) {
        let text = String(value || '');
        for (let i = 0; i < 2 && /%[0-9a-f]{2}/i.test(text); i++) {
            try {
                const next = decodeURIComponent(text);
                if (next === text) break;
                text = next;
            } catch (e) {
                break;
            }
        }
        return text;
    }

    function getJumpTargetUrl(link) {
        if (!link || !link.href) return '';
        try {
            const url = new URL(link.href, location.origin);
            if (url.pathname !== '/jump' || !url.searchParams.has('to')) return '';
            return decodeJumpTargetValue(url.searchParams.get('to'));
        } catch (e) {
            return '';
        }
    }

    function shouldSkipJumpTarget(targetUrlStr) {
        if (!targetUrlStr) return false;
        const mode = getSkipJumpMode();
        const list = getSkipJumpList();
        if (mode !== 'whitelist') return true;

        try {
            const targetUrl = new URL(targetUrlStr, location.origin);
            const host = targetUrl.hostname.toLowerCase();
            const domains = Array.isArray(list) ? list.map(domain => String(domain || '').trim().toLowerCase().replace(/^\.+/, '')).filter(Boolean) : [];
            if (!domains.length) return false;
            return domains.some(domain => host === domain || host.endsWith('.' + domain));
        } catch (e) {
            return false;
        }
    }

    function rewriteJumpLinks() {
        if (!getSkipJumpPageEnabled()) return;

        document.querySelectorAll('a[href*="/jump"][href*="to="]').forEach(link => {
            try {
                const targetUrlStr = getJumpTargetUrl(link);
                if (!targetUrlStr) return;
                if (shouldSkipJumpTarget(targetUrlStr)) {
                    // 保存原始链接以便恢复
                    if (!link.getAttribute('data-ns-jump-url')) {
                        link.setAttribute('data-ns-jump-url', link.href);
                    }
                    link.href = targetUrlStr;
                    if (!link.target) link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                } else {
                    // 如果不应该跳过，但之前可能被重写过，则恢复
                    const originalUrl = link.getAttribute('data-ns-jump-url');
                    if (originalUrl) {
                        link.href = originalUrl;
                        link.removeAttribute('data-ns-jump-url');
                    }
                }
            } catch (e) {
                console.error('Error rewriting jump link', e);
            }
        });
    }

    document.addEventListener('click', function (event) {
        if (!getSkipJumpPageEnabled()) return;
        const link = event.target.closest?.('a[href*="/jump"][href*="to="]');
        if (!link) return;
        const targetUrlStr = getJumpTargetUrl(link);
        if (!shouldSkipJumpTarget(targetUrlStr)) return;

        event.preventDefault();
        event.stopPropagation();
        if (link.target === '_blank' || event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) {
            window.open(targetUrlStr, '_blank', 'noopener,noreferrer');
        } else {
            window.location.href = targetUrlStr;
        }
    }, true);

    function restoreJumpLinks() {
        document.querySelectorAll('a[data-ns-jump-url]').forEach(link => {
            try {
                const originalUrl = link.getAttribute('data-ns-jump-url');
                if (originalUrl) {
                    link.href = originalUrl;
                    link.removeAttribute('data-ns-jump-url');
                    // 可选：如果需要恢复 target/rel 属性，可以在这里处理
                    // 但通常外部链接保持 _blank 是合适的，所以这里只恢复 href
                }
            } catch (e) {
                console.error('Error restoring jump link', e);
            }
        });
    }

    const NODEIMAGE_CDN_ORIGIN = 'https://cdn.nodeimage.com';
    const NODEIMAGE_IMAGE_ATTR = 'data-ns-nodeimage-optimized';
    let nodeImageOptimizeTimer = null;

    function ensureNodeImageConnectionHints() {
        const head = document.head || document.documentElement;
        if (!head || document.getElementById('ns-nodeimage-cdn-preconnect')) return;

        const preconnect = document.createElement('link');
        preconnect.id = 'ns-nodeimage-cdn-preconnect';
        preconnect.rel = 'preconnect';
        preconnect.href = NODEIMAGE_CDN_ORIGIN;
        preconnect.crossOrigin = 'anonymous';
        head.appendChild(preconnect);

        const dnsPrefetch = document.createElement('link');
        dnsPrefetch.id = 'ns-nodeimage-cdn-dns-prefetch';
        dnsPrefetch.rel = 'dns-prefetch';
        dnsPrefetch.href = NODEIMAGE_CDN_ORIGIN;
        head.appendChild(dnsPrefetch);
    }

    function isNodeImageCdnUrl(value) {
        if (!value) return false;
        try {
            return new URL(value, window.location.href).hostname === 'cdn.nodeimage.com';
        } catch (e) {
            return String(value).indexOf('cdn.nodeimage.com') !== -1;
        }
    }

    function imageUsesNodeImageCdn(img) {
        if (!(img instanceof HTMLImageElement)) return false;
        return isNodeImageCdnUrl(img.currentSrc)
            || isNodeImageCdnUrl(img.src)
            || isNodeImageCdnUrl(img.getAttribute('data-src'))
            || isNodeImageCdnUrl(img.getAttribute('data-original'))
            || isNodeImageCdnUrl(img.getAttribute('srcset'))
            || isNodeImageCdnUrl(img.getAttribute('data-srcset'));
    }

    function isNearViewport(el) {
        try {
            const rect = el.getBoundingClientRect();
            const height = window.innerHeight || document.documentElement.clientHeight || 800;
            return rect.top < height * 1.25 && rect.bottom > -height * 0.25;
        } catch (e) {
            return false;
        }
    }

    function optimizeNodeImage(img) {
        if (!imageUsesNodeImageCdn(img)) return;
        if (img.getAttribute(NODEIMAGE_IMAGE_ATTR) === 'true') return;
        img.setAttribute(NODEIMAGE_IMAGE_ATTR, 'true');
        img.decoding = 'async';
        if (isNearViewport(img)) {
            img.loading = 'eager';
            try { img.fetchPriority = 'high'; } catch (e) { }
        } else {
            img.loading = 'lazy';
            try { img.fetchPriority = 'low'; } catch (e) { }
        }
    }

    function optimizeNodeImageCdnImages(root) {
        ensureNodeImageConnectionHints();
        const scope = root && root.querySelectorAll ? root : document;
        if (scope instanceof HTMLImageElement) optimizeNodeImage(scope);
        scope.querySelectorAll?.('img').forEach(optimizeNodeImage);
    }

    function scheduleNodeImageCdnOptimize(root) {
        if (nodeImageOptimizeTimer) clearTimeout(nodeImageOptimizeTimer);
        nodeImageOptimizeTimer = setTimeout(function () {
            nodeImageOptimizeTimer = null;
            optimizeNodeImageCdnImages(root || document);
        }, 120);
    }

    function startNodeImageCdnOptimize() {
        optimizeNodeImageCdnImages(document);
        window.addEventListener('load', function () {
            optimizeNodeImageCdnImages(document);
        }, { once: true });
        try {
            new MutationObserver(function (mutations) {
                for (const mutation of mutations) {
                    for (const node of mutation.addedNodes) {
                        if (node instanceof Element && (node.matches?.('img') || node.querySelector?.('img'))) {
                            scheduleNodeImageCdnOptimize(node);
                            return;
                        }
                    }
                }
            }).observe(document.body || document.documentElement, { childList: true, subtree: true });
        } catch (e) { }
    }

    let nsBlacklistNavTimer = null;
    function scheduleEnsureBlacklistNav() {
        if (nsBlacklistNavTimer) return;
        nsBlacklistNavTimer = setTimeout(() => {
            nsBlacklistNavTimer = null;
            ensureBlacklistNavEntryAndMeta();
            rewriteJumpLinks();
        }, 200);
    }

    const blacklistEntryObserver = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof Element)) continue;
                if (node.matches?.('.app-switch, a[href*="/jump"][href*="to="]') || node.querySelector?.('.app-switch, a[href*="/jump"][href*="to="]')) {
                    scheduleEnsureBlacklistNav();
                    return;
                }
            }
        }
    });

    try {
        blacklistEntryObserver.observe(document.body, { childList: true, subtree: true });
    } catch (e) { }

    window.addEventListener('hashchange', scheduleEnsureBlacklistNav);
    setTimeout(scheduleEnsureBlacklistNav, 300);
    setTimeout(scheduleEnsureBlacklistNav, 1500);
    startNodeImageCdnOptimize();
    restartWebdavSyncTimer();
    bindSafariNodeImageToolbar();
    setTimeout(bindSafariNodeImageToolbar, 800);
    try {
        let safariNodeImageToolbarTimer = null;
        new MutationObserver(function (mutations) {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (!(node instanceof Element)) continue;
                    if (node.matches?.('textarea, .CodeMirror, .vditor, .mde, [contenteditable="true"]') || node.querySelector?.('textarea, .CodeMirror, .vditor, .mde, [contenteditable="true"]')) {
                        if (safariNodeImageToolbarTimer) clearTimeout(safariNodeImageToolbarTimer);
                        safariNodeImageToolbarTimer = setTimeout(function () {
                            safariNodeImageToolbarTimer = null;
                            bindSafariNodeImageToolbar();
                        }, 220);
                        return;
                    }
                }
            }
        }).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) { }
