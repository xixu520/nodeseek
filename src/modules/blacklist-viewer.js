    // 内置黑名单查看功能
    if (!window.NodeSeekBlacklistViewer) {
        window.NodeSeekBlacklistViewer = (function () {
            function formatTime(value) {
                if (!value) return '';
                const date = new Date(value);
                if (Number.isNaN(date.getTime())) return '';
                return date.getFullYear() + '-' +
                    String(date.getMonth() + 1).padStart(2, '0') + '-' +
                    String(date.getDate()).padStart(2, '0') + ' ' +
                    String(date.getHours()).padStart(2, '0') + ':' +
                    String(date.getMinutes()).padStart(2, '0') + ':' +
                    String(date.getSeconds()).padStart(2, '0');
            }

            function buildUserUrl(username, info) {
                if (info && info.userId) return 'https://www.nodeseek.com/space/' + info.userId + '#/general';
                return info && info.url ? info.url : 'https://www.nodeseek.com';
            }

            function buildPageUrl(info) {
                if (!info || !info.url) return '';
                let targetUrl = info.url;
                if (info.postId && !targetUrl.includes('#post-') && !targetUrl.includes('#' + String(info.postId).replace('post-', ''))) {
                    targetUrl = targetUrl.split('#')[0] + '#' + String(info.postId).replace('post-', '');
                }
                return targetUrl;
            }

            function updateBlacklistRemark(username, remark) {
                const list = getBlacklist();
                if (!list[username]) return false;
                list[username].remark = remark || '';
                setBlacklist(list);
                highlightBlacklisted(username);
                return true;
            }

            function showBlacklistDialog() {
                const existing = document.getElementById('blacklist-dialog');
                if (existing) {
                    existing.remove();
                    return;
                }

                const dialog = document.createElement('div');
                dialog.id = 'blacklist-dialog';
                dialog.style.position = 'fixed';
                dialog.style.top = '80px';
                dialog.style.right = '16px';
                dialog.style.zIndex = '10000';
                dialog.style.background = '#fff';
                dialog.style.border = '1px solid #ccc';
                dialog.style.borderRadius = '8px';
                dialog.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)';
                dialog.style.padding = '14px';
                dialog.style.width = window.innerWidth <= 767 ? '92%' : '720px';
                dialog.style.maxHeight = '80vh';
                dialog.style.overflow = 'auto';
                dialog.style.boxSizing = 'border-box';

                const header = document.createElement('div');
                header.style.display = 'flex';
                header.style.justifyContent = 'space-between';
                header.style.alignItems = 'center';
                header.style.marginBottom = '10px';

                const title = document.createElement('strong');
                title.textContent = '黑名单';

                const closeBtn = document.createElement('button');
                closeBtn.textContent = '×';
                closeBtn.className = 'close-btn';
                closeBtn.onclick = function () { dialog.remove(); };

                header.appendChild(title);
                header.appendChild(closeBtn);
                dialog.appendChild(header);

                const list = getBlacklist();
                const entries = Object.keys(list).sort((a, b) => {
                    const at = new Date(list[a]?.timestamp || 0).getTime();
                    const bt = new Date(list[b]?.timestamp || 0).getTime();
                    return bt - at;
                });

                if (entries.length === 0) {
                    const empty = document.createElement('div');
                    empty.textContent = '暂无黑名单用户';
                    empty.style.textAlign = 'center';
                    empty.style.color = '#888';
                    empty.style.margin = '18px 0 8px 0';
                    dialog.appendChild(empty);
                    document.body.appendChild(dialog);
                    if (typeof makeDraggable === 'function') makeDraggable(dialog, { width: 50, height: 50 });
                    return;
                }

                const table = document.createElement('table');
                table.style.width = '100%';
                table.style.borderCollapse = 'collapse';
                table.innerHTML = '<thead><tr><th style="text-align:left;font-size:13px;">用户名</th><th style="text-align:left;font-size:13px;">备注</th><th style="text-align:left;font-size:13px;">拉黑时间</th><th style="text-align:left;font-size:13px;">页面</th><th></th></tr></thead>';
                const tbody = document.createElement('tbody');
                table.appendChild(tbody);

                entries.forEach(username => {
                    const info = list[username] || {};
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid #eee';

                    const tdUser = document.createElement('td');
                    const userLink = document.createElement('a');
                    userLink.href = buildUserUrl(username, info);
                    userLink.target = '_blank';
                    userLink.textContent = username;
                    userLink.style.color = '#d00';
                    userLink.style.fontWeight = 'bold';
                    tdUser.appendChild(userLink);

                    const tdRemark = document.createElement('td');
                    tdRemark.textContent = info.remark || '　';
                    tdRemark.title = info.remark || '点击编辑备注';
                    tdRemark.style.cursor = 'pointer';
                    tdRemark.style.maxWidth = '180px';
                    tdRemark.style.overflow = 'hidden';
                    tdRemark.style.textOverflow = 'ellipsis';
                    tdRemark.style.whiteSpace = 'nowrap';
                    tdRemark.onclick = function () {
                        const next = prompt('请输入备注：', info.remark || '');
                        if (next === null) return;
                        info.remark = next;
                        updateBlacklistRemark(username, next);
                        tdRemark.textContent = next || '　';
                        tdRemark.title = next || '点击编辑备注';
                    };

                    const tdTime = document.createElement('td');
                    tdTime.textContent = formatTime(info.timestamp);
                    tdTime.style.fontSize = '12px';
                    tdTime.style.whiteSpace = 'nowrap';

                    const tdPage = document.createElement('td');
                    const pageUrl = buildPageUrl(info);
                    if (pageUrl) {
                        const pageLink = document.createElement('a');
                        pageLink.href = pageUrl;
                        pageLink.target = '_blank';
                        pageLink.textContent = info.postId ? '楼层#' + String(info.postId).replace('post-', '') : '页面';
                        tdPage.appendChild(pageLink);
                    }

                    const tdOp = document.createElement('td');
                    const removeBtn = document.createElement('button');
                    removeBtn.textContent = '移除';
                    removeBtn.className = 'blacklist-btn red';
                    removeBtn.onclick = function () {
                        if (!confirm('确定要移除该用户？')) return;
                        removeFromBlacklist(username);
                        tr.remove();
                        highlightBlacklisted(username);
                        if (!tbody.children.length) {
                            table.remove();
                            const empty = document.createElement('div');
                            empty.textContent = '暂无黑名单用户';
                            empty.style.textAlign = 'center';
                            empty.style.color = '#888';
                            empty.style.margin = '18px 0 8px 0';
                            dialog.appendChild(empty);
                        }
                    };
                    tdOp.appendChild(removeBtn);

                    [tdUser, tdRemark, tdTime, tdPage, tdOp].forEach(td => {
                        td.style.padding = '6px 4px';
                        td.style.verticalAlign = 'middle';
                        tr.appendChild(td);
                    });
                    tbody.appendChild(tr);
                });

                dialog.appendChild(table);
                document.body.appendChild(dialog);
                if (typeof makeDraggable === 'function') makeDraggable(dialog, { width: 50, height: 50 });
            }

            return {
                showBlacklistDialog,
                updateBlacklistRemark
            };
        })();
    }

    // 内置关键词过滤功能
