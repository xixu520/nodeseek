    function ensureNsModules() {
        const read = (key, fallback) => {
            try {
                const raw = localStorage.getItem(key);
                return raw ? JSON.parse(raw) : fallback;
            } catch (e) {
                return fallback;
            }
        };
        const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
        const log = message => {
            if (typeof addLog === 'function') addLog(message);
        };
        const timeText = value => {
            const date = value ? new Date(value) : new Date();
            if (Number.isNaN(date.getTime())) return '';
            return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0') + ' ' + String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0') + ':' + String(date.getSeconds()).padStart(2, '0');
        };
        const drag = dialog => {
            if (!dialog || dialog.dataset.nsDragReady) return;
            dialog.dataset.nsDragReady = '1';
            const handle = document.createElement('div');
            handle.style.cssText = 'position:absolute;left:0;top:0;width:48px;height:38px;cursor:move;';
            dialog.appendChild(handle);
            handle.onmousedown = event => {
                event.preventDefault();
                const rect = dialog.getBoundingClientRect();
                const startX = event.clientX;
                const startY = event.clientY;
                const move = e => {
                    dialog.style.right = 'auto';
                    dialog.style.left = (rect.left + e.clientX - startX) + 'px';
                    dialog.style.top = (rect.top + e.clientY - startY) + 'px';
                    dialog.style.transform = 'none';
                };
                const up = () => {
                    document.removeEventListener('mousemove', move);
                    document.removeEventListener('mouseup', up);
                };
                document.addEventListener('mousemove', move);
                document.addEventListener('mouseup', up);
            };
        };
        const box = (id, title, width) => {
            const old = document.getElementById(id);
            if (old) {
                old.remove();
                return null;
            }
            const dialog = document.createElement('div');
            dialog.id = id;
            dialog.style.cssText = 'position:fixed;top:80px;right:16px;z-index:10001;background:#fff;border:1px solid #ccc;border-radius:8px;box-shadow:0 2px 12px rgba(0,0,0,.15);padding:14px;max-height:82vh;overflow:auto;box-sizing:border-box;width:' + (window.innerWidth <= 767 ? '92%' : width) + ';';
            const head = document.createElement('div');
            head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;';
            const strong = document.createElement('strong');
            strong.textContent = title;
            const close = document.createElement('button');
            close.textContent = '×';
            close.className = 'close-btn';
            close.onclick = () => dialog.remove();
            head.appendChild(strong);
            head.appendChild(close);
            dialog.appendChild(head);
            document.body.appendChild(dialog);
            drag(dialog);
            return dialog;
        };
        const normalizeUrl = value => {
            try {
                const url = new URL(value || location.href);
                let path = url.pathname;
                const post = path.match(/^\/post-(\d+)-\d+$/);
                if (post) path = '/post-' + post[1] + '-1';
                return url.origin + path + url.search;
            } catch (e) {
                return String(value || '').split('#')[0];
            }
        };

        if (!window.NodeSeekFriends) {
            const key = 'nodeseek_friends';
            const clean = list => Array.isArray(list) ? list.filter(item => item && item.username).map(item => ({
                username: String(item.username).trim(),
                remark: item.remark ? String(item.remark) : '',
                timestamp: item.timestamp || new Date().toISOString(),
                pmUrl: item.pmUrl || ''
            })).filter(item => item.username) : [];
            const getFriendsData = () => clean(read(key, []));
            const setFriendsData = list => write(key, clean(list));
            const isFriendUser = username => getFriendsData().some(item => item.username === username);
            const updateFriendRemark = (username, remark) => {
                const list = getFriendsData();
                const item = list.find(row => row.username === username);
                if (!item) return false;
                item.remark = remark || '';
                setFriendsData(list);
                highlightFriends(username);
                return true;
            };
            const addFriendUser = (username, remark) => {
                const name = String(username || '').trim();
                if (!name) return false;
                const list = getFriendsData().filter(item => item.username !== name);
                list.unshift({ username: name, remark: remark || '', timestamp: new Date().toISOString(), pmUrl: location.href.includes('/talk') ? location.href : '' });
                setFriendsData(list);
                log('将用户 ' + name + ' 加入好友');
                highlightFriends(name);
                return true;
            };
            const removeFriendUser = (username, silent) => {
                const name = String(username || '').trim();
                setFriendsData(getFriendsData().filter(item => item.username !== name));
                if (!silent) log('将用户 ' + name + ' 从好友中移除');
                document.querySelectorAll('a.author-name').forEach(link => {
                    if ((link.textContent || '').trim() !== name) return;
                    link.classList.remove('friend-user');
                    link.parentNode?.querySelectorAll('.friend-remark').forEach(el => el.remove());
                });
                return true;
            };
            function highlightFriends(targetUsername) {
                const data = new Map(getFriendsData().map(item => [item.username, item]));
                document.querySelectorAll('a.author-name').forEach(link => {
                    const name = (link.textContent || '').trim();
                    if (targetUsername && name !== targetUsername) return;
                    link.classList.remove('friend-user');
                    link.parentNode?.querySelectorAll('.friend-remark').forEach(el => el.remove());
                    const item = data.get(name);
                    if (!item) return;
                    link.classList.add('friend-user');
                    if (item.remark) {
                        const span = document.createElement('span');
                        span.className = 'friend-remark';
                        span.textContent = '(' + item.remark + ')';
                        span.title = item.remark;
                        link.after(span);
                    }
                });
            }
            const showFriendsDialog = () => {
                const dialog = box('friends-dialog', '好友', '620px');
                if (!dialog) return;
                const list = getFriendsData();
                if (!list.length) {
                    const empty = document.createElement('div');
                    empty.textContent = '暂无好友';
                    empty.style.cssText = 'text-align:center;color:#888;margin:18px 0;';
                    dialog.appendChild(empty);
                    return;
                }
                const table = document.createElement('table');
                table.style.cssText = 'width:100%;border-collapse:collapse;';
                table.innerHTML = '<thead><tr><th style="text-align:left;font-size:13px;">用户名</th><th style="text-align:left;font-size:13px;">备注</th><th style="text-align:left;font-size:13px;">添加时间</th><th></th></tr></thead>';
                const tbody = document.createElement('tbody');
                table.appendChild(tbody);
                list.forEach(item => {
                    const tr = document.createElement('tr');
                    tr.style.borderBottom = '1px solid #eee';
                    const user = document.createElement('td');
                    user.textContent = item.username;
                    user.style.color = '#2ea44f';
                    user.style.fontWeight = 'bold';
                    const remark = document.createElement('td');
                    remark.textContent = item.remark || '　';
                    remark.style.cursor = 'pointer';
                    remark.onclick = () => {
                        const next = prompt('请输入好友备注：', item.remark || '');
                        if (next === null) return;
                        updateFriendRemark(item.username, next);
                        remark.textContent = next || '　';
                    };
                    const time = document.createElement('td');
                    time.textContent = timeText(item.timestamp);
                    const op = document.createElement('td');
                    const del = document.createElement('button');
                    del.textContent = '移除';
                    del.className = 'blacklist-btn red';
                    del.onclick = () => {
                        if (!confirm('确定要删除该好友？')) return;
                        removeFriendUser(item.username);
                        tr.remove();
                    };
                    op.appendChild(del);
                    [user, remark, time, op].forEach(td => {
                        td.style.padding = '6px 4px';
                        tr.appendChild(td);
                    });
                    tbody.appendChild(tr);
                });
                dialog.appendChild(table);
            };
            window.NodeSeekFriends = {
                getFriends: getFriendsData,
                setFriends: setFriendsData,
                addFriend: addFriendUser,
                removeFriend: removeFriendUser,
                isFriend: isFriendUser,
                showFriendsDialog,
                updateFriendRemark,
                highlightFriends,
                updateFriendsDialogWithNewUser: () => { },
                removeFriendFromDialog: () => { }
            };
        }

        if (!window.NodeSeekHistory) {
            const getBrowseHistoryData = () => Array.isArray(read(BROWSE_HISTORY_KEY, [])) ? read(BROWSE_HISTORY_KEY, []) : [];
            const setBrowseHistoryData = list => write(BROWSE_HISTORY_KEY, Array.isArray(list) ? list : []);
            const addToBrowseHistoryData = (title, url) => {
                const target = normalizeUrl(url || location.href);
                const old = getBrowseHistoryData().find(item => normalizeUrl(item.url) === target);
                const list = getBrowseHistoryData().filter(item => normalizeUrl(item.url) !== target);
                list.unshift({ title: title || url || location.href, url: url || location.href, time: new Date().toISOString(), count: old?.count ? old.count + 1 : 1 });
                setBrowseHistoryData(list.slice(0, 500));
            };
            const clearBrowseHistoryData = () => localStorage.removeItem(BROWSE_HISTORY_KEY);
            const cleanupDuplicateHistoryData = () => {
                const seen = new Set();
                const next = [];
                getBrowseHistoryData().forEach(item => {
                    const key = normalizeUrl(item.url);
                    if (seen.has(key)) return;
                    seen.add(key);
                    next.push(item);
                });
                const changed = next.length !== getBrowseHistoryData().length;
                if (changed) setBrowseHistoryData(next);
                return changed;
            };
            const showDialog = () => {
                const dialog = box('browse-history-dialog', '历史浏览记录', '760px');
                if (!dialog) return;
                const clear = document.createElement('button');
                clear.textContent = '清空';
                clear.className = 'blacklist-btn red';
                clear.onclick = () => {
                    if (!confirm('确定要清空历史浏览记录？')) return;
                    clearBrowseHistoryData();
                    dialog.remove();
                };
                dialog.appendChild(clear);
                const list = getBrowseHistoryData();
                const pre = document.createElement('div');
                pre.style.cssText = 'white-space:pre-wrap;margin-top:10px;';
                pre.textContent = list.length ? list.map(item => (item.title || item.url) + '\n' + item.url + '\n访问：' + timeText(item.time || item.timestamp) + '，次数：' + (item.count || 1)).join('\n\n') : '暂无历史浏览记录';
                dialog.appendChild(pre);
            };
            window.NodeSeekHistory = {
                getBrowseHistory: getBrowseHistoryData,
                setBrowseHistory: setBrowseHistoryData,
                addToBrowseHistory: addToBrowseHistoryData,
                clearBrowseHistory: clearBrowseHistoryData,
                cleanupDuplicateHistory: cleanupDuplicateHistoryData,
                showDialog
            };
        }

        if (!window.NodeSeekClockIn) {
            let timer = null;
            let running = false;
            let logFn = log;
            const SIGN_LAST_SUCCESS_DATE_KEY = 'nodeseek_sign_last_success_date';
            const SIGN_LAST_ATTEMPT_AT_KEY = 'nodeseek_sign_last_attempt_at';
            const SIGN_LAST_RESULT_KEY = 'nodeseek_sign_last_result';
            const SIGN_ATTEMPT_INTERVAL = 10 * 60 * 1000;

            function signDateKey(date) {
                const target = date || new Date();
                return target.getFullYear() + '-' +
                    String(target.getMonth() + 1).padStart(2, '0') + '-' +
                    String(target.getDate()).padStart(2, '0');
            }

            function isSignEnabled() {
                return localStorage.getItem('nodeseek_sign_enabled') !== 'false';
            }

            function setSignResult(message) {
                localStorage.setItem(SIGN_LAST_RESULT_KEY, message || '');
                logFn(message || '自动签到：已执行');
            }

            function cacheTodaySigned(message) {
                localStorage.setItem(SIGN_LAST_SUCCESS_DATE_KEY, signDateKey());
                setSignResult(message || '自动签到：今日已签到');
            }

            async function readBoardAttendance() {
                const response = await fetch('/api/attendance/board?page=1', {
                    method: 'GET',
                    credentials: 'include'
                });
                return response.json();
            }

            async function postBoardAttendance() {
                const random = (localStorage.getItem('nodeseek_sign_mode') || 'fixed') === 'random';
                const response = await fetch('/api/attendance?random=' + String(random), {
                    method: 'POST',
                    credentials: 'include'
                });
                return response.json();
            }

            async function runDailyBoardSign(force) {
                if (!isSignEnabled()) return false;
                if (running) return false;
                const today = signDateKey();
                if (localStorage.getItem(SIGN_LAST_SUCCESS_DATE_KEY) === today) return true;
                const lastAttempt = parseInt(localStorage.getItem(SIGN_LAST_ATTEMPT_AT_KEY) || '0', 10) || 0;
                if (!force && lastAttempt && Date.now() - lastAttempt < SIGN_ATTEMPT_INTERVAL) return false;

                running = true;
                localStorage.setItem(SIGN_LAST_ATTEMPT_AT_KEY, String(Date.now()));
                try {
                    const board = await readBoardAttendance();
                    if (board && board.record) {
                        cacheTodaySigned('自动签到：今日已签到');
                        return true;
                    }
                    if (!board || !Array.isArray(board.list)) {
                        setSignResult('自动签到：未能读取签到页面');
                        return false;
                    }
                    const result = await postBoardAttendance();
                    if (result && result.success) {
                        cacheTodaySigned('自动签到：' + (result.message || '签到成功'));
                        return true;
                    }
                    if (result && /已签到|今日已/.test(String(result.message || ''))) {
                        cacheTodaySigned('自动签到：' + (result.message || '今日已签到'));
                        return true;
                    }
                    setSignResult('自动签到：' + ((result && result.message) || '签到失败'));
                    return false;
                } catch (e) {
                    setSignResult('自动签到：请求失败');
                    return false;
                } finally {
                    running = false;
                    scheduleNextHourlySign();
                }
            }

            const scheduleNextHourlySign = () => {
                if (timer) clearTimeout(timer);
                if (!isSignEnabled()) return;
                const now = new Date();
                const next = new Date(now);
                next.setHours(24, 5, 0, 0);
                const delay = Math.max(60 * 1000, next.getTime() - now.getTime());
                timer = setTimeout(() => {
                    runDailyBoardSign(true);
                }, delay);
            };
            window.NodeSeekClockIn = {
                setAddLogFunction: fn => { if (typeof fn === 'function') logFn = fn; },
                setSignMode: mode => { localStorage.setItem('nodeseek_sign_mode', mode === 'random' ? 'random' : 'fixed'); scheduleNextHourlySign(); },
                scheduleNextHourlySign,
                runDailyBoardSign
            };
            setTimeout(() => runDailyBoardSign(false), 1500);
            scheduleNextHourlySign();
        }

        if (!window.NodeSeekRegister) {
            let logFn = log;
            window.NodeSeekRegister = {
                setAddLogFunction: fn => { if (typeof fn === 'function') logFn = fn; },
                getChickenLegStats: () => ({
                    lastFetch: localStorage.getItem('nodeseek_chicken_leg_last_fetch') || '',
                    nextAllow: localStorage.getItem('nodeseek_chicken_leg_next_allow') || '',
                    lastHtml: localStorage.getItem('nodeseek_chicken_leg_last_html') || '',
                    history: read('nodeseek_chicken_leg_history', [])
                }),
                setChickenLegStats: stats => {
                    if (!stats || typeof stats !== 'object') return;
                    if (stats.lastFetch) localStorage.setItem('nodeseek_chicken_leg_last_fetch', stats.lastFetch);
                    if (stats.nextAllow) localStorage.setItem('nodeseek_chicken_leg_next_allow', stats.nextAllow);
                    if (stats.lastHtml) localStorage.setItem('nodeseek_chicken_leg_last_html', stats.lastHtml);
                    if (Array.isArray(stats.history)) write('nodeseek_chicken_leg_history', stats.history);
                },
                showChickenLegStatsDialog: () => {
                    const dialog = box('chicken-leg-stats-dialog', '鸡腿统计', '420px');
                    if (!dialog) return;
                    const stats = window.NodeSeekRegister.getChickenLegStats();
                    const pre = document.createElement('pre');
                    pre.style.cssText = 'white-space:pre-wrap;background:#f5f5f5;padding:10px;';
                    pre.textContent = '上次获取：' + (timeText(stats.lastFetch) || '暂无') + '\n下次允许：' + (timeText(stats.nextAllow) || '暂无') + '\n历史条数：' + (Array.isArray(stats.history) ? stats.history.length : 0);
                    dialog.appendChild(pre);
                    logFn('鸡腿统计：已打开');
                }
            };
        }

        if (!window.NodeSeekFocus) {
            window.NodeSeekFocus = {
                showHotTopicsDialog: () => {
                    const dialog = box('hot-topics-dialog', '热点统计', '520px');
                    if (!dialog) return;
                    const text = Array.from(document.querySelectorAll('a[href*="/post-"],a[href*="/topic/"],a[href*="/article/"]')).map(a => (a.textContent || '').trim()).filter(Boolean).slice(0, 80).join('\n');
                    const pre = document.createElement('pre');
                    pre.style.cssText = 'white-space:pre-wrap;background:#f5f5f5;padding:10px;';
                    pre.textContent = text || '暂无热点数据';
                    dialog.appendChild(pre);
                }
            };
        }

        if (!window.NodeSeekVPS) {
            window.NodeSeekVPS = {
                showCalculatorDialog: () => {
                    const dialog = box('vps-calculator-dialog', 'VPS计算器', '360px');
                    if (!dialog) return;
                    const price = document.createElement('input');
                    price.type = 'number';
                    price.placeholder = '月付价格';
                    const rate = document.createElement('input');
                    rate.type = 'number';
                    rate.value = '7.2';
                    rate.placeholder = '汇率';
                    const result = document.createElement('pre');
                    result.textContent = '请输入价格';
                    [price, rate].forEach(input => {
                        input.style.cssText = 'width:100%;box-sizing:border-box;margin-bottom:8px;padding:6px;';
                        input.oninput = () => {
                            const p = parseFloat(price.value || '0');
                            const r = parseFloat(rate.value || '0');
                            result.textContent = p && r ? '月付约 ' + (p * r).toFixed(2) + ' 元\n年付约 ' + (p * r * 12).toFixed(2) + ' 元' : '请输入价格';
                        };
                        dialog.appendChild(input);
                    });
                    result.style.cssText = 'white-space:pre-wrap;background:#f5f5f5;padding:10px;';
                    dialog.appendChild(result);
                }
            };
        }

        if (!window.NodeSeekNotes) {
            const getNotes = () => Array.isArray(read('nodeseek_notes_data', [])) ? read('nodeseek_notes_data', []) : [];
            const setNotes = list => write('nodeseek_notes_data', Array.isArray(list) ? list : []);
            window.NodeSeekNotes = {
                exportNotesData: () => ({
                    categories: read('nodeseek_notes_categories', ['默认']),
                    notes: getNotes(),
                    fontColors: read('nodeseek_notes_font_colors', {}),
                    bgColors: read('nodeseek_notes_bg_colors', {}),
                    lastSelectedNote: read('nodeseek_notes_last_selected', null),
                    trash: read('nodeseek_notes_trash', [])
                }),
                importNotesData: data => {
                    if (!data || typeof data !== 'object') return false;
                    if (Array.isArray(data.categories)) write('nodeseek_notes_categories', data.categories);
                    if (Array.isArray(data.notes)) setNotes(data.notes);
                    if (data.fontColors) write('nodeseek_notes_font_colors', data.fontColors);
                    if (data.bgColors) write('nodeseek_notes_bg_colors', data.bgColors);
                    if (data.lastSelectedNote) write('nodeseek_notes_last_selected', data.lastSelectedNote);
                    if (Array.isArray(data.trash)) write('nodeseek_notes_trash', data.trash);
                    return true;
                },
                showNotesDialog: () => {
                    const dialog = box('notes-dialog', '笔记', '520px');
                    if (!dialog) return;
                    const title = document.createElement('input');
                    title.placeholder = '标题';
                    const content = document.createElement('textarea');
                    content.placeholder = '内容';
                    const save = document.createElement('button');
                    save.textContent = '保存笔记';
                    save.className = 'blacklist-btn';
                    const listBox = document.createElement('div');
                    [title, content, save].forEach(el => {
                        el.style.cssText = 'width:100%;box-sizing:border-box;margin-bottom:8px;padding:6px;';
                        dialog.appendChild(el);
                    });
                    dialog.appendChild(listBox);
                    const render = () => {
                        const list = getNotes();
                        listBox.innerHTML = list.length ? '' : '<div style="text-align:center;color:#888;">暂无笔记</div>';
                        list.forEach((note, index) => {
                            const row = document.createElement('div');
                            row.style.cssText = 'border-top:1px solid #eee;padding:8px 0;white-space:pre-wrap;';
                            row.textContent = (note.title || '无标题') + '\n' + (note.content || '');
                            const del = document.createElement('button');
                            del.textContent = '删除';
                            del.className = 'blacklist-btn red';
                            del.onclick = () => {
                                const next = getNotes();
                                next.splice(index, 1);
                                setNotes(next);
                                render();
                            };
                            row.appendChild(document.createElement('br'));
                            row.appendChild(del);
                            listBox.appendChild(row);
                        });
                    };
                    save.onclick = () => {
                        if (!title.value.trim() && !content.value.trim()) return;
                        const list = getNotes();
                        list.unshift({ title: title.value.trim() || '无标题', content: content.value, category: '默认', createdAt: new Date().toISOString() });
                        setNotes(list);
                        title.value = '';
                        content.value = '';
                        render();
                    };
                    render();
                }
            };
        }

        if (!window.NodeSeekNodeImage) {
            window.NodeSeekNodeImage = {
                open: () => showSafariNodeImageDialog(),
                insertIntoForumEditor: text => {
                    return typeof insertTextToNodeSeekEditor === 'function' ? insertTextToNodeSeekEditor(text) : false;
                }
            };
        }
    }
