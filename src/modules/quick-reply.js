    // 内置快捷回复功能
    if (!window.NodeSeekQuickReply) {
        window.NodeSeekQuickReply = (function () {
            function normalizeReplies(value) {
                if (Array.isArray(value)) {
                    const result = {};
                    value.forEach((item, index) => {
                        if (typeof item === 'string') result['回复' + (index + 1)] = item;
                        else if (item && typeof item === 'object') result[item.title || item.name || ('回复' + (index + 1))] = item.content || item.text || '';
                    });
                    return result;
                }
                return value && typeof value === 'object' ? value : {};
            }

            function getQuickReplies() {
                try {
                    return normalizeReplies(JSON.parse(nsLocalStorage.getItem('nodeseek_quick_reply') || '{}'));
                } catch (e) {
                    return {};
                }
            }

            function setQuickReplies(replies) {
                nsLocalStorage.setItem('nodeseek_quick_reply', JSON.stringify(normalizeReplies(replies)));
            }

            function getAutoSubmit() {
                return nsLocalStorage.getItem('nodeseek_quick_reply_auto_submit') === 'true';
            }

            function setAutoSubmit(value) {
                nsLocalStorage.setItem('nodeseek_quick_reply_auto_submit', value ? 'true' : 'false');
            }

            function getLastUsed() {
                try {
                    return JSON.parse(nsLocalStorage.getItem('nodeseek_quick_reply_last_used') || '{}');
                } catch (e) {
                    return {};
                }
            }

            function setLastUsed(title) {
                const data = getLastUsed();
                data[title] = Date.now();
                nsLocalStorage.setItem('nodeseek_quick_reply_last_used', JSON.stringify(data));
            }

            function getSelectedShortcutKeys() {
                try {
                    const value = JSON.parse(nsLocalStorage.getItem('nodeseek_quick_reply_shortcuts') || '[]');
                    return Array.isArray(value) ? value.filter(Boolean) : [];
                } catch (e) {
                    return [];
                }
            }

            function setSelectedShortcutKeys(keys) {
                const seen = new Set();
                const next = [];
                (keys || []).forEach(key => {
                    if (!key || seen.has(key)) return;
                    seen.add(key);
                    next.push(key);
                });
                nsLocalStorage.setItem('nodeseek_quick_reply_shortcuts', JSON.stringify(next));
                if (window.NodeSeekCollapsedActions && typeof window.NodeSeekCollapsedActions.refresh === 'function') {
                    window.NodeSeekCollapsedActions.refresh();
                }
            }

            function getSelectedShortcuts() {
                const replies = getQuickReplies();
                return getSelectedShortcutKeys()
                    .filter(key => Object.prototype.hasOwnProperty.call(replies, key))
                    .map(key => ({ key, title: key, text: replies[key] }));
            }

            function setShortcutSelected(key, selected) {
                const keys = getSelectedShortcutKeys().filter(item => item !== key);
                if (selected) keys.push(key);
                setSelectedShortcutKeys(keys);
            }

            function makeReplyTitle(text, replies, oldKey) {
                const firstLine = String(text || '').split(/\n/).map(item => item.trim()).find(Boolean) || '快捷回复';
                const base = firstLine.length > 28 ? firstLine.slice(0, 28) + '…' : firstLine;
                if (oldKey && oldKey === base) return base;
                if (!replies[base] || base === oldKey) return base;
                let index = 2;
                let next = base + ' ' + index;
                while (replies[next] && next !== oldKey) {
                    index += 1;
                    next = base + ' ' + index;
                }
                return next;
            }

            function clickSubmitButton() {
                const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]')).filter(btn => {
                    return !(typeof isNsPluginElement === 'function' && isNsPluginElement(btn));
                });
                const submit = buttons.find(btn => {
                    const text = (btn.textContent || btn.value || '').trim();
                    return /回复|提交|发送|评论|发布/.test(text);
                });
                if (submit) {
                    submit.click();
                    setTimeout(function () {
                        if (typeof ensurePluginControlPanel === 'function') ensurePluginControlPanel();
                    }, 500);
                }
            }

            function insertReply(text) {
                if (!text) return false;
                let inserted = false;
                if (typeof insertTextToNodeSeekEditor === 'function') {
                    inserted = insertTextToNodeSeekEditor(text);
                }
                if (!inserted) {
                    const target = typeof findNodeSeekEditor === 'function'
                        ? findNodeSeekEditor()
                        : document.querySelector('textarea, [contenteditable="true"], .ProseMirror');
                    if (!target) {
                        alert('未找到输入框');
                        return false;
                    }
                    if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
                        const start = target.selectionStart || 0;
                        const end = target.selectionEnd || 0;
                        const value = target.value || '';
                        if (typeof setNativeTextareaValue === 'function') setNativeTextareaValue(target, value.slice(0, start) + text + value.slice(end));
                        else target.value = value.slice(0, start) + text + value.slice(end);
                        target.selectionStart = target.selectionEnd = start + text.length;
                        if (typeof dispatchEditorInput === 'function') dispatchEditorInput(target, text);
                        else target.dispatchEvent(new Event('input', { bubbles: true }));
                    } else {
                        if (typeof insertTextIntoRichEditor === 'function') insertTextIntoRichEditor(target, text);
                        else {
                            target.focus();
                            target.textContent = (target.textContent || '') + text;
                            target.dispatchEvent(new Event('input', { bubbles: true }));
                        }
                    }
                    inserted = true;
                }
                if (inserted && getAutoSubmit()) setTimeout(clickSubmitButton, 300);
                setTimeout(function () {
                    if (typeof ensurePluginControlPanel === 'function') ensurePluginControlPanel();
                }, 800);
                return inserted;
            }

            function insertReplyByKey(key) {
                const replies = getQuickReplies();
                if (!Object.prototype.hasOwnProperty.call(replies, key)) return false;
                const ok = insertReply(replies[key]);
                if (ok) setLastUsed(key);
                return ok;
            }

            function bindEditorButton() {
                const editor = typeof findNodeSeekEditor === 'function'
                    ? findNodeSeekEditor()
                    : document.querySelector('.editor-textarea, .ProseMirror, textarea[name="content"], textarea');
                if (!editor) return;
                const host = editor.closest('form, .editor, .reply, .comment, .post-editor, .vditor, .mde, .markdown-editor, .w-e-text-container, .ql-container, .tox-tinymce, [class*="editor"], [class*="reply"], [class*="comment"]') || editor.parentElement;
                if (!host || host.querySelector('.ns-quick-reply-entry')) return;
                let toolbar = host.querySelector('.toolbar, .editor-toolbar, .vditor-toolbar, .mde-toolbar, .bytemd-toolbar, .w-e-toolbar, .ql-toolbar, .tox-toolbar, [class*="toolbar"]');
                if (!toolbar && host.previousElementSibling && /toolbar|w-e-toolbar|ql-toolbar/i.test(host.previousElementSibling.className || '')) {
                    toolbar = host.previousElementSibling;
                }
                if (!toolbar && host.parentElement) {
                    toolbar = host.parentElement.querySelector('.toolbar, .editor-toolbar, .vditor-toolbar, .mde-toolbar, .bytemd-toolbar, .w-e-toolbar, .ql-toolbar, .tox-toolbar, [class*="toolbar"]');
                }
                const mount = toolbar || host;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'ns-quick-reply-entry';
                btn.textContent = '快捷回复';
                btn.style.margin = '6px 6px 6px 0';
                btn.style.padding = '4px 10px';
                btn.style.border = '1px solid rgba(15,23,42,.12)';
                btn.style.borderRadius = '6px';
                btn.style.background = '#2563eb';
                btn.style.color = '#fff';
                btn.style.cursor = 'pointer';
                btn.style.fontSize = '12px';
                btn.onclick = function () {
                    showQuickReplyDialog();
                };
                if (toolbar) mount.appendChild(btn);
                else host.insertBefore(btn, host.firstChild);
            }

            function showQuickReplyDialog() {
                const existing = document.getElementById('quick-reply-dialog');
                if (existing) {
                    existing.remove();
                    return;
                }

                const dialog = document.createElement('div');
                dialog.id = 'quick-reply-dialog';
                dialog.style.position = 'fixed';
                dialog.style.top = '80px';
                dialog.style.right = '16px';
                dialog.style.zIndex = '10000';
                dialog.style.background = '#fff';
                dialog.style.border = '1px solid #ccc';
                dialog.style.borderRadius = '8px';
                dialog.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)';
                dialog.style.padding = '14px';
                dialog.style.width = window.innerWidth <= 767 ? '92%' : '430px';
                dialog.style.maxHeight = '82vh';
                dialog.style.overflow = 'auto';
                dialog.style.boxSizing = 'border-box';

                const header = document.createElement('div');
                header.style.display = 'flex';
                header.style.justifyContent = 'space-between';
                header.style.alignItems = 'center';
                header.style.marginBottom = '10px';
                const title = document.createElement('strong');
                title.textContent = '快捷回复';
                const closeBtn = document.createElement('button');
                closeBtn.textContent = '×';
                closeBtn.onclick = function () { dialog.remove(); };
                header.appendChild(title);
                header.appendChild(closeBtn);
                dialog.appendChild(header);

                const listBox = document.createElement('div');
                dialog.appendChild(listBox);

                const searchInput = document.createElement('input');
                searchInput.placeholder = '搜索回复内容';
                searchInput.style.width = '100%';
                searchInput.style.boxSizing = 'border-box';
                searchInput.style.marginBottom = '8px';
                searchInput.style.padding = '6px';
                dialog.insertBefore(searchInput, listBox);

                const form = document.createElement('div');
                form.style.marginTop = '10px';
                form.style.borderTop = '1px solid #eee';
                form.style.paddingTop = '10px';

                let editingKey = '';

                const textInput = document.createElement('textarea');
                textInput.placeholder = '回复内容';
                textInput.style.width = '100%';
                textInput.style.minHeight = '80px';
                textInput.style.boxSizing = 'border-box';
                textInput.style.resize = 'vertical';
                textInput.style.marginBottom = '6px';
                textInput.style.padding = '6px';

                const autoLabel = document.createElement('label');
                autoLabel.style.display = 'flex';
                autoLabel.style.alignItems = 'center';
                autoLabel.style.gap = '6px';
                autoLabel.style.marginBottom = '8px';
                const autoInput = document.createElement('input');
                autoInput.type = 'checkbox';
                autoInput.checked = getAutoSubmit();
                autoInput.onchange = function () { setAutoSubmit(autoInput.checked); };
                autoLabel.appendChild(autoInput);
                const autoText = document.createElement('span');
                autoText.textContent = '插入后自动提交';
                autoLabel.appendChild(autoText);

                const saveBtn = document.createElement('button');
                saveBtn.textContent = '保存回复';
                saveBtn.className = 'blacklist-btn';
                saveBtn.style.width = '100%';

                function renderList() {
                    const replies = getQuickReplies();
                    const lastUsed = getLastUsed();
                    const selectedKeys = new Set(getSelectedShortcutKeys());
                    const keyword = (searchInput.value || '').trim().toLowerCase();
                    const keys = Object.keys(replies)
                        .filter(key => {
                            const text = (key + '\n' + replies[key]).toLowerCase();
                            return !keyword || text.includes(keyword);
                        })
                        .sort((a, b) => (lastUsed[b] || 0) - (lastUsed[a] || 0));
                    listBox.innerHTML = '';
                    if (!keys.length) {
                        const empty = document.createElement('div');
                        empty.textContent = '暂无快捷回复';
                        empty.style.color = '#888';
                        empty.style.textAlign = 'center';
                        empty.style.padding = '12px 0';
                        listBox.appendChild(empty);
                        return;
                    }
                    keys.forEach(key => {
                        const row = document.createElement('div');
                        row.style.display = 'grid';
                        row.style.gridTemplateColumns = '1fr auto auto auto auto';
                        row.style.gap = '6px';
                        row.style.alignItems = 'center';
                        row.style.borderBottom = '1px solid #eee';
                        row.style.padding = '6px 0';

                        const name = document.createElement('div');
                        const firstLine = String(replies[key] || '').split(/\n/).map(item => item.trim()).find(Boolean);
                        name.textContent = firstLine || key;
                        name.title = replies[key];
                        name.style.overflow = 'hidden';
                        name.style.textOverflow = 'ellipsis';
                        name.style.whiteSpace = 'nowrap';

                        const shortcutCheck = document.createElement('input');
                        shortcutCheck.type = 'checkbox';
                        shortcutCheck.title = '显示到最小化按钮';
                        shortcutCheck.checked = selectedKeys.has(key);
                        shortcutCheck.onclick = function (event) {
                            event.stopPropagation();
                        };
                        shortcutCheck.onchange = function () {
                            setShortcutSelected(key, shortcutCheck.checked);
                        };

                        const useBtn = document.createElement('button');
                        useBtn.textContent = '插入';
                        useBtn.className = 'blacklist-btn';
                        useBtn.onclick = function () {
                            if (insertReply(replies[key])) setLastUsed(key);
                        };

                        const editBtn = document.createElement('button');
                        editBtn.textContent = '编辑';
                        editBtn.className = 'blacklist-btn';
                        editBtn.onclick = function () {
                            editingKey = key;
                            textInput.value = replies[key];
                            textInput.focus();
                        };

                        const delBtn = document.createElement('button');
                        delBtn.textContent = '删除';
                        delBtn.className = 'blacklist-btn red';
                        delBtn.onclick = function () {
                            if (!confirm('确定要删除该回复？')) return;
                            const next = getQuickReplies();
                            delete next[key];
                            setQuickReplies(next);
                            setSelectedShortcutKeys(getSelectedShortcutKeys().filter(item => item !== key));
                            renderList();
                        };

                        row.appendChild(name);
                        row.appendChild(shortcutCheck);
                        row.appendChild(useBtn);
                        row.appendChild(editBtn);
                        row.appendChild(delBtn);
                        listBox.appendChild(row);
                    });
                }

                saveBtn.onclick = function () {
                    const value = textInput.value;
                    if (!value.trim()) {
                        alert('请填写回复内容');
                        return;
                    }
                    const replies = getQuickReplies();
                    const key = makeReplyTitle(value, replies, editingKey);
                    if (editingKey && editingKey !== key) {
                        delete replies[editingKey];
                        const shortcutKeys = getSelectedShortcutKeys();
                        if (shortcutKeys.includes(editingKey)) {
                            setSelectedShortcutKeys(shortcutKeys.map(item => item === editingKey ? key : item));
                        }
                    }
                    replies[key] = value;
                    setQuickReplies(replies);
                    editingKey = '';
                    textInput.value = '';
                    renderList();
                    addLog('快捷回复：已保存');
                };

                searchInput.oninput = renderList;

                form.appendChild(textInput);
                form.appendChild(autoLabel);
                form.appendChild(saveBtn);
                dialog.appendChild(form);

                renderList();
                document.body.appendChild(dialog);
                if (typeof makeDraggable === 'function') makeDraggable(dialog, { width: 50, height: 50 });
            }

            return {
                getQuickReplies,
                setQuickReplies,
                showQuickReplyDialog,
                insertReply,
                insertReplyByKey,
                getSelectedShortcuts,
                bindEditorButton
            };
        })();
        setTimeout(function () {
            if (window.NodeSeekCollapsedActions && typeof window.NodeSeekCollapsedActions.refresh === 'function') {
                window.NodeSeekCollapsedActions.refresh();
            }
        }, 0);
    }
