    // Safari 下 GM_xmlhttpRequest 上传 FormData 容易失败，这里提供同域页面可用的备用图床面板。
    function isSafariBrowser() {
        const ua = navigator.userAgent || '';
        const vendor = navigator.vendor || '';
        return (/Safari/i.test(ua) && /Apple/i.test(vendor) && !/Chrome|CriOS|FxiOS|Edg|OPR/i.test(ua)) || /iPad|iPhone|iPod/i.test(ua);
    }

    function getSafariNodeImageApiKey() {
        try {
            if (typeof GM_getValue === 'function') {
                const value = GM_getValue('ns_nodeimage_api_key', '');
                if (value != null && String(value).trim()) return String(value).trim();
            }
        } catch (e) { }
        try {
            const oldValue = localStorage.getItem('ns_nodeimage_api_key') || '';
            if (oldValue && typeof GM_setValue === 'function') GM_setValue('ns_nodeimage_api_key', oldValue);
            localStorage.removeItem('ns_nodeimage_api_key');
            return oldValue;
        } catch (e2) {
            return '';
        }
    }

    function setSafariNodeImageApiKey(value) {
        const key = (value || '').trim();
        try {
            localStorage.removeItem('ns_nodeimage_api_key');
        } catch (e) { }
        try {
            if (typeof GM_setValue === 'function' && key) GM_setValue('ns_nodeimage_api_key', key);
            if (typeof GM_deleteValue === 'function' && !key) GM_deleteValue('ns_nodeimage_api_key');
        } catch (e2) { }
    }

    function extractSafariNodeImageApiKeyFromJson(body) {
        if (!body || typeof body !== 'object') return '';
        if (typeof body.api_key === 'string' && body.api_key.trim()) return body.api_key.trim();
        if (typeof body.apiKey === 'string' && body.apiKey.trim()) return body.apiKey.trim();
        if (body.data && typeof body.data === 'object') {
            if (typeof body.data.api_key === 'string' && body.data.api_key.trim()) return body.data.api_key.trim();
            if (typeof body.data.apiKey === 'string' && body.data.apiKey.trim()) return body.data.apiKey.trim();
        }
        return '';
    }

    function extractSafariNodeImageApiKeyFromHtml(html) {
        if (typeof html !== 'string' || !html) return '';
        let match = html.match(/id\s*=\s*["']apiKeyInput["'][^>]*\svalue\s*=\s*["']([^"']+)["']/i);
        if (match && match[1]) return match[1].trim();
        match = html.match(/value\s*=\s*["']([a-fA-F0-9]{48,})["'][^>]*\s*id\s*=\s*["']apiKeyInput["']/i);
        if (match && match[1]) return match[1].trim();
        return '';
    }

    function fetchSafariNodeImageApiKey() {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== 'function') {
                reject(new Error('当前环境不支持自动获取'));
                return;
            }

            const pages = [
                { url: 'https://www.nodeimage.com/api/user/api-key', json: true },
                { url: 'https://api.nodeimage.com/api/user/api-key', json: true },
                { url: 'https://www.nodeimage.com/', json: false }
            ];

            function readMessage(text, asJson) {
                if (!asJson || !text) return '';
                try {
                    const body = JSON.parse(text);
                    return body && body.message ? String(body.message) : '';
                } catch (e) {
                    return '';
                }
            }

            function requestAt(index, lastMessage) {
                if (index >= pages.length) {
                    reject(new Error(lastMessage || '未获取到 API Key，请确认已登录 nodeimage.com'));
                    return;
                }

                const page = pages[index];
                GM_xmlhttpRequest({
                    method: 'GET',
                    url: page.url,
                    headers: {
                        Referer: 'https://www.nodeimage.com/',
                        Accept: page.json ? 'application/json' : 'text/html,*/*'
                    },
                    timeout: 20000,
                    anonymous: false,
                    onload: function (response) {
                        const text = response.responseText || '';
                        let key = '';
                        if (page.json) {
                            try {
                                key = extractSafariNodeImageApiKeyFromJson(text ? JSON.parse(text) : null);
                            } catch (e) {
                                key = '';
                            }
                        } else {
                            key = extractSafariNodeImageApiKeyFromHtml(text);
                        }

                        if (key) {
                            resolve(key);
                            return;
                        }

                        requestAt(index + 1, readMessage(text, page.json) || lastMessage);
                    },
                    onerror: function () {
                        requestAt(index + 1, lastMessage);
                    },
                    ontimeout: function () {
                        requestAt(index + 1, lastMessage);
                    }
                });
            }

            requestAt(0, '');
        });
    }

    function collectNodeImageUrls(value, result) {
        result = result || [];
        if (!value) return result;
        if (typeof value === 'string') {
            if (/^https?:\/\//i.test(value)) result.push(value);
            return result;
        }
        if (Array.isArray(value)) {
            value.forEach(item => collectNodeImageUrls(item, result));
            return result;
        }
        if (typeof value === 'object') {
            Object.keys(value).forEach(key => collectNodeImageUrls(value[key], result));
        }
        return result;
    }

    function setNativeTextareaValue(textarea, value) {
        const proto = Object.getPrototypeOf(textarea);
        const descriptor = proto ? Object.getOwnPropertyDescriptor(proto, 'value') : null;
        if (descriptor && descriptor.set) descriptor.set.call(textarea, value);
        else textarea.value = value;
    }

    function isNsPluginElement(node) {
        return !!(node && node.closest && node.closest(
            '#nodeseek-plugin-main-container, #settings-dialog, #webdav-sync-dialog, #blacklist-dialog, #ns-filter-dialog, #quick-reply-dialog, #logs-dialog, #favorites-dialog, #friends-dialog, #nodeimage-dialog, .ns-modal, .ns-dialog'
        ));
    }

    function isVisibleElement(node) {
        if (!node || !node.ownerDocument || isNsPluginElement(node)) return false;
        const style = window.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function isEditorElement(node) {
        return !!(node && node.matches && node.matches(
            'textarea, input, [contenteditable="true"], [contenteditable="plaintext-only"], [data-slate-editor="true"], .CodeMirror, .CodeMirror textarea, .ProseMirror, .cm-content, .ql-editor, .w-e-text, .w-e-text-container [contenteditable="true"], .tox-edit-area iframe'
        ));
    }

    function getCodeMirrorFromNode(node) {
        if (!node || !node.closest) return null;
        const wrapper = node.closest('.CodeMirror');
        if (!wrapper) return null;
        if (window.editor && typeof window.editor.cm === 'function') {
            const cm = window.editor.cm();
            if (cm && typeof cm.replaceSelection === 'function') return cm;
        }
        if (window.editor && typeof window.editor.cme === 'function') {
            const cme = window.editor.cme();
            if (cme && cme.codemirrorInstance && typeof cme.codemirrorInstance.replaceSelection === 'function') return cme.codemirrorInstance;
        }
        const win = wrapper.ownerDocument && wrapper.ownerDocument.defaultView ? wrapper.ownerDocument.defaultView : window;
        if (win.codemirrorInstance && typeof win.codemirrorInstance.replaceSelection === 'function') return win.codemirrorInstance;
        const input = wrapper.querySelector('textarea');
        if (input && input.CodeMirror && typeof input.CodeMirror.replaceSelection === 'function') return input.CodeMirror;
        if (wrapper.CodeMirror && typeof wrapper.CodeMirror.replaceSelection === 'function') return wrapper.CodeMirror;
        return null;
    }

    function findCodeMirrorEditor() {
        const active = document.activeElement;
        const activeCm = getCodeMirrorFromNode(active);
        if (activeCm) return activeCm;
        const wrappers = Array.from(document.querySelectorAll('.CodeMirror')).filter(isVisibleElement);
        for (const wrapper of wrappers) {
            const cm = getCodeMirrorFromNode(wrapper);
            if (cm) return cm;
        }
        return null;
    }

    function findNodeSeekEditor() {
        const cm = findCodeMirrorEditor();
        if (cm) return { type: 'codemirror', cm };
        const active = document.activeElement;
        if (active && !isNsPluginElement(active) && (isEditorElement(active) || active.closest?.('.CodeMirror, [data-slate-editor="true"], .ProseMirror, [contenteditable="true"], [contenteditable="plaintext-only"], .cm-content, .ql-editor, .w-e-text'))) {
            const activeEditor = active.closest?.('.CodeMirror, [data-slate-editor="true"], .ProseMirror, [contenteditable="true"], [contenteditable="plaintext-only"], .cm-content, .ql-editor, .w-e-text') || active;
            const activeEditorCm = getCodeMirrorFromNode(activeEditor);
            return activeEditorCm ? { type: 'codemirror', cm: activeEditorCm } : activeEditor;
        }
        const selectors = [
            '.CodeMirror',
            '[data-slate-editor="true"]',
            '[role="textbox"][contenteditable="true"]',
            '.w-e-text-container [contenteditable="true"]',
            '.w-e-text[contenteditable="true"]',
            '.ql-editor',
            '.tox-edit-area iframe',
            '.editor-textarea textarea',
            'textarea[name="content"]',
            'textarea[name="message"]',
            'textarea[name="body"]',
            'textarea[placeholder*="回复"]',
            'textarea[placeholder*="评论"]',
            'textarea[placeholder*="发表"]',
            'textarea[placeholder*="输入"]',
            'textarea[placeholder*="内容"]',
            '#content',
            '.ProseMirror',
            '[contenteditable="true"]',
            '[contenteditable="plaintext-only"]',
            '[data-placeholder*="回复"]',
            '[data-placeholder*="评论"]',
            '.cm-content[contenteditable="true"]',
            '.vditor-ir',
            '.vditor-wysiwyg',
            '.CodeMirror textarea',
            'textarea'
        ];
        for (const selector of selectors) {
            const target = Array.from(document.querySelectorAll(selector)).find(isVisibleElement);
            if (!target) continue;
            const targetCm = getCodeMirrorFromNode(target);
            if (targetCm) return { type: 'codemirror', cm: targetCm };
            if (target.tagName === 'IFRAME') {
                try {
                    if (target.contentDocument && target.contentDocument.body) return target.contentDocument.body;
                } catch (e) { }
            }
            return target;
        }
        return null;
    }

    function editorTextIncludes(target, text) {
        const value = target && (target.value || target.innerText || target.textContent || '');
        return String(value).includes(text);
    }

    function dispatchEditorInput(target, text) {
        try {
            target.dispatchEvent(new InputEvent('beforeinput', { bubbles: true, cancelable: true, inputType: 'insertText', data: text }));
        } catch (e) { }
        try {
            target.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
        } catch (e) {
            target.dispatchEvent(new Event('input', { bubbles: true }));
        }
        target.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function dispatchEditorPaste(target, text) {
        let event = null;
        try {
            const data = new DataTransfer();
            data.setData('text/plain', text);
            data.setData('text/html', text.replace(/\n/g, '<br>'));
            event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data });
        } catch (e) {
            try {
                event = new Event('paste', { bubbles: true, cancelable: true });
                event.clipboardData = {
                    getData: type => type === 'text/html' ? text.replace(/\n/g, '<br>') : text,
                    types: ['text/plain', 'text/html']
                };
            } catch (err) {
                event = null;
            }
        }
        return !!(event && target.dispatchEvent(event));
    }

    function placeCaretAtEnd(target) {
        const doc = target.ownerDocument || document;
        const selection = doc.getSelection ? doc.getSelection() : window.getSelection();
        if (!selection || !doc.createRange) return null;
        const range = doc.createRange();
        range.selectNodeContents(target);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        return range;
    }

    function insertTextIntoRichEditor(target, text) {
        const doc = target.ownerDocument || document;
        target.focus();
        if (/^(<p><br><\/p>|<p><br><\/p>\s*)$/i.test((target.innerHTML || '').trim())) {
            target.innerHTML = '';
        }
        const beforeText = target.innerText || target.textContent || '';
        dispatchEditorPaste(target, text);
        if (editorTextIncludes(target, text) && (target.innerText || target.textContent || '') !== beforeText) {
            dispatchEditorInput(target, text);
            return true;
        }
        let selection = doc.getSelection ? doc.getSelection() : window.getSelection();
        let range = selection && selection.rangeCount ? selection.getRangeAt(0) : null;
        if (!range || !target.contains(range.commonAncestorContainer)) {
            range = placeCaretAtEnd(target);
            selection = doc.getSelection ? doc.getSelection() : window.getSelection();
        }
        let ok = false;
        try {
            ok = doc.execCommand && doc.execCommand('insertText', false, text);
        } catch (e) {
            ok = false;
        }
        if (!ok && range) {
            range.deleteContents();
            const node = doc.createTextNode(text);
            range.insertNode(node);
            range.setStartAfter(node);
            range.collapse(true);
            if (selection) {
                selection.removeAllRanges();
                selection.addRange(range);
            }
        } else if (!ok) {
            target.textContent = (target.textContent || '') + text;
        }
        dispatchEditorInput(target, text);
        return true;
    }

    function insertTextToNodeSeekEditor(text) {
        const textarea = findNodeSeekEditor();
        if (!textarea) return false;
        if (textarea.type === 'codemirror' && textarea.cm) {
            textarea.cm.focus();
            textarea.cm.replaceSelection(text);
            return true;
        }
        if (textarea.tagName === 'TEXTAREA' || textarea.tagName === 'INPUT') {
            const start = textarea.selectionStart || 0;
            const end = textarea.selectionEnd || start;
            const oldValue = textarea.value || '';
            setNativeTextareaValue(textarea, oldValue.slice(0, start) + text + oldValue.slice(end));
            textarea.selectionStart = textarea.selectionEnd = start + text.length;
            dispatchEditorInput(textarea, text);
            textarea.focus();
            return true;
        }
        return insertTextIntoRichEditor(textarea, text);
    }

    function copyNodeImageText(text, onDone) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(onDone).catch(() => fallbackCopy());
            return;
        }
        fallbackCopy();

        function fallbackCopy() {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.left = '-9999px';
            document.body.appendChild(textarea);
            textarea.select();
            try { document.execCommand('copy'); } catch (e) { }
            textarea.remove();
            if (typeof onDone === 'function') onDone();
        }
    }

    async function uploadNodeImageFileByFetch(file, apiKey) {
        const form = new FormData();
        form.append('image', file, file.name || 'image');
        try {
            const response = await fetch('https://api.nodeimage.com/api/upload', {
                method: 'POST',
                headers: { 'X-API-Key': apiKey },
                body: form,
                credentials: 'omit',
                mode: 'cors'
            });
            const text = await response.text();
            let body = text;
            try { body = text ? JSON.parse(text) : null; } catch (e) { }
            if (!response.ok) {
                const msg = body && typeof body === 'object'
                    ? (body.message || body.error || JSON.stringify(body))
                    : (text || response.statusText || String(response.status));
                throw new Error(String(msg));
            }
            return body;
        } catch (error) {
            if (typeof GM_xmlhttpRequest !== 'function') throw error;
            return uploadNodeImageFileByGmMultipart(file, apiKey);
        }
    }

    function uploadNodeImageFileByGmMultipart(file, apiKey) {
        return new Promise((resolve, reject) => {
            const boundary = '----NSNodeImageSafari' + Date.now().toString(16);
            const fileName = (file.name || 'image').replace(/"/g, '');
            const head = '--' + boundary + '\r\n' +
                'Content-Disposition: form-data; name="image"; filename="' + fileName + '"\r\n' +
                'Content-Type: ' + (file.type || 'application/octet-stream') + '\r\n\r\n';
            const tail = '\r\n--' + boundary + '--\r\n';
            const body = new Blob([head, file, tail], { type: 'multipart/form-data; boundary=' + boundary });
            GM_xmlhttpRequest({
                method: 'POST',
                url: 'https://api.nodeimage.com/api/upload',
                headers: {
                    'X-API-Key': apiKey,
                    'Content-Type': 'multipart/form-data; boundary=' + boundary
                },
                data: body,
                timeout: 300000,
                onload: function (response) {
                    const text = response.responseText || '';
                    let parsed = text;
                    try { parsed = text ? JSON.parse(text) : null; } catch (e) { }
                    if (response.status >= 200 && response.status < 300) {
                        resolve(parsed);
                        return;
                    }
                    const msg = parsed && typeof parsed === 'object'
                        ? (parsed.message || parsed.error || JSON.stringify(parsed))
                        : (text || response.statusText || String(response.status));
                    reject(new Error(String(msg)));
                },
                onerror: function () { reject(new Error('网络请求失败')); },
                ontimeout: function () { reject(new Error('上传超时')); }
            });
        });
    }

    function showSafariNodeImageDialog() {
        const existing = document.getElementById('ns-nodeimage-safari-dialog');
        if (existing) {
            existing.remove();
            return;
        }

        const dialog = document.createElement('div');
        dialog.id = 'ns-nodeimage-safari-dialog';
        dialog.style.position = 'fixed';
        dialog.style.top = '56px';
        dialog.style.right = '12px';
        dialog.style.zIndex = '10001';
        dialog.style.width = 'min(500px, 96vw)';
        dialog.style.maxHeight = '78vh';
        dialog.style.display = 'flex';
        dialog.style.flexDirection = 'column';
        dialog.style.background = '#fff';
        dialog.style.border = '1px solid #ccc';
        dialog.style.borderRadius = '8px';
        dialog.style.boxShadow = '0 4px 16px rgba(0,0,0,.12)';
        dialog.style.font = '13px system-ui, sans-serif';
        dialog.style.overflow = 'hidden';

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.padding = '12px';
        header.style.borderBottom = '1px solid #e2e8f0';

        const title = document.createElement('b');
        title.textContent = 'NS图床';
        title.style.color = '#0d9488';

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.textContent = '×';
        closeBtn.style.border = 'none';
        closeBtn.style.background = 'none';
        closeBtn.style.fontSize = '20px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.onclick = function () { dialog.remove(); };

        header.appendChild(title);
        header.appendChild(closeBtn);
        dialog.appendChild(header);

        const body = document.createElement('div');
        body.style.padding = '12px';
        body.style.overflowY = 'auto';
        dialog.appendChild(body);

        const tip = document.createElement('div');
        tip.style.fontSize = '12px';
        tip.style.color = '#666';
        tip.style.lineHeight = '1.5';
        tip.style.marginBottom = '8px';
        tip.innerHTML = 'Safari 备用上传面板。请先在 <a href="https://www.nodeimage.com/" target="_blank" rel="noopener noreferrer">nodeimage.com</a> 获取 API Key。';
        body.appendChild(tip);

        const keyRow = document.createElement('div');
        keyRow.style.display = 'flex';
        keyRow.style.gap = '6px';
        keyRow.style.marginBottom = '8px';

        const keyInput = document.createElement('input');
        keyInput.type = 'password';
        keyInput.placeholder = 'X-API-Key';
        keyInput.value = getSafariNodeImageApiKey();
        keyInput.style.flex = '1';
        keyInput.style.minWidth = '0';
        keyInput.style.padding = '6px 8px';
        keyInput.style.border = '1px solid #ddd';
        keyInput.style.borderRadius = '4px';

        const saveKeyBtn = document.createElement('button');
        saveKeyBtn.type = 'button';
        saveKeyBtn.textContent = '保存';
        saveKeyBtn.style.padding = '6px 10px';
        saveKeyBtn.style.background = '#0d9488';
        saveKeyBtn.style.color = '#fff';
        saveKeyBtn.style.border = 'none';
        saveKeyBtn.style.borderRadius = '4px';
        saveKeyBtn.style.cursor = 'pointer';

        const autoKeyBtn = document.createElement('button');
        autoKeyBtn.type = 'button';
        autoKeyBtn.textContent = '自动获取';
        autoKeyBtn.style.padding = '6px 10px';
        autoKeyBtn.style.background = '#1890ff';
        autoKeyBtn.style.color = '#fff';
        autoKeyBtn.style.border = 'none';
        autoKeyBtn.style.borderRadius = '4px';
        autoKeyBtn.style.cursor = 'pointer';
        autoKeyBtn.style.whiteSpace = 'nowrap';

        keyRow.appendChild(keyInput);
        keyRow.appendChild(autoKeyBtn);
        keyRow.appendChild(saveKeyBtn);
        body.appendChild(keyRow);

        const status = document.createElement('div');
        status.style.fontSize = '12px';
        status.style.color = '#64748b';
        status.style.minHeight = '18px';
        status.style.marginBottom = '8px';
        body.appendChild(status);

        const uploadBox = document.createElement('label');
        uploadBox.style.display = 'block';
        uploadBox.style.border = '2px dashed #cbd5e1';
        uploadBox.style.borderRadius = '6px';
        uploadBox.style.padding = '16px 12px';
        uploadBox.style.textAlign = 'center';
        uploadBox.style.cursor = 'pointer';
        uploadBox.style.background = '#f8fafc';
        uploadBox.style.marginBottom = '8px';
        uploadBox.textContent = '点击选择图片上传';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.multiple = true;
        fileInput.accept = 'image/jpeg,image/png,image/gif,image/webp';
        fileInput.style.display = 'none';
        uploadBox.appendChild(fileInput);
        body.appendChild(uploadBox);

        const resultBox = document.createElement('div');
        resultBox.style.display = 'flex';
        resultBox.style.flexDirection = 'column';
        resultBox.style.gap = '6px';
        body.appendChild(resultBox);

        function setStatus(text, isError) {
            status.textContent = text || '';
            status.style.color = isError ? '#dc2626' : '#64748b';
        }

        function appendResult(url) {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.gap = '6px';
            row.style.alignItems = 'center';

            const input = document.createElement('input');
            input.type = 'text';
            input.readOnly = true;
            input.value = '![](' + url + ')';
            input.style.flex = '1';
            input.style.minWidth = '0';
            input.style.padding = '5px 6px';
            input.style.border = '1px solid #e2e8f0';
            input.style.borderRadius = '4px';
            input.style.fontSize = '12px';

            const insertBtn = document.createElement('button');
            insertBtn.type = 'button';
            insertBtn.textContent = '插入';
            insertBtn.style.padding = '5px 8px';
            insertBtn.style.border = 'none';
            insertBtn.style.borderRadius = '4px';
            insertBtn.style.background = '#1890ff';
            insertBtn.style.color = '#fff';
            insertBtn.style.cursor = 'pointer';
            insertBtn.onclick = function () {
                const text = input.value + '\n';
                if (insertTextToNodeSeekEditor(text)) setStatus('已插入');
                else copyNodeImageText(text, () => setStatus('未找到输入框，已复制'));
            };

            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.textContent = '复制';
            copyBtn.style.padding = '5px 8px';
            copyBtn.style.border = '1px solid #cbd5e1';
            copyBtn.style.borderRadius = '4px';
            copyBtn.style.background = '#fff';
            copyBtn.style.cursor = 'pointer';
            copyBtn.onclick = function () {
                copyNodeImageText(input.value, () => setStatus('已复制'));
            };

            row.appendChild(input);
            row.appendChild(insertBtn);
            row.appendChild(copyBtn);
            resultBox.prepend(row);
        }

        async function uploadFiles(files) {
            const apiKey = getSafariNodeImageApiKey();
            if (!apiKey) {
                setStatus('请先保存 API Key', true);
                return;
            }
            const list = Array.from(files || []);
            if (!list.length) return;
            for (let i = 0; i < list.length; i++) {
                const file = list[i];
                if (!/^image\/(jpeg|png|gif|webp)$/i.test(file.type || '') && !/\.(jpe?g|png|gif|webp)$/i.test(file.name || '')) {
                    setStatus('已跳过非图片文件：' + (file.name || '未命名'), true);
                    continue;
                }
                try {
                    setStatus('上传中 ' + (i + 1) + ' / ' + list.length + '：' + (file.name || '未命名'));
                    const data = await uploadNodeImageFileByFetch(file, apiKey);
                    const urls = collectNodeImageUrls(data, []);
                    if (!urls.length) {
                        setStatus('上传成功，但返回内容中没有图片链接', true);
                        continue;
                    }
                    appendResult(urls[0]);
                    const md = '![](' + urls[0] + ')\n';
                    if (!insertTextToNodeSeekEditor(md)) copyNodeImageText(md, () => setStatus('已上传并复制链接'));
                    else setStatus('已上传并插入链接');
                } catch (error) {
                    setStatus('上传失败：' + (error && error.message ? error.message : String(error)), true);
                }
            }
        }

        saveKeyBtn.onclick = function () {
            setSafariNodeImageApiKey(keyInput.value);
            setStatus(getSafariNodeImageApiKey() ? 'API Key 已保存' : 'API Key 已清除');
        };

        autoKeyBtn.onclick = async function () {
            const oldText = autoKeyBtn.textContent;
            autoKeyBtn.disabled = true;
            autoKeyBtn.textContent = '获取中';
            autoKeyBtn.style.opacity = '0.7';
            setStatus('正在从 nodeimage.com 获取 API Key');
            try {
                const key = await fetchSafariNodeImageApiKey();
                keyInput.value = key;
                setSafariNodeImageApiKey(key);
                setStatus('API Key 已获取并保存');
            } catch (error) {
                setStatus('获取失败：' + (error && error.message ? error.message : String(error)), true);
            } finally {
                autoKeyBtn.disabled = false;
                autoKeyBtn.textContent = oldText;
                autoKeyBtn.style.opacity = '1';
            }
        };

        fileInput.onchange = function () {
            uploadFiles(fileInput.files);
            fileInput.value = '';
        };

        dialog.addEventListener('paste', function (event) {
            const items = event.clipboardData && event.clipboardData.items;
            if (!items) return;
            const files = [];
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (!item.type || item.type.indexOf('image') === -1) continue;
                const file = item.getAsFile();
                if (file) files.push(file);
            }
            if (!files.length) return;
            event.preventDefault();
            uploadFiles(files);
        }, true);

        document.body.appendChild(dialog);
    }

    function openNodeImagePanel() {
        if (isSafariBrowser()) {
            showSafariNodeImageDialog();
            return;
        }
        if (window.NodeSeekNodeImage && typeof window.NodeSeekNodeImage.open === 'function') {
            window.NodeSeekNodeImage.open();
            return;
        }
        showSafariNodeImageDialog();
    }

    function bindSafariNodeImageToolbar() {
        if (!isSafariBrowser()) return;
        document.querySelectorAll('.ns-ni-mde-toolbar-btn').forEach(btn => {
            btn.title = '打开 NS图床 Safari 备用面板';
            btn.onclick = function (event) {
                event.preventDefault();
                event.stopPropagation();
                openNodeImagePanel();
            };
        });
    }
