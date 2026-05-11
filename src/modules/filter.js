    if (!window.NodeSeekFilter) {
        window.NodeSeekFilter = (function () {
            let observer = null;
            let applyTimer = null;
            let lastStats = { hidden: 0, highlighted: 0 };

            const TOKEN_COLORS = ['#22c55e', '#14b8a6', '#38bdf8', '#8b5cf6', '#f97316', '#ec4899', '#64748b'];
            const PLUGIN_SELECTOR = '#nodeseek-plugin-main-container, #settings-dialog, #webdav-sync-dialog, #blacklist-dialog, #ns-filter-dialog, #quick-reply-dialog, #logs-dialog, #favorites-dialog, #friends-dialog';
            const TITLE_SELECTORS = [
                'a.post-title',
                '.post-title a',
                '.topic-title',
                '.topic-title a',
                '.article-title',
                '.article-title a',
                '.thread-title',
                '.thread-title a',
                '.content-title',
                '.content-title a',
                'h1',
                'h2 a[href*="/post-"]',
                'h3 a[href*="/post-"]',
                'a[href*="/post-"][class*="title"]',
                'a[href*="/topic/"][class*="title"]',
                'a[href*="/article/"][class*="title"]'
            ];

            function isMobileDevice() {
                return window.innerWidth <= 767;
            }

            function parseLines(value) {
                return String(value || '')
                    .split(/\n|,|，/)
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

            function readWords(key) {
                const raw = localStorage.getItem(key);
                if (!raw) return [];
                try {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) return uniqueWords(parsed);
                    if (typeof parsed === 'string') return uniqueWords(parseLines(parsed));
                } catch (e) { }
                return uniqueWords(parseLines(raw));
            }

            function readBool(key, fallback) {
                const raw = localStorage.getItem(key);
                if (raw === null) return fallback;
                try {
                    return !!JSON.parse(raw);
                } catch (e) {
                    return raw === 'true';
                }
            }

            function writeJson(key, value) {
                localStorage.setItem(key, JSON.stringify(value));
            }

            function getSettings() {
                const displayKeywords = uniqueWords([
                    ...readWords('ns-filter-custom-keywords'),
                    ...readWords('ns-filter-keywords')
                ]);
                const highlightKeywords = uniqueWords([
                    ...readWords('ns-filter-highlight-keywords'),
                    ...readWords('ns-filter-highlight-post-keywords')
                ]);
                return {
                    customKeywords: [],
                    displayKeywords,
                    highlightKeywords,
                    highlightPostKeywords: highlightKeywords,
                    highlightAuthorEnabled: readBool('ns-filter-highlight-author-enabled', false),
                    highlightColor: localStorage.getItem('ns-filter-highlight-color') || '#38bdf8',
                    whitelistUsers: readWords('ns-filter-whitelist-users')
                };
            }

            function saveSettings(settings) {
                const displayKeywords = uniqueWords(settings.displayKeywords || []);
                const highlightKeywords = uniqueWords(settings.highlightKeywords || []);
                writeJson('ns-filter-custom-keywords', []);
                writeJson('ns-filter-keywords', displayKeywords);
                writeJson('ns-filter-highlight-keywords', highlightKeywords);
                writeJson('ns-filter-highlight-post-keywords', highlightKeywords);
                writeJson('ns-filter-highlight-author-enabled', !!settings.highlightAuthorEnabled);
                localStorage.setItem('ns-filter-highlight-color', settings.highlightColor || '#38bdf8');
                writeJson('ns-filter-whitelist-users', uniqueWords(settings.whitelistUsers || []));
            }

            function textHas(text, words) {
                const source = String(text || '').toLowerCase();
                return (words || []).some(word => source.includes(String(word).toLowerCase()));
            }

            function isPluginNode(node) {
                return !!node.closest?.(PLUGIN_SELECTOR);
            }

            function getAuthorName(node) {
                const author = node.querySelector?.('a.author-name');
                return author ? author.textContent.trim() : '';
            }

            function getContainer(node) {
                return node.closest?.('article, .nsk-content, .card, .post, .topic, .reply, li, tr') || node;
            }

            function getContentCandidates() {
                const nodes = Array.from(document.querySelectorAll('article, .nsk-content, .card, .post, .topic, .reply, li, tr, a[href*="/post"], a[href*="/topic"], a[href*="/article"]'));
                const result = [];
                const seen = new Set();
                nodes.forEach(node => {
                    const container = getContainer(node);
                    if (!container || seen.has(container) || isPluginNode(container)) return;
                    seen.add(container);
                    result.push(container);
                });
                return result;
            }

            function getTitleElements() {
                const titles = [];
                const seen = new Set();
                TITLE_SELECTORS.forEach(selector => {
                    document.querySelectorAll(selector).forEach(node => {
                        if (!node || seen.has(node) || isPluginNode(node)) return;
                        const text = (node.textContent || '').trim();
                        if (!text || text === 'NodeSeek') return;
                        seen.add(node);
                        titles.push(node);
                    });
                });
                return titles;
            }

            function resetFilters() {
                document.querySelectorAll('[data-ns-filter-hit]').forEach(node => {
                    node.style.display = node.getAttribute('data-ns-filter-old-display') || '';
                    node.removeAttribute('data-ns-filter-hit');
                });
                document.querySelectorAll('.ns-filter-highlighted').forEach(node => {
                    node.classList.remove('ns-filter-highlighted');
                    node.style.removeProperty('--ns-filter-highlight-color');
                });
            }

            function applyFilters() {
                const settings = getSettings();
                const hideWords = uniqueWords(settings.displayKeywords);
                const highlightWords = uniqueWords(settings.highlightKeywords);
                const whitelist = new Set(uniqueWords(settings.whitelistUsers).map(name => name.toLowerCase()));
                let hidden = 0;
                let highlighted = 0;

                resetFilters();

                getContentCandidates().forEach(node => {
                    const author = getAuthorName(node).toLowerCase();
                    if (author && whitelist.has(author)) return;
                    if (textHas(node.textContent || '', hideWords)) {
                        if (!node.hasAttribute('data-ns-filter-old-display')) {
                            node.setAttribute('data-ns-filter-old-display', node.style.display || '');
                        }
                        node.style.display = 'none';
                        node.setAttribute('data-ns-filter-hit', 'hidden');
                        hidden += 1;
                    }
                });

                getTitleElements().forEach(node => {
                    const container = getContainer(node);
                    if (container?.getAttribute('data-ns-filter-hit') === 'hidden') return;
                    const author = container ? getAuthorName(container).toLowerCase() : '';
                    if (author && whitelist.has(author)) return;
                    const authorMatched = settings.highlightAuthorEnabled && author && textHas(author, highlightWords);
                    if (textHas(node.textContent || '', highlightWords) || authorMatched) {
                        node.style.setProperty('--ns-filter-highlight-color', settings.highlightColor || '#38bdf8');
                        node.classList.add('ns-filter-highlighted');
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

            function colorForWord(word, index) {
                const text = String(word || '');
                let hash = index;
                for (let i = 0; i < text.length; i++) {
                    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
                }
                return TOKEN_COLORS[Math.abs(hash) % TOKEN_COLORS.length];
            }

            function createTagInput(values, tone) {
                let items = uniqueWords(values || []);
                const wrap = document.createElement('div');
                wrap.className = 'ns-filter-token-field ns-filter-token-field-' + tone;

                const list = document.createElement('div');
                list.className = 'ns-filter-token-list';

                const input = document.createElement('input');
                input.type = 'text';
                input.className = 'ns-filter-token-input';
                input.placeholder = '输入后按回车';
                input.autocomplete = 'off';
                input.spellcheck = false;

                function render() {
                    list.innerHTML = '';
                    items.forEach((word, index) => {
                        const chip = document.createElement('span');
                        chip.className = 'ns-filter-chip ns-filter-chip-' + tone;
                        chip.style.setProperty('--ns-chip-bg', colorForWord(word, index));
                        chip.style.setProperty('--ns-chip-fg', '#ffffff');
                        chip.title = word;

                        const text = document.createElement('span');
                        text.className = 'ns-filter-chip-text';
                        text.textContent = word;
                        chip.appendChild(text);

                        const close = document.createElement('button');
                        close.type = 'button';
                        close.className = 'ns-filter-chip-close';
                        close.textContent = '×';
                        close.title = '删除';
                        close.onclick = function (event) {
                            event.preventDefault();
                            event.stopPropagation();
                            items.splice(index, 1);
                            render();
                            input.focus();
                        };
                        chip.appendChild(close);
                        list.appendChild(chip);
                    });
                    list.appendChild(input);
                }

                function addFromText(text) {
                    const next = uniqueWords(items.concat(parseLines(text)));
                    items = next;
                    input.value = '';
                    render();
                    input.focus();
                }

                input.addEventListener('keydown', function (event) {
                    if (event.key === 'Enter' || event.key === ',') {
                        event.preventDefault();
                        event.stopPropagation();
                        addFromText(input.value);
                    } else if (event.key === 'Backspace' && !input.value && items.length) {
                        event.stopPropagation();
                        items.pop();
                        render();
                    }
                });
                input.addEventListener('pointerdown', event => event.stopPropagation());
                input.addEventListener('mousedown', event => event.stopPropagation());
                input.addEventListener('click', event => event.stopPropagation());
                input.addEventListener('paste', function () {
                    setTimeout(function () {
                        if (/\n|,|，/.test(input.value)) addFromText(input.value);
                    }, 0);
                });
                input.addEventListener('blur', function () {
                    if (input.value.trim()) addFromText(input.value);
                });

                wrap.onclick = function (event) {
                    if (event.target?.closest?.('.ns-filter-chip-close')) return;
                    input.focus();
                };
                wrap.getValues = function () {
                    if (input.value.trim()) addFromText(input.value);
                    return uniqueWords(items);
                };
                wrap.setValues = function (nextValues) {
                    items = uniqueWords(nextValues || []);
                    input.value = '';
                    render();
                };
                wrap.appendChild(list);
                render();
                return wrap;
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
                dialog.className = 'ns-filter-dialog';
                dialog.style.position = 'fixed';
                dialog.style.top = isMobileDevice() ? '12px' : '80px';
                dialog.style.right = isMobileDevice() ? '10px' : '16px';
                dialog.style.left = isMobileDevice() ? '10px' : 'auto';
                dialog.style.zIndex = '10000';
                dialog.style.padding = isMobileDevice() ? '10px' : '12px';
                dialog.style.width = isMobileDevice() ? 'auto' : '380px';
                dialog.style.maxWidth = 'calc(100vw - 20px)';
                dialog.style.maxHeight = isMobileDevice() ? '74vh' : '78vh';
                dialog.style.overflow = 'auto';
                dialog.style.boxSizing = 'border-box';

                const header = document.createElement('div');
                header.className = 'ns-filter-dialog-header';
                const title = document.createElement('strong');
                title.textContent = '关键词过滤';
                const closeBtn = document.createElement('button');
                closeBtn.type = 'button';
                closeBtn.className = 'ns-filter-dialog-close';
                closeBtn.textContent = '×';
                closeBtn.onclick = function () { dialog.remove(); };
                header.appendChild(title);
                header.appendChild(closeBtn);
                dialog.appendChild(header);

                function field(labelText, control) {
                    const block = document.createElement('div');
                    block.className = 'ns-filter-field';
                    const label = document.createElement('div');
                    label.className = 'ns-filter-field-label';
                    label.textContent = labelText;
                    block.appendChild(label);
                    block.appendChild(control);
                    return block;
                }

                const hideInput = createTagInput(settings.displayKeywords, 'hide');
                const highlightInput = createTagInput(settings.highlightKeywords, 'highlight');
                const whitelistInput = createTagInput(settings.whitelistUsers, 'allow');
                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.className = 'ns-filter-color-input';
                colorInput.value = settings.highlightColor || '#38bdf8';
                const authorInput = document.createElement('input');
                authorInput.type = 'checkbox';
                authorInput.checked = !!settings.highlightAuthorEnabled;

                dialog.appendChild(field('屏蔽关键词', hideInput));
                dialog.appendChild(field('高亮关键词', highlightInput));
                dialog.appendChild(field('白名单用户名', whitelistInput));
                dialog.appendChild(field('高亮颜色', colorInput));

                const authorLabel = document.createElement('label');
                authorLabel.className = 'ns-filter-check-row';
                authorLabel.appendChild(authorInput);
                const authorText = document.createElement('span');
                authorText.textContent = '匹配作者名';
                authorLabel.appendChild(authorText);
                dialog.appendChild(authorLabel);

                const row = document.createElement('div');
                row.className = 'ns-filter-actions';
                const saveBtn = document.createElement('button');
                saveBtn.type = 'button';
                saveBtn.textContent = '保存';
                saveBtn.className = 'blacklist-btn ns-filter-save';
                const clearBtn = document.createElement('button');
                clearBtn.type = 'button';
                clearBtn.textContent = '清空';
                clearBtn.className = 'blacklist-btn red ns-filter-clear';

                saveBtn.onclick = function () {
                    const blockKeywords = hideInput.getValues();
                    const highlightKeywords = highlightInput.getValues();
                    saveSettings({
                        displayKeywords: blockKeywords,
                        highlightKeywords: highlightKeywords,
                        highlightPostKeywords: highlightKeywords,
                        highlightAuthorEnabled: authorInput.checked,
                        highlightColor: colorInput.value,
                        whitelistUsers: whitelistInput.getValues()
                    });
                    applyFilters();
                    addLog('关键词过滤：已保存');
                    alert('关键词过滤已保存');
                };

                clearBtn.onclick = function () {
                    if (!confirm('确定要清空关键词过滤设置？')) return;
                    saveSettings({
                        displayKeywords: [],
                        highlightKeywords: [],
                        highlightPostKeywords: [],
                        highlightAuthorEnabled: false,
                        highlightColor: '#38bdf8',
                        whitelistUsers: []
                    });
                    hideInput.setValues([]);
                    highlightInput.setValues([]);
                    whitelistInput.setValues([]);
                    authorInput.checked = false;
                    colorInput.value = '#38bdf8';
                    applyFilters();
                    addLog('关键词过滤：已清空');
                };

                row.appendChild(saveBtn);
                row.appendChild(clearBtn);
                dialog.appendChild(row);
                document.body.appendChild(dialog);
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
