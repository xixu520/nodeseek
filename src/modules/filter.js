    if (!window.NodeSeekFilter) {
        window.NodeSeekFilter = (function () {
            let observer = null;
            let applyTimer = null;
            let lastStats = { hidden: 0, highlighted: 0 };

            function isMobileDevice() {
                return window.innerWidth <= 767;
            }

            function readJson(key, fallback) {
                try {
                    const raw = localStorage.getItem(key);
                    return raw ? JSON.parse(raw) : fallback;
                } catch (e) {
                    return fallback;
                }
            }

            function writeJson(key, value) {
                localStorage.setItem(key, JSON.stringify(value));
            }

            function parseLines(value) {
                return String(value || '')
                    .split(/\n|,/)
                    .map(item => item.trim())
                    .filter(Boolean);
            }

            function uniqueWords(words) {
                const seen = new Set();
                const result = [];
                (words || []).forEach(word => {
                    const value = String(word || '').trim();
                    const key = value.toLowerCase();
                    if (!value || seen.has(key)) return;
                    seen.add(key);
                    result.push(value);
                });
                return result;
            }

            function getSettings() {
                const blockKeywords = uniqueWords([
                    ...readJson('ns-filter-custom-keywords', []),
                    ...readJson('ns-filter-keywords', [])
                ]);
                const highlightKeywords = uniqueWords([
                    ...readJson('ns-filter-highlight-keywords', []),
                    ...readJson('ns-filter-highlight-post-keywords', [])
                ]);
                return {
                    customKeywords: [],
                    displayKeywords: blockKeywords,
                    highlightKeywords: highlightKeywords,
                    highlightPostKeywords: highlightKeywords,
                    highlightAuthorEnabled: readJson('ns-filter-highlight-author-enabled', false),
                    highlightColor: localStorage.getItem('ns-filter-highlight-color') || '#facc15',
                    whitelistUsers: readJson('ns-filter-whitelist-users', [])
                };
            }

            function saveSettings(settings) {
                writeJson('ns-filter-custom-keywords', settings.customKeywords || []);
                writeJson('ns-filter-keywords', settings.displayKeywords || []);
                writeJson('ns-filter-highlight-keywords', settings.highlightKeywords || []);
                writeJson('ns-filter-highlight-post-keywords', settings.highlightPostKeywords || []);
                writeJson('ns-filter-highlight-author-enabled', !!settings.highlightAuthorEnabled);
                localStorage.setItem('ns-filter-highlight-color', settings.highlightColor || '#facc15');
                writeJson('ns-filter-whitelist-users', settings.whitelistUsers || []);
            }

            function textHas(text, words) {
                const source = String(text || '').toLowerCase();
                return (words || []).some(word => source.includes(String(word).toLowerCase()));
            }

            function getAuthorName(node) {
                const author = node.querySelector?.('a.author-name');
                return author ? author.textContent.trim() : '';
            }

            function getContainer(node) {
                return node.closest?.('.nsk-content, article, .card, .post, .topic, .reply, li, tr') || node;
            }

            function isPluginNode(node) {
                return !!node.closest?.('#nodeseek-plugin-main-container, #settings-dialog, #webdav-sync-dialog, #blacklist-dialog, #ns-filter-dialog, #quick-reply-dialog, #logs-dialog, #favorites-dialog, #friends-dialog');
            }

            function isPostCandidate(node) {
                if (!node) return false;
                if (node.matches?.('article, .nsk-content, .card, .post, .topic')) return true;
                if (node.querySelector?.('a[href*="/post"], a[href*="/topic"], a[href*="/discussion"]')) return true;
                return false;
            }

            function getContentCandidates() {
                const nodes = Array.from(document.querySelectorAll('article, .nsk-content, .card, .post, .topic, .reply, li, tr, a[href*="/post"], a[href*="/topic"], a[href*="/discussion"]'));
                const result = [];
                const seen = new Set();
                nodes.forEach(node => {
                    const container = getContainer(node);
                    if (!container || seen.has(container)) return;
                    if (isPluginNode(container)) return;
                    seen.add(container);
                    result.push(container);
                });
                return result;
            }

            function resetCandidate(node) {
                node.style.display = node.getAttribute('data-ns-filter-old-display') || '';
                node.style.backgroundColor = node.getAttribute('data-ns-filter-old-bg') || '';
                node.style.outline = node.getAttribute('data-ns-filter-old-outline') || '';
                node.classList.remove('ns-filter-highlighted');
                node.style.removeProperty('--ns-filter-highlight-color');
                node.removeAttribute('data-ns-filter-hit');
            }

            function applyFilters() {
                const settings = getSettings();
                const hideWords = uniqueWords(settings.displayKeywords);
                const highlightWords = uniqueWords(settings.highlightKeywords);
                const whitelist = new Set((settings.whitelistUsers || []).map(item => String(item).trim()).filter(Boolean));
                let hidden = 0;
                let highlighted = 0;
                const candidates = getContentCandidates();

                candidates.forEach(node => {
                    resetCandidate(node);
                });

                candidates.forEach(node => {
                    const text = node.textContent || '';
                    const author = getAuthorName(node);
                    if (author && whitelist.has(author)) return;

                    if (isPostCandidate(node) && textHas(text, hideWords)) {
                        if (!node.hasAttribute('data-ns-filter-old-display')) node.setAttribute('data-ns-filter-old-display', node.style.display || '');
                        node.style.display = 'none';
                        node.setAttribute('data-ns-filter-hit', 'hidden');
                        hidden += 1;
                    }
                });

                candidates.forEach(node => {
                    if (node.getAttribute('data-ns-filter-hit') === 'hidden') return;
                    const text = node.textContent || '';
                    const author = getAuthorName(node);
                    if (author && whitelist.has(author)) return;
                    const authorMatched = settings.highlightAuthorEnabled && author && textHas(author, highlightWords);
                    if (textHas(text, highlightWords) || authorMatched) {
                        if (!node.hasAttribute('data-ns-filter-old-outline')) node.setAttribute('data-ns-filter-old-outline', node.style.outline || '');
                        node.style.setProperty('--ns-filter-highlight-color', settings.highlightColor || '#facc15');
                        node.classList.add('ns-filter-highlighted');
                        node.setAttribute('data-ns-filter-hit', 'highlighted');
                        highlighted += 1;
                    }
                });

                lastStats = { hidden, highlighted };
                renderHighlightStatsToContainer();
            }

            function scheduleApplyFilters() {
                if (applyTimer) clearTimeout(applyTimer);
                applyTimer = setTimeout(() => {
                    applyTimer = null;
                    applyFilters();
                }, 200);
            }

            function initFilterObserver() {
                applyFilters();
                if (observer) return;
                observer = new MutationObserver(scheduleApplyFilters);
                observer.observe(document.body, { childList: true, subtree: true });
            }

            function renderHighlightStatsToContainer() {
                const box = document.getElementById('ns-highlight-stats-container');
                if (!box) return;
                const detailMode = box.getAttribute('data-ns-filter-detail') === 'true';
                box.innerHTML = '';
                box.style.cursor = 'pointer';
                box.title = detailMode ? '点击返回主面板' : '点击查看过滤选项';
                box.onclick = function () {
                    const next = box.getAttribute('data-ns-filter-detail') !== 'true';
                    box.setAttribute('data-ns-filter-detail', next ? 'true' : 'false');
                    const panel = document.getElementById('nodeseek-plugin-buttons-container');
                    if (panel) {
                        Array.from(panel.children).forEach(child => {
                            if (child !== box) child.style.display = next ? 'none' : '';
                        });
                    }
                    renderHighlightStatsToContainer();
                };

                if (!detailMode) {
                    const text = document.createElement('div');
                    text.style.textAlign = 'center';
                    text.style.padding = '4px';
                    text.style.fontSize = '11px';
                    text.style.color = '#666';
                    text.textContent = '隐藏 ' + lastStats.hidden + '，高亮 ' + lastStats.highlighted;
                    box.appendChild(text);
                    return;
                }

                const header = document.createElement('div');
                header.style.fontSize = '12px';
                header.style.fontWeight = '700';
                header.style.marginBottom = '6px';
                header.textContent = '过滤面板';
                box.appendChild(header);

                const summary = document.createElement('div');
                summary.style.fontSize = '11px';
                summary.style.color = '#666';
                summary.style.marginBottom = '8px';
                summary.textContent = '隐藏 ' + lastStats.hidden + '，高亮 ' + lastStats.highlighted;
                box.appendChild(summary);

                const actions = document.createElement('div');
                actions.style.display = 'grid';
                actions.style.gridTemplateColumns = '1fr';
                actions.style.gap = '6px';
                [
                    ['设置关键词', createFilterUI],
                    ['重新扫描', applyFilters],
                    ['返回主页', function () { box.click(); }]
                ].forEach(item => {
                    const btn = document.createElement('button');
                    btn.textContent = item[0];
                    btn.className = 'blacklist-btn';
                    btn.style.width = '100%';
                    btn.style.background = item[0] === '返回主页' ? '#64748b' : '#2563eb';
                    btn.onclick = function (event) {
                        event.preventDefault();
                        event.stopPropagation();
                        item[1]();
                    };
                    actions.appendChild(btn);
                });
                box.appendChild(actions);
            }

            function createTextArea(value) {
                const textarea = document.createElement('textarea');
                textarea.value = (value || []).join('\n');
                textarea.style.width = '100%';
                textarea.style.minHeight = '70px';
                textarea.style.boxSizing = 'border-box';
                textarea.style.resize = 'vertical';
                return textarea;
            }

            function createFilterUI() {
                const existing = document.getElementById('ns-filter-dialog');
                if (existing) {
                    existing.remove();
                    return;
                }

                const settings = getSettings();
                const dialog = document.createElement('div');
                dialog.id = 'ns-filter-dialog';
                dialog.style.position = 'fixed';
                dialog.style.top = '80px';
                dialog.style.right = '16px';
                dialog.style.zIndex = '10000';
                dialog.style.background = '#fff';
                dialog.style.border = '1px solid #ccc';
                dialog.style.borderRadius = '8px';
                dialog.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)';
                dialog.style.padding = '14px';
                dialog.style.width = isMobileDevice() ? '92%' : '420px';
                dialog.style.maxHeight = '82vh';
                dialog.style.overflow = 'auto';
                dialog.style.boxSizing = 'border-box';

                const header = document.createElement('div');
                header.style.display = 'flex';
                header.style.justifyContent = 'space-between';
                header.style.alignItems = 'center';
                header.style.marginBottom = '10px';
                const title = document.createElement('strong');
                title.textContent = '关键词过滤';
                const closeBtn = document.createElement('button');
                closeBtn.textContent = '×';
                closeBtn.onclick = function () { dialog.remove(); };
                header.appendChild(title);
                header.appendChild(closeBtn);
                dialog.appendChild(header);

                function field(labelText, input) {
                    const label = document.createElement('label');
                    label.style.display = 'block';
                    label.style.marginBottom = '10px';
                    const span = document.createElement('span');
                    span.textContent = labelText;
                    span.style.display = 'block';
                    span.style.fontSize = '12px';
                    span.style.color = '#555';
                    span.style.marginBottom = '4px';
                    label.appendChild(span);
                    label.appendChild(input);
                    return label;
                }

                const hideInput = createTextArea(settings.displayKeywords);
                const highlightInput = createTextArea(settings.highlightKeywords);
                const whitelistInput = createTextArea(settings.whitelistUsers);
                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.value = settings.highlightColor || '#facc15';
                const authorInput = document.createElement('input');
                authorInput.type = 'checkbox';
                authorInput.checked = !!settings.highlightAuthorEnabled;

                dialog.appendChild(field('屏蔽关键词', hideInput));
                dialog.appendChild(field('高亮关键词', highlightInput));
                dialog.appendChild(field('白名单用户名', whitelistInput));
                dialog.appendChild(field('高亮颜色', colorInput));

                const authorLabel = document.createElement('label');
                authorLabel.style.display = 'flex';
                authorLabel.style.alignItems = 'center';
                authorLabel.style.gap = '6px';
                authorLabel.style.marginBottom = '10px';
                authorLabel.appendChild(authorInput);
                const authorText = document.createElement('span');
                authorText.textContent = '匹配作者名';
                authorLabel.appendChild(authorText);
                dialog.appendChild(authorLabel);

                const row = document.createElement('div');
                row.style.display = 'flex';
                row.style.gap = '8px';
                const saveBtn = document.createElement('button');
                saveBtn.textContent = '保存';
                saveBtn.className = 'blacklist-btn';
                saveBtn.style.flex = '1';
                const clearBtn = document.createElement('button');
                clearBtn.textContent = '清空';
                clearBtn.className = 'blacklist-btn red';
                clearBtn.style.flex = '1';

                saveBtn.onclick = function () {
                    const blockKeywords = uniqueWords(parseLines(hideInput.value));
                    const highlightKeywords = uniqueWords(parseLines(highlightInput.value));
                    saveSettings({
                        customKeywords: [],
                        displayKeywords: blockKeywords,
                        highlightKeywords: highlightKeywords,
                        highlightPostKeywords: highlightKeywords,
                        highlightAuthorEnabled: authorInput.checked,
                        highlightColor: colorInput.value,
                        whitelistUsers: parseLines(whitelistInput.value)
                    });
                    applyFilters();
                    addLog('关键词过滤：已保存');
                    alert('关键词过滤已保存');
                };

                clearBtn.onclick = function () {
                    if (!confirm('确定要清空关键词过滤设置？')) return;
                    saveSettings({
                        customKeywords: [],
                        displayKeywords: [],
                        highlightKeywords: [],
                        highlightPostKeywords: [],
                        highlightAuthorEnabled: false,
                        highlightColor: '#facc15',
                        whitelistUsers: []
                    });
                    hideInput.value = '';
                    highlightInput.value = '';
                    whitelistInput.value = '';
                    authorInput.checked = false;
                    colorInput.value = '#facc15';
                    applyFilters();
                    addLog('关键词过滤：已清空');
                };

                row.appendChild(saveBtn);
                row.appendChild(clearBtn);
                dialog.appendChild(row);
                document.body.appendChild(dialog);
                if (typeof makeDraggable === 'function') makeDraggable(dialog, { width: 50, height: 50 });
            }

            return {
                isMobileDevice,
                createFilterUI,
                initFilterObserver,
                renderHighlightStatsToContainer,
                applyFilters
            };
        })();
    }
