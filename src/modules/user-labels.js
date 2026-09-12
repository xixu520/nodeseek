    if (!window.NodeSeekUserLabels) {
        window.NodeSeekUserLabels = (function () {
            const LABELS_KEY = 'nodeseek_user_labels';
            const SETTINGS_KEY = 'nodeseek_user_label_settings';
            const SCAN_CACHE_KEY = 'nodeseek_user_label_scan_cache';
            const SCAN_STATE_KEY = 'nodeseek_user_label_scan_state';
            const OBSERVATIONS_KEY = 'nodeseek_user_label_observations';
            const RISK_PROMPT_STATE_KEY = 'nodeseek_user_label_risk_prompt_state';
            const NO_MATCH_TTL = 30 * 86400000;
            const FAILED_TTL = 86400000;
            const REQUEST_GAP = 3000;
            const DAILY_LIMIT = 20;
            const HISTORY_PAGES = 3;
            const EVIDENCE_LIMIT = 12;
            const pageScanKeys = new Set();
            let lastHistoryRequestAt = 0;
            let scanRunning = false;
            let scanTimer = null;
            let riskPromptUrl = '';
            let activeScanPageKey = '';

            function currentPageKey() {
                return location.pathname + location.search + location.hash;
            }

            function readJson(key, fallback) {
                try {
                    const value = JSON.parse(nsLocalStorage.getItem(key) || 'null');
                    return value && typeof value === 'object' ? value : fallback;
                } catch (e) {
                    return fallback;
                }
            }

            function writeJson(key, value) {
                nsLocalStorage.setItem(key, JSON.stringify(value));
            }

            function getSettings() {
                const saved = readJson(SETTINGS_KEY, {});
                return {
                    enabled: saved.enabled !== false,
                    autoScan: saved.autoScan !== false,
                    riskPrompt: saved.riskPrompt !== false
                };
            }

            function setSettings(next) {
                const settings = {
                    enabled: next && next.enabled !== false,
                    autoScan: next && next.autoScan !== false,
                    riskPrompt: next && next.riskPrompt !== false
                };
                writeJson(SETTINGS_KEY, settings);
                refreshBadges();
                if (settings.autoScan) scheduleAutoScan(500);
                return settings;
            }

            function getLabelsData() {
                return readJson(LABELS_KEY, {});
            }

            function setLabelsData(data) {
                writeJson(LABELS_KEY, data && typeof data === 'object' ? data : {});
                refreshBadges();
            }

            function getScanCache() {
                return readJson(SCAN_CACHE_KEY, {});
            }

            function setScanCache(data) {
                writeJson(SCAN_CACHE_KEY, data && typeof data === 'object' ? data : {});
            }

            function dateKey() {
                const now = new Date();
                return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
            }

            function getScanState() {
                const saved = readJson(SCAN_STATE_KEY, {});
                if (saved.date !== dateKey()) return { date: dateKey(), count: 0, halted: false, consecutiveFailures: 0 };
                return {
                    date: saved.date,
                    count: Number(saved.count) || 0,
                    halted: saved.halted === true,
                    consecutiveFailures: Number(saved.consecutiveFailures) || 0
                };
            }

            function setScanState(state) {
                writeJson(SCAN_STATE_KEY, state);
            }

            function userIdFromLink(link) {
                const href = link && (link.getAttribute('href') || link.href) || '';
                const match = String(href).match(/\/space\/(\d+)/);
                return match ? match[1] : '';
            }

            function normalizedUsername(value) {
                return String(value || '').trim().toLowerCase();
            }

            function mergeTemporaryRecord(data, userId, username) {
                const temporaryKey = 'name:' + normalizedUsername(username);
                if (!userId || !data[temporaryKey]) return data[userId] || null;
                const old = data[temporaryKey];
                data[userId] = {
                    ...old,
                    ...(data[userId] || {}),
                    userId,
                    username: username || old.username
                };
                delete data[temporaryKey];
                writeJson(LABELS_KEY, data);
                return data[userId];
            }

            function findRecord(userId, username) {
                const data = getLabelsData();
                if (userId) {
                    const merged = mergeTemporaryRecord(data, userId, username);
                    if (merged) return { key: userId, record: merged };
                }
                const name = normalizedUsername(username);
                const entry = Object.entries(data).find(([, record]) => normalizedUsername(record && record.username) === name);
                return entry ? { key: entry[0], record: entry[1] } : null;
            }

            function saveRecord(key, record) {
                const data = getLabelsData();
                data[key] = record;
                setLabelsData(data);
            }

            function compactEvidence(list) {
                const seen = new Set();
                return (Array.isArray(list) ? list : []).filter(item => {
                    const url = String(item && item.url || '');
                    if (!url || seen.has(url)) return false;
                    seen.add(url);
                    return true;
                }).slice(0, EVIDENCE_LIMIT).map(item => ({ url: item.url, kind: item.kind || '页面' }));
            }

            function labelTitle(type) {
                if (type === 'trader') return '炒鸡';
                if (type === 'spammer') return '灌水';
                if (type === 'risk') return '风险';
                return '标签';
            }

            function isSupportedLabelType(type) {
                return type === 'trader' || type === 'spammer' || type === 'risk';
            }

            function labelClass(type) {
                if (type === 'trader') return 'ns-user-label-trader';
                if (type === 'spammer') return 'ns-user-label-spammer';
                if (type === 'risk') return 'ns-user-label-risk';
                return 'ns-user-label-custom';
            }

            function formatDate(value) {
                const date = new Date(value || '');
                if (Number.isNaN(date.getTime())) return '未知';
                return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0') + ' ' + String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
            }

            function refreshBadges(root) {
                const settings = getSettings();
                const scope = root && root.querySelectorAll ? root : document;
                scope.querySelectorAll('.ns-user-label-badges').forEach(box => box.remove());
                if (!settings.enabled) return;
                const selector = 'a.author-name[href*="/space/"], .info-author a[href*="/space/"], .nsk-content-meta-info a[href*="/space/"], .post-list-item a[href*="/space/"]';
                const links = Array.from(scope.querySelectorAll(selector));
                links.forEach(link => {
                    if (!link || link.closest('#nodeseek-plugin-main-container, #ns-user-label-dialog, #ns-user-label-detail-dialog')) return;
                    const userId = userIdFromLink(link);
                    const username = String(link.textContent || '').trim();
                    if (!username) return;
                    const found = findRecord(userId, username);
                    const labels = found && found.record && found.record.labels ? found.record.labels : {};
                    const entries = Object.entries(labels).filter(([, label]) => label && label.name);
                    if (!entries.length || link.parentNode.querySelector('.ns-user-label-badges')) return;
                    const box = document.createElement('span');
                    box.className = 'ns-user-label-badges';
                    box.dataset.userId = userId || found.key;
                    entries.forEach(([type, label]) => {
                        const badge = document.createElement('button');
                        badge.type = 'button';
                        badge.className = 'ns-user-label-badge ' + labelClass(type);
                        badge.textContent = label.name || labelTitle(type);
                        badge.title = '个人规则判断，点击查看依据';
                        badge.onclick = function (event) {
                            event.preventDefault();
                            event.stopPropagation();
                            showDetailDialog(found.key, username);
                        };
                        box.appendChild(badge);
                    });
                    link.insertAdjacentElement('afterend', box);
                });
            }

            function createDialog(id, titleText, width) {
                const existing = document.getElementById(id);
                if (existing) existing.remove();
                const dialog = document.createElement('div');
                dialog.id = id;
                dialog.className = 'ns-user-label-dialog';
                dialog.style.width = width || '620px';
                const header = document.createElement('div');
                header.className = 'ns-user-label-dialog-header';
                const title = document.createElement('strong');
                title.textContent = titleText;
                const close = document.createElement('button');
                close.type = 'button';
                close.className = 'ns-user-label-close';
                close.textContent = '×';
                close.onclick = () => dialog.remove();
                header.appendChild(title);
                header.appendChild(close);
                dialog.appendChild(header);
                document.body.appendChild(dialog);
                return dialog;
            }

            function metricLines(type, metrics) {
                const data = metrics || {};
                if (type === 'trader') {
                    return [
                        '最近主题样本：' + (data.sampleCount || 0) + ' 条',
                        '服务器收购：' + (data.buyCount || 0) + ' 条',
                        '服务器出售：' + (data.sellCount || 0) + ' 条',
                        '同类先收后出：' + (data.pairCount || 0) + ' 组'
                    ];
                }
                if (type === 'spammer') {
                    return [
                        '最近评论样本：' + (data.sampleCount || 0) + ' 条',
                        '相同或近似回复：' + Math.round((data.duplicateRatio || 0) * 100) + '%',
                        '短回复：' + Math.round((data.shortRatio || 0) * 100) + '%',
                        '账户平均评论：' + Number(data.dailyAverage || 0).toFixed(1) + ' 条/天'
                    ];
                }
                return [];
            }

            function showDetailDialog(key, username) {
                const data = getLabelsData();
                const record = data[key];
                if (!record) return;
                const dialog = createDialog('ns-user-label-detail-dialog', (record.username || username || '用户') + ' 的个人标签', '560px');
                const notice = document.createElement('div');
                notice.className = 'ns-user-label-notice';
                notice.textContent = '这些标签来自本机保存的规则判断或手工记录，仅供个人参考。';
                dialog.appendChild(notice);
                const labels = record.labels || {};
                Object.entries(labels).forEach(([type, label]) => {
                    const card = document.createElement('section');
                    card.className = 'ns-user-label-card';
                    const heading = document.createElement('h4');
                    heading.textContent = label.name || labelTitle(type);
                    card.appendChild(heading);
                    const meta = document.createElement('div');
                    meta.className = 'ns-user-label-muted';
                    meta.textContent = (label.source === 'manual' ? '手工记录' : '固定规则判断') + ' · ' + formatDate(label.createdAt);
                    card.appendChild(meta);
                    metricLines(type, label.metrics).forEach(text => {
                        const line = document.createElement('div');
                        line.textContent = text;
                        card.appendChild(line);
                    });
                    if (record.note) {
                        const note = document.createElement('div');
                        note.className = 'ns-user-label-note';
                        note.textContent = '备注：' + record.note;
                        card.appendChild(note);
                    }
                    const evidence = compactEvidence(label.evidence);
                    if (evidence.length) {
                        const list = document.createElement('div');
                        list.className = 'ns-user-label-evidence';
                        evidence.forEach((item, index) => {
                            const link = document.createElement('a');
                            link.href = item.url;
                            link.target = '_blank';
                            link.rel = 'noopener noreferrer';
                            link.textContent = item.kind + '依据 ' + (index + 1);
                            list.appendChild(link);
                        });
                        card.appendChild(list);
                    }
                    const actions = document.createElement('div');
                    actions.className = 'ns-user-label-actions';
                    function action(text, handler) {
                        const button = document.createElement('button');
                        button.type = 'button';
                        button.textContent = text;
                        button.onclick = handler;
                        actions.appendChild(button);
                    }
                    action('确认保留', function () {
                        label.confirmedAt = Date.now();
                        saveRecord(key, record);
                        showDetailDialog(key, username);
                    });
                    action('备注', function () {
                        const value = prompt('请输入个人备注：', record.note || '');
                        if (value === null) return;
                        record.note = value.trim().slice(0, 500);
                        saveRecord(key, record);
                        showDetailDialog(key, username);
                    });
                    if (label.source === 'auto' && (type === 'trader' || type === 'spammer')) {
                        action('永久忽略', function () {
                            if (!confirm('确定忽略此类自动标签？以后不会再次自动生成。')) return;
                            record.ignored = record.ignored || {};
                            record.ignored[type] = true;
                            delete record.labels[type];
                            saveRecord(key, record);
                            dialog.remove();
                        });
                    }
                    action('删除', function () {
                        if (!confirm('确定删除这个标签？')) return;
                        delete record.labels[type];
                        if (!Object.keys(record.labels).length && !Object.keys(record.ignored || {}).length && !record.note) {
                            const all = getLabelsData();
                            delete all[key];
                            setLabelsData(all);
                        } else {
                            saveRecord(key, record);
                        }
                        dialog.remove();
                    });
                    card.appendChild(actions);
                    dialog.appendChild(card);
                });
                if (!Object.keys(labels).length) {
                    const empty = document.createElement('div');
                    empty.className = 'ns-user-label-empty';
                    empty.textContent = '当前没有显示中的标签。';
                    dialog.appendChild(empty);
                }
            }

            function addManualLabel(key, username, type, name, evidenceUrl, note) {
                if (!isSupportedLabelType(type)) return null;
                const data = getLabelsData();
                const record = data[key] || { userId: /^\d+$/.test(key) ? key : '', username: username || '', labels: {}, ignored: {} };
                record.username = username || record.username;
                record.labels = record.labels || {};
                record.labels[type] = {
                    name: labelTitle(type),
                    source: 'manual',
                    createdAt: Date.now(),
                    metrics: {},
                    evidence: evidenceUrl ? [{ url: evidenceUrl, kind: type === 'risk' ? '风险记录' : '页面' }] : []
                };
                if (note) record.note = String(note).trim().slice(0, 500);
                data[key] = record;
                setLabelsData(data);
                return record;
            }

            function showManagerDialog() {
                const dialog = createDialog('ns-user-label-dialog', '个人用户标签', '720px');
                const toolbar = document.createElement('div');
                toolbar.className = 'ns-user-label-toolbar';
                const search = document.createElement('input');
                search.type = 'search';
                search.placeholder = '查找用户名或标签';
                const add = document.createElement('button');
                add.type = 'button';
                add.textContent = '手工记录风险';
                toolbar.appendChild(search);
                toolbar.appendChild(add);
                dialog.appendChild(toolbar);
                const list = document.createElement('div');
                dialog.appendChild(list);

                function render() {
                    list.innerHTML = '';
                    const query = normalizedUsername(search.value);
                    const labelsData = getLabelsData();
                    const scanCache = getScanCache();
                    const keys = Array.from(new Set(Object.keys(labelsData).concat(Object.keys(scanCache))));
                    const rows = keys.map(key => ({ key, record: labelsData[key], scan: scanCache[key] })).filter(row => {
                        const username = row.record?.username || row.scan?.username || row.key;
                        const names = Object.values(row.record?.labels || {}).map(item => item.name).join(' ');
                        return !query || normalizedUsername(username + ' ' + names).includes(query);
                    }).sort((a, b) => String(a.record?.username || a.scan?.username || a.key).localeCompare(String(b.record?.username || b.scan?.username || b.key), 'zh-CN'));
                    if (!rows.length) {
                        const empty = document.createElement('div');
                        empty.className = 'ns-user-label-empty';
                        empty.textContent = '暂无个人标签或检查结果';
                        list.appendChild(empty);
                        return;
                    }
                    rows.forEach(row => {
                        const item = document.createElement('div');
                        item.className = 'ns-user-label-manager-row';
                        const text = document.createElement('div');
                        const username = row.record?.username || row.scan?.username || row.key;
                        const names = Object.values(row.record?.labels || {}).map(label => label.name).filter(Boolean);
                        text.textContent = username + ' · ' + (names.length ? names.join('、') : '无标签检查结果');
                        const actions = document.createElement('div');
                        if (row.record) {
                            const detail = document.createElement('button');
                            detail.type = 'button';
                            detail.textContent = '查看';
                            detail.onclick = () => showDetailDialog(row.key, username);
                            actions.appendChild(detail);
                        }
                        const clear = document.createElement('button');
                        clear.type = 'button';
                        clear.textContent = '清除结果';
                        clear.onclick = function () {
                            if (!confirm('确定清除该用户的标签和检查结果？')) return;
                            const allLabels = getLabelsData();
                            const allScans = getScanCache();
                            delete allLabels[row.key];
                            delete allScans[row.key];
                            setLabelsData(allLabels);
                            setScanCache(allScans);
                            render();
                        };
                        actions.appendChild(clear);
                        item.appendChild(text);
                        item.appendChild(actions);
                        list.appendChild(item);
                    });
                }
                search.oninput = render;
                add.onclick = function () {
                    const identity = prompt('请输入用户主页编号或用户名：', '');
                    if (identity === null || !identity.trim()) return;
                    const username = prompt('请输入显示用户名：', /^\d+$/.test(identity.trim()) ? '' : identity.trim());
                    if (username === null || !username.trim()) return;
                    const note = prompt('请输入风险说明或个人备注：', '交易争议，需自行核对依据');
                    if (note === null) return;
                    const key = /^\d+$/.test(identity.trim()) ? identity.trim() : 'name:' + normalizedUsername(username);
                    addManualLabel(key, username.trim(), 'risk', '风险', '', note);
                    render();
                };
                render();
            }

            function waitForHistoryGap() {
                const delay = NodeSeekUserLabelRules.nextRequestDelay(lastHistoryRequestAt, Date.now(), REQUEST_GAP);
                return delay ? new Promise(resolve => setTimeout(resolve, delay)) : Promise.resolve();
            }

            function isRateLimited(data) {
                const text = String(data && data.message || '');
                return /请求频率过高|too many requests|rate limit/i.test(text);
            }

            async function fetchHistory(kind, userId, page) {
                if ((document.visibilityState && document.visibilityState !== 'visible') || (activeScanPageKey && activeScanPageKey !== topicPageKey())) {
                    const error = new Error('页面状态已经变化');
                    error.cancelled = true;
                    throw error;
                }
                await waitForHistoryGap();
                if ((document.visibilityState && document.visibilityState !== 'visible') || (activeScanPageKey && activeScanPageKey !== topicPageKey())) {
                    const error = new Error('页面状态已经变化');
                    error.cancelled = true;
                    throw error;
                }
                lastHistoryRequestAt = Date.now();
                const endpoint = kind === 'discussion' ? 'list-discussions' : 'list-comments';
                const response = await fetch('/api/content/' + endpoint + '?uid=' + encodeURIComponent(userId) + '&page=' + page, { credentials: 'include' });
                if (response.status === 429) {
                    const error = new Error('访问过于频繁');
                    error.rateLimited = true;
                    throw error;
                }
                if (!response.ok) throw new Error('读取用户活动失败：' + response.status);
                const data = await response.json();
                if (isRateLimited(data)) {
                    const error = new Error('访问过于频繁');
                    error.rateLimited = true;
                    throw error;
                }
                const field = kind === 'discussion' ? 'discussions' : 'comments';
                if (!data || data.success !== true || !Array.isArray(data[field])) {
                    const error = new Error('用户活动资料格式已经变化');
                    error.schemaChanged = true;
                    throw error;
                }
                return data[field];
            }

            async function scanUser(userId, username) {
                const discussions = [];
                const comments = [];
                const profile = typeof fetchUserData === 'function' ? await fetchUserData(userId) : null;
                for (let page = 1; page <= HISTORY_PAGES; page += 1) {
                    discussions.push(...await fetchHistory('discussion', userId, page));
                }
                for (let page = 1; page <= HISTORY_PAGES; page += 1) {
                    comments.push(...await fetchHistory('comment', userId, page));
                }
                const trading = NodeSeekUserLabelRules.analyzeTrading(discussions);
                const spammer = NodeSeekUserLabelRules.analyzeComments(comments, profile || {});
                const labelsData = getLabelsData();
                const record = labelsData[userId] || { userId, username, labels: {}, ignored: {} };
                record.username = username || profile?.member_name || record.username;
                record.labels = record.labels || {};
                record.ignored = record.ignored || {};
                if (trading.matched && !record.ignored.trader) {
                    record.labels.trader = {
                        name: '炒鸡', source: 'auto', createdAt: Date.now(), metrics: trading,
                        evidence: compactEvidence(trading.evidence)
                    };
                }
                if (spammer.matched && !record.ignored.spammer) {
                    record.labels.spammer = {
                        name: '灌水', source: 'auto', createdAt: Date.now(), metrics: spammer,
                        evidence: compactEvidence(spammer.evidence)
                    };
                }
                if (Object.keys(record.labels).length || Object.keys(record.ignored).length) {
                    labelsData[userId] = record;
                    setLabelsData(labelsData);
                }
                const cache = getScanCache();
                cache[userId] = {
                    username: record.username || username,
                    checkedAt: Date.now(),
                    status: 'complete',
                    matched: Object.keys(record.labels).filter(type => type === 'trader' || type === 'spammer'),
                    metrics: {
                        trading: { buyCount: trading.buyCount, sellCount: trading.sellCount, pairCount: trading.pairCount },
                        spammer: { duplicateRatio: spammer.duplicateRatio, shortRatio: spammer.shortRatio, dailyAverage: spammer.dailyAverage }
                    }
                };
                setScanCache(cache);
                if (typeof addLog === 'function') addLog('用户标签：已检查 ' + (record.username || username));
                return record;
            }

            function topicIdFromPath() {
                const match = location.pathname.match(/(?:\/post-|\/topic\/|\/article\/)(\d+)/i);
                return match ? match[1] : '';
            }

            function topicPageKey() {
                const topicId = topicIdFromPath();
                return topicId ? 'topic:' + topicId : currentPageKey();
            }

            function topicAuthorCandidate() {
                if (!topicIdFromPath()) return null;
                const link = document.querySelector('.nsk-content .nsk-content-meta-info a.author-name[href*="/space/"], .nsk-content-meta-info a.author-name[href*="/space/"], article a.author-name[href*="/space/"], a.author-name[href*="/space/"]');
                if (!link) return null;
                const candidate = {
                    link,
                    userId: userIdFromLink(link),
                    username: String(link.textContent || '').trim()
                };
                return candidate.userId && candidate.username ? candidate : null;
            }

            function shouldSkipCandidate(candidate) {
                const record = getLabelsData()[candidate.userId];
                const cached = getScanCache()[candidate.userId];
                return NodeSeekUserLabelRules.shouldSkipScan(record, cached, Date.now(), NO_MATCH_TTL, FAILED_TTL);
            }

            function canAutoScan() {
                const settings = getSettings();
                if (!settings.enabled || !settings.autoScan || scanRunning) return false;
                if (document.visibilityState && document.visibilityState !== 'visible') return false;
                if (typeof navigator !== 'undefined' && navigator.onLine === false) return false;
                const state = getScanState();
                return NodeSeekUserLabelRules.canScanToday(state, dateKey(), DAILY_LIMIT);
            }

            function runAutoScanForPage(pageKey) {
                if (!canAutoScan() || pageScanKeys.has(pageKey)) return;
                const candidate = topicAuthorCandidate();
                if (!candidate || shouldSkipCandidate(candidate)) {
                    pageScanKeys.add(pageKey);
                    return;
                }
                pageScanKeys.add(pageKey);
                scanRunning = true;
                activeScanPageKey = pageKey;
                const state = getScanState();
                state.count += 1;
                setScanState(state);
                scanUser(candidate.userId, candidate.username).then(function () {
                    const next = getScanState();
                    next.consecutiveFailures = 0;
                    setScanState(next);
                    refreshBadges();
                }).catch(function (error) {
                    if (error && error.cancelled) {
                        const cancelledState = getScanState();
                        cancelledState.count = Math.max(0, cancelledState.count - 1);
                        setScanState(cancelledState);
                        return;
                    }
                    const cache = getScanCache();
                    cache[candidate.userId] = { username: candidate.username, status: 'failed', failedAt: Date.now() };
                    setScanCache(cache);
                    const next = getScanState();
                    next.consecutiveFailures += 1;
                    if (error && (error.rateLimited || error.schemaChanged || next.consecutiveFailures >= 2)) next.halted = true;
                    setScanState(next);
                    console.warn('用户标签检查已暂停或稍后重试:', error);
                }).finally(function () {
                    scanRunning = false;
                    activeScanPageKey = '';
                });
            }

            function scheduleAutoScan(delay) {
                if (scanTimer) clearTimeout(scanTimer);
                const pageKey = topicPageKey();
                scanTimer = setTimeout(function () {
                    scanTimer = null;
                    const run = () => runAutoScanForPage(pageKey);
                    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: 2500 });
                    else run();
                }, typeof delay === 'number' ? delay : 2200);
            }

            function simpleHash(value) {
                let hash = 2166136261;
                const text = String(value || '');
                for (let i = 0; i < text.length; i += 1) {
                    hash ^= text.charCodeAt(i);
                    hash = Math.imul(hash, 16777619);
                }
                return (hash >>> 0).toString(36);
            }

            function collectPassiveObservations() {
                const observations = readJson(OBSERVATIONS_KEY, {});
                let changed = false;
                document.querySelectorAll('.post-list-item').forEach(item => {
                    const author = item.querySelector('.info-author a[href*="/space/"], a.author-name[href*="/space/"]');
                    const titleLink = item.querySelector('a.post-title, .post-title a, a[href*="/post-"]');
                    const userId = userIdFromLink(author);
                    const title = titleLink && String(titleLink.textContent || '').trim();
                    const direction = NodeSeekUserLabelRules.tradeDirection(title);
                    if (!userId || !direction || !titleLink.href) return;
                    const list = Array.isArray(observations[userId]) ? observations[userId] : [];
                    if (list.some(entry => entry.url === titleLink.href)) return;
                    list.unshift({ kind: 'trade', direction, url: titleLink.href, seenAt: Date.now() });
                    observations[userId] = list.slice(0, 60);
                    changed = true;
                });
                document.querySelectorAll('a.author-name[href*="/space/"]').forEach(author => {
                    const userId = userIdFromLink(author);
                    const container = author.closest('article, .nsk-content, .reply, .comment');
                    if (!userId || !container) return;
                    const normalized = NodeSeekUserLabelRules.normalizeText(container.textContent || '');
                    if (!normalized) return;
                    const url = location.href;
                    const fingerprint = simpleHash(normalized);
                    const list = Array.isArray(observations[userId]) ? observations[userId] : [];
                    if (list.some(entry => entry.kind === 'comment' && entry.fingerprint === fingerprint && entry.url === url)) return;
                    list.unshift({ kind: 'comment', fingerprint, short: normalized.length <= 8, url, seenAt: Date.now() });
                    observations[userId] = list.slice(0, 60);
                    changed = true;
                });
                if (changed) writeJson(OBSERVATIONS_KEY, observations);
            }

            function topicPrimaryText() {
                const author = topicAuthorCandidate()?.link;
                const container = author && author.closest('article, .nsk-content, .post, .topic');
                const source = container || document.querySelector('article, .nsk-content, .post-content, .topic-content');
                if (!source) return '';
                const copy = source.cloneNode(true);
                copy.querySelectorAll('.reply, .comment, .comments, .post-comments, .nsk-reply, #ns-risk-evidence-prompt, .ns-user-label-badges').forEach(node => node.remove());
                return String(copy.innerText || copy.textContent || '').slice(0, 30000);
            }

            function topicTitleText() {
                const title = document.querySelector('.topic-title, .article-title, .thread-title, .post-title, .content-title, h1');
                return String(title && title.textContent || document.title || '').replace(/\s*-\s*NodeSeek\s*$/i, '').trim();
            }

            function riskContextDetected() {
                if (!topicIdFromPath()) return false;
                const category = Array.from(document.querySelectorAll('a[href*="/categories/"], a[href*="/category/"]')).some(link => /曝光/.test(link.textContent || ''));
                return NodeSeekUserLabelRules.hasRiskContext(topicTitleText(), topicPrimaryText(), category);
            }

            function riskCandidates() {
                const mentioned = new Set(NodeSeekUserLabelRules.riskMentionNames(topicTitleText() + '\n' + topicPrimaryText()).map(normalizedUsername));
                const result = [];
                const seen = new Set();
                document.querySelectorAll('a[href*="/space/"]').forEach(link => {
                    const username = String(link.textContent || '').trim();
                    const userId = userIdFromLink(link);
                    if (!username || !userId || !mentioned.has(normalizedUsername(username)) || seen.has(userId)) return;
                    seen.add(userId);
                    result.push({ username, userId });
                });
                return result;
            }

            function markRiskPromptHandled(status) {
                const states = readJson(RISK_PROMPT_STATE_KEY, {});
                states[topicPageKey()] = { status: status || 'ignored', handledAt: Date.now() };
                const entries = Object.entries(states)
                    .sort((a, b) => Number(b[1]?.handledAt || 0) - Number(a[1]?.handledAt || 0))
                    .slice(0, 500);
                writeJson(RISK_PROMPT_STATE_KEY, Object.fromEntries(entries));
            }

            function isRiskPromptHandled() {
                return Boolean(readJson(RISK_PROMPT_STATE_KEY, {})[topicPageKey()]);
            }

            function recordRiskEvidence() {
                const candidates = riskCandidates();
                const hint = candidates.length ? '\n页面明确提及：' + candidates.map(item => item.username).join('、') : '';
                const identity = prompt('请输入需要记录的用户名或用户主页编号。不会自动把发帖人标为风险用户。' + hint, candidates[0]?.username || '');
                if (identity === null || !identity.trim()) return;
                const value = identity.trim();
                const matched = candidates.find(item => item.userId === value || normalizedUsername(item.username) === normalizedUsername(value));
                let userId = matched?.userId || (/^\d+$/.test(value) ? value : '');
                let username = matched?.username || (/^\d+$/.test(value) ? '' : value);
                if (!username && userId) {
                    const link = Array.from(document.querySelectorAll('a[href*="/space/' + userId + '"]')).find(Boolean);
                    username = link ? String(link.textContent || '').trim() : '用户 ' + userId;
                }
                const note = prompt('请输入风险说明或个人备注：', '交易争议，需自行核对原帖');
                if (note === null) return;
                if (!confirm('确定为“' + username + '”保存个人风险标签和当前页面链接？')) return;
                const key = userId || 'name:' + normalizedUsername(username);
                addManualLabel(key, username, 'risk', '风险', location.href, note);
                markRiskPromptHandled('recorded');
                const banner = document.getElementById('ns-risk-evidence-prompt');
                if (banner) banner.remove();
            }

            function showRiskPrompt() {
                const settings = getSettings();
                const pageKey = topicPageKey();
                if (!settings.enabled || !settings.riskPrompt || !riskContextDetected() || isRiskPromptHandled() || riskPromptUrl === pageKey) return;
                riskPromptUrl = pageKey;
                const old = document.getElementById('ns-risk-evidence-prompt');
                if (old) old.remove();
                const banner = document.createElement('div');
                banner.id = 'ns-risk-evidence-prompt';
                const text = document.createElement('span');
                text.textContent = '检测到曝光或交易争议内容，是否记录个人风险证据？';
                const record = document.createElement('button');
                record.type = 'button';
                record.textContent = '记录证据';
                record.onclick = recordRiskEvidence;
                const dismiss = document.createElement('button');
                dismiss.type = 'button';
                dismiss.textContent = '忽略本页';
                dismiss.onclick = function () {
                    markRiskPromptHandled('ignored');
                    banner.remove();
                };
                banner.appendChild(text);
                banner.appendChild(record);
                banner.appendChild(dismiss);
                document.body.appendChild(banner);
            }

            function refresh(root) {
                refreshBadges(root);
                collectPassiveObservations();
                showRiskPrompt();
                scheduleAutoScan();
            }

            function exportData() {
                return getLabelsData();
            }

            function importData(data) {
                if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
                const clean = {};
                Object.entries(data).forEach(([key, record]) => {
                    if (!record || typeof record !== 'object') return;
                    const labels = {};
                    Object.entries(record.labels || {}).forEach(([type, label]) => {
                        if (!isSupportedLabelType(type) || !label || typeof label !== 'object') return;
                        labels[type] = {
                            ...label,
                            name: labelTitle(type),
                            evidence: compactEvidence(label.evidence)
                        };
                    });
                    clean[key] = {
                        userId: record.userId ? String(record.userId) : '',
                        username: String(record.username || '').slice(0, 64),
                        labels,
                        ignored: record.ignored && typeof record.ignored === 'object' ? record.ignored : {},
                        note: String(record.note || '').slice(0, 500)
                    };
                });
                setLabelsData(clean);
                return true;
            }

            setTimeout(function () { refresh(); }, 1800);
            window.addEventListener('hashchange', function () { setTimeout(refresh, 500); });

            return {
                getSettings,
                setSettings,
                exportData,
                importData,
                refresh,
                refreshBadges,
                showManagerDialog,
                showDetailDialog,
                addManualLabel,
                recordRiskEvidence,
                scanUser,
                getLabelsData,
                getScanCache
            };
        })();
    }
