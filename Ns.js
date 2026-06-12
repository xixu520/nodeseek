// ==UserScript==
// @name         NodeseekLite
// @namespace    http://tampermonkey.net/
// @version      2026.06.12.5
// @description  NodeSeek 论坛综合插件，源码按模块维护，发布为单文件脚本
// @match        https://www.nodeseek.com/*
// @updateURL    https://raw.githubusercontent.com/xixu520/nodeseek/main/Ns.user.js
// @downloadURL  https://raw.githubusercontent.com/xixu520/nodeseek/main/Ns.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_info
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue

// @connect      api.nodeimage.com
// @connect      www.nodeimage.com
// @connect      cdn.nodeimage.com
// @connect      *
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // --------------------------------------------------------
    // 新增功能：跳过跳转提示页面
    // 检查开关状态 (默认为 false)
    const skipJumpVal = localStorage.getItem('nodeseek_skip_jump_page');
    const isSkipJumpEnabled = skipJumpVal === null ? false : skipJumpVal === 'true';
    if (isSkipJumpEnabled) {
        if (location.pathname === '/jump' && location.search.includes('to=')) {
            const params = new URLSearchParams(location.search);
            if (params.has('to')) {
                const target = params.get('to');
                if (target) {
                    try {
                        const targetUrlStr = decodeURIComponent(target);
                        const targetUrl = new URL(targetUrlStr);
                        const targetDomain = targetUrl.hostname;

                        const modeRaw = localStorage.getItem('nodeseek_skip_jump_mode');
                        const mode = (modeRaw === 'whitelist') ? 'whitelist' : 'all';
                        const listSaved = localStorage.getItem('nodeseek_skip_jump_list');
                        const list = listSaved ? JSON.parse(listSaved) : [];

                        let shouldSkip = true;
                        if (mode === 'whitelist') {
                            // 如果是白名单模式，且名单为空，则不跳过（即显示跳转提醒）
                            if (list.length === 0) {
                                shouldSkip = false;
                            } else {
                                // 仅匹配域名本身或其子域名
                                shouldSkip = list.some(domain => targetDomain === domain || targetDomain.endsWith('.' + domain));
                            }
                        }

                        if (shouldSkip) {
                            // 立即跳转
                            window.location.replace(targetUrlStr);
                            return; // 停止执行后续脚本
                        }
                    } catch (e) {
                        // URL 解析失败，按原逻辑直接跳转
                        window.location.replace(decodeURIComponent(target));
                        return;
                    }
                }
            }
        }
    }
    // --------------------------------------------------------

    // 黑名单数据结构：{ username: {remark: 'xxx'} }
    const STORAGE_KEY = 'nodeseek_blacklist';


    // 新增：折叠状态的存储键
    const COLLAPSED_STATE_KEY = 'nodeseek_buttons_collapsed';
    const COLLAPSED_POSITION_KEY = 'nodeseek_collapsed_position';
    const COLLAPSED_MOVE_LOCK_KEY = 'nodeseek_collapsed_move_locked';
    const PANEL_THEME_MODE_KEY = 'nodeseek_panel_theme_mode';

    // 新增：用户数据缓存的存储键
    const USER_DATA_CACHE_KEY = 'nodeseek_user_data_cache';

    const VIEWED_HISTORY_ENABLED_KEY = 'nodeseek_viewed_history_enabled';
    const VIEWED_COLOR_KEY = 'nodeseek_viewed_color';
    // 新增：跳过跳转页面开关
    const SKIP_JUMP_PAGE_KEY = 'nodeseek_skip_jump_page';
    const SKIP_JUMP_MODE_KEY = 'nodeseek_skip_jump_mode'; // 'blacklist' or 'whitelist'
    const SKIP_JUMP_LIST_KEY = 'nodeseek_skip_jump_list'; // Array of domains

    // 新增：浏览历史记录的存储键
    const BROWSE_HISTORY_KEY = 'nodeseek_browse_history';

    // 新增：新标签页打开帖子开关
    const OPEN_POST_NEW_TAB_KEY = 'nodeseek_open_post_new_tab';

    // WebDAV 同步设置
    const WEBDAV_SYNC_CONFIG_KEY = 'nodeseek_webdav_sync_config';
    const WEBDAV_SYNC_PASSWORD_KEY = 'nodeseek_webdav_sync_password';
    const WEBDAV_SYNC_LOCAL_CHANGED_AT_KEY = 'nodeseek_webdav_local_changed_at';
    const WEBDAV_SYNC_LAST_SYNC_AT_KEY = 'nodeseek_webdav_last_sync_at';
    const WEBDAV_SYNC_LAST_REMOTE_UPDATED_AT_KEY = 'nodeseek_webdav_last_remote_updated_at';
    const WEBDAV_SYNC_LOCK_KEY = 'nodeseek_webdav_sync_lock';
    const WEBDAV_SYNC_DEVICE_ID_KEY = 'nodeseek_webdav_device_id';
    const WEBDAV_SYNC_FILE_NAME = 'nodeseek_data.json';
    const WEBDAV_SYNC_DEBOUNCE_MS = 5000;
    const WEBDAV_SYNC_LOCK_TTL_MS = 120000;
    const WEBDAV_SYNC_FIELD_OPTIONS = [
        { key: 'blacklist', label: '黑名单', dataKeys: ['blacklist'] },
        { key: 'friends', label: '好友', dataKeys: ['friends'] },
        { key: 'logs', label: '操作日志', dataKeys: ['logs'] },
        { key: 'browseHistory', label: '浏览历史', dataKeys: ['browseHistory'] },
        { key: 'quickReplies', label: '快捷回复', dataKeys: ['quickReplies', 'quickReplySettings'] },
        { key: 'signSettings', label: '签到设置', dataKeys: ['signSettings'] },
        { key: 'skipJumpSettings', label: '跳转设置', dataKeys: ['skipJumpSettings'] },
        { key: 'openPostNewTabSettings', label: '新标签打开设置', dataKeys: ['openPostNewTabSettings'] },
        { key: 'chickenLegStats', label: '鸡腿统计', dataKeys: ['chickenLegStats'] },
        { key: 'filterData', label: '关键词过滤', dataKeys: ['filterData'] },
        { key: 'notesData', label: '笔记', dataKeys: ['notesData'] },
        { key: 'viewedTitles', label: '阅读记忆', dataKeys: ['viewedTitles'] },
        { key: 'backupLimit', label: '备份设置', dataKeys: ['backupLimit'] }
    ];
    let webdavSyncTimer = null;
    let webdavChangeSyncTimer = null;
    let isWebdavApplyingRemoteData = false;
    const webdavPageId = 'page-' + Date.now() + '-' + Math.random().toString(36).slice(2);

    function isWebdavTrackedStorageKey(key) {
        if (!key) return false;
        if (key === WEBDAV_SYNC_CONFIG_KEY || key === WEBDAV_SYNC_LOCAL_CHANGED_AT_KEY || key === WEBDAV_SYNC_LAST_SYNC_AT_KEY || key === WEBDAV_SYNC_LAST_REMOTE_UPDATED_AT_KEY || key === WEBDAV_SYNC_LOCK_KEY || key === WEBDAV_SYNC_DEVICE_ID_KEY) return false;
        if (key === PANEL_THEME_MODE_KEY || key === COLLAPSED_STATE_KEY || key === USER_DATA_CACHE_KEY) return false;
        if (key === 'nodeseek_sign_logs') return false;
        return key.startsWith('nodeseek_') || key.startsWith('ns-filter-') || key.startsWith('ns_');
    }

    function markWebdavLocalChanged(key) {
        if (isWebdavApplyingRemoteData) return;
        if (!isWebdavTrackedStorageKey(key)) return;
        localStorage.setItem(WEBDAV_SYNC_LOCAL_CHANGED_AT_KEY, String(Date.now()));
        scheduleWebdavChangeSync();
    }

    const originalLocalStorageSetItem = Storage.prototype.setItem;
    const originalLocalStorageRemoveItem = Storage.prototype.removeItem;

    Storage.prototype.setItem = function (key, value) {
        const result = originalLocalStorageSetItem.apply(this, arguments);
        if (this === localStorage) markWebdavLocalChanged(String(key));
        return result;
    };

    Storage.prototype.removeItem = function (key) {
        const result = originalLocalStorageRemoveItem.apply(this, arguments);
        if (this === localStorage) markWebdavLocalChanged(String(key));
        return result;
    };

    function getOpenPostNewTabEnabled() {
        const val = localStorage.getItem(OPEN_POST_NEW_TAB_KEY);
        return val === 'true'; // 默认关闭
    }

    function setOpenPostNewTabEnabled(enabled) {
        localStorage.setItem(OPEN_POST_NEW_TAB_KEY, enabled.toString());
    }

    // 新增：获取是否开启跳过跳转页面
    function getSkipJumpPageEnabled() {
        const val = localStorage.getItem(SKIP_JUMP_PAGE_KEY);
        return val === null ? false : val === 'true'; // 默认关闭
    }

    // 新增：设置是否开启跳过跳转页面
    function setSkipJumpPageEnabled(enabled) {
        localStorage.setItem(SKIP_JUMP_PAGE_KEY, enabled.toString());
    }

    // 新增：获取跳转模式
    function getSkipJumpMode() {
        const mode = localStorage.getItem(SKIP_JUMP_MODE_KEY);
        return (mode === 'whitelist') ? 'whitelist' : 'all'; // 默认为 all，处理旧有的 blacklist 为 all
    }

    // 新增：设置跳转模式
    function setSkipJumpMode(mode) {
        localStorage.setItem(SKIP_JUMP_MODE_KEY, mode);
    }

    // 新增：获取跳转名单列表
    function getSkipJumpList() {
        const saved = localStorage.getItem(SKIP_JUMP_LIST_KEY);
        try {
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    }

    // 新增：设置跳转名单列表
    function setSkipJumpList(list) {
        localStorage.setItem(SKIP_JUMP_LIST_KEY, JSON.stringify(list));
    }

    // 新增：获取阅读记忆开启状态
    function getViewedHistoryEnabled() {
        return localStorage.getItem(VIEWED_HISTORY_ENABLED_KEY) !== 'false'; // 默认开启
    }

    // 新增：保存阅读记忆开启状态
    function setViewedHistoryEnabled(enabled) {
        localStorage.setItem(VIEWED_HISTORY_ENABLED_KEY, enabled.toString());
    }

    // 新增：获取阅读后颜色
    function getViewedColor() {
        return localStorage.getItem(VIEWED_COLOR_KEY) || '#9aa0a6';
    }

    // 新增：保存阅读后颜色
    function setViewedColor(color) {
        localStorage.setItem(VIEWED_COLOR_KEY, color);
    }

    // 新增：浏览历史记录管理
    function getBrowseHistory() {
        if (window.NodeSeekHistory && window.NodeSeekHistory.getBrowseHistory) {
            return window.NodeSeekHistory.getBrowseHistory();
        }
        return JSON.parse(localStorage.getItem(BROWSE_HISTORY_KEY) || '[]');
    }

    function setBrowseHistory(list) {
        if (window.NodeSeekHistory && window.NodeSeekHistory.setBrowseHistory) {
            return window.NodeSeekHistory.setBrowseHistory(list);
        }
        localStorage.setItem(BROWSE_HISTORY_KEY, JSON.stringify(list));
    }

    function addToBrowseHistory(title, url) {
        if (window.NodeSeekHistory && window.NodeSeekHistory.addToBrowseHistory) {
            return window.NodeSeekHistory.addToBrowseHistory(title, url);
        }
    }

    function clearBrowseHistory() {
        if (window.NodeSeekHistory && window.NodeSeekHistory.clearBrowseHistory) {
            return window.NodeSeekHistory.clearBrowseHistory();
        }
        localStorage.removeItem(BROWSE_HISTORY_KEY);
    }

    // 新增：清理现有的重复记录
    function cleanupDuplicateHistory() {
        if (window.NodeSeekHistory && window.NodeSeekHistory.cleanupDuplicateHistory) {
            return window.NodeSeekHistory.cleanupDuplicateHistory();
        }
        return false;
    }

    // 读取黑名单
    function getBlacklist() {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    }

    // 保存黑名单
    function setBlacklist(list) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }


    // 新增：获取折叠状态
    function getCollapsedState() {
        return localStorage.getItem(COLLAPSED_STATE_KEY) === 'true';
    }

    // 新增：保存折叠状态
    function setCollapsedState(isCollapsed) {
        localStorage.setItem(COLLAPSED_STATE_KEY, isCollapsed.toString());
    }

    function getCollapsedPosition() {
        try {
            const value = JSON.parse(localStorage.getItem(COLLAPSED_POSITION_KEY) || 'null');
            if (value && Number.isFinite(value.left) && Number.isFinite(value.top)) return value;
        } catch (e) { }
        return null;
    }

    function setCollapsedPosition(position) {
        if (!position || !Number.isFinite(position.left) || !Number.isFinite(position.top)) return;
        localStorage.setItem(COLLAPSED_POSITION_KEY, JSON.stringify({
            left: Math.round(position.left),
            top: Math.round(position.top)
        }));
    }

    function getCollapsedMoveLockState() {
        return localStorage.getItem(COLLAPSED_MOVE_LOCK_KEY) === 'true';
    }

    function setCollapsedMoveLockState(isLocked) {
        localStorage.setItem(COLLAPSED_MOVE_LOCK_KEY, isLocked.toString());
        document.dispatchEvent(new CustomEvent('nodeseek-collapsed-lock-change', { detail: { locked: !!isLocked } }));
    }

    function getPanelThemeMode() {
        const saved = localStorage.getItem(PANEL_THEME_MODE_KEY);
        if (saved === 'dark' || saved === 'light') return saved;
        const root = document.documentElement;
        const pageTheme = root.getAttribute('data-theme');
        const isDarkByAttr = pageTheme === 'dark';
        const isDarkByClass = root.classList.contains('dark') || document.body?.classList?.contains('dark') || document.body?.classList?.contains('theme-dark');
        const isDarkByMedia = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const inferred = (isDarkByAttr || isDarkByClass || isDarkByMedia) ? 'dark' : 'light';
        localStorage.setItem(PANEL_THEME_MODE_KEY, inferred);
        return inferred;
    }

    function setPanelThemeMode(mode) {
        const safe = (mode === 'dark' || mode === 'light') ? mode : getPanelThemeMode();
        localStorage.setItem(PANEL_THEME_MODE_KEY, safe);
    }

    function applyPanelThemeMode(mode) {
        const root = document.documentElement;
        root.setAttribute('data-ns-theme', mode === 'dark' ? 'dark' : 'light');
    }

    function cyclePanelThemeMode() {
        const current = getPanelThemeMode();
        const next = current === 'dark' ? 'light' : 'dark';
        setPanelThemeMode(next);
        applyPanelThemeMode(next);
        return next;
    }

    function panelThemeModeLabel(mode) {
        return mode === 'dark' ? '暗' : '亮';
    }

    function panelThemeModeTitle(mode) {
        const text = mode === 'dark' ? '暗黑' : '亮色';
        return `主题：${text}，点击切换`;
    }

    try { applyPanelThemeMode(getPanelThemeMode()); } catch (e) { }

    // 新增：用户数据缓存管理
    const userDataPendingRequests = new Map();
    const userDataRequestQueue = [];
    const USER_DATA_REQUEST_TIMEOUT = 8000;
    const USER_DATA_MAX_CONCURRENT = 2;
    const USER_DATA_REQUEST_GAP = 500;
    const USER_DATA_FAILED_CACHE_KEY = 'nodeseek_user_data_failed_cache';
    const USER_DATA_RATE_LIMIT_UNTIL_KEY = 'nodeseek_user_data_rate_limit_until';
    const USER_DATA_FAILED_TTL = 5 * 60 * 1000;
    const USER_DATA_RATE_LIMIT_PAUSE = 5 * 60 * 1000;
    let userDataActiveRequests = 0;
    let userDataLastRequestAt = 0;
    let userDataQueueTimer = null;

    function getUserDataCache() {
        try {
            const cache = JSON.parse(localStorage.getItem(USER_DATA_CACHE_KEY) || '{}');
            if (!cache || typeof cache !== 'object') return {};
            // 清理过期缓存（1小时过期）
            const now = Date.now();
            const expireTime = 1 * 60 * 60 * 1000; // 1小时
            Object.keys(cache).forEach(userId => {
                if (cache[userId].timestamp && (now - cache[userId].timestamp) > expireTime) {
                    delete cache[userId];
                }
            });
            localStorage.setItem(USER_DATA_CACHE_KEY, JSON.stringify(cache));
            return cache;
        } catch (error) {
            console.warn('读取用户数据缓存失败，已重置:', error);
            localStorage.removeItem(USER_DATA_CACHE_KEY);
            return {};
        }
    }

    function setUserDataCache(userId, data) {
        try {
            const cache = getUserDataCache();
            cache[userId] = {
                ...data,
                timestamp: Date.now()
            };
            localStorage.setItem(USER_DATA_CACHE_KEY, JSON.stringify(cache));
        } catch (error) {
            console.warn('写入用户数据缓存失败:', error);
        }
    }

    function getUserDataFailedCache() {
        try {
            const cache = JSON.parse(localStorage.getItem(USER_DATA_FAILED_CACHE_KEY) || '{}');
            if (!cache || typeof cache !== 'object') return {};
            const now = Date.now();
            Object.keys(cache).forEach(userId => {
                if (!cache[userId] || now - cache[userId] > USER_DATA_FAILED_TTL) {
                    delete cache[userId];
                }
            });
            localStorage.setItem(USER_DATA_FAILED_CACHE_KEY, JSON.stringify(cache));
            return cache;
        } catch (error) {
            console.warn('读取用户数据失败缓存失败，已重置:', error);
            localStorage.removeItem(USER_DATA_FAILED_CACHE_KEY);
            return {};
        }
    }

    function setUserDataFailedCache(userId) {
        try {
            const cache = getUserDataFailedCache();
            cache[userId] = Date.now();
            localStorage.setItem(USER_DATA_FAILED_CACHE_KEY, JSON.stringify(cache));
        } catch (error) {
            console.warn('写入用户数据失败缓存失败:', error);
        }
    }

    function isUserDataFailedRecently(userId) {
        const cache = getUserDataFailedCache();
        return !!cache[userId] && Date.now() - cache[userId] <= USER_DATA_FAILED_TTL;
    }

    function getUserDataRateLimitUntil() {
        const until = parseInt(localStorage.getItem(USER_DATA_RATE_LIMIT_UNTIL_KEY) || '0', 10) || 0;
        return until > Date.now() ? until : 0;
    }

    function pauseUserDataRequests() {
        const until = Date.now() + USER_DATA_RATE_LIMIT_PAUSE;
        localStorage.setItem(USER_DATA_RATE_LIMIT_UNTIL_KEY, String(until));
        while (userDataRequestQueue.length) {
            const task = userDataRequestQueue.shift();
            userDataPendingRequests.delete(task.userId);
            task.resolve(null);
        }
    }

    function isRateLimitMessage(message) {
        const text = String(message || '');
        return text.includes('请求频率过高') || text.includes('璇锋眰棰戠巼杩囬珮');
    }

    async function fetchWithTimeout(url, options, timeoutMs) {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timer = setTimeout(function () {
            if (controller) controller.abort();
        }, timeoutMs);

        try {
            return await fetch(url, {
                ...(options || {}),
                signal: controller ? controller.signal : undefined
            });
        } finally {
            clearTimeout(timer);
        }
    }

    async function requestUserData(userId) {
        try {
            const response = await fetchWithTimeout(`/api/account/getInfo/${userId}`, {
                credentials: 'include'
            }, USER_DATA_REQUEST_TIMEOUT);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (isRateLimitMessage(data && data.message)) {
                pauseUserDataRequests();
                return null;
            }
            if (data.success && data.detail) {
                const userInfo = {
                    member_id: data.detail.member_id,
                    member_name: data.detail.member_name,
                    rank: data.detail.rank,
                    coin: data.detail.coin,
                    stardust: data.detail.stardust,
                    created_at: data.detail.created_at,
                    nPost: data.detail.nPost,
                    nComment: data.detail.nComment,
                    follows: data.detail.follows,
                    fans: data.detail.fans,
                    created_at_str: data.detail.created_at_str
                };

                setUserDataCache(userId, userInfo);
                return userInfo;
            }
            setUserDataFailedCache(userId);
            return null;
        } catch (error) {
            console.warn('获取用户数据失败:', error);
            setUserDataFailedCache(userId);
            return null;
        }
    }

    function scheduleUserDataQueue() {
        if (userDataQueueTimer) return;
        const delay = Math.max(0, USER_DATA_REQUEST_GAP - (Date.now() - userDataLastRequestAt));
        userDataQueueTimer = setTimeout(function () {
            userDataQueueTimer = null;
            pumpUserDataQueue();
        }, delay);
    }

    function pumpUserDataQueue() {
        if (getUserDataRateLimitUntil()) {
            pauseUserDataRequests();
            return;
        }
        if (userDataActiveRequests >= USER_DATA_MAX_CONCURRENT || !userDataRequestQueue.length) return;
        const wait = USER_DATA_REQUEST_GAP - (Date.now() - userDataLastRequestAt);
        if (wait > 0) {
            scheduleUserDataQueue();
            return;
        }

        const task = userDataRequestQueue.shift();
        if (!task) return;
        userDataActiveRequests += 1;
        userDataLastRequestAt = Date.now();

        requestUserData(task.userId)
            .then(task.resolve)
            .catch(function () { task.resolve(null); })
            .finally(function () {
                userDataActiveRequests -= 1;
                userDataPendingRequests.delete(task.userId);
                scheduleUserDataQueue();
            });

        if (userDataActiveRequests < USER_DATA_MAX_CONCURRENT && userDataRequestQueue.length) {
            scheduleUserDataQueue();
        }
    }

    // 新增：抓取用户数据
    async function fetchUserData(userId) {
        const normalizedUserId = String(userId || '').trim();
        if (!normalizedUserId) return null;

        const cache = getUserDataCache();
        if (cache[normalizedUserId] && cache[normalizedUserId].timestamp) {
            return cache[normalizedUserId];
        }
        if (getUserDataRateLimitUntil() || isUserDataFailedRecently(normalizedUserId)) return null;
        if (userDataPendingRequests.has(normalizedUserId)) {
            return userDataPendingRequests.get(normalizedUserId);
        }

        const request = new Promise(function (resolve) {
            userDataRequestQueue.push({ userId: normalizedUserId, resolve });
            scheduleUserDataQueue();
        });
        userDataPendingRequests.set(normalizedUserId, request);
        return request;
    }

    // 添加黑名单
    function addToBlacklist(username, remark, userLinkElement, buttonElement) {
        const list = getBlacklist();

        // 尝试获取用户ID
        let userId = null;
        let postId = null; // 楼层ID

        // 优先从当前操作的上下文中获取楼层信息
        if (userLinkElement) {
            // 获取用户ID
            if (userLinkElement.href) {
                const match = userLinkElement.href.match(/\/space\/(\d+)/) || userLinkElement.href.match(/[?&]to=(\d+)/) || userLinkElement.href.match(/\/user\/(\d+)/);
                if (match) userId = match[1];
            }

            // 查找当前元素所在的楼层
            // 1. 首先查找最近的带有明确楼层标识的元素
            let currentElement = userLinkElement;
            let floorElement = null;

            // 查找当前元素附近的楼层标记
            // 向上查找最多15层父元素，寻找楼层相关元素
            for (let i = 0; i < 15 && currentElement; i++) {
                // 先检查当前元素及其子元素中是否包含如"#1"、"#2"这样的楼层标记
                const floorMarkers = Array.from(currentElement.querySelectorAll('*'))
                    .filter(el => el.textContent && el.textContent.trim().match(/^#\d+$/));

                // 也检查当前元素本身的文本
                if (currentElement.textContent && currentElement.textContent.trim().match(/^#\d+$/)) {
                    floorMarkers.push(currentElement);
                }

                if (floorMarkers.length > 0) {
                    // 找到了楼层标记，获取楼层号
                    const floorNumber = floorMarkers[0].textContent.trim().replace('#', '');
                    postId = 'post-' + floorNumber;
                    break;
                }

                // 检查是否存在带有"#数字"形式的链接（常见于楼层链接）
                const floorLinks = Array.from(currentElement.querySelectorAll('a[href*="#"]'))
                    .filter(a => a.href && a.href.match(/#\d+$/));

                if (floorLinks.length > 0) {
                    const floorMatch = floorLinks[0].href.match(/#(\d+)$/);
                    if (floorMatch) {
                        postId = 'post-' + floorMatch[1];
                        break;
                    }
                }

                // 检查是否为带有class="floor"的元素（一些论坛使用此类标记楼层）
                const floorClassElements = Array.from(currentElement.querySelectorAll('.floor, .post-number, .floor-number'));
                if (floorClassElements.length > 0) {
                    const floorText = floorClassElements[0].textContent.trim();
                    const floorMatch = floorText.match(/(\d+)/);
                    if (floorMatch) {
                        postId = 'post-' + floorMatch[1];
                        break;
                    }
                }

                // 查找是否在文章内有明确的楼层标识，如"#2"
                const postNumberElements = Array.from(currentElement.querySelectorAll('[class*="post-number"], [class*="floor"]'));
                for (const el of postNumberElements) {
                    const text = el.textContent.trim();
                    const match = text.match(/#(\d+)/);
                    if (match) {
                        postId = 'post-' + match[1];
                        break;
                    }
                }

                // 向上移动到父元素
                currentElement = currentElement.parentElement;
            }

            // 2. 如果找不到明确标识，则尝试从URL中识别当前楼层
            if (!postId) {
                // 检查当前URL是否包含楼层信息
                if (window.location.hash) {
                    // 尝试匹配#post-数字或#数字格式
                    const hashMatch = window.location.hash.match(/#post-(\d+)/) || window.location.hash.match(/#(\d+)/);
                    if (hashMatch) {
                        postId = 'post-' + hashMatch[1];
                    }
                }
            }

            // 3. 尝试查找整个文章区域的data-post-id属性
            if (!postId && buttonElement) {
                let element = buttonElement;
                // 向上查找包含post-id的元素
                for (let i = 0; i < 10 && element; i++) {
                    if (element.getAttribute('data-post-id')) {
                        postId = 'post-' + element.getAttribute('data-post-id');
                        break;
                    }

                    // 检查元素ID是否为post-数字格式
                    if (element.id && element.id.match(/^post-\d+$/)) {
                        postId = element.id;
                        break;
                    }

                    element = element.parentElement;
                }
            }
        } else {
            // 如果没有传入元素，则使用原有逻辑
            const userLink = Array.from(document.querySelectorAll('a.author-name'))
                .find(a => a.textContent.trim() === username);

            if (userLink && userLink.href) {
                const match = userLink.href.match(/\/space\/(\d+)/) || userLink.href.match(/[?&]to=(\d+)/) || userLink.href.match(/\/user\/(\d+)/);
                if (match) userId = match[1];
            }
            // 方法2：如果还没找到postId，尝试从URL中解析
            if (!postId && window.location.hash) {
                const hashMatch = window.location.hash.match(/#post-(\d+)/);
                if (hashMatch) {
                    postId = 'post-' + hashMatch[1];
                } else {
                    // 尝试直接匹配数字
                    const directMatch = window.location.hash.match(/#(\d+)/);
                    if (directMatch) {
                        postId = 'post-' + directMatch[1];
                    }
                }
            }
        }

        // 增加：尝试从当前页面URL检查是否在用户主页，可以直接获取用户ID
        if (!userId) {
            const currentPageMatch = window.location.pathname.match(/\/space\/(\d+)/);
            if (currentPageMatch) {
                // 检查当前页面是否显示的就是要拉黑的用户
                const pageUsername = document.querySelector('.user-card .user-info h3')?.textContent?.trim();
                if (pageUsername === username) {
                    userId = currentPageMatch[1];
                }
            }
        }

        // 直接保存备注，无需截断
        list[username] = {
            remark: remark || '',
            url: window.location.href, // 记录拉黑时的网址
            timestamp: new Date().toISOString(), // 记录拉黑时间
            userId: userId, // 记录用户ID用于构建主页链接
            postId: postId // 新增：记录楼层ID用于精确跳转
        };
        setBlacklist(list);
        // 记录操作日志
        addLog(`将用户 ${username} 加入黑名单${remark ? ` (备注: ${remark})` : ''}${postId ? ` (楼层ID: ${postId})` : ''}`);
        syncOfficialBlockUser(username);
        // 新增：拉黑时自动移除好友
        removeFriend(username, true);
    }

    // 移除黑名单
    function removeFromBlacklist(username) {
        const list = getBlacklist();
        delete list[username];
        setBlacklist(list);
        // 记录操作日志
        addLog(`将用户 ${username} 从黑名单中移除`);
    }

    // 判断是否在黑名单
    function isBlacklisted(username) {
        const list = getBlacklist();
        return !!list[username];
    }

    // 获取备注
    function getRemark(username) {
        const list = getBlacklist();
        return list[username] ? list[username].remark : '';
    }

    // 新增：获取拉黑时的网址
    function getBlacklistUrl(username) {
        const list = getBlacklist();
        return list[username] ? list[username].url : '';
    }

    // 新增：获取拉黑时间
    function getBlacklistTime(username) {
        const list = getBlacklist();
        return list[username] ? list[username].timestamp : '';
    }

    function getBlacklistedEntryByUserId(userId) {
        if (userId === null || typeof userId === 'undefined') return null;
        const normalized = String(userId).trim();
        if (!normalized) return null;
        const list = getBlacklist();
        for (const username of Object.keys(list)) {
            const info = list[username];
            if (!info) continue;
            if (info.userId !== null && typeof info.userId !== 'undefined' && String(info.userId) === normalized) {
                return { username, info };
            }
        }
        return null;
    }

    async function syncOfficialBlockUser(username) {
        const name = String(username || '').trim();
        if (!name) return false;
        try {
            const response = await fetch('/api/block-list/add', {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ block_member_name: name })
            });
            let data = null;
            try {
                data = await response.json();
            } catch (e) { }
            if (response.ok && data && data.success) {
                addLog('官方屏蔽用户：已同步 ' + name);
                return true;
            }
            const message = data && data.message ? String(data.message) : ('HTTP ' + response.status);
            addLog('官方屏蔽用户：同步 ' + name + ' 失败，' + message);
            return false;
        } catch (error) {
            addLog('官方屏蔽用户：同步 ' + name + ' 失败，' + (error && error.message ? error.message : String(error)));
            return false;
        }
    }

    function getHashQueryParam(name) {
        try {
            const hash = window.location.hash || '';
            const idx = hash.indexOf('?');
            if (idx === -1) return null;
            const qs = hash.slice(idx + 1);
            const params = new URLSearchParams(qs);
            return params.get(name);
        } catch (e) {
            return null;
        }
    }

    function findTalkTitleElement() {
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

        try {
            const candidates = [];
            const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT, null);
            let node = walker.currentNode;
            while (node) {
                const el = node;
                if (el && el.id !== 'ns-blacklist-talk-indicator') {
                    const raw = (el.textContent || '').trim().replace(/\s+/g, ' ');
                    if (raw && /^与.{1,32}的对话$/.test(raw)) {
                        const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
                        if (rect && rect.width > 0 && rect.height > 0) {
                            const computed = window.getComputedStyle ? window.getComputedStyle(el) : null;
                            if (computed && (computed.display === 'none' || computed.visibility === 'hidden')) {
                                // skip
                            } else if ((el.children?.length || 0) <= 3) {
                                candidates.push(el);
                            }
                        }
                    }
                }
                node = walker.nextNode();
            }
            if (candidates.length === 0) return null;

            candidates.sort((a, b) => {
                const ra = a.getBoundingClientRect();
                const rb = b.getBoundingClientRect();
                const ha = ra ? ra.height : 9999;
                const hb = rb ? rb.height : 9999;
                if (ha !== hb) return ha - hb;
                const wa = ra ? ra.width : 9999;
                const wb = rb ? rb.width : 9999;
                if (wa !== wb) return wa - wb;
                const da = (a.children?.length || 0);
                const db = (b.children?.length || 0);
                return da - db;
            });
            return candidates[0];
        } catch (e) {
            return null;
        }
    }

    function updateTalkBlacklistIndicator() {
        try {
            const existing = document.getElementById('ns-blacklist-talk-indicator');
            if (existing) existing.remove();
            return;
        } catch (e) { }
    }

    // ====== 好友功能数据结构 ======
    // 好友功能已内置，通过 window.NodeSeekFriends 访问
    const getFriends = () => window.NodeSeekFriends?.getFriends() || [];
    const setFriends = (list) => window.NodeSeekFriends?.setFriends(list);
    const addFriend = (username, remarkInput) => window.NodeSeekFriends?.addFriend(username, remarkInput);
    const removeFriend = (username, silent) => window.NodeSeekFriends?.removeFriend(username, silent);
    const isFriend = (username) => window.NodeSeekFriends?.isFriend(username) || false;

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
        align-items: flex-end !important;
        flex-direction: column !important;
        cursor: move !important;
        touch-action: none !important;
        user-select: none !important;
    }

    #nodeseek-plugin-main-container.nodeseek-plugin-main-collapsed.ns-collapsed-move-locked {
        cursor: default !important;
        touch-action: auto !important;
    }

    #nodeseek-plugin-main-container.nodeseek-plugin-main-collapsed #collapse-btn {
        position: static !important;
        width: 34px !important;
        height: 34px !important;
        border-radius: 8px !important;
        border: 1px solid var(--ns-panel-collapse-border) !important;
        transform: none !important;
        opacity: .92 !important;
    }

    #nodeseek-plugin-main-container.nodeseek-plugin-main-collapsed #theme-toggle-btn {
        display: none !important;
    }

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

        #logs-dialog, #blacklist-dialog, #friends-dialog, #browse-history-dialog,
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
        #friends-dialog .close-btn, #browse-history-dialog .close-btn {
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
        #blacklist-dialog table, #friends-dialog table, #browse-history-dialog table,
        #blacklist-dialog tbody, #friends-dialog tbody, #browse-history-dialog tbody {
            width: 100% !important;
            display: block !important;
        }

        /* 移动端表格行转为卡片式布局 */
        #blacklist-dialog tr, #friends-dialog tr, #browse-history-dialog tr {
            display: block !important;
            border: 1px solid #e0e0e0 !important;
            border-radius: 8px !important;
            margin-bottom: 8px !important; /* 减少卡片间距 */
            padding: 6px !important; /* 减少内部填充 */
            background-color: #f9f9f9 !important;
        }

        /* 移动端表头隐藏 */
        #blacklist-dialog thead, #friends-dialog thead, #browse-history-dialog thead {
            display: none !important;
        }

        /* 表格单元格纵向排列 */
        #blacklist-dialog td, #friends-dialog td, #browse-history-dialog td {
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
        #blacklist-dialog td:first-child, #friends-dialog td:first-child, #browse-history-dialog td:first-child {
            font-size: 15px !important;
            font-weight: bold !important;
            border-bottom: 1px solid #eaeaea !important;
            padding-bottom: 3px !important; /* 减少下边距 */
            margin-bottom: 4px !important; /* 减少下边距 */
        }

        /* 备注特殊处理 - 显示为单独一行带前缀 */
        #blacklist-dialog td:nth-child(2)::before,
        #friends-dialog td:nth-child(2)::before {
            content: "备注：" !important;
            font-weight: bold !important;
            color: #666 !important;
            font-size: 12px !important; /* 减小前缀字体大小 */
        }

        /* 备注行样式 */
        #blacklist-dialog td:nth-child(2),
        #friends-dialog td:nth-child(2) {
            white-space: normal !important; /* 允许备注内容换行 */
            line-height: 1.3 !important; /* 减少行高 */
            max-height: 50px !important; /* 减少最大高度 */
            overflow-y: auto !important;
            padding: 2px 0 !important; /* 减少上下填充 */
            margin-bottom: 3px !important; /* 减少下边距 */
        }

        /* 时间特殊处理 */
        #blacklist-dialog td:nth-child(3)::before,
        #friends-dialog td:nth-child(3)::before {
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
        #browse-history-dialog td:last-child {
            text-align: center !important;
            padding-top: 4px !important; /* 减少上填充 */
            border-top: 1px solid #eaeaea !important;
            margin-top: 2px !important; /* 减少上边距 */
        }

        /* 移除按钮在移动端内更显眼 */
        #blacklist-dialog td:last-child button,
        #friends-dialog td:last-child button,
        #browse-history-dialog td:last-child button {
            width: 65px !important; /* 稍微减少按钮宽度 */
            padding: 3px 0 !important; /* 减少按钮内部填充 */
            font-size: 12px !important; /* 减小字体 */
        }

        /* 弹窗内部滚动区域 */
        #logs-dialog pre, #blacklist-dialog div, #friends-dialog div, #browse-history-dialog div {
            max-height: 65vh !important;
            overflow-y: auto !important;
        }

        /* 当备注为空时显示提示文本 */
        #blacklist-dialog td:nth-child(2):empty::after,
        #friends-dialog td:nth-child(2):empty::after {
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

        .userscript-nodeseek-interaction-btn.ns-user-meta-badge {
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
            border: 1px solid rgba(148, 163, 184, .36) !important;
            border-radius: 5px !important;
            background: rgba(248, 250, 252, .9) !important;
            color: #64748b !important;
            font-family: var(--ns-ui-font) !important;
            font-size: 11px !important;
            font-weight: 600 !important;
            line-height: 18px !important;
            vertical-align: middle !important;
            white-space: nowrap !important;
            box-sizing: border-box !important;
        }

        .userscript-nodeseek-interaction-btn.ns-user-meta-badge.ns-user-meta-loading {
            color: #94a3b8 !important;
        }

        .userscript-nodeseek-interaction-btn.ns-user-meta-badge.ns-user-meta-danger {
            background: rgba(254, 226, 226, .94) !important;
            border-color: rgba(248, 113, 113, .45) !important;
            color: #991b1b !important;
        }

        .ns-homepage-author-meta-wrapper {
            display: inline-flex !important;
            align-items: center !important;
            gap: 4px !important;
            margin-left: 6px !important;
            vertical-align: middle !important;
            flex-wrap: wrap !important;
        }

        .ns-homepage-author-meta-wrapper .userscript-nodeseek-interaction-btn.ns-user-meta-badge {
            margin-left: 0 !important;
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

        .ns-collapsed-action-rail {
            display: none !important;
            flex-direction: column !important;
            align-items: flex-end !important;
            gap: 7px !important;
            margin-bottom: 7px !important;
            padding-right: 0 !important;
        }

        #nodeseek-plugin-main-container.nodeseek-plugin-main-collapsed .ns-collapsed-action-rail {
            display: flex !important;
        }

        .ns-collapsed-action-btn {
            width: 34px !important;
            height: 34px !important;
            min-width: 34px !important;
            min-height: 34px !important;
            max-width: 34px !important;
            max-height: 34px !important;
            padding: 0 !important;
            border: 1px solid rgba(20, 184, 166, .24) !important;
            border-radius: 9px !important;
            background: #ccfbf1 !important;
            color: #0f766e !important;
            box-shadow: 0 6px 16px rgba(15, 118, 110, .13) !important;
            font-family: var(--ns-ui-font) !important;
            font-size: 14px !important;
            font-weight: 800 !important;
            line-height: 1 !important;
            cursor: pointer !important;
            box-sizing: border-box !important;
        }

        .ns-collapsed-reply-btn {
            background: #dbeafe !important;
            border-color: rgba(59, 130, 246, .22) !important;
            color: #1d4ed8 !important;
        }

        .ns-collapsed-home-btn {
            background: #ccfbf1 !important;
            border-color: rgba(20, 184, 166, .24) !important;
            color: #0f766e !important;
        }

        .ns-collapsed-refresh-btn {
            background: #e0f2fe !important;
            border-color: rgba(14, 165, 233, .24) !important;
            color: #0369a1 !important;
        }

        .ns-collapsed-action-btn:hover {
            filter: brightness(.98) !important;
            box-shadow: 0 7px 18px rgba(15, 23, 42, .14) !important;
        }

        .ns-collapsed-highlight-count {
            display: none;
            flex-direction: column !important;
            align-items: center !important;
            justify-content: center !important;
            width: 34px !important;
            min-width: 34px !important;
            height: 42px !important;
            min-height: 42px !important;
            margin-top: 7px !important;
            padding: 0 !important;
            border: 1px solid rgba(245, 158, 11, .24) !important;
            border-right: none !important;
            border-radius: 9px 0 0 9px !important;
            background: #fef3c7 !important;
            color: #92400e !important;
            box-shadow: 0 6px 16px rgba(146, 64, 14, .11) !important;
            font-family: var(--ns-ui-font) !important;
            cursor: pointer !important;
            box-sizing: border-box !important;
            transition: background-color .16s ease, border-color .16s ease, color .16s ease, box-shadow .16s ease !important;
        }

        .ns-collapsed-highlight-count.ns-collapsed-highlight-active {
            background: #ccfbf1 !important;
            border-color: rgba(20, 184, 166, .36) !important;
            color: #0f766e !important;
            box-shadow: 0 7px 18px rgba(15, 118, 110, .16) !important;
        }

        .ns-collapsed-highlight-count span {
            font-size: 10px !important;
            font-weight: 700 !important;
            line-height: 1 !important;
        }

        .ns-collapsed-highlight-count strong {
            margin-top: 3px !important;
            font-size: 14px !important;
            font-weight: 850 !important;
            line-height: 1 !important;
        }

        #ns-highlight-stats-container {
            margin-top: 1px !important;
            padding: 5px !important;
            border-radius: 7px !important;
            background: var(--ns-ui-soft) !important;
            border: 1px solid var(--ns-ui-line) !important;
            color: var(--ns-ui-muted) !important;
        }

        .ns-filter-stat-tags {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 5px !important;
        }

        .ns-filter-stat-tag {
            width: 100% !important;
            min-height: 26px !important;
            padding: 4px 5px !important;
            border: 1px solid var(--ns-ui-line) !important;
            border-radius: 7px !important;
            background: var(--ns-ui-bg-solid) !important;
            color: var(--ns-ui-muted) !important;
            font-family: var(--ns-ui-font) !important;
            font-size: 11px !important;
            font-weight: 700 !important;
            cursor: pointer !important;
            box-shadow: none !important;
        }

        .ns-filter-stat-tag-active {
            background: #ccfbf1 !important;
            border-color: rgba(20, 184, 166, .36) !important;
            color: #0f766e !important;
        }

        #logs-dialog, #blacklist-dialog, #friends-dialog, #browse-history-dialog,
        #settings-dialog, #webdav-sync-dialog, #jump-list-dialog, #ns-nodeimage-safari-dialog,
        #chicken-leg-stats-dialog, #hot-topics-dialog, #vps-calculator-dialog,
        #notes-dialog, #ns-filter-dialog, #quick-reply-dialog {
            font-family: var(--ns-ui-font) !important;
            color: var(--ns-ui-text) !important;
            background: var(--ns-ui-bg-solid) !important;
            border: 1px solid var(--ns-ui-line) !important;
            border-radius: 8px !important;
            box-shadow: var(--ns-ui-shadow) !important;
        }

        #logs-dialog button, #blacklist-dialog button, #friends-dialog button,
        #browse-history-dialog button, #settings-dialog button, #webdav-sync-dialog button,
        #jump-list-dialog button, #ns-nodeimage-safari-dialog button,
        #chicken-leg-stats-dialog button, #hot-topics-dialog button, #vps-calculator-dialog button,
        #notes-dialog button, #ns-filter-dialog button, #quick-reply-dialog button {
            border-radius: 6px !important;
            min-height: 26px !important;
        }

        #logs-dialog input, #blacklist-dialog input, #friends-dialog input,
        #browse-history-dialog input, #settings-dialog input, #webdav-sync-dialog input,
        #jump-list-dialog input, #ns-nodeimage-safari-dialog input,
        #chicken-leg-stats-dialog input, #hot-topics-dialog input, #vps-calculator-dialog input,
        #notes-dialog input, #ns-filter-dialog input, #quick-reply-dialog input,
        #logs-dialog textarea, #blacklist-dialog textarea, #friends-dialog textarea,
        #browse-history-dialog textarea, #settings-dialog textarea, #webdav-sync-dialog textarea,
        #jump-list-dialog textarea, #ns-nodeimage-safari-dialog textarea,
        #notes-dialog textarea, #ns-filter-dialog textarea, #quick-reply-dialog textarea,
        #settings-dialog select, #webdav-sync-dialog select, #jump-list-dialog select {
            border: 1px solid var(--ns-ui-line) !important;
            border-radius: 7px !important;
            background: var(--ns-ui-bg-solid) !important;
            color: var(--ns-ui-text) !important;
            outline: none !important;
        }

        #quick-reply-dialog input[type="checkbox"] {
            width: 16px !important;
            height: 16px !important;
            min-height: 16px !important;
            accent-color: #14b8a6 !important;
        }

        #logs-dialog input:focus, #blacklist-dialog input:focus, #friends-dialog input:focus,
        #browse-history-dialog input:focus, #settings-dialog input:focus,
        #webdav-sync-dialog input:focus, #jump-list-dialog input:focus, #ns-nodeimage-safari-dialog input:focus,
        #notes-dialog input:focus, #ns-filter-dialog input:focus,
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

        #blacklist-dialog table, #friends-dialog table, #browse-history-dialog table {
            border-collapse: separate !important;
            border-spacing: 0 !important;
            overflow: hidden !important;
        }

        #blacklist-dialog th, #friends-dialog th, #browse-history-dialog th {
            padding: 8px 6px !important;
            color: var(--ns-ui-muted) !important;
            background: var(--ns-ui-soft) !important;
            border-bottom: 1px solid var(--ns-ui-line) !important;
        }

        #blacklist-dialog td, #friends-dialog td, #browse-history-dialog td {
            border-bottom: 1px solid var(--ns-ui-line) !important;
        }

        #blacklist-dialog tr:hover, #friends-dialog tr:hover, #browse-history-dialog tr:hover {
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

        .ns-filter-level-options {
            display: flex !important;
            flex-wrap: wrap !important;
            gap: 6px !important;
        }

        #ns-filter-dialog .ns-filter-level-chip {
            min-width: 32px !important;
            min-height: 28px !important;
            padding: 4px 8px !important;
            border: 1px solid rgba(148, 163, 184, .34) !important;
            border-radius: 8px !important;
            background: rgba(248, 250, 252, .94) !important;
            color: #475569 !important;
            font-size: 12px !important;
            font-weight: 700 !important;
        }

        #ns-filter-dialog .ns-filter-level-chip-active {
            background: #ccfbf1 !important;
            border-color: rgba(20, 184, 166, .36) !important;
            color: #0f766e !important;
        }

        #ns-filter-dialog .ns-filter-days-input {
            width: 100% !important;
            min-height: 34px !important;
            padding: 5px 8px !important;
            border-radius: 8px !important;
            box-sizing: border-box !important;
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
                max-width: calc(100vw - 24px) !important;
            }

            #nodeseek-plugin-main-container.nodeseek-plugin-main-collapsed #collapse-btn {
                width: 34px !important;
                height: 34px !important;
                min-width: 34px !important;
                min-height: 34px !important;
                max-width: 34px !important;
                max-height: 34px !important;
                border-radius: 10px !important;
            }

            .ns-collapsed-action-rail {
                gap: 6px !important;
                margin-bottom: 6px !important;
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

            #logs-dialog, #blacklist-dialog, #friends-dialog, #browse-history-dialog,
            #settings-dialog, #webdav-sync-dialog, #jump-list-dialog, #ns-nodeimage-safari-dialog,
            #chicken-leg-stats-dialog, #hot-topics-dialog, #vps-calculator-dialog,
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

            #blacklist-dialog tr, #friends-dialog tr, #browse-history-dialog tr {
                background: var(--ns-ui-soft) !important;
                border: 1px solid var(--ns-ui-line) !important;
                border-radius: 10px !important;
                padding: 8px !important;
            }

            #blacklist-dialog td, #friends-dialog td, #browse-history-dialog td {
                border: 0 !important;
                line-height: 1.45 !important;
            }

            #blacklist-dialog td:last-child button,
            #friends-dialog td:last-child button,
            #browse-history-dialog td:last-child button {
                width: 100% !important;
                min-height: 34px !important;
            }
        }`;
        document.head.appendChild(modernStyle);
    }

    injectNsModernUiStyle();

    // 初始化已读标题颜色变量
    try {
        const initialViewedColor = getViewedColor();
        document.documentElement.style.setProperty('--ns-viewed-color', initialViewedColor);
    } catch (e) { }

    function getUserIdFromAuthorLink(link) {
        if (!link || !link.href) return '';
        const match = link.href.match(/\/space\/(\d+)/) || link.href.match(/[?&]to=(\d+)/) || link.href.match(/\/user\/(\d+)/);
        return match ? match[1] : '';
    }

    function getJoinDaysFromCreatedAt(value) {
        if (!value) return null;
        let joinDate = null;
        if (typeof value === 'number') {
            joinDate = new Date(value < 10000000000 ? value * 1000 : value);
        } else {
            const text = String(value).trim();
            if (/^\d+$/.test(text)) {
                const num = parseInt(text, 10);
                joinDate = new Date(num < 10000000000 ? num * 1000 : num);
            } else {
                joinDate = new Date(text.replace(' ', 'T'));
            }
        }
        if (!joinDate || Number.isNaN(joinDate.getTime())) return null;
        return Math.max(0, Math.floor((Date.now() - joinDate.getTime()) / 86400000));
    }

    function createUserMetaBadge(type) {
        const badge = document.createElement('span');
        badge.className = 'userscript-nodeseek-interaction-btn ns-user-meta-badge ns-user-meta-' + type + ' ns-user-meta-loading';
        badge.textContent = type === 'join' ? '加入 --' : 'Lv --';
        return badge;
    }

    function updateUserMetaBadges(authorLink, joinBadge, rankBadge) {
        const userId = getUserIdFromAuthorLink(authorLink);
        if (!userId || typeof fetchUserData !== 'function') return;
        fetchUserData(userId).then(function (userData) {
            if (!userData) return;
            const joinDays = getJoinDaysFromCreatedAt(userData.created_at || userData.created_at_str);
            const rank = parseInt(userData.rank, 10);
            joinBadge.classList.remove('ns-user-meta-loading', 'ns-user-meta-danger');
            rankBadge.classList.remove('ns-user-meta-loading', 'ns-user-meta-danger');
            if (joinDays === null) {
                joinBadge.textContent = '加入 --';
            } else {
                joinBadge.textContent = '加入 ' + joinDays + '天';
                if (joinDays < 30) joinBadge.classList.add('ns-user-meta-danger');
            }
            if (Number.isNaN(rank)) {
                rankBadge.textContent = 'Lv --';
            } else {
                rankBadge.textContent = 'Lv ' + rank;
                if (rank <= 1) rankBadge.classList.add('ns-user-meta-danger');
            }
        }).catch(function () {
            joinBadge.classList.remove('ns-user-meta-loading');
            rankBadge.classList.remove('ns-user-meta-loading');
        });
    }

    // 处理所有用户名节点
    function processUsernames() {
        const SCRIPT_BUTTON_MARKER_CLASS = 'userscript-nodeseek-interaction-btn'; // 新增标记类

        document.querySelectorAll('a.author-name').forEach(function (a) {
            const username = a.textContent.trim();
            const parent = a.parentNode;
            if (!username || !parent) return;

            const blacklistedNow = isBlacklisted(username);
            const friendNow = isFriend(username);
            const stateKey = username + '|' + (blacklistedNow ? '1' : '0') + '|' + (friendNow ? '1' : '0');
            if (a.dataset.nsInteractionState === stateKey && parent.querySelectorAll('.' + SCRIPT_BUTTON_MARKER_CLASS).length >= 4) {
                return;
            }
            a.dataset.nsInteractionState = stateKey;

            // 总是先移除此脚本之前为该用户添加的交互按钮
            parent.querySelectorAll('.' + SCRIPT_BUTTON_MARKER_CLASS).forEach(btn => btn.remove());

            // 添加按钮
            a.style.whiteSpace = 'nowrap';

            // 拉黑按钮
            const btn = document.createElement('button');
            // 为按钮添加标记类
            btn.className = 'blacklist-btn ' + SCRIPT_BUTTON_MARKER_CLASS + ' ns-user-action-btn ns-user-block-btn' + (blacklistedNow ? ' red ns-is-active' : '');
            btn.textContent = blacklistedNow ? '移除黑名单' : '拉黑';
            btn.onclick = function (e) {
                e.stopPropagation();
                if (isBlacklisted(username)) {
                    if (confirm('确定要移除黑名单？')) {
                        removeFromBlacklist(username);

                        // 不刷新页面，直接更新按钮和用户显示
                        btn.textContent = '拉黑';
                        btn.className = 'blacklist-btn ' + SCRIPT_BUTTON_MARKER_CLASS + ' ns-user-action-btn ns-user-block-btn';

                        // 更新当前页面上该用户的所有显示
                        document.querySelectorAll('a.author-name').forEach(function (link) {
                            if (link.textContent.trim() === username) {
                                // 移除黑名单样式
                                link.classList.remove('blacklisted-user');
                                // 移除备注和链接
                                const oldRemark = link.parentNode.querySelector('.blacklist-remark');
                                if (oldRemark) oldRemark.remove();
                                const oldUrl = link.parentNode.querySelector('.blacklist-url');
                                if (oldUrl) oldUrl.remove();
                                // 移除拉黑时间
                                const metaInfo = link.closest('.nsk-content-meta-info');
                                if (metaInfo) {
                                    const oldTime = metaInfo.querySelector('.blacklist-time');
                                    if (oldTime) oldTime.remove();
                                }
                            }
                        });

                        // 如果黑名单列表弹窗是打开的，立即更新弹窗内容
                        const blacklistDialog = document.getElementById('blacklist-dialog');
                        if (blacklistDialog) {
                            // 查找该用户在弹窗中对应的行
                            const tbody = blacklistDialog.querySelector('tbody');
                            if (tbody) {
                                Array.from(tbody.children).forEach(function (row) {
                                    const userNameCell = row.querySelector('td:first-child a');
                                    if (userNameCell && userNameCell.textContent.trim() === username) {
                                        // 添加淡出动画
                                        row.style.opacity = '0.5';
                                        row.style.transition = 'opacity 0.2s';

                                        setTimeout(function () {
                                            row.remove();

                                            // 检查是否还有其他用户，如果没有则显示空提示
                                            if (tbody.children.length === 0) {
                                                const empty = document.createElement('div');
                                                empty.textContent = '暂无黑名单用户';
                                                empty.style.textAlign = 'center';
                                                empty.style.color = '#888';
                                                empty.style.margin = '18px 0 8px 0';
                                                blacklistDialog.querySelector('table').after(empty);
                                            }
                                        }, 200);
                                    }
                                });
                            }
                        }
                    }
                } else {
                    const remark = prompt('请输入备注（可选）：', '');
                    if (remark !== null) {
                        addToBlacklist(username, remark, a, btn);
                        if (isFriend(username)) {
                            removeFriend(username, true);
                        }

                        // 不刷新页面，直接更新按钮和用户显示
                        btn.textContent = '移除黑名单';
                        btn.className = 'blacklist-btn ' + SCRIPT_BUTTON_MARKER_CLASS + ' ns-user-action-btn ns-user-block-btn red ns-is-active';

                        // 更新当前页面上该用户的所有显示
                        highlightBlacklisted(username);
                        try { ensureBlacklistNavEntryAndMeta(true); } catch (e) { }

                        // 更新好友按钮状态（如果存在）
                        if (friendBtn) {
                            friendBtn.style.background = '#2ea44f';
                            friendBtn.textContent = '添加好友';
                        }

                        // 如果黑名单列表弹窗是打开的，立即更新弹窗内容
                        const blacklistDialog = document.getElementById('blacklist-dialog');
                        if (blacklistDialog) {
                            updateBlacklistDialogWithNewUser(username, remark, a, btn);
                        }
                    }
                }
            };
            parent.appendChild(btn);

            // 添加好友按钮
            const friendBtn = document.createElement('button');
            // 为按钮添加标记类
            friendBtn.className = 'blacklist-btn ' + SCRIPT_BUTTON_MARKER_CLASS + ' ns-user-action-btn ns-user-friend-btn' + (friendNow ? ' ns-is-active' : '');
            friendBtn.style.background = friendNow ? '#aaa' : '#2ea44f';
            friendBtn.style.marginLeft = '4px';
            friendBtn.textContent = friendNow ? '删除好友' : '添加好友';
            friendBtn.onclick = function (e) {
                e.stopPropagation();
                if (!isFriend(username)) {
                    if (isBlacklisted(username)) {
                        removeFromBlacklist(username);
                        // 更新黑名单按钮状态
                        btn.textContent = '拉黑';
                        btn.className = 'blacklist-btn ' + SCRIPT_BUTTON_MARKER_CLASS + ' ns-user-action-btn ns-user-block-btn';

                        // 如果黑名单弹窗是打开的，立即更新弹窗内容
                        const blacklistDialog = document.getElementById('blacklist-dialog');
                        if (blacklistDialog) {
                            // 查找该用户在弹窗中对应的行
                            const tbody = blacklistDialog.querySelector('tbody');
                            if (tbody) {
                                Array.from(tbody.children).forEach(function (row) {
                                    const userNameCell = row.querySelector('td:first-child a');
                                    if (userNameCell && userNameCell.textContent.trim() === username) {
                                        // 添加淡出动画
                                        row.style.opacity = '0.5';
                                        row.style.transition = 'opacity 0.2s';

                                        setTimeout(function () {
                                            row.remove();

                                            // 检查是否还有其他用户，如果没有则显示空提示
                                            if (tbody.children.length === 0) {
                                                const empty = document.createElement('div');
                                                empty.textContent = '暂无黑名单用户';
                                                empty.style.textAlign = 'center';
                                                empty.style.color = '#888';
                                                empty.style.margin = '18px 0 8px 0';
                                                blacklistDialog.querySelector('table').after(empty);
                                            }
                                        }, 200);
                                    }
                                });
                            }
                        }
                    }
                    let remark = prompt('请输入好友备注（可选）：', '');
                    if (remark === null) return;
                    addFriend(username, remark);

                    // 不刷新页面，直接更新按钮和用户显示
                    friendBtn.textContent = '删除好友';
                    friendBtn.className = 'blacklist-btn ' + SCRIPT_BUTTON_MARKER_CLASS + ' ns-user-action-btn ns-user-friend-btn ns-is-active';
                    friendBtn.style.background = '#aaa';

                    // 更新当前页面上该用户的所有显示
                    highlightBlacklisted(username);
                    try { ensureBlacklistNavEntryAndMeta(true); } catch (e) { }

                    // 如果好友列表弹窗是打开的，立即更新弹窗内容
                    if (window.NodeSeekFriends && typeof window.NodeSeekFriends.updateFriendsDialogWithNewUser === 'function') {
                        window.NodeSeekFriends.updateFriendsDialogWithNewUser(username, remark);
                    }
                } else {
                    if (confirm('确定要删除该好友？')) {
                        removeFriend(username);

                        // 不刷新页面，直接更新按钮和用户显示
                        friendBtn.textContent = '添加好友';
                        friendBtn.className = 'blacklist-btn ' + SCRIPT_BUTTON_MARKER_CLASS + ' ns-user-action-btn ns-user-friend-btn';
                        friendBtn.style.background = '#2ea44f';

                        // 更新当前页面上该用户的所有显示
                        document.querySelectorAll('a.author-name').forEach(function (link) {
                            if (link.textContent.trim() === username) {
                                // 移除好友样式
                                link.classList.remove('friend-user');
                                // 移除备注
                                const oldRemark = link.parentNode.querySelector('.friend-remark');
                                if (oldRemark) oldRemark.remove();
                                // 移除右侧“添加时间”显示
                                const metaInfo = link.closest('.nsk-content-meta-info');
                                if (metaInfo) {
                                    const oldFriendTime = metaInfo.querySelector('.friend-time');
                                    if (oldFriendTime) oldFriendTime.remove();
                                }

                                // 更新页面上该用户的好友按钮状态
                                const userButtons = link.parentNode.querySelectorAll('.userscript-nodeseek-interaction-btn');
                                userButtons.forEach(btn => {
                                    if (btn.textContent === '删除好友') {
                                        btn.textContent = '添加好友';
                                        btn.className = 'blacklist-btn userscript-nodeseek-interaction-btn ns-user-action-btn ns-user-friend-btn';
                                        btn.style.background = '#2ea44f';
                                    }
                                });
                            }
                        });

                        // 如果好友列表弹窗是打开的，立即从弹窗中移除该用户
                        if (window.NodeSeekFriends && typeof window.NodeSeekFriends.removeFriendFromDialog === 'function') {
                            window.NodeSeekFriends.removeFriendFromDialog(username);
                        }
                        try { ensureBlacklistNavEntryAndMeta(true); } catch (e) { }
                    }
                }
            };
            parent.appendChild(friendBtn);

            const joinBadge = createUserMetaBadge('join');
            const rankBadge = createUserMetaBadge('rank');
            parent.appendChild(joinBadge);
            parent.appendChild(rankBadge);
            updateUserMetaBadges(a, joinBadge, rankBadge);
        });
    }

    function findHomepageAuthorLinks() {
        const links = [];
        const seen = new Set();
        document.querySelectorAll('li.post-list-item, .post-list-item').forEach(function (item) {
            const link = item.querySelector('.info-author a[href*="/space/"], a.author-name[href*="/space/"], a[href^="/space/"]');
            if (!link || seen.has(link) || link.classList.contains('author-name')) return;
            seen.add(link);
            links.push({ item, link });
        });
        return links;
    }

    function findHomepageCategoryTarget(item) {
        if (!item) return null;
        const selectors = [
            '.info-category',
            '.post-category',
            '.category',
            '.category-info',
            '.topic-category',
            '.info-tags',
            '.post-tags',
            'a[href*="/categories/"]',
            'a[href*="/category/"]',
            'a[href*="/tag/"]',
            'a[href*="category"]',
            'a[href*="tag"]'
        ];
        for (const selector of selectors) {
            const target = item.querySelector(selector);
            if (target) return target;
        }
        return item.querySelector('.info-author') || null;
    }

    function processHomepageAuthorMetaBadges() {
        findHomepageAuthorLinks().forEach(function (entry) {
            const item = entry.item;
            const authorLink = entry.link;
            const userId = getUserIdFromAuthorLink(authorLink);
            const target = findHomepageCategoryTarget(item);
            if (!userId || !target) return;

            if (authorLink.dataset.nsHomepageMetaUserId === userId && item.querySelector('.ns-homepage-author-meta-wrapper')) {
                return;
            }
            authorLink.dataset.nsHomepageMetaUserId = userId;

            item.querySelectorAll('.ns-homepage-author-meta-wrapper').forEach(function (el) { el.remove(); });

            const wrapper = document.createElement('span');
            wrapper.className = 'ns-homepage-author-meta-wrapper';

            const joinBadge = createUserMetaBadge('join');
            const rankBadge = createUserMetaBadge('rank');
            joinBadge.classList.add('ns-homepage-author-meta');
            rankBadge.classList.add('ns-homepage-author-meta');

            wrapper.appendChild(joinBadge);
            wrapper.appendChild(rankBadge);
            target.after(wrapper);
            updateUserMetaBadges(authorLink, joinBadge, rankBadge);
        });
    }

    // 高亮黑名单用户并显示备注和网址
    let blacklistRemarkWidthRaf = null;
    function findFloorMarkerElement(metaInfo) {
        const anchorFloor = Array.from(metaInfo.querySelectorAll('a')).find(el => el.textContent && el.textContent.trim().match(/^#\d+$/));
        if (anchorFloor) return anchorFloor.closest('.floor-link-wrapper') || anchorFloor;
        const anyFloor = Array.from(metaInfo.querySelectorAll('*')).find(el => el.childElementCount === 0 && el.textContent && el.textContent.trim().match(/^#\d+$/));
        if (!anyFloor) return null;
        return anyFloor.closest('.floor-link-wrapper') || anyFloor;
    }

    function updateBlacklistRemarkWidthsInMeta(metaInfo) {
        const floorEl = findFloorMarkerElement(metaInfo);
        if (!floorEl) return;

        const floorRect = floorEl.getBoundingClientRect();
        metaInfo.querySelectorAll('.blacklist-remark, .friend-remark').forEach(span => {
            const spanRect = span.getBoundingClientRect();
            const available = Math.floor(floorRect.left - spanRect.left - 6);
            span.style.maxWidth = Math.max(20, available) + 'px';
        });
    }

    function updateAllBlacklistRemarkWidths() {
        document.querySelectorAll('.nsk-content-meta-info').forEach(metaInfo => updateBlacklistRemarkWidthsInMeta(metaInfo));
    }

    function scheduleBlacklistRemarkWidthUpdate() {
        if (blacklistRemarkWidthRaf) cancelAnimationFrame(blacklistRemarkWidthRaf);
        blacklistRemarkWidthRaf = requestAnimationFrame(() => {
            blacklistRemarkWidthRaf = null;
            updateAllBlacklistRemarkWidths();
        });
    }

    if (!window.__nsBlacklistRemarkResizeBound) {
        window.__nsBlacklistRemarkResizeBound = true;
        window.addEventListener('resize', scheduleBlacklistRemarkWidthUpdate);
    }

    function highlightBlacklisted(targetUsername) {
        const list = getBlacklist();
        const friends = getFriends();
        const friendMap = new Map();
        if (Array.isArray(friends)) {
            friends.forEach(f => {
                if (f && f.username) friendMap.set(String(f.username).trim(), f);
            });
        }

        const normalizedTarget = (typeof targetUsername === 'string' && targetUsername.trim())
            ? targetUsername.trim()
            : '';

        document.querySelectorAll('a.author-name').forEach(function (a) {
            const username = a.textContent.trim();
            if (normalizedTarget && username !== normalizedTarget) return;
            // 先移除样式
            a.classList.remove('blacklisted-user', 'friend-user');
            // 移除备注和网址
            const oldRemark = a.parentNode.querySelector('.blacklist-remark');
            if (oldRemark) oldRemark.remove();
            const oldUrl = a.parentNode.querySelector('.blacklist-url');
            if (oldUrl) oldUrl.remove();
            const oldFriendRemark = a.parentNode.querySelector('.friend-remark');
            if (oldFriendRemark) oldFriendRemark.remove();

            // 新增：移除旧的黑名单信息容器（在metaInfo下）
            let metaInfo = a.closest('.nsk-content-meta-info');
            if (metaInfo) {
                const oldContainer = metaInfo.querySelector('.blacklist-info-container');
                if (oldContainer) oldContainer.remove();
                // 兼容旧版本：移除单独的拉黑时间
                const oldTime = metaInfo.querySelector('.blacklist-time');
                if (oldTime) oldTime.remove();
                const oldFriendContainer = metaInfo.querySelector('.friend-info-container');
                if (oldFriendContainer) oldFriendContainer.remove();
                const oldFriendTime = metaInfo.querySelector('.friend-time');
                if (oldFriendTime) oldFriendTime.remove();
            }

            if (isBlacklisted(username)) {
                a.classList.add('blacklisted-user');

                // 获取黑名单信息
                const info = list[username];

                // 修改：为用户名链接直接添加用户主页跳转
                // 如果黑名单条目中保存了userId，直接使用它构建主页链接
                if (info && info.userId) {
                    // 修改原始链接为用户主页链接
                    a.href = 'https://www.nodeseek.com/space/' + info.userId + '#/general';
                    a.target = '_blank';
                    a.title = '点击访问用户主页';
                }

                // 显示备注
                const remark = getRemark(username);
                if (remark) {
                    const span = document.createElement('span');
                    span.className = 'blacklist-remark';
                    span.textContent = remark; // 移除“备注：”前缀，直接显示内容
                    span.title = remark; // 悬停显示完整备注
                    a.parentNode.appendChild(span);
                }

                // 准备底部显示的信息：拉黑页面链接 和 拉黑时间
                const url = getBlacklistUrl(username);
                const timestamp = getBlacklistTime(username);

                if (metaInfo && (url || timestamp)) {
                    const isMobile = window.innerWidth <= 767;
                    // 让父容器相对定位，便于绝对定位子元素
                    metaInfo.style.position = 'relative';

                    // 创建容器
                    const container = document.createElement('div');
                    container.className = 'blacklist-info-container';
                    container.style.position = isMobile ? 'static' : 'absolute';
                    container.style.right = isMobile ? '' : '-6px';
                    container.style.top = isMobile ? '' : '23px';
                    container.style.display = 'flex';
                    container.style.alignItems = 'center';
                    container.style.zIndex = isMobile ? '' : '10';
                    container.style.background = 'transparent';
                    container.style.padding = '0';
                    container.style.flexWrap = isMobile ? 'wrap' : 'nowrap';
                    container.style.gap = isMobile ? '6px' : '';
                    container.style.marginTop = isMobile ? '4px' : '';

                    // 1. 显示拉黑时的网址 (在左侧)
                    if (url) {
                        const link = document.createElement('a');
                        link.className = 'blacklist-url';

                        // 构建包含精确楼层的链接
                        let targetUrl = url;
                        // 检查是否有楼层信息
                        if (info.postId) {
                            // 提取楼层号
                            const floorNumber = info.postId.replace('post-', '');
                            // 移除原始URL中可能存在的锚点
                            targetUrl = targetUrl.split('#')[0];
                            // 添加新的锚点（不带post-前缀）
                            targetUrl += '#' + floorNumber;
                        }

                        link.href = targetUrl;
                        link.textContent = info.postId ? '【拉黑页面#' + info.postId.replace('post-', '') + '】' : '【拉黑页面】';
                        link.target = '_blank';
                        link.style.color = '#06c';
                        link.style.fontSize = '10px'; // 调整字体大小以匹配时间
                        link.style.position = 'relative'; // 使用相对定位
                        link.style.left = isMobile ? '0px' : '10px';
                        // link.style.marginLeft = '20px'; // 移除之前的 margin-left
                        link.style.marginRight = isMobile ? '0px' : '8px';
                        link.style.whiteSpace = 'nowrap';
                        link.style.textDecoration = 'none'; // 去掉下划线
                        container.appendChild(link);
                    }

                    // 2. 显示拉黑时间 (在右侧)
                    if (timestamp) {
                        const timeSpan = document.createElement('span');
                        timeSpan.className = 'blacklist-time';

                        const date = new Date(timestamp);
                        const timeStr = date.getFullYear() + '-' +
                            String(date.getMonth() + 1).padStart(2, '0') + '-' +
                            String(date.getDate()).padStart(2, '0') + ' ' +
                            String(date.getHours()).padStart(2, '0') + ':' +
                            String(date.getMinutes()).padStart(2, '0') + ':' +
                            String(date.getSeconds()).padStart(2, '0');

                        timeSpan.textContent = '拉黑时间：' + timeStr;
                        timeSpan.style.color = '#d00';
                        timeSpan.style.fontSize = '10px';
                        timeSpan.style.whiteSpace = 'nowrap';

                        container.appendChild(timeSpan);
                    }

                    metaInfo.appendChild(container);
                }
            } else if (friendMap.has(username)) {
                const friend = friendMap.get(username);
                a.classList.add('friend-user');

                const remark = friend && friend.remark ? String(friend.remark) : '';
                if (remark) {
                    const span = document.createElement('span');
                    span.className = 'friend-remark';
                    span.textContent = remark;
                    span.title = remark;
                    a.parentNode.appendChild(span);
                }

                if (metaInfo && friend && friend.timestamp) {
                    const isMobile = window.innerWidth <= 767;
                    metaInfo.style.position = 'relative';

                    const container = document.createElement('div');
                    container.className = 'friend-info-container';
                    container.style.position = isMobile ? 'static' : 'absolute';
                    container.style.right = isMobile ? '' : '-6px';
                    container.style.top = isMobile ? '' : '23px';
                    container.style.display = 'flex';
                    container.style.alignItems = 'center';
                    container.style.zIndex = isMobile ? '' : '10';
                    container.style.background = 'transparent';
                    container.style.padding = '0';
                    container.style.flexWrap = isMobile ? 'wrap' : 'nowrap';
                    container.style.gap = isMobile ? '6px' : '';
                    container.style.marginTop = isMobile ? '4px' : '';

                    const timeSpan = document.createElement('span');
                    timeSpan.className = 'friend-time';

                    const date = new Date(friend.timestamp);
                    const timeStr = date.getFullYear() + '-' +
                        String(date.getMonth() + 1).padStart(2, '0') + '-' +
                        String(date.getDate()).padStart(2, '0') + ' ' +
                        String(date.getHours()).padStart(2, '0') + ':' +
                        String(date.getMinutes()).padStart(2, '0') + ':' +
                        String(date.getSeconds()).padStart(2, '0');

                    timeSpan.textContent = '添加时间：' + timeStr;
                    timeSpan.style.color = '#2ea44f';
                    timeSpan.style.fontSize = '10px';
                    timeSpan.style.whiteSpace = 'nowrap';
                    container.appendChild(timeSpan);

                    metaInfo.appendChild(container);
                }
            }
        });
        scheduleBlacklistRemarkWidthUpdate();
    }

    // 新增：高亮好友用户并显示备注
    // highlightFriends 函数已内置
    const highlightFriends = (username) => window.NodeSeekFriends?.highlightFriends(username);

    // 将相对时间替换为悬停 title 中的完整时间
    function replaceRelativeTimeWithAbsolute() {
        const processedAttr = 'data-ns-time-replaced';
        const elements = document.querySelectorAll('[title]:not([' + processedAttr + '])');
        elements.forEach(function (element) {
            try {
                const titleText = element.getAttribute('title') || '';
                if (!titleText) return;
                const originalText = (element.textContent || '').trim();
                const lowerText = originalText.toLowerCase();
                // 仅处理看起来是相对时间的文本
                const looksLikeRelative = /\bago\b/.test(lowerText) || /刚刚|分钟前|小时|天前|月前|年前/.test(originalText);
                if (!looksLikeRelative) return;

                let displayText = titleText;
                if (/\bedited\b/.test(lowerText)) {
                    // 去掉 title 开头可能自带的 "Edited " 或中文 "编辑于 " 前缀
                    let clean = titleText.replace(/^\s*edited\s*/i, '').replace(/^\s*编辑于\s*/i, '');
                    displayText = '编辑时间 ' + clean;
                }

                element.textContent = displayText;
                element.setAttribute(processedAttr, 'true');
            } catch (e) {
                // 忽略单个元素异常
            }
        });
    }

    let lastViewedTitlesRunAt = 0;
    let lastVisitedHistoryRaw = null;
    let cachedVisitedUrlSet = new Set();

    function normalizeVisitedUrl(urlStr) {
        try {
            const urlObj = new URL(urlStr, window.location.origin);
            let pathname = urlObj.pathname;
            const postMatch = pathname.match(/^\/post-(\d+)-\d+$/);
            if (postMatch) {
                pathname = `/post-${postMatch[1]}-1`;
            }
            return urlObj.origin + pathname + urlObj.search;
        } catch (e) {
            return (urlStr || '').toString().split('#')[0];
        }
    }

    // 全局点击拦截：点击标题链接时立即记录历史 + 更新链接样式（不依赖页面 load/DOMContentLoaded）
    document.addEventListener('click', function (e) {
        const a = e.target.closest('a');
        if (!a || !a.href) return;
        const href = a.getAttribute('href') || '';
        if (!/\/post-\d+|\/topic\/|\/article\//.test(href) && !/\/post-\d+|\/topic\/|\/article\//.test(a.href)) return;
        const text = (a.textContent || '').trim();
        if (text.length < 1) return;
        if (a.closest('#nodeseek-plugin-container, #browse-history-dialog, #blacklist-dialog, #friends-dialog, #logs-dialog, footer')) return;

        // 立即记录到已读历史（任意进帖链接均可记录）；仅标题链接触发阅读记忆颜色（帖子详情页不着色）
        if (getViewedHistoryEnabled()) {
            addToViewedTitles(a.href);
            if (!isPostThreadDetailPage()) {
                const normalized = normalizeVisitedUrl(a.href);
                if (isLikelyTitleLink(a) && cachedVisitedUrlSet.has(normalized)) {
                    a.classList.add('ns-viewed-title');
                } else {
                    a.classList.remove('ns-viewed-title');
                }
            }
        }

        // 同时记录到浏览历史
        if (window.NodeSeekViewedTitles && window.NodeSeekViewedTitles.add) {
            window.NodeSeekViewedTitles.add(a.href);
        }
    }, true);

    // 新增：已读标题记录管理（独立存储）
    const VIEWED_TITLES_STORAGE_KEY = 'nodeseek_viewed_titles_data';

    function getViewedTitlesData() {
        return JSON.parse(localStorage.getItem(VIEWED_TITLES_STORAGE_KEY) || '[]');
    }

    function setViewedTitlesData(list) {
        localStorage.setItem(VIEWED_TITLES_STORAGE_KEY, JSON.stringify(list));
    }

    function addToViewedTitles(url) {
        const history = getViewedTitlesData();
        const normalizedUrl = normalizeVisitedUrl(url);

        // 检查是否存在
        const existingIndex = history.indexOf(normalizedUrl);
        if (existingIndex !== -1) {
            // 移动到最前
            history.splice(existingIndex, 1);
        }

        history.unshift(normalizedUrl);

        // 限制最大条数 5000
        if (history.length > 5000) {
            history.length = 5000;
        }

        setViewedTitlesData(history);
        // 更新缓存
        cachedVisitedUrlSet = new Set(history);
    }

    // 暴露接口给 History.js 和同步功能使用
    window.NodeSeekViewedTitles = {
        add: addToViewedTitles,
        getData: getViewedTitlesData,
        setData: setViewedTitlesData,
        refresh: function () {
            cachedVisitedUrlSet = null; // 强制清除缓存
            markViewedTitles(true); // 重新渲染
        }
    };

    function getVisitedUrlSet() {
        // 优先使用新的独立存储
        const raw = localStorage.getItem(VIEWED_TITLES_STORAGE_KEY);
        if (raw) {
            if (raw === lastVisitedHistoryRaw) return cachedVisitedUrlSet;
            lastVisitedHistoryRaw = raw;
            try {
                const history = JSON.parse(raw);
                cachedVisitedUrlSet = new Set(history);
                return cachedVisitedUrlSet;
            } catch (e) {
                return new Set();
            }
        }

        // 迁移旧数据（如果存在且新存储为空）
        try {
            const history = getBrowseHistory();
            const set = new Set();
            const list = [];
            if (Array.isArray(history)) {
                for (const item of history) {
                    if (!item || !item.url) continue;
                    const normalized = normalizeVisitedUrl(item.url);
                    if (!set.has(normalized)) {
                        set.add(normalized);
                        list.push(normalized);
                    }
                }
            }
            // 保存迁移数据
            if (list.length > 0) {
                setViewedTitlesData(list);
            }
            cachedVisitedUrlSet = set;
            return cachedVisitedUrlSet;
        } catch (e) {
            cachedVisitedUrlSet = new Set();
            return cachedVisitedUrlSet;
        }
    }

    /** 链接可见文本仅为日期时间（如最后回复时间），不是帖子标题 */
    function anchorTextLooksLikeReplyOrPostTime(text) {
        const t = (text || '').trim();
        if (!t) return false;
        if (/^编辑时间\s+/u.test(t)) return true;
        // 完整本地时间：2026-03-24 01:40:17
        if (/^\d{4}-\d{2}-\d{2}(\s+\d{1,2}:\d{2}(:\d{2})?)?$/u.test(t)) return true;
        return false;
    }

    /** 主题页楼层锚点（#13）；与同帖 URL 规范化后一致，不能当「标题」染阅读记忆色 */
    function anchorTextLooksLikeFloorLink(text) {
        const t = (text || '').trim().replace(/\s+/g, '');
        if (!t) return false;
        return /^#\d+$/.test(t);
    }

    function isLikelyTitleLink(a) {
        if (!(a instanceof HTMLAnchorElement)) return false;
        if (!a.href) return false;
        if (a.closest('#nodeseek-plugin-container, #browse-history-dialog, #blacklist-dialog, #friends-dialog, #logs-dialog')) return false;
        if (a.closest('footer')) return false;
        if (a.closest('.floor-link-wrapper')) return false;
        // 列表项底部元信息行（作者、浏览、回复、最后回复时间等）内的帖子链不是标题
        if (a.closest('.nsk-content-meta-info')) return false;
        const path = window.location.pathname || '';
        const isDetailPage = path.includes('/topic/') || path.includes('/article/') || /\/post-\d+/.test(path);
        if (isDetailPage) {
            if (a.closest('.topic-header, .thread-header, .article-header, .topic-detail-header')) return false;
            if (a.closest('h1')) return false;
        }
        const text = (a.textContent || '').trim();
        if (anchorTextLooksLikeReplyOrPostTime(text)) return false;
        if (anchorTextLooksLikeFloorLink(text)) return false;
        if (isSamePostThreadPageLink(a)) return false;
        const minLen = isUserSpaceTab() ? 1 : 3;
        const maxLen = isUserSpaceTab() ? 500 : 140;
        if (text.length < minLen || text.length > maxLen) return false;
        const href = a.getAttribute('href') || '';
        if (!/\/post-\d+|\/topic\/|\/article\//.test(href) && !/\/post-\d+|\/topic\/|\/article\//.test(a.href)) return false;
        return true;
    }

    /** 个人主页「主题帖」「评论」「收藏」标签（含 #/discussions 与 #discussions 等写法） */
    function isUserSpaceTab() {
        const path = window.location.pathname || '';
        if (!/^\/space\/\d+/.test(path)) return false;
        const hash = window.location.hash || '';
        return /^#\/?discussions(\b|\/|\?|$)/.test(hash) || /^#\/?comments(\b|\/|\?|$)/.test(hash) || /^#\/?favorites?(\b|\/|\?|$)/.test(hash);
    }

    function isNotificationPage() {
        const path = window.location.pathname || '';
        return path === '/notification' || path.startsWith('/notification/');
    }

    /** 论坛帖子详情页（/post-123-1）；不在此页应用阅读记忆标题颜色 */
    function isPostThreadDetailPage() {
        const path = window.location.pathname || '';
        return /^\/post-\d+/i.test(path);
    }

    /** 帖子内翻页、省略号跳转等与当前帖同 ID（/post-{id}-*），应保持站点默认打开方式，不强制新标签页 */
    function isSamePostThreadPageLink(a) {
        if (!(a instanceof HTMLAnchorElement)) return false;
        const path = window.location.pathname || '';
        const cur = path.match(/^\/post-(\d+)/i);
        if (!cur) return false;
        try {
            const u = new URL(a.href, window.location.href);
            const linkPath = u.pathname || '';
            const tgt = linkPath.match(/^\/post-(\d+)/i);
            return !!(tgt && tgt[1] === cur[1]);
        } catch (e) {
            return false;
        }
    }

    function updatePageScopeClasses() {
        const root = document.documentElement;
        if (!root) return;
        root.classList.toggle('ns-page-notification', isNotificationPage());
    }

    // ====== MutationObserver：Vue SPA 渲染完成后自动触发标记和链接处理 ======
    (function () {
        const CONTENT_ROOT_SELECTORS = [
            '#app', 'main', '.nsk-content',
            '.post-content', '.topic-list',
            '.thread-list', '.post-list'
        ];

        function contentRoot() {
            for (const sel of CONTENT_ROOT_SELECTORS) {
                const el = document.querySelector(sel);
                if (el) return el;
            }
            return document.body;
        }

        const obs = new MutationObserver(function (mutations) {
            for (const m of mutations) {
                if (m.type !== 'childList' || m.addedNodes.length === 0) continue;
                for (const node of m.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    if (node.id && /^nodeseek-plugin|blacklist-dialog|friends-dialog|browse-history-dialog|logs-dialog|quick-reply-dialog/.test(node.id)) continue;
                    if (node.closest && node.closest('#nodeseek-plugin-main-container, #nodeseek-plugin-buttons-container, #blacklist-dialog, #friends-dialog, #browse-history-dialog, #logs-dialog, #quick-reply-dialog')) continue;
                    scheduleUpdateAll(180);
                    return;
                }
            }
        });

        function initObserver() {
            obs.observe(contentRoot(), { childList: true, subtree: true });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initObserver);
        } else {
            initObserver();
        }

        // hash 路由切换时：立即同步执行 + 多次补漏（Vue 渲染可能分批）
        window.addEventListener('hashchange', function () {
            scheduleUpdateAll(0);
            ensurePluginControlPanel();
            setTimeout(function () { scheduleUpdateAll(0); }, 150);
            setTimeout(function () { scheduleUpdateAll(0); ensurePluginControlPanel(); }, 400);
        });
    })();

    // 新增：应用新标签页打开帖子逻辑
    function applyNewTabLinks() {
        const isEnabled = getOpenPostNewTabEnabled();
        const isSpaceTab = isUserSpaceTab();

        // 曾误判为标题链的节点（如帖内翻页、省略号）需摘掉本脚本写入的 target 标记
        document.querySelectorAll('a[data-ns-original-target]').forEach(function (el) {
            if (!(el instanceof HTMLAnchorElement)) return;
            if (isLikelyTitleLink(el)) return;
            const originalTarget = el.getAttribute('data-ns-original-target');
            if (originalTarget) {
                el.target = originalTarget;
            } else {
                el.removeAttribute('target');
            }
            el.removeAttribute('data-ns-original-target');
        });

        // 通用选择器（所有页面都用）
        const generalSelectors = [
            'a.topic-title', '.topic-title a',
            'a.thread-title', '.thread-title a',
            'a.post-title', '.post-title a',
            'a.article-title', '.article-title a',
            '.subject a',
            'h2 a[href*="/post-"]', 'h3 a[href*="/post-"]',
            'a[href*="/post-"][class*="title"]',
            'a[href*="/topic/"][class*="title"]',
            'a[href*="/article/"][class*="title"]'
        ];

        // 用户空间 tab 专用（.title 在论坛列表页会误匹配，这里只对用户空间页额外补充）
        const spaceSelectors = isSpaceTab ? [
            '.title a',
            'a[href*="/post-"]',
            'a[href*="/topic/"]',
            'a[href*="/article/"]'
        ] : [];

        const allSelectors = [...generalSelectors, ...spaceSelectors];

        const candidates = new Set();
        for (const selector of allSelectors) {
            const list = document.querySelectorAll(selector);
            for (const el of list) {
                if (el instanceof HTMLAnchorElement) candidates.add(el);
            }
        }

        // fallback：始终兜底查找所有帖子链接
        const fallback = document.querySelectorAll('a[href*="/post-"], a[href*="/topic/"], a[href*="/article/"]');
        for (const el of fallback) {
            if (el instanceof HTMLAnchorElement && isLikelyTitleLink(el)) candidates.add(el);
        }

        for (const a of candidates) {
            if (!isLikelyTitleLink(a)) continue;
            if (isEnabled) {
                if (!a.hasAttribute('data-ns-original-target')) {
                    a.setAttribute('data-ns-original-target', a.target || '');
                }
                a.target = '_blank';
            } else {
                if (a.hasAttribute('data-ns-original-target')) {
                    const originalTarget = a.getAttribute('data-ns-original-target');
                    if (originalTarget) {
                        a.target = originalTarget;
                    } else {
                        a.removeAttribute('target');
                    }
                    a.removeAttribute('data-ns-original-target');
                }
            }
        }
    }

    function markViewedTitles(force = false) {
        const isEnabled = getViewedHistoryEnabled();
        const now = Date.now();
        if (!force && now - lastViewedTitlesRunAt < 1200) return;
        lastViewedTitlesRunAt = now;

        // 如果功能关闭，移除已有的样式并退出
        if (!isEnabled) {
            const marked = document.querySelectorAll('.ns-viewed-title');
            for (const el of marked) {
                el.classList.remove('ns-viewed-title');
                el.style.removeProperty('color');
            }
            return;
        }

        if (isNotificationPage()) {
            // /notification 列表页本身（无 hash 或其他 hash）不染色；#/reply 和 #/atMe 子页面需要染标题色
            const hash = window.location.hash || '';
            const isReplyOrAtMe = /^#\/reply\b/i.test(hash) || /^#\/atMe\b/i.test(hash);
            if (!isReplyOrAtMe) {
                const marked = document.querySelectorAll('.ns-viewed-title');
                for (const el of marked) {
                    el.classList.remove('ns-viewed-title');
                    el.style.removeProperty('color');
                }
                return;
            }
        }

        if (isPostThreadDetailPage()) {
            const marked = document.querySelectorAll('.ns-viewed-title');
            for (const el of marked) {
                el.classList.remove('ns-viewed-title');
                el.style.removeProperty('color');
            }
            return;
        }

        const visitedSet = getVisitedUrlSet();
        const isSpaceTab = isUserSpaceTab();

        const generalSelectors = [
            'a.topic-title', '.topic-title a',
            'a.thread-title', '.thread-title a',
            'a.post-title', '.post-title a',
            'a.article-title', '.article-title a',
            '.subject a',
            'h2 a[href*="/post-"]', 'h3 a[href*="/post-"]',
            'a[href*="/post-"][class*="title"]',
            'a[href*="/topic/"][class*="title"]',
            'a[href*="/article/"][class*="title"]',
            // 通知页 #/reply 和 #/atMe 标题链接
            '.notification-title a',
            '.notify-title a',
            '.notify-item a[href*="/post-"]',
            'a.notify-link[href*="/post-"]',
            'a[href*="/post-"][class*="notification"]',
            'a[href*="/post-"][class*="notify"]',
            '.app-main a[href*="/post-"]',
            '.notification-content a[href*="/post-"]'
        ];

        const spaceSelectors = isSpaceTab ? [
            '.title a',
            'a[href*="/post-"]',
            'a[href*="/topic/"]',
            'a[href*="/article/"]'
        ] : [];

        const candidates = new Set();
        for (const selector of [...generalSelectors, ...spaceSelectors]) {
            const list = document.querySelectorAll(selector);
            for (const el of list) {
                if (el instanceof HTMLAnchorElement) candidates.add(el);
            }
        }

        // fallback：始终兜底查找所有帖子链接
        const fallback = document.querySelectorAll('a[href*="/post-"], a[href*="/topic/"], a[href*="/article/"]');
        for (const el of fallback) {
            if (el instanceof HTMLAnchorElement) candidates.add(el);
        }

        for (const a of candidates) {
            if (!isLikelyTitleLink(a)) continue;
            const normalized = normalizeVisitedUrl(a.href);
            const isViewed = visitedSet.has(normalized);

            if (isViewed) {
                a.classList.add('ns-viewed-title');
                // 移除旧的内联样式
                if (a.style.color) {
                    a.style.removeProperty('color');
                }
            } else {
                a.classList.remove('ns-viewed-title');
                // 如果之前设置过颜色，移除它
                if (a.style.color) {
                    a.style.removeProperty('color');
                }
            }
        }
    }

    // 优化主更新函数，减少不必要的重复调用
    let lastUpdateTime = 0;
    let deferredUpdateTimer = null;
    function ensurePluginControlPanel() {
        if (!document.body) return;
        const panel = document.getElementById('nodeseek-plugin-main-container');
        if (!panel || !document.body.contains(panel) || !document.getElementById('settings-btn')) {
            addExportImportButtons();
        }
    }

    let updateAllTimer = null;
    function scheduleUpdateAll(delay) {
        if (updateAllTimer) clearTimeout(updateAllTimer);
        updateAllTimer = setTimeout(function () {
            updateAllTimer = null;
            updateAll();
        }, typeof delay === 'number' ? delay : 250);
    }

    function runWhenIdle(fn, timeout) {
        if (typeof requestIdleCallback === 'function') {
            requestIdleCallback(fn, { timeout: timeout || 1200 });
            return;
        }
        setTimeout(fn, 0);
    }

    function updateAll() {
        const now = Date.now();
        // 避免过于频繁的更新
        if (now - lastUpdateTime < 600) {
            if (!deferredUpdateTimer) {
                deferredUpdateTimer = setTimeout(function () {
                    deferredUpdateTimer = null;
                    scheduleUpdateAll(0);
                }, Math.max(120, 620 - (now - lastUpdateTime)));
            }
            return;
        }
        lastUpdateTime = now;

        updatePageScopeClasses();
        processUsernames();
        processHomepageAuthorMetaBadges();
        highlightBlacklisted();
        highlightFriends(); // 新增调用
        replaceRelativeTimeWithAbsolute(); // 新增：替换相对时间为完整时间
        if (getViewedHistoryEnabled()) markViewedTitles();
        if (getOpenPostNewTabEnabled()) applyNewTabLinks(); // 新增：应用新标签页打开帖子逻辑
        if (window.NodeSeekQuickReply && typeof window.NodeSeekQuickReply.bindEditorButton === 'function') window.NodeSeekQuickReply.bindEditorButton();
        ensurePluginControlPanel();
    }

    // 兼容异步加载，定时检查
    setInterval(function () { scheduleUpdateAll(0); }, 12000);
    setInterval(ensurePluginControlPanel, 10000);

    // ====== 导出/导入黑名单功能 ======

    function exportBlacklist() {
        // 同时导出所有用户数据：黑名单、好友、操作日志、浏览历史、热点统计等
        const blacklist = getBlacklist();
        const friends = getFriends();
        const logs = getLogs();
        const browseHistory = getBrowseHistory();

        // 不再导出热点统计相关数据

        // 添加快捷回复数据
        let quickReplies = {};
        try {
            if (window.NodeSeekQuickReply) {
                quickReplies = window.NodeSeekQuickReply.getQuickReplies();
            }
        } catch (error) {
            console.error('导出快捷回复数据失败:', error);
        }

        // 新增：快捷回复设置（自动发布）
        let quickReplySettings = {};
        try {
            const autoSubmit = localStorage.getItem('nodeseek_quick_reply_auto_submit');
            if (autoSubmit !== null) {
                quickReplySettings.autoSubmit = autoSubmit === 'true';
            }
        } catch (error) {
            console.error('导出快捷回复设置失败:', error);
        }

        // 新增：签到设置（是否开启自动签到及模式）
        let signSettings = {};
        try {
            const signEnabled = localStorage.getItem('nodeseek_sign_enabled');
            if (signEnabled !== null) {
                signSettings.enabled = signEnabled === 'true';
            }
            const signMode = localStorage.getItem('nodeseek_sign_mode');
            if (signMode !== null) {
                signSettings.mode = signMode;
            }
        } catch (error) {
            console.error('导出签到设置失败:', error);
        }


        // 添加鸡腿统计数据
        let chickenLegStats = {};
        try {
            if (window.NodeSeekRegister && typeof window.NodeSeekRegister.getChickenLegStats === 'function') {
                chickenLegStats = window.NodeSeekRegister.getChickenLegStats();
            } else {
                // 如果模块函数不存在，尝试直接从localStorage获取所有相关数据
                const lastFetch = localStorage.getItem('nodeseek_chicken_leg_last_fetch');
                const nextAllow = localStorage.getItem('nodeseek_chicken_leg_next_allow');
                const lastHtml = localStorage.getItem('nodeseek_chicken_leg_last_html');
                const history = localStorage.getItem('nodeseek_chicken_leg_history');

                if (lastFetch || nextAllow || lastHtml || history) {
                    chickenLegStats = {
                        lastFetch: lastFetch,
                        nextAllow: nextAllow,
                        lastHtml: lastHtml,
                        history: history ? JSON.parse(history) : []
                    };
                }
            }
        } catch (error) {
            console.error('导出鸡腿统计数据失败:', error);
        }

        // 添加关键词过滤数据
        let filterData = {};
        try {
            if (window.NodeSeekFilter) {
                const customKeywords = localStorage.getItem('ns-filter-custom-keywords');
                const displayKeywords = localStorage.getItem('ns-filter-keywords');
                const highlightKeywords = localStorage.getItem('ns-filter-highlight-keywords');
                const highlightPostKeywords = localStorage.getItem('ns-filter-highlight-post-keywords');
                const highlightAuthorEnabled = localStorage.getItem('ns-filter-highlight-author-enabled');
                const highlightColor = localStorage.getItem('ns-filter-highlight-color');
                const dialogPosition = localStorage.getItem('ns-filter-dialog-position');
                const whitelistUsers = localStorage.getItem('ns-filter-whitelist-users');
                const profileFilterEnabled = localStorage.getItem('ns-filter-profile-filter-enabled');
                const blockLevels = localStorage.getItem('ns-filter-block-levels');
                const maxJoinDays = localStorage.getItem('ns-filter-max-join-days');

                if (customKeywords || displayKeywords || highlightKeywords || highlightPostKeywords || highlightAuthorEnabled || highlightColor || dialogPosition || whitelistUsers || profileFilterEnabled || blockLevels || maxJoinDays !== null) {
                    filterData = {
                        customKeywords: customKeywords ? JSON.parse(customKeywords) : [],
                        displayKeywords: displayKeywords ? JSON.parse(displayKeywords) : [],
                        highlightKeywords: highlightKeywords ? JSON.parse(highlightKeywords) : [],
                        highlightPostKeywords: highlightPostKeywords ? JSON.parse(highlightPostKeywords) : [],
                        highlightAuthorEnabled: highlightAuthorEnabled ? JSON.parse(highlightAuthorEnabled) : false,
                        highlightColor: highlightColor || '#facc15',
                        dialogPosition: dialogPosition ? JSON.parse(dialogPosition) : null,
                        whitelistUsers: whitelistUsers ? JSON.parse(whitelistUsers) : [],
                        profileFilterEnabled: profileFilterEnabled ? JSON.parse(profileFilterEnabled) : true,
                        blockLevels: blockLevels ? JSON.parse(blockLevels) : ['0', '1'],
                        maxJoinDays: maxJoinDays === '' ? null : (maxJoinDays ? Number(maxJoinDays) : 30)
                    };
                }
            }
        } catch (error) {
            console.error('导出关键词过滤数据失败:', error);
        }

        // 添加笔记数据
        let notesData = {};
        try {
            if (window.NodeSeekNotes && typeof window.NodeSeekNotes.exportNotesData === 'function') {
                notesData = window.NodeSeekNotes.exportNotesData();
            }
        } catch (error) {
            console.error('导出笔记数据失败:', error);
        }

        // 添加阅读记忆数据
        let viewedTitles = {};
        try {
            const enabled = localStorage.getItem('nodeseek_viewed_history_enabled');
            const color = localStorage.getItem('nodeseek_viewed_color');
            const data = localStorage.getItem('nodeseek_viewed_titles_data');

            if (enabled !== null) viewedTitles.enabled = enabled === 'true';
            if (color !== null) viewedTitles.color = color;
            if (data !== null) viewedTitles.data = JSON.parse(data);
        } catch (error) {
            console.error('导出阅读记忆数据失败:', error);
        }

        // 添加备份设置
        let backupLimit = 3;
        try {
            const limit = localStorage.getItem('nodeseek_backup_limit');
            if (limit) {
                backupLimit = parseInt(limit);
            }
        } catch (error) {
            console.error('导出备份设置失败:', error);
        }

        // 新增：屏蔽URL跳转提醒设置
        let skipJumpSettings = {};
        try {
            skipJumpSettings.enabled = getSkipJumpPageEnabled();
            skipJumpSettings.mode = getSkipJumpMode();
            skipJumpSettings.list = getSkipJumpList();
        } catch (error) {
            console.error('导出屏蔽URL跳转提醒设置失败:', error);
        }

        // 新增：新标签页打开帖子设置
        let openPostNewTabSettings = {};
        try {
            openPostNewTabSettings.enabled = getOpenPostNewTabEnabled();
        } catch (error) {
            console.error('导出新标签页打开帖子设置失败:', error);
        }

        const data = JSON.stringify({
            blacklist: blacklist,
            friends: friends,
            logs: logs,
            browseHistory: browseHistory,
            quickReplies: quickReplies, // 添加快捷回复数据
            quickReplySettings: quickReplySettings, // 新增：快捷回复设置
            signSettings: signSettings, // 新增：签到设置
            skipJumpSettings: skipJumpSettings, // 新增：屏蔽URL跳转提醒设置
            openPostNewTabSettings: openPostNewTabSettings, // 新增：新标签页打开帖子设置
            chickenLegStats: chickenLegStats, // 添加鸡腿统计数据
            filterData: filterData, // 添加关键词过滤数据
            notesData: notesData, // 添加笔记数据
            viewedTitles: viewedTitles, // 添加阅读记忆数据

            backupLimit: backupLimit // 添加备份设置
        }, null, 2);
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nodeseek_data.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        // 记录操作日志
        const hasQuickReplies = Object.keys(quickReplies).length > 0;
        const hasQuickReplySettings = Object.keys(quickReplySettings).length > 0;
        const hasSignSettings = Object.keys(signSettings).length > 0;
        const hasChickenLegStats = Object.keys(chickenLegStats).length > 0;
        const hasFilterData = Object.keys(filterData).length > 0;
        const hasNotesData = Object.keys(notesData).length > 0;
        const hasViewedTitles = Object.keys(viewedTitles).length > 0;
        let exportDesc = '导出数据备份 (黑名单、好友、操作日志、浏览历史';
        if (hasQuickReplies) {
            exportDesc += '、快捷回复';
        }
        if (hasChickenLegStats) {
            exportDesc += '、鸡腿统计';
        }
        if (hasFilterData) {
            exportDesc += '、关键词过滤';
        }
        if (hasNotesData) {
            exportDesc += '、笔记';
        }
        if (hasViewedTitles) {
            exportDesc += '、阅读记忆';
        }
        // 不在导出日志中包含“自动同步设置”
        // 始终包含备份设置
        exportDesc += '、设置';
        exportDesc += ')';
        addLog(exportDesc);
    }

    function importBlacklist() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (evt) {
                try {
                    const json = JSON.parse(evt.target.result);
                    // 记录导入前信息
                    let importInfo = [];

                    // 处理黑名单数据
                    if (json.blacklist) {
                        setBlacklist(json.blacklist);
                        importInfo.push("黑名单");
                    }

                    // 处理好友数据
                    if (json.friends) {
                        setFriends(json.friends);
                        importInfo.push("好友");
                    }

                    // 处理日志数据
                    if (json.logs && Array.isArray(json.logs)) {
                        localStorage.setItem(LOGS_KEY, JSON.stringify(json.logs));
                        importInfo.push("操作日志");
                    }

                    // 处理浏览历史数据
                    if (json.browseHistory && Array.isArray(json.browseHistory)) {
                        setBrowseHistory(json.browseHistory);
                        importInfo.push("浏览历史");
                    }

                    // 处理热点统计数据
                    if (json.hotTopicsData && typeof json.hotTopicsData === 'object') {
                        try {
                            const hotData = json.hotTopicsData;
                            let hotImportCount = 0;

                            // 导入RSS历史数据
                            if (hotData.rssHistory && Array.isArray(hotData.rssHistory)) {
                                localStorage.setItem('nodeseek_rss_history', JSON.stringify(hotData.rssHistory));
                                hotImportCount++;
                            }

                            // 导入热词历史数据
                            if (hotData.hotWordsHistory && Array.isArray(hotData.hotWordsHistory)) {
                                localStorage.setItem('nodeseek_hot_words_history', JSON.stringify(hotData.hotWordsHistory));
                                hotImportCount++;
                            }

                            // 导入时间分布数据
                            if (hotData.timeDistributionHistory && Array.isArray(hotData.timeDistributionHistory)) {
                                localStorage.setItem('nodeseek_time_distribution_history', JSON.stringify(hotData.timeDistributionHistory));
                                hotImportCount++;
                            }

                            // 导入用户统计数据
                            if (hotData.userStatsHistory && Array.isArray(hotData.userStatsHistory)) {
                                localStorage.setItem('nodeseek_user_stats_history', JSON.stringify(hotData.userStatsHistory));
                                hotImportCount++;
                            }

                            // 导入全局状态数据
                            if (hotData.globalState && typeof hotData.globalState === 'object') {
                                localStorage.setItem('nodeseek_focus_global_state', JSON.stringify(hotData.globalState));
                                hotImportCount++;
                            }

                            if (hotImportCount > 0) {
                                importInfo.push(`热点统计(${hotImportCount}项)`);
                            }
                        } catch (error) {
                            console.error('导入热点统计数据失败:', error);
                            importInfo.push("热点统计(失败)");
                        }
                    }

                    // 处理快捷回复数据
                    if (json.quickReplies && typeof json.quickReplies === 'object') {
                        try {
                            if (window.NodeSeekQuickReply) {
                                window.NodeSeekQuickReply.setQuickReplies(json.quickReplies);
                                const categoriesCount = Object.keys(json.quickReplies).length;
                                importInfo.push(`快捷回复(${categoriesCount}个分类)`);
                            } else {
                                // 如果功能暂不可用，直接保存到localStorage
                                localStorage.setItem('nodeseek_quick_reply', JSON.stringify(json.quickReplies));
                                importInfo.push("快捷回复");
                            }
                        } catch (error) {
                            console.error('导入快捷回复数据失败:', error);
                            importInfo.push("快捷回复(失败)");
                        }
                    }

                    // 新增：处理快捷回复设置（自动发布）
                    if (json.quickReplySettings && typeof json.quickReplySettings === 'object') {
                        try {
                            if (typeof json.quickReplySettings.autoSubmit !== 'undefined') {
                                localStorage.setItem('nodeseek_quick_reply_auto_submit', json.quickReplySettings.autoSubmit ? 'true' : 'false');
                                importInfo.push(`快捷回复设置(自动发布${json.quickReplySettings.autoSubmit ? '开启' : '关闭'})`);
                            }
                        } catch (error) {
                            console.error('导入快捷回复设置失败:', error);
                            importInfo.push('快捷回复设置(失败)');
                        }
                    } else if (typeof json.quickReplyAutoSubmit !== 'undefined') {
                        // 兼容可能的旧字段名
                        try {
                            localStorage.setItem('nodeseek_quick_reply_auto_submit', json.quickReplyAutoSubmit ? 'true' : 'false');
                            importInfo.push(`快捷回复设置(自动发布${json.quickReplyAutoSubmit ? '开启' : '关闭'})`);
                        } catch (error) {
                            console.error('导入快捷回复设置(兼容字段)失败:', error);
                            importInfo.push('快捷回复设置(失败)');
                        }
                    }

                    // 新增：处理签到设置（是否开启自动签到及模式）
                    if (json.signSettings && typeof json.signSettings === 'object') {
                        try {
                            if (typeof json.signSettings.enabled !== 'undefined') {
                                localStorage.setItem('nodeseek_sign_enabled', json.signSettings.enabled ? 'true' : 'false');
                            }
                            if (typeof json.signSettings.mode !== 'undefined') {
                                localStorage.setItem('nodeseek_sign_mode', json.signSettings.mode);
                            }
                            const modeStr = json.signSettings.mode === 'fixed' ? '固定' : (json.signSettings.mode === 'random' ? '随机' : '默认');
                            importInfo.push(`签到设置(${json.signSettings.enabled ? '开启' : '关闭'}, ${modeStr})`);
                        } catch (error) {
                            console.error('导入签到设置失败:', error);
                            importInfo.push('签到设置(失败)');
                        }
                    } else if (typeof json.signEnabled !== 'undefined') {
                        // 兼容可能的旧字段名
                        try {
                            localStorage.setItem('nodeseek_sign_enabled', json.signEnabled ? 'true' : 'false');
                            importInfo.push(`签到设置(${json.signEnabled ? '开启' : '关闭'})`);
                        } catch (error) {
                            console.error('导入签到设置(兼容字段)失败:', error);
                            importInfo.push('签到设置(失败)');
                        }
                    }

                    // 新增：处理屏蔽URL跳转提醒设置
                    if (json.skipJumpSettings && typeof json.skipJumpSettings === 'object') {
                        try {
                            if (typeof json.skipJumpSettings.enabled !== 'undefined') {
                                setSkipJumpPageEnabled(json.skipJumpSettings.enabled);
                            }
                            if (json.skipJumpSettings.mode) {
                                // 兼容旧数据的 blacklist 模式，将其转为 all
                                const mode = json.skipJumpSettings.mode === 'whitelist' ? 'whitelist' : 'all';
                                setSkipJumpMode(mode);
                            }
                            if (json.skipJumpSettings.list) {
                                setSkipJumpList(json.skipJumpSettings.list);
                            }
                            const modeText = (getSkipJumpMode() === 'whitelist') ? '白名单' : '全放行';
                            importInfo.push(`屏蔽URL跳转提醒设置(${json.skipJumpSettings.enabled ? '开启' : '关闭'}, ${modeText})`);
                        } catch (error) {
                            console.error('导入屏蔽URL跳转提醒设置失败:', error);
                            importInfo.push('屏蔽URL跳转提醒设置(失败)');
                        }
                    }

                    // 新增：处理新标签页打开帖子设置
                    if (json.openPostNewTabSettings && typeof json.openPostNewTabSettings === 'object') {
                        try {
                            if (typeof json.openPostNewTabSettings.enabled !== 'undefined') {
                                setOpenPostNewTabEnabled(json.openPostNewTabSettings.enabled);
                                importInfo.push(`新标签页打开帖子设置(${json.openPostNewTabSettings.enabled ? '开启' : '关闭'})`);
                            }
                        } catch (error) {
                            console.error('导入新标签页打开帖子设置失败:', error);
                            importInfo.push('新标签页打开帖子设置(失败)');
                        }
                    }

                    // 处理鸡腿统计数据
                    if (json.chickenLegStats && typeof json.chickenLegStats === 'object') {
                        try {
                            if (window.NodeSeekRegister && typeof window.NodeSeekRegister.setChickenLegStats === 'function') {
                                window.NodeSeekRegister.setChickenLegStats(json.chickenLegStats);
                                const historyCount = json.chickenLegStats.history ? json.chickenLegStats.history.length : 0;
                                importInfo.push(`鸡腿统计(${historyCount}条记录)`);
                            } else {
                                // 如果功能暂不可用，直接保存到localStorage的相应键中
                                let importedCount = 0;

                                if (json.chickenLegStats.lastFetch) {
                                    localStorage.setItem('nodeseek_chicken_leg_last_fetch', json.chickenLegStats.lastFetch);
                                    importedCount++;
                                }

                                if (json.chickenLegStats.nextAllow) {
                                    localStorage.setItem('nodeseek_chicken_leg_next_allow', json.chickenLegStats.nextAllow);
                                    importedCount++;
                                }

                                if (json.chickenLegStats.lastHtml) {
                                    localStorage.setItem('nodeseek_chicken_leg_last_html', json.chickenLegStats.lastHtml);
                                    importedCount++;
                                }

                                if (json.chickenLegStats.history && Array.isArray(json.chickenLegStats.history)) {
                                    localStorage.setItem('nodeseek_chicken_leg_history', JSON.stringify(json.chickenLegStats.history));
                                    importedCount++;
                                    importInfo.push(`鸡腿统计(${json.chickenLegStats.history.length}条记录)`);
                                } else {
                                    importInfo.push("鸡腿统计");
                                }
                            }
                        } catch (error) {
                            console.error('导入鸡腿统计数据失败:', error);
                            importInfo.push("鸡腿统计(失败)");
                        }
                    }

                    // 处理旧格式数据
                    // 处理关键词过滤数据
                    if (json.filterData && typeof json.filterData === 'object') {
                        try {
                            let filterImportCount = 0;

                            // 导入屏蔽关键词
                            if (json.filterData.customKeywords && Array.isArray(json.filterData.customKeywords)) {
                                localStorage.setItem('ns-filter-custom-keywords', JSON.stringify(json.filterData.customKeywords));
                                filterImportCount += json.filterData.customKeywords.length;
                            }

                            // 导入显示关键词
                            if (json.filterData.displayKeywords && Array.isArray(json.filterData.displayKeywords)) {
                                localStorage.setItem('ns-filter-keywords', JSON.stringify(json.filterData.displayKeywords));
                            }

                            // 导入高亮关键词
                            if (json.filterData.highlightKeywords && Array.isArray(json.filterData.highlightKeywords)) {
                                localStorage.setItem('ns-filter-highlight-keywords', JSON.stringify(json.filterData.highlightKeywords));
                            }

                            // 导入帖子内容高亮关键词
                            if (json.filterData.highlightPostKeywords && Array.isArray(json.filterData.highlightPostKeywords)) {
                                localStorage.setItem('ns-filter-highlight-post-keywords', JSON.stringify(json.filterData.highlightPostKeywords));
                            }

                            // 导入作者高亮选项
                            if (json.filterData.highlightAuthorEnabled !== undefined) {
                                localStorage.setItem('ns-filter-highlight-author-enabled', JSON.stringify(json.filterData.highlightAuthorEnabled));
                            }

                            // 导入高亮颜色
                            if (json.filterData.highlightColor) {
                                localStorage.setItem('ns-filter-highlight-color', json.filterData.highlightColor);
                            }

                            // 导入弹窗位置
                            if (json.filterData.dialogPosition && typeof json.filterData.dialogPosition === 'object') {
                                localStorage.setItem('ns-filter-dialog-position', JSON.stringify(json.filterData.dialogPosition));
                            }

                            // 导入不屏蔽用户
                            if (json.filterData.whitelistUsers && Array.isArray(json.filterData.whitelistUsers)) {
                                localStorage.setItem('ns-filter-whitelist-users', JSON.stringify(json.filterData.whitelistUsers));
                            }

                            if (json.filterData.profileFilterEnabled !== undefined) {
                                localStorage.setItem('ns-filter-profile-filter-enabled', JSON.stringify(json.filterData.profileFilterEnabled));
                            }

                            if (json.filterData.blockLevels && Array.isArray(json.filterData.blockLevels)) {
                                localStorage.setItem('ns-filter-block-levels', JSON.stringify(json.filterData.blockLevels));
                            }

                            if (json.filterData.maxJoinDays !== undefined) {
                                localStorage.setItem('ns-filter-max-join-days', json.filterData.maxJoinDays === null ? '' : String(json.filterData.maxJoinDays));
                            }

                            if (filterImportCount > 0 || (json.filterData.displayKeywords && json.filterData.displayKeywords.length > 0) || (json.filterData.highlightKeywords && json.filterData.highlightKeywords.length > 0) || json.filterData.highlightAuthorEnabled !== undefined || (json.filterData.whitelistUsers && json.filterData.whitelistUsers.length > 0) || json.filterData.profileFilterEnabled !== undefined || (json.filterData.blockLevels && json.filterData.blockLevels.length > 0) || json.filterData.maxJoinDays !== undefined) {
                                const customCount = json.filterData.customKeywords ? json.filterData.customKeywords.length : 0;
                                const displayCount = json.filterData.displayKeywords ? json.filterData.displayKeywords.length : 0;
                                const highlightCount = json.filterData.highlightKeywords ? json.filterData.highlightKeywords.length : 0;
                                const whitelistCount = json.filterData.whitelistUsers ? json.filterData.whitelistUsers.length : 0;
                                const authorHighlightEnabled = json.filterData.highlightAuthorEnabled ? '开启' : '关闭';
                                importInfo.push(`关键词过滤(屏蔽${customCount}个,显示${displayCount}个,高亮${highlightCount}个,不屏蔽用户${whitelistCount}个,作者高亮${authorHighlightEnabled})`);
                            } else {
                                importInfo.push("关键词过滤");
                            }
                        } catch (error) {
                            console.error('导入关键词过滤数据失败:', error);
                            importInfo.push("关键词过滤(失败)");
                        }
                    }

                    // 处理笔记数据
                    if (json.notesData && typeof json.notesData === 'object') {
                        try {
                            if (window.NodeSeekNotes && typeof window.NodeSeekNotes.importNotesData === 'function') {
                                const success = window.NodeSeekNotes.importNotesData(json.notesData);
                                if (success) {
                                    const categoriesCount = json.notesData.categories ? json.notesData.categories.length : 0;
                                    const notesCount = json.notesData.notes ? Object.keys(json.notesData.notes).length : 0;
                                    const trashCount = json.notesData.trash ? json.notesData.trash.length : 0;
                                    importInfo.push(`笔记(${categoriesCount}个分类,${notesCount}篇笔记,${trashCount}条回收站)`);
                                } else {
                                    importInfo.push("笔记(失败)");
                                }
                            } else {
                                // 如果功能暂不可用，直接保存到localStorage
                                if (json.notesData.categories) {
                                    localStorage.setItem('nodeseek_notes_categories', JSON.stringify(json.notesData.categories));
                                }
                                if (json.notesData.notes) {
                                    localStorage.setItem('nodeseek_notes_data', JSON.stringify(json.notesData.notes));
                                }
                                if (json.notesData.fontColors) {
                                    localStorage.setItem('nodeseek_notes_font_colors', JSON.stringify(json.notesData.fontColors));
                                }
                                if (json.notesData.bgColors) {
                                    localStorage.setItem('nodeseek_notes_bg_colors', JSON.stringify(json.notesData.bgColors));
                                }
                                if (json.notesData.lastSelectedNote) {
                                    localStorage.setItem('nodeseek_notes_last_selected', JSON.stringify(json.notesData.lastSelectedNote));
                                }
                                if (json.notesData.trash) {
                                    localStorage.setItem('nodeseek_notes_trash', JSON.stringify(json.notesData.trash));
                                }
                                const categoriesCount = json.notesData.categories ? json.notesData.categories.length : 0;
                                const notesCount = json.notesData.notes ? Object.keys(json.notesData.notes).length : 0;
                                const trashCount = json.notesData.trash ? json.notesData.trash.length : 0;
                                importInfo.push(`笔记(${categoriesCount}个分类,${notesCount}篇笔记,${trashCount}条回收站)`);
                            }
                        } catch (error) {
                            console.error('导入笔记数据失败:', error);
                            importInfo.push("笔记(失败)");
                        }
                    }

                    // 处理阅读记忆数据
                    if (json.viewedTitles && typeof json.viewedTitles === 'object') {
                        try {
                            if (typeof json.viewedTitles.enabled !== 'undefined') {
                                localStorage.setItem('nodeseek_viewed_history_enabled', json.viewedTitles.enabled ? 'true' : 'false');
                            }
                            if (json.viewedTitles.color) {
                                localStorage.setItem('nodeseek_viewed_color', json.viewedTitles.color);
                            }
                            if (Array.isArray(json.viewedTitles.data)) {
                                localStorage.setItem('nodeseek_viewed_titles_data', JSON.stringify(json.viewedTitles.data));
                            }

                            // 刷新缓存
                            if (window.NodeSeekViewedTitles && typeof window.NodeSeekViewedTitles.refresh === 'function') {
                                window.NodeSeekViewedTitles.refresh();
                            }

                            const count = Array.isArray(json.viewedTitles.data) ? json.viewedTitles.data.length : 0;
                            importInfo.push(`阅读记忆(${json.viewedTitles.enabled ? '开启' : '关闭'}, ${count}条)`);
                        } catch (error) {
                            console.error('导入阅读记忆数据失败:', error);
                            importInfo.push('阅读记忆(失败)');
                        }
                    }



                    // 导入备份设置
                    if (json.backupLimit) {
                        try {
                            localStorage.setItem('nodeseek_backup_limit', json.backupLimit.toString());
                            importInfo.push(`备份设置(保留${json.backupLimit}份)`);
                        } catch (e) {
                            importInfo.push('备份设置(失败)');
                        }
                    }

                    if (!json.blacklist && !json.friends && !json.logs && !json.hotTopicsData && !json.quickReplies && !json.chickenLegStats && !json.filterData && !json.notesData) {
                        // 旧格式，直接作为黑名单
                        setBlacklist(json);
                        importInfo.push("旧格式黑名单");
                    }

                    const hasQuickRepliesLog = json.quickReplies && typeof json.quickReplies === 'object' && Object.keys(json.quickReplies).length > 0;
                    const hasChickenLegStatsLog = json.chickenLegStats && typeof json.chickenLegStats === 'object' && Object.keys(json.chickenLegStats).length > 0;
                    const hasFilterDataLog = json.filterData && typeof json.filterData === 'object' && Object.keys(json.filterData).length > 0;
                    const hasNotesDataLog = json.notesData && typeof json.notesData === 'object' && Object.keys(json.notesData).length > 0;
                    let importDesc = '导入数据备份 (黑名单、好友、操作日志、浏览历史';
                    if (hasQuickRepliesLog) importDesc += '、快捷回复';
                    if (hasChickenLegStatsLog) importDesc += '、鸡腿统计';
                    if (hasFilterDataLog) importDesc += '、关键词过滤';
                    if (hasNotesDataLog) importDesc += '、笔记';
                    // 始终包含备份设置
                    if (json.backupLimit) importDesc += '、设置';
                    importDesc += ')';
                    addLog(importDesc);

                    location.reload();
                } catch (err) {
                    alert('导入失败，文件格式不正确');
                    // 记录操作日志
                    addLog('导入数据备份失败: 文件格式不正确');
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }

    function getDefaultWebdavSyncFields() {
        return WEBDAV_SYNC_FIELD_OPTIONS.map(item => item.key);
    }

    function normalizeWebdavSyncFields(fields) {
        const allowed = new Set(getDefaultWebdavSyncFields());
        if (!Array.isArray(fields)) return getDefaultWebdavSyncFields();
        const list = fields.filter(key => allowed.has(key));
        return Array.from(new Set(list));
    }

    function filterNodeSeekBackupData(data, fields) {
        const selected = new Set(normalizeWebdavSyncFields(fields));
        const filtered = {};
        WEBDAV_SYNC_FIELD_OPTIONS.forEach(item => {
            if (!selected.has(item.key)) return;
            item.dataKeys.forEach(dataKey => {
                if (Object.prototype.hasOwnProperty.call(data, dataKey)) filtered[dataKey] = data[dataKey];
            });
        });
        return filtered;
    }

    function buildNodeSeekBackupData(fields) {
        const blacklist = getBlacklist();
        const friends = getFriends();
        const logs = getLogs();
        const browseHistory = getBrowseHistory();

        let quickReplies = {};
        try {
            if (window.NodeSeekQuickReply && typeof window.NodeSeekQuickReply.getQuickReplies === 'function') {
                quickReplies = window.NodeSeekQuickReply.getQuickReplies();
            } else {
                quickReplies = JSON.parse(localStorage.getItem('nodeseek_quick_reply') || '{}');
            }
        } catch (error) {
            console.error('读取快捷回复数据失败:', error);
        }

        const quickReplySettings = {};
        try {
            const autoSubmit = localStorage.getItem('nodeseek_quick_reply_auto_submit');
            if (autoSubmit !== null) quickReplySettings.autoSubmit = autoSubmit === 'true';
        } catch (error) {
            console.error('读取快捷回复设置失败:', error);
        }

        const signSettings = {};
        try {
            const signEnabled = localStorage.getItem('nodeseek_sign_enabled');
            const signMode = localStorage.getItem('nodeseek_sign_mode');
            if (signEnabled !== null) signSettings.enabled = signEnabled === 'true';
            if (signMode !== null) signSettings.mode = signMode;
        } catch (error) {
            console.error('读取签到设置失败:', error);
        }

        let chickenLegStats = {};
        try {
            if (window.NodeSeekRegister && typeof window.NodeSeekRegister.getChickenLegStats === 'function') {
                chickenLegStats = window.NodeSeekRegister.getChickenLegStats();
            } else {
                const lastFetch = localStorage.getItem('nodeseek_chicken_leg_last_fetch');
                const nextAllow = localStorage.getItem('nodeseek_chicken_leg_next_allow');
                const lastHtml = localStorage.getItem('nodeseek_chicken_leg_last_html');
                const history = localStorage.getItem('nodeseek_chicken_leg_history');
                if (lastFetch || nextAllow || lastHtml || history) {
                    chickenLegStats = {
                        lastFetch: lastFetch,
                        nextAllow: nextAllow,
                        lastHtml: lastHtml,
                        history: history ? JSON.parse(history) : []
                    };
                }
            }
        } catch (error) {
            console.error('读取鸡腿统计数据失败:', error);
        }

        let filterData = {};
        try {
            const customKeywords = localStorage.getItem('ns-filter-custom-keywords');
            const displayKeywords = localStorage.getItem('ns-filter-keywords');
            const highlightKeywords = localStorage.getItem('ns-filter-highlight-keywords');
            const highlightPostKeywords = localStorage.getItem('ns-filter-highlight-post-keywords');
            const highlightAuthorEnabled = localStorage.getItem('ns-filter-highlight-author-enabled');
            const highlightColor = localStorage.getItem('ns-filter-highlight-color');
            const dialogPosition = localStorage.getItem('ns-filter-dialog-position');
            const whitelistUsers = localStorage.getItem('ns-filter-whitelist-users');
            const profileFilterEnabled = localStorage.getItem('ns-filter-profile-filter-enabled');
            const blockLevels = localStorage.getItem('ns-filter-block-levels');
            const maxJoinDays = localStorage.getItem('ns-filter-max-join-days');
            if (customKeywords || displayKeywords || highlightKeywords || highlightPostKeywords || highlightAuthorEnabled || highlightColor || dialogPosition || whitelistUsers || profileFilterEnabled || blockLevels || maxJoinDays !== null) {
                filterData = {
                    customKeywords: customKeywords ? JSON.parse(customKeywords) : [],
                    displayKeywords: displayKeywords ? JSON.parse(displayKeywords) : [],
                    highlightKeywords: highlightKeywords ? JSON.parse(highlightKeywords) : [],
                    highlightPostKeywords: highlightPostKeywords ? JSON.parse(highlightPostKeywords) : [],
                    highlightAuthorEnabled: highlightAuthorEnabled ? JSON.parse(highlightAuthorEnabled) : false,
                    highlightColor: highlightColor || '#facc15',
                    dialogPosition: dialogPosition ? JSON.parse(dialogPosition) : null,
                    whitelistUsers: whitelistUsers ? JSON.parse(whitelistUsers) : [],
                    profileFilterEnabled: profileFilterEnabled ? JSON.parse(profileFilterEnabled) : true,
                    blockLevels: blockLevels ? JSON.parse(blockLevels) : ['0', '1'],
                    maxJoinDays: maxJoinDays === '' ? null : (maxJoinDays ? Number(maxJoinDays) : 30)
                };
            }
        } catch (error) {
            console.error('读取关键词过滤数据失败:', error);
        }

        let notesData = {};
        try {
            if (window.NodeSeekNotes && typeof window.NodeSeekNotes.exportNotesData === 'function') {
                notesData = window.NodeSeekNotes.exportNotesData();
            }
        } catch (error) {
            console.error('读取笔记数据失败:', error);
        }

        const viewedTitles = {};
        try {
            const enabled = localStorage.getItem('nodeseek_viewed_history_enabled');
            const color = localStorage.getItem('nodeseek_viewed_color');
            const data = localStorage.getItem('nodeseek_viewed_titles_data');
            if (enabled !== null) viewedTitles.enabled = enabled === 'true';
            if (color !== null) viewedTitles.color = color;
            if (data !== null) viewedTitles.data = JSON.parse(data);
        } catch (error) {
            console.error('读取阅读记忆数据失败:', error);
        }

        let backupLimit = 3;
        try {
            const limit = localStorage.getItem('nodeseek_backup_limit');
            if (limit) backupLimit = parseInt(limit);
        } catch (error) {
            console.error('读取备份设置失败:', error);
        }

        let skipJumpSettings = {};
        try {
            skipJumpSettings = {
                enabled: getSkipJumpPageEnabled(),
                mode: getSkipJumpMode(),
                list: getSkipJumpList()
            };
        } catch (error) {
            console.error('读取屏蔽URL跳转提醒设置失败:', error);
        }

        let openPostNewTabSettings = {};
        try {
            openPostNewTabSettings.enabled = getOpenPostNewTabEnabled();
        } catch (error) {
            console.error('读取新标签页打开帖子设置失败:', error);
        }

        const data = {
            blacklist: blacklist,
            friends: friends,
            logs: logs,
            browseHistory: browseHistory,
            quickReplies: quickReplies,
            quickReplySettings: quickReplySettings,
            signSettings: signSettings,
            skipJumpSettings: skipJumpSettings,
            openPostNewTabSettings: openPostNewTabSettings,
            chickenLegStats: chickenLegStats,
            filterData: filterData,
            notesData: notesData,
            viewedTitles: viewedTitles,
            backupLimit: backupLimit
        };

        return filterNodeSeekBackupData(data, fields);
    }

    function applyNodeSeekBackupData(json) {
        if (!json || typeof json !== 'object') throw new Error('远端文件格式不正确');

        isWebdavApplyingRemoteData = true;
        try {
            if (json.blacklist) setBlacklist(json.blacklist);
            if (json.friends) setFriends(json.friends);
            if (json.logs && Array.isArray(json.logs)) localStorage.setItem(LOGS_KEY, JSON.stringify(json.logs));
            if (json.browseHistory && Array.isArray(json.browseHistory)) setBrowseHistory(json.browseHistory);
            if (json.quickReplies && typeof json.quickReplies === 'object') {
                if (window.NodeSeekQuickReply && typeof window.NodeSeekQuickReply.setQuickReplies === 'function') {
                    window.NodeSeekQuickReply.setQuickReplies(json.quickReplies);
                } else {
                    localStorage.setItem('nodeseek_quick_reply', JSON.stringify(json.quickReplies));
                }
            }

            if (json.quickReplySettings && typeof json.quickReplySettings === 'object' && typeof json.quickReplySettings.autoSubmit !== 'undefined') {
                localStorage.setItem('nodeseek_quick_reply_auto_submit', json.quickReplySettings.autoSubmit ? 'true' : 'false');
            }

            if (json.signSettings && typeof json.signSettings === 'object') {
                if (typeof json.signSettings.enabled !== 'undefined') localStorage.setItem('nodeseek_sign_enabled', json.signSettings.enabled ? 'true' : 'false');
                if (typeof json.signSettings.mode !== 'undefined') localStorage.setItem('nodeseek_sign_mode', json.signSettings.mode);
            }

            if (json.skipJumpSettings && typeof json.skipJumpSettings === 'object') {
                if (typeof json.skipJumpSettings.enabled !== 'undefined') setSkipJumpPageEnabled(json.skipJumpSettings.enabled);
                if (json.skipJumpSettings.mode) setSkipJumpMode(json.skipJumpSettings.mode === 'whitelist' ? 'whitelist' : 'all');
                if (Array.isArray(json.skipJumpSettings.list)) setSkipJumpList(json.skipJumpSettings.list);
            }

            if (json.openPostNewTabSettings && typeof json.openPostNewTabSettings === 'object' && typeof json.openPostNewTabSettings.enabled !== 'undefined') {
                setOpenPostNewTabEnabled(json.openPostNewTabSettings.enabled);
            }

            if (json.chickenLegStats && typeof json.chickenLegStats === 'object') {
                if (window.NodeSeekRegister && typeof window.NodeSeekRegister.setChickenLegStats === 'function') {
                    window.NodeSeekRegister.setChickenLegStats(json.chickenLegStats);
                } else {
                    if (json.chickenLegStats.lastFetch) localStorage.setItem('nodeseek_chicken_leg_last_fetch', json.chickenLegStats.lastFetch);
                    if (json.chickenLegStats.nextAllow) localStorage.setItem('nodeseek_chicken_leg_next_allow', json.chickenLegStats.nextAllow);
                    if (json.chickenLegStats.lastHtml) localStorage.setItem('nodeseek_chicken_leg_last_html', json.chickenLegStats.lastHtml);
                    if (Array.isArray(json.chickenLegStats.history)) localStorage.setItem('nodeseek_chicken_leg_history', JSON.stringify(json.chickenLegStats.history));
                }
            }

            if (json.filterData && typeof json.filterData === 'object') {
                if (Array.isArray(json.filterData.customKeywords)) localStorage.setItem('ns-filter-custom-keywords', JSON.stringify(json.filterData.customKeywords));
                if (Array.isArray(json.filterData.displayKeywords)) localStorage.setItem('ns-filter-keywords', JSON.stringify(json.filterData.displayKeywords));
                if (Array.isArray(json.filterData.highlightKeywords)) localStorage.setItem('ns-filter-highlight-keywords', JSON.stringify(json.filterData.highlightKeywords));
                if (Array.isArray(json.filterData.highlightPostKeywords)) localStorage.setItem('ns-filter-highlight-post-keywords', JSON.stringify(json.filterData.highlightPostKeywords));
                if (json.filterData.highlightAuthorEnabled !== undefined) localStorage.setItem('ns-filter-highlight-author-enabled', JSON.stringify(json.filterData.highlightAuthorEnabled));
                if (json.filterData.highlightColor) localStorage.setItem('ns-filter-highlight-color', json.filterData.highlightColor);
                if (json.filterData.dialogPosition && typeof json.filterData.dialogPosition === 'object') localStorage.setItem('ns-filter-dialog-position', JSON.stringify(json.filterData.dialogPosition));
                if (Array.isArray(json.filterData.whitelistUsers)) localStorage.setItem('ns-filter-whitelist-users', JSON.stringify(json.filterData.whitelistUsers));
                if (json.filterData.profileFilterEnabled !== undefined) localStorage.setItem('ns-filter-profile-filter-enabled', JSON.stringify(json.filterData.profileFilterEnabled));
                if (Array.isArray(json.filterData.blockLevels)) localStorage.setItem('ns-filter-block-levels', JSON.stringify(json.filterData.blockLevels));
                if (json.filterData.maxJoinDays !== undefined) localStorage.setItem('ns-filter-max-join-days', json.filterData.maxJoinDays === null ? '' : String(json.filterData.maxJoinDays));
            }

            if (json.notesData && typeof json.notesData === 'object') {
                if (window.NodeSeekNotes && typeof window.NodeSeekNotes.importNotesData === 'function') {
                    window.NodeSeekNotes.importNotesData(json.notesData);
                } else {
                    if (json.notesData.categories) localStorage.setItem('nodeseek_notes_categories', JSON.stringify(json.notesData.categories));
                    if (json.notesData.notes) localStorage.setItem('nodeseek_notes_data', JSON.stringify(json.notesData.notes));
                    if (json.notesData.fontColors) localStorage.setItem('nodeseek_notes_font_colors', JSON.stringify(json.notesData.fontColors));
                    if (json.notesData.bgColors) localStorage.setItem('nodeseek_notes_bg_colors', JSON.stringify(json.notesData.bgColors));
                    if (json.notesData.lastSelectedNote) localStorage.setItem('nodeseek_notes_last_selected', JSON.stringify(json.notesData.lastSelectedNote));
                    if (json.notesData.trash) localStorage.setItem('nodeseek_notes_trash', JSON.stringify(json.notesData.trash));
                }
            }

            if (json.viewedTitles && typeof json.viewedTitles === 'object') {
                if (typeof json.viewedTitles.enabled !== 'undefined') localStorage.setItem('nodeseek_viewed_history_enabled', json.viewedTitles.enabled ? 'true' : 'false');
                if (json.viewedTitles.color) localStorage.setItem('nodeseek_viewed_color', json.viewedTitles.color);
                if (Array.isArray(json.viewedTitles.data)) localStorage.setItem('nodeseek_viewed_titles_data', JSON.stringify(json.viewedTitles.data));
                if (window.NodeSeekViewedTitles && typeof window.NodeSeekViewedTitles.refresh === 'function') window.NodeSeekViewedTitles.refresh();
            }

            if (json.backupLimit) localStorage.setItem('nodeseek_backup_limit', json.backupLimit.toString());
        } finally {
            isWebdavApplyingRemoteData = false;
        }
    }

    function getWebdavStoredPassword(fallbackPassword) {
        try {
            if (typeof GM_getValue === 'function') {
                const value = GM_getValue(WEBDAV_SYNC_PASSWORD_KEY, '');
                if (value != null && String(value)) return String(value);
            }
        } catch (e) { }
        if (fallbackPassword) return String(fallbackPassword);
        return '';
    }

    function setWebdavStoredPassword(password) {
        try {
            if (typeof GM_setValue === 'function' && password) GM_setValue(WEBDAV_SYNC_PASSWORD_KEY, password);
            if (typeof GM_deleteValue === 'function' && !password) GM_deleteValue(WEBDAV_SYNC_PASSWORD_KEY);
        } catch (e) { }
    }

    function migrateWebdavPasswordFromLocalStorage(saved) {
        if (!saved || typeof saved !== 'object' || !Object.prototype.hasOwnProperty.call(saved, 'password')) return saved;
        const password = saved.password || '';
        setWebdavStoredPassword(password);
        delete saved.password;
        try {
            localStorage.setItem(WEBDAV_SYNC_CONFIG_KEY, JSON.stringify(saved));
        } catch (e) { }
        return saved;
    }

    function getWebdavSyncConfig() {
        try {
            const savedRaw = JSON.parse(localStorage.getItem(WEBDAV_SYNC_CONFIG_KEY) || '{}');
            const legacyPassword = savedRaw.password || '';
            const saved = migrateWebdavPasswordFromLocalStorage(savedRaw);
            return {
                enabled: saved.enabled === true,
                baseUrl: saved.baseUrl || '',
                username: saved.username || '',
                password: getWebdavStoredPassword(legacyPassword),
                intervalMinutes: Math.max(1, parseInt(saved.intervalMinutes || '30', 10) || 30),
                syncFields: normalizeWebdavSyncFields(saved.syncFields)
            };
        } catch (error) {
            return { enabled: false, baseUrl: '', username: '', password: getWebdavStoredPassword(''), intervalMinutes: 30, syncFields: getDefaultWebdavSyncFields() };
        }
    }

    function setWebdavSyncConfig(config) {
        const safe = {
            enabled: config.enabled === true,
            baseUrl: (config.baseUrl || '').trim(),
            username: (config.username || '').trim(),
            intervalMinutes: Math.max(1, parseInt(config.intervalMinutes || '30', 10) || 30),
            syncFields: normalizeWebdavSyncFields(config.syncFields)
        };
        setWebdavStoredPassword(config.password || '');
        localStorage.setItem(WEBDAV_SYNC_CONFIG_KEY, JSON.stringify(safe));
        restartWebdavSyncTimer();
    }

    function buildWebdavFileUrl(config) {
        const base = (config.baseUrl || '').trim().replace(/\/+$/, '');
        return base + '/' + WEBDAV_SYNC_FILE_NAME;
    }

    function getWebdavAuthHeader(config) {
        return 'Basic ' + btoa(unescape(encodeURIComponent(config.username + ':' + config.password)));
    }

    function gmRequestText(method, url, headers) {
        return new Promise((resolve, reject) => {
            if (typeof GM_xmlhttpRequest !== 'function') {
                reject(new Error('当前脚本管理器不支持网络请求'));
                return;
            }
            GM_xmlhttpRequest({
                method: method,
                url: url,
                headers: headers || {},
                timeout: 30000,
                responseType: 'text',
                onload: response => resolve(response),
                onerror: response => reject(new Error('网络请求失败：' + (response && response.status ? response.status : ''))),
                ontimeout: () => reject(new Error('网络请求超时'))
            });
        });
    }

    function describeWebdavRequestError(method, url, response) {
        const details = [];
        details.push(method + ' ' + url);
        if (response) {
            if (response.status) details.push('状态码 ' + response.status);
            if (response.statusText) details.push(response.statusText);
            if (response.error) details.push(String(response.error));
        }
        details.push('请检查 WebDAV 地址、证书、反向代理、账号密码和 Tampermonkey 跨域授权。');
        return details.join('；');
    }

    function requestWebdav(method, url, config, data) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: method,
                url: url,
                data: data,
                headers: {
                    'Authorization': getWebdavAuthHeader(config),
                    'Content-Type': 'application/json; charset=utf-8'
                },
                timeout: 30000,
                anonymous: false,
                responseType: 'text',
                onload: function (response) {
                    resolve(response);
                },
                onerror: function (response) {
                    reject(new Error('网络请求失败：' + describeWebdavRequestError(method, url, response)));
                },
                ontimeout: function () {
                    reject(new Error('网络请求超时：' + describeWebdavRequestError(method, url)));
                }
            });
        });
    }

    async function readWebdavBackup(config) {
        const response = await requestWebdav('GET', buildWebdavFileUrl(config), config);
        if (response.status === 404) return null;
        if (response.status < 200 || response.status >= 300) throw new Error('远端读取失败，状态码 ' + response.status);
        if (!response.responseText) return null;
        try {
            const data = JSON.parse(response.responseText);
            if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid');
            return data;
        } catch (error) {
            throw new Error('远端文件不是有效备份文件');
        }
    }

    async function uploadWebdavBackup(config, updatedAt, remoteData) {
        const selectedData = buildNodeSeekBackupData(config.syncFields);
        const data = (remoteData && typeof remoteData === 'object' && !Array.isArray(remoteData)) ? Object.assign({}, remoteData, selectedData) : selectedData;
        data.syncMeta = {
            updatedAt: updatedAt,
            syncedAt: Date.now(),
            fileName: WEBDAV_SYNC_FILE_NAME,
            scriptVersion: (typeof GM_info !== 'undefined' && GM_info.script) ? GM_info.script.version : '',
            syncFields: normalizeWebdavSyncFields(config.syncFields),
            deviceId: getWebdavDeviceId(),
            deviceName: getWebdavDeviceName()
        };
        const response = await requestWebdav('PUT', buildWebdavFileUrl(config), config, JSON.stringify(data, null, 2));
        if (response.status < 200 || response.status >= 300) throw new Error('远端写入失败，状态码 ' + response.status);
    }

    function ensureWebdavLocalChangedAt() {
        let value = parseInt(localStorage.getItem(WEBDAV_SYNC_LOCAL_CHANGED_AT_KEY) || '0', 10);
        if (!value) {
            value = Date.now();
            localStorage.setItem(WEBDAV_SYNC_LOCAL_CHANGED_AT_KEY, String(value));
        }
        return value;
    }

    function getBackupUpdatedAt(data) {
        return parseInt(data && data.syncMeta && data.syncMeta.updatedAt ? data.syncMeta.updatedAt : '0', 10) || 0;
    }

    function getWebdavLastRemoteUpdatedAt() {
        return parseInt(localStorage.getItem(WEBDAV_SYNC_LAST_REMOTE_UPDATED_AT_KEY) || '0', 10) || 0;
    }

    function setWebdavLastRemoteUpdatedAt(value) {
        localStorage.setItem(WEBDAV_SYNC_LAST_REMOTE_UPDATED_AT_KEY, String(value || 0));
    }

    function getWebdavDeviceId() {
        let deviceId = localStorage.getItem(WEBDAV_SYNC_DEVICE_ID_KEY);
        if (!deviceId) {
            deviceId = 'device-' + Date.now() + '-' + Math.random().toString(36).slice(2);
            localStorage.setItem(WEBDAV_SYNC_DEVICE_ID_KEY, deviceId);
        }
        return deviceId;
    }

    function getWebdavDeviceName() {
        const platform = navigator.platform || '';
        const language = navigator.language || '';
        return [platform, language].filter(Boolean).join(' / ') || 'unknown';
    }

    function addWebdavSyncLog(message) {
        isWebdavApplyingRemoteData = true;
        try {
            addLog(message);
        } finally {
            isWebdavApplyingRemoteData = false;
        }
    }

    function tryAcquireWebdavSyncLock() {
        const now = Date.now();
        try {
            const saved = JSON.parse(localStorage.getItem(WEBDAV_SYNC_LOCK_KEY) || 'null');
            if (saved && saved.owner && saved.owner !== webdavPageId && saved.expiresAt && saved.expiresAt > now) {
                return false;
            }
        } catch (e) { }

        const lock = { owner: webdavPageId, expiresAt: now + WEBDAV_SYNC_LOCK_TTL_MS };
        localStorage.setItem(WEBDAV_SYNC_LOCK_KEY, JSON.stringify(lock));

        try {
            const current = JSON.parse(localStorage.getItem(WEBDAV_SYNC_LOCK_KEY) || 'null');
            return current && current.owner === webdavPageId;
        } catch (e) {
            return true;
        }
    }

    function releaseWebdavSyncLock() {
        try {
            const saved = JSON.parse(localStorage.getItem(WEBDAV_SYNC_LOCK_KEY) || 'null');
            if (!saved || saved.owner === webdavPageId) localStorage.removeItem(WEBDAV_SYNC_LOCK_KEY);
        } catch (e) {
            localStorage.removeItem(WEBDAV_SYNC_LOCK_KEY);
        }
    }

    function hasWebdavConflict(localUpdatedAt, remoteUpdatedAt) {
        const lastRemoteUpdatedAt = getWebdavLastRemoteUpdatedAt();
        return lastRemoteUpdatedAt > 0
            && localUpdatedAt > lastRemoteUpdatedAt
            && remoteUpdatedAt > lastRemoteUpdatedAt
            && localUpdatedAt !== remoteUpdatedAt;
    }

    function chooseWebdavConflictAction(trigger, localUpdatedAt, remoteUpdatedAt) {
        if (trigger !== 'manual') return 'skip';
        const message = [
            '发现本地和远端都已修改。',
            '本地时间：' + formatWebdavSyncTime(localUpdatedAt),
            '远端时间：' + formatWebdavSyncTime(remoteUpdatedAt),
            '输入 1 使用本地并上传。',
            '输入 2 使用远端并刷新。',
            '其他内容取消同步。'
        ].join('\n');
        const choice = window.prompt(message, '');
        if (choice === '1') return 'local';
        if (choice === '2') return 'remote';
        return 'cancel';
    }

    function filterRemoteWebdavBackupData(data, fields) {
        const filtered = filterNodeSeekBackupData(data || {}, fields);
        if (data && data.syncMeta) filtered.syncMeta = data.syncMeta;
        return filtered;
    }

    function validateWebdavConfig(config) {
        if (typeof GM_xmlhttpRequest !== 'function') {
            throw new Error('当前脚本管理器不支持 GM_xmlhttpRequest，无法同步 WebDAV');
        }
        if (!config.baseUrl || !config.username || !config.password) {
            throw new Error('请先填写 WebDAV 地址、账号和密码');
        }
        if (!/^https:\/\//i.test(config.baseUrl)) {
            throw new Error('WebDAV 地址需要以 https:// 开头');
        }
        if (normalizeWebdavSyncFields(config.syncFields).length === 0) {
            throw new Error('请至少选择一个同步字段');
        }
    }

    let isWebdavSyncRunning = false;
    async function syncWithWebdav(trigger) {
        if (isWebdavSyncRunning) {
            if (trigger === 'manual') alert('同步正在进行');
            return;
        }

        const config = getWebdavSyncConfig();
        try {
            validateWebdavConfig(config);
        } catch (error) {
            if (trigger === 'manual') alert(error.message);
            return;
        }

        if (!tryAcquireWebdavSyncLock()) {
            if (trigger === 'manual') alert('其他页面正在同步');
            return;
        }

        isWebdavSyncRunning = true;
        try {
            let localUpdatedAt = parseInt(localStorage.getItem(WEBDAV_SYNC_LOCAL_CHANGED_AT_KEY) || '0', 10) || 0;
            const remoteData = await readWebdavBackup(config);

            if (!remoteData) {
                if (!localUpdatedAt) localUpdatedAt = ensureWebdavLocalChangedAt();
                await uploadWebdavBackup(config, localUpdatedAt);
                localStorage.setItem(WEBDAV_SYNC_LAST_SYNC_AT_KEY, String(Date.now()));
                setWebdavLastRemoteUpdatedAt(localUpdatedAt);
                addWebdavSyncLog('WebDAV同步：远端无文件，已上传本地数据');
                if (trigger === 'manual') alert('同步完成：已上传本地数据');
                return;
            }

            const remoteUpdatedAt = getBackupUpdatedAt(remoteData);
            if (hasWebdavConflict(localUpdatedAt, remoteUpdatedAt)) {
                const action = chooseWebdavConflictAction(trigger, localUpdatedAt, remoteUpdatedAt);
                if (action === 'local') {
                    await uploadWebdavBackup(config, localUpdatedAt, remoteData);
                    localStorage.setItem(WEBDAV_SYNC_LAST_SYNC_AT_KEY, String(Date.now()));
                    setWebdavLastRemoteUpdatedAt(localUpdatedAt);
                    addWebdavSyncLog('WebDAV同步：冲突处理，已上传本地数据');
                    if (trigger === 'manual') alert('同步完成：已上传本地数据');
                    return;
                }
                if (action === 'remote') {
                    applyNodeSeekBackupData(filterRemoteWebdavBackupData(remoteData, config.syncFields));
                    localStorage.setItem(WEBDAV_SYNC_LOCAL_CHANGED_AT_KEY, String(remoteUpdatedAt));
                    localStorage.setItem(WEBDAV_SYNC_LAST_SYNC_AT_KEY, String(Date.now()));
                    setWebdavLastRemoteUpdatedAt(remoteUpdatedAt);
                    addWebdavSyncLog('WebDAV同步：冲突处理，已使用远端数据');
                    if (trigger === 'manual') alert('同步完成：已使用远端数据，页面将刷新');
                    setTimeout(() => location.reload(), 500);
                    return;
                }
                addWebdavSyncLog('WebDAV同步：发现本地和远端均已修改，已取消同步');
                if (trigger === 'manual') alert('同步已取消');
                return;
            }

            if (!localUpdatedAt && remoteUpdatedAt) {
                applyNodeSeekBackupData(filterRemoteWebdavBackupData(remoteData, config.syncFields));
                localStorage.setItem(WEBDAV_SYNC_LOCAL_CHANGED_AT_KEY, String(remoteUpdatedAt));
                localStorage.setItem(WEBDAV_SYNC_LAST_SYNC_AT_KEY, String(Date.now()));
                setWebdavLastRemoteUpdatedAt(remoteUpdatedAt);
                addWebdavSyncLog('WebDAV同步：已使用远端数据');
                if (trigger === 'manual') alert('同步完成：已使用远端数据，页面将刷新');
                setTimeout(() => location.reload(), 500);
                return;
            }

            if (!localUpdatedAt) localUpdatedAt = ensureWebdavLocalChangedAt();
            if (remoteUpdatedAt > localUpdatedAt) {
                applyNodeSeekBackupData(filterRemoteWebdavBackupData(remoteData, config.syncFields));
                localStorage.setItem(WEBDAV_SYNC_LOCAL_CHANGED_AT_KEY, String(remoteUpdatedAt));
                localStorage.setItem(WEBDAV_SYNC_LAST_SYNC_AT_KEY, String(Date.now()));
                setWebdavLastRemoteUpdatedAt(remoteUpdatedAt);
                addWebdavSyncLog('WebDAV同步：已使用远端最新数据');
                if (trigger === 'manual') alert('同步完成：已使用远端最新数据，页面将刷新');
                setTimeout(() => location.reload(), 500);
                return;
            }

            if (localUpdatedAt > remoteUpdatedAt) {
                await uploadWebdavBackup(config, localUpdatedAt, remoteData);
                localStorage.setItem(WEBDAV_SYNC_LAST_SYNC_AT_KEY, String(Date.now()));
                setWebdavLastRemoteUpdatedAt(localUpdatedAt);
                addWebdavSyncLog('WebDAV同步：已上传本地最新数据');
                if (trigger === 'manual') alert('同步完成：已上传本地最新数据');
                return;
            }

            localStorage.setItem(WEBDAV_SYNC_LAST_SYNC_AT_KEY, String(Date.now()));
            setWebdavLastRemoteUpdatedAt(remoteUpdatedAt);
            addWebdavSyncLog('WebDAV同步：两端数据一致');
            if (trigger === 'manual') alert('同步完成：两端数据一致');
        } catch (error) {
            console.error('WebDAV同步失败:', error);
            addWebdavSyncLog('WebDAV同步失败：' + error.message);
            if (trigger === 'manual') alert('同步失败：' + error.message);
        } finally {
            isWebdavSyncRunning = false;
            releaseWebdavSyncLock();
        }
    }

    function restartWebdavSyncTimer() {
        if (webdavSyncTimer) {
            clearInterval(webdavSyncTimer);
            webdavSyncTimer = null;
        }
        if (webdavChangeSyncTimer) {
            clearTimeout(webdavChangeSyncTimer);
            webdavChangeSyncTimer = null;
        }
        const config = getWebdavSyncConfig();
        if (!config.enabled) return;
        const intervalMs = Math.max(1, config.intervalMinutes) * 60 * 1000;
        webdavSyncTimer = setInterval(() => syncWithWebdav('timer'), intervalMs);
    }

    function scheduleWebdavChangeSync() {
        const config = getWebdavSyncConfig();
        if (!config.enabled) return;
        if (webdavChangeSyncTimer) clearTimeout(webdavChangeSyncTimer);
        webdavChangeSyncTimer = setTimeout(() => {
            webdavChangeSyncTimer = null;
            syncWithWebdav('change');
        }, WEBDAV_SYNC_DEBOUNCE_MS);
    }

    function formatWebdavSyncTime(value) {
        const time = parseInt(value || '0', 10);
        return time ? new Date(time).toLocaleString() : '暂无';
    }

    function showWebdavSyncDialog() {
        const existing = document.getElementById('webdav-sync-dialog');
        if (existing) {
            existing.remove();
            return;
        }

        const config = getWebdavSyncConfig();
        const dialog = document.createElement('div');
        dialog.id = 'webdav-sync-dialog';
        dialog.style.position = 'fixed';
        dialog.style.top = '80px';
        dialog.style.right = '16px';
        dialog.style.zIndex = '10001';
        dialog.style.background = '#fff';
        dialog.style.border = '1px solid #ccc';
        dialog.style.borderRadius = '8px';
        dialog.style.boxShadow = '0 2px 12px rgba(0,0,0,0.15)';
        dialog.style.padding = '12px';
        dialog.style.width = '340px';
        dialog.style.boxSizing = 'border-box';
        dialog.style.maxHeight = '82vh';
        dialog.style.overflow = 'hidden';

        const isMobile = (window.NodeSeekFilter && typeof window.NodeSeekFilter.isMobileDevice === 'function')
            ? window.NodeSeekFilter.isMobileDevice()
            : (window.innerWidth <= 767);
        if (isMobile) {
            dialog.style.width = '90%';
            dialog.style.left = '50%';
            dialog.style.top = '10px';
            dialog.style.right = 'auto';
            dialog.style.transform = 'translateX(-50%)';
            dialog.style.maxHeight = 'calc(100vh - 20px)';
        }

        const header = document.createElement('div');
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.style.marginBottom = '8px';

        const title = document.createElement('div');
        title.textContent = 'WebDAV同步';
        title.style.fontWeight = 'bold';
        title.style.fontSize = '14px';

        const closeBtn = document.createElement('span');
        closeBtn.textContent = '×';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '24px';
        closeBtn.onclick = function () { dialog.remove(); };

        header.appendChild(title);
        header.appendChild(closeBtn);
        dialog.appendChild(header);

        const form = document.createElement('div');
        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '8px';
        form.style.maxHeight = window.innerWidth <= 767 ? 'calc(100vh - 78px)' : 'calc(82vh - 58px)';
        form.style.overflowY = 'auto';
        form.style.paddingRight = '2px';

        function createField(labelText, input) {
            const row = document.createElement('label');
            row.style.display = 'flex';
            row.style.flexDirection = 'column';
            row.style.gap = '4px';
            row.style.fontSize = '12px';
            row.style.color = '#555';
            const label = document.createElement('span');
            label.textContent = labelText;
            input.style.padding = '5px 8px';
            input.style.border = '1px solid #ddd';
            input.style.borderRadius = '4px';
            input.style.boxSizing = 'border-box';
            input.style.width = '100%';
            row.appendChild(label);
            row.appendChild(input);
            return row;
        }

        const baseUrlInput = document.createElement('input');
        baseUrlInput.type = 'text';
        baseUrlInput.placeholder = 'https://域名:5006/webdav/目录';
        baseUrlInput.value = config.baseUrl;

        const usernameInput = document.createElement('input');
        usernameInput.type = 'text';
        usernameInput.value = config.username;

        const passwordInput = document.createElement('input');
        passwordInput.type = 'password';
        passwordInput.value = config.password;

        const intervalInput = document.createElement('input');
        intervalInput.type = 'number';
        intervalInput.min = '1';
        intervalInput.step = '1';
        intervalInput.value = String(config.intervalMinutes);

        const enabledRow = document.createElement('label');
        enabledRow.style.display = 'flex';
        enabledRow.style.justifyContent = 'space-between';
        enabledRow.style.alignItems = 'center';
        enabledRow.style.fontSize = '13px';
        enabledRow.style.color = '#555';
        const enabledLabel = document.createElement('span');
        enabledLabel.textContent = '定时同步';
        const enabledSwitch = document.createElement('input');
        enabledSwitch.type = 'checkbox';
        enabledSwitch.checked = config.enabled;
        enabledSwitch.style.transform = 'scale(1.15)';
        enabledRow.appendChild(enabledLabel);
        enabledRow.appendChild(enabledSwitch);

        const syncFieldsBox = document.createElement('div');
        syncFieldsBox.style.border = '1px solid #ddd';
        syncFieldsBox.style.borderRadius = '4px';
        syncFieldsBox.style.padding = '7px';
        syncFieldsBox.style.maxHeight = '110px';
        syncFieldsBox.style.overflowY = 'auto';
        const syncFieldsTitle = document.createElement('div');
        syncFieldsTitle.textContent = '同步字段';
        syncFieldsTitle.style.fontSize = '12px';
        syncFieldsTitle.style.color = '#555';
        syncFieldsTitle.style.marginBottom = '6px';
        syncFieldsBox.appendChild(syncFieldsTitle);
        const syncFieldInputs = {};
        const selectedFields = new Set(normalizeWebdavSyncFields(config.syncFields));
        WEBDAV_SYNC_FIELD_OPTIONS.forEach(item => {
            const row = document.createElement('label');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '6px';
            row.style.fontSize = '12px';
            row.style.color = '#555';
            row.style.marginBottom = '2px';
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = selectedFields.has(item.key);
            syncFieldInputs[item.key] = checkbox;
            const text = document.createElement('span');
            text.textContent = item.label;
            row.appendChild(checkbox);
            row.appendChild(text);
            syncFieldsBox.appendChild(row);
        });

        const status = document.createElement('div');
        status.style.fontSize = '12px';
        status.style.color = '#666';
        status.style.lineHeight = '1.35';
        status.style.wordBreak = 'break-all';
        status.textContent = '上次同步：' + formatWebdavSyncTime(localStorage.getItem(WEBDAV_SYNC_LAST_SYNC_AT_KEY));

        const buttonRow = document.createElement('div');
        buttonRow.style.display = 'flex';
        buttonRow.style.gap = '8px';

        const testBtn = document.createElement('button');
        testBtn.textContent = '测试';
        testBtn.className = 'blacklist-btn';
        testBtn.style.flex = '1';
        testBtn.style.background = '#64748b';

        const saveBtn = document.createElement('button');
        saveBtn.textContent = '保存';
        saveBtn.className = 'blacklist-btn';
        saveBtn.style.flex = '1';
        saveBtn.style.background = '#2ea44f';

        const syncBtn = document.createElement('button');
        syncBtn.textContent = '立即同步';
        syncBtn.className = 'blacklist-btn';
        syncBtn.style.flex = '1';
        syncBtn.style.background = '#1890ff';

        buttonRow.appendChild(testBtn);
        buttonRow.appendChild(saveBtn);
        buttonRow.appendChild(syncBtn);

        form.appendChild(createField('WebDAV地址', baseUrlInput));
        form.appendChild(createField('账号', usernameInput));
        form.appendChild(createField('密码', passwordInput));
        form.appendChild(createField('间隔分钟', intervalInput));
        form.appendChild(enabledRow);
        form.appendChild(syncFieldsBox);
        form.appendChild(status);
        form.appendChild(buttonRow);
        dialog.appendChild(form);

        function readFormConfig() {
            return {
                enabled: enabledSwitch.checked,
                baseUrl: baseUrlInput.value,
                username: usernameInput.value,
                password: passwordInput.value,
                intervalMinutes: intervalInput.value,
                syncFields: Object.keys(syncFieldInputs).filter(key => syncFieldInputs[key].checked)
            };
        }

        saveBtn.onclick = function () {
            const nextConfig = readFormConfig();
            if (normalizeWebdavSyncFields(nextConfig.syncFields).length === 0) {
                alert('请至少选择一个同步字段');
                return;
            }
            setWebdavSyncConfig(nextConfig);
            addLog('WebDAV同步设置：已保存');
            status.textContent = '上次同步：' + formatWebdavSyncTime(localStorage.getItem(WEBDAV_SYNC_LAST_SYNC_AT_KEY));
            alert('WebDAV同步设置已保存');
        };

        testBtn.onclick = function () {
            const nextConfig = readFormConfig();
            try {
                validateWebdavConfig(nextConfig);
            } catch (error) {
                alert(error.message);
                return;
            }
            setWebdavSyncConfig(nextConfig);
            status.textContent = '正在测试：' + buildWebdavFileUrl(nextConfig);
            readWebdavBackup(nextConfig).then(() => {
                status.textContent = '测试通过：可以访问远端文件';
                alert('测试通过：WebDAV 地址可以访问');
            }).catch(error => {
                status.textContent = '测试失败：' + error.message;
                alert('测试失败：' + error.message);
            });
        };

        syncBtn.onclick = function () {
            const nextConfig = readFormConfig();
            if (normalizeWebdavSyncFields(nextConfig.syncFields).length === 0) {
                alert('请至少选择一个同步字段');
                return;
            }
            setWebdavSyncConfig(nextConfig);
            syncWithWebdav('manual').then(() => {
                status.textContent = '上次同步：' + formatWebdavSyncTime(localStorage.getItem(WEBDAV_SYNC_LAST_SYNC_AT_KEY));
            });
        };

        document.body.appendChild(dialog);
    }

    window.NodeSeekWebdavSync = {
        open: showWebdavSyncDialog,
        sync: () => syncWithWebdav('manual'),
        getConfig: getWebdavSyncConfig
    };

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
            '#nodeseek-plugin-main-container, #settings-dialog, #webdav-sync-dialog, #blacklist-dialog, #ns-filter-dialog, #quick-reply-dialog, #logs-dialog, #friends-dialog, #nodeimage-dialog, .ns-modal, .ns-dialog'
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
            },
            updateHighlightCount: function () {
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
                mainContainer.classList.toggle('ns-collapsed-move-locked', getCollapsedMoveLockState());
                requestAnimationFrame(function () {
                    const saved = getCollapsedPosition();
                    const rect = mainContainer.getBoundingClientRect();
                    const fallbackLeft = Math.max(0, window.innerWidth - rect.width);
                    const fallbackTop = window.innerWidth <= 767
                        ? Math.max(0, window.innerHeight - rect.height - 88)
                        : Math.max(0, Math.round((window.innerHeight - rect.height) * 0.4));
                    setCollapsedPanelPosition(saved || { left: fallbackLeft, top: fallbackTop }, false);
                });
            } else {
                mainContainer.style.flexDirection = 'row';
                mainContainer.style.alignItems = '';
                mainContainer.classList.remove('ns-collapsed-move-locked');
                collapsedRail.style.display = 'none';
                collapsedHighlightBtn.style.display = 'none';
                mainContainer.style.removeProperty('left');
                mainContainer.style.removeProperty('right');
                mainContainer.style.removeProperty('top');
                mainContainer.style.removeProperty('bottom');
                mainContainer.style.top = expandedPosition.top;
                mainContainer.style.right = expandedPosition.right;
                mainContainer.style.bottom = expandedPosition.bottom;
            }
        }

        function setCollapsedPanelPosition(position, save) {
            const rect = mainContainer.getBoundingClientRect();
            const maxLeft = Math.max(0, window.innerWidth - rect.width);
            const maxTop = Math.max(0, window.innerHeight - rect.height);
            let left = Math.min(maxLeft, Math.max(0, position.left));
            let top = Math.min(maxTop, Math.max(0, position.top));
            const snap = 24;
            if (left <= snap) left = 0;
            if (maxLeft - left <= snap) left = maxLeft;
            if (top <= snap) top = 0;
            if (maxTop - top <= snap) top = maxTop;
            mainContainer.style.setProperty('left', left + 'px', 'important');
            mainContainer.style.setProperty('top', top + 'px', 'important');
            mainContainer.style.setProperty('right', 'auto', 'important');
            mainContainer.style.setProperty('bottom', 'auto', 'important');
            if (save) setCollapsedPosition({ left, top });
        }

        let collapsedDragState = null;

        function isCollapsedPanelDraggableTarget(target) {
            if (!mainContainer.classList.contains('nodeseek-plugin-main-collapsed')) return false;
            if (getCollapsedMoveLockState()) return false;
            if (target.closest && target.closest('.ns-collapsed-action-btn, #ns-collapsed-highlight-count')) return false;
            return true;
        }

        function startCollapsedPanelDrag(event) {
            if (!isCollapsedPanelDraggableTarget(event.target)) return;
            const point = event.touches ? event.touches[0] : event;
            if (!point) return;
            const rect = mainContainer.getBoundingClientRect();
            collapsedDragState = {
                startX: point.clientX,
                startY: point.clientY,
                left: rect.left,
                top: rect.top,
                moved: false
            };
            document.addEventListener('mousemove', moveCollapsedPanelDrag);
            document.addEventListener('mouseup', endCollapsedPanelDrag);
            document.addEventListener('touchmove', moveCollapsedPanelDrag, { passive: false });
            document.addEventListener('touchend', endCollapsedPanelDrag);
        }

        function moveCollapsedPanelDrag(event) {
            if (!collapsedDragState) return;
            const point = event.touches ? event.touches[0] : event;
            if (!point) return;
            const dx = point.clientX - collapsedDragState.startX;
            const dy = point.clientY - collapsedDragState.startY;
            if (Math.abs(dx) + Math.abs(dy) > 4) collapsedDragState.moved = true;
            if (event.cancelable) event.preventDefault();
            setCollapsedPanelPosition({
                left: collapsedDragState.left + dx,
                top: collapsedDragState.top + dy
            }, false);
        }

        function endCollapsedPanelDrag() {
            if (collapsedDragState) {
                const rect = mainContainer.getBoundingClientRect();
                setCollapsedPanelPosition({ left: rect.left, top: rect.top }, true);
            }
            document.removeEventListener('mousemove', moveCollapsedPanelDrag);
            document.removeEventListener('mouseup', endCollapsedPanelDrag);
            document.removeEventListener('touchmove', moveCollapsedPanelDrag);
            document.removeEventListener('touchend', endCollapsedPanelDrag);
            setTimeout(function () { collapsedDragState = null; }, 0);
        }

        mainContainer.addEventListener('mousedown', startCollapsedPanelDrag);
        mainContainer.addEventListener('touchstart', startCollapsedPanelDrag, { passive: true });
        document.addEventListener('nodeseek-collapsed-lock-change', function () {
            mainContainer.classList.toggle('ns-collapsed-move-locked', getCollapsedMoveLockState());
        });
        window.addEventListener('resize', function () {
            if (!mainContainer.classList.contains('nodeseek-plugin-main-collapsed')) return;
            const rect = mainContainer.getBoundingClientRect();
            setCollapsedPanelPosition({ left: rect.left, top: rect.top }, true);
        });

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
            if (collapsedDragState && collapsedDragState.moved) return;
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

    if (!window.NodeSeekFilter) {
        window.NodeSeekFilter = (function () {
            let observer = null;
            let applyTimer = null;
            let lastStats = { hidden: 0, highlighted: 0 };
            let profileFilterSignature = '';
            let selectedFilterMode = '';
            const profileFilterState = new WeakMap();

            const TOKEN_COLORS = ['#22c55e', '#14b8a6', '#38bdf8', '#8b5cf6', '#f97316', '#ec4899', '#64748b'];
            const PLUGIN_SELECTOR = '#nodeseek-plugin-main-container, #settings-dialog, #webdav-sync-dialog, #blacklist-dialog, #ns-filter-dialog, #quick-reply-dialog, #logs-dialog, #friends-dialog';
            const LEVEL_OPTIONS = ['0', '1', '2', '3', '4', '5', '6'];
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

            function readNumber(key, fallback) {
                const raw = localStorage.getItem(key);
                if (raw === null) return fallback;
                if (raw === '') return null;
                const value = Number(raw);
                return Number.isFinite(value) && value >= 0 ? value : fallback;
            }

            function readWordsWithDefault(key, fallback) {
                if (localStorage.getItem(key) === null) return fallback;
                return readWords(key);
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
                    whitelistUsers: readWords('ns-filter-whitelist-users'),
                    profileFilterEnabled: readBool('ns-filter-profile-filter-enabled', true),
                    blockLevels: uniqueWords(readWordsWithDefault('ns-filter-block-levels', ['0', '1']))
                        .filter(level => LEVEL_OPTIONS.includes(level)),
                    maxJoinDays: readNumber('ns-filter-max-join-days', 30)
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
                writeJson('ns-filter-profile-filter-enabled', !!settings.profileFilterEnabled);
                writeJson('ns-filter-block-levels', uniqueWords(settings.blockLevels || []).filter(level => LEVEL_OPTIONS.includes(level)));
                if (Number.isFinite(settings.maxJoinDays) && settings.maxJoinDays >= 0) {
                    localStorage.setItem('ns-filter-max-join-days', String(Math.floor(settings.maxJoinDays)));
                } else {
                    localStorage.setItem('ns-filter-max-join-days', '');
                }
            }

            function prepareWords(words) {
                return uniqueWords(words || []).map(word => String(word).toLowerCase());
            }

            function textHasPrepared(text, preparedWords) {
                if (!preparedWords || preparedWords.length === 0) return false;
                const source = String(text || '').toLowerCase();
                return preparedWords.some(word => source.includes(word));
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

            function getPostListCandidates() {
                return Array.from(document.querySelectorAll('li.post-list-item, .post-list-item'))
                    .filter(node => node instanceof HTMLElement && !isPluginNode(node));
            }

            function getAuthorLinkFromPost(node) {
                return node.querySelector?.('.info-author a[href^="/space/"], a.author-name[href*="/space/"], a[href^="/space/"]') || null;
            }

            function getUserIdFromLink(link) {
                if (!link || !link.href) return '';
                const match = link.href.match(/\/space\/(\d+)/) || link.href.match(/[?&]to=(\d+)/) || link.href.match(/\/user\/(\d+)/);
                return match ? match[1] : '';
            }

            function getJoinDaysFromCreatedAt(value) {
                if (!value) return null;
                let joinDate = null;
                if (typeof value === 'number') {
                    joinDate = new Date(value < 10000000000 ? value * 1000 : value);
                } else {
                    const text = String(value).trim();
                    if (/^\d+$/.test(text)) {
                        const num = parseInt(text, 10);
                        joinDate = new Date(num < 10000000000 ? num * 1000 : num);
                    } else {
                        joinDate = new Date(text.replace(' ', 'T'));
                    }
                }
                if (!joinDate || Number.isNaN(joinDate.getTime())) return null;
                return Math.max(0, Math.floor((Date.now() - joinDate.getTime()) / 86400000));
            }

            function isProfileMatched(userData, settings) {
                if (!userData) return false;
                const rank = String(parseInt(userData.rank, 10));
                const joinDays = getJoinDaysFromCreatedAt(userData.created_at || userData.created_at_str);
                const levelMatched = rank !== 'NaN' && (settings.blockLevels || []).includes(rank);
                const daysMatched = Number.isFinite(settings.maxJoinDays) && joinDays !== null && joinDays <= settings.maxJoinDays;
                return levelMatched || daysMatched;
            }

            function hideMatchedNode(node) {
                if (!node.hasAttribute('data-ns-filter-old-display')) {
                    node.setAttribute('data-ns-filter-old-display', node.style.display || '');
                }
                node.style.display = 'none';
                node.setAttribute('data-ns-filter-hit', 'hidden');
            }

            function getProfileFilterSignature(settings, whitelist) {
                return JSON.stringify({
                    enabled: !!settings.profileFilterEnabled,
                    levels: uniqueWords(settings.blockLevels || []).sort(),
                    days: Number.isFinite(settings.maxJoinDays) ? Math.floor(settings.maxJoinDays) : null,
                    whitelist: Array.from(whitelist || []).sort()
                });
            }

            function resetFilters() {
                clearSelectedFilterView();
                document.querySelectorAll('[data-ns-filter-hit]').forEach(node => {
                    node.style.display = node.getAttribute('data-ns-filter-old-display') || '';
                    node.removeAttribute('data-ns-filter-hit');
                });
                document.querySelectorAll('.ns-filter-highlighted').forEach(node => {
                    node.classList.remove('ns-filter-highlighted');
                    node.style.removeProperty('--ns-filter-highlight-color');
                });
            }

            function getHighlightedContainers() {
                const result = [];
                const seen = new Set();
                document.querySelectorAll('.ns-filter-highlighted').forEach(node => {
                    const container = getContainer(node);
                    if (!container || seen.has(container) || isPluginNode(container)) return;
                    seen.add(container);
                    result.push(container);
                });
                return result;
            }

            function clearSelectedFilterView() {
                document.querySelectorAll('[data-ns-filter-focus-hidden]').forEach(node => {
                    node.style.display = node.getAttribute('data-ns-filter-focus-display') || '';
                    node.removeAttribute('data-ns-filter-focus-hidden');
                    node.removeAttribute('data-ns-filter-focus-display');
                });
                document.querySelectorAll('[data-ns-filter-hit="hidden"]').forEach(node => {
                    node.style.display = 'none';
                });
            }

            function showNodeForSelectedView(node) {
                node.style.display = node.getAttribute('data-ns-filter-old-display') || '';
                node.removeAttribute('data-ns-filter-focus-hidden');
                node.removeAttribute('data-ns-filter-focus-display');
            }

            function hideNodeForSelectedView(node) {
                if (!node.hasAttribute('data-ns-filter-focus-hidden')) {
                    node.setAttribute('data-ns-filter-focus-display', node.style.display || '');
                }
                node.style.display = 'none';
                node.setAttribute('data-ns-filter-focus-hidden', 'true');
            }

            function applySelectedFilterView(mode) {
                clearSelectedFilterView();
                selectedFilterMode = mode || '';
                if (!selectedFilterMode) {
                    renderHighlightStatsToContainer();
                    if (window.NodeSeekCollapsedActions && typeof window.NodeSeekCollapsedActions.updateHighlightCount === 'function') {
                        window.NodeSeekCollapsedActions.updateHighlightCount();
                    } else if (window.NodeSeekCollapsedActions && typeof window.NodeSeekCollapsedActions.refresh === 'function') {
                        window.NodeSeekCollapsedActions.refresh();
                    }
                    return;
                }

                const selected = new Set(selectedFilterMode === 'hidden'
                    ? Array.from(document.querySelectorAll('[data-ns-filter-hit="hidden"]'))
                    : getHighlightedContainers());

                getContentCandidates().forEach(node => {
                    if (selected.has(node)) showNodeForSelectedView(node);
                    else hideNodeForSelectedView(node);
                });
                renderHighlightStatsToContainer();
                if (window.NodeSeekCollapsedActions && typeof window.NodeSeekCollapsedActions.updateHighlightCount === 'function') {
                    window.NodeSeekCollapsedActions.updateHighlightCount();
                } else if (window.NodeSeekCollapsedActions && typeof window.NodeSeekCollapsedActions.refresh === 'function') {
                    window.NodeSeekCollapsedActions.refresh();
                }
            }

            function toggleSelectedFilterView(mode) {
                applySelectedFilterView(selectedFilterMode === mode ? '' : mode);
            }

            function applyFilters() {
                const settings = getSettings();
                const hideWords = uniqueWords(settings.displayKeywords);
                const highlightWords = uniqueWords(settings.highlightKeywords);
                const hideMatchers = prepareWords(hideWords);
                const highlightMatchers = prepareWords(highlightWords);
                const whitelist = new Set(uniqueWords(settings.whitelistUsers).map(name => name.toLowerCase()));
                const currentProfileFilterSignature = getProfileFilterSignature(settings, whitelist);
                profileFilterSignature = currentProfileFilterSignature;
                let hidden = 0;
                let highlighted = 0;

                resetFilters();

                if (hideMatchers.length > 0) {
                    getContentCandidates().forEach(node => {
                        const author = getAuthorName(node).toLowerCase();
                        if (author && whitelist.has(author)) return;
                        if (textHasPrepared(node.textContent || '', hideMatchers)) {
                            hideMatchedNode(node);
                            hidden += 1;
                        }
                    });
                }

                if (settings.profileFilterEnabled && typeof fetchUserData === 'function') {
                    getPostListCandidates().forEach(node => {
                        if (node.getAttribute('data-ns-filter-hit') === 'hidden') return;
                        const authorLink = getAuthorLinkFromPost(node);
                        const author = authorLink ? authorLink.textContent.trim().toLowerCase() : '';
                        if (author && whitelist.has(author)) return;
                        const userId = getUserIdFromLink(authorLink);
                        if (!userId) return;
                        const requestKey = currentProfileFilterSignature + ':' + userId;
                        const state = profileFilterState.get(node);
                        if (state && state.key === requestKey) {
                            if (state.status === 'matched') {
                                hideMatchedNode(node);
                                hidden += 1;
                            }
                            if (state.status === 'matched' || state.status === 'miss' || state.status === 'pending') return;
                        }
                        profileFilterState.set(node, { key: requestKey, status: 'pending' });
                        fetchUserData(userId).then(userData => {
                            if (currentProfileFilterSignature !== profileFilterSignature) return;
                            if (!userData || node.getAttribute('data-ns-filter-hit') === 'hidden') return;
                            if (!isProfileMatched(userData, settings)) {
                                profileFilterState.set(node, { key: requestKey, status: 'miss' });
                                return;
                            }
                            profileFilterState.set(node, { key: requestKey, status: 'matched' });
                            hideMatchedNode(node);
                            lastStats.hidden += 1;
                            if (selectedFilterMode) applySelectedFilterView(selectedFilterMode);
                            renderHighlightStatsToContainer();
                        }).catch(function () {
                            profileFilterState.set(node, { key: requestKey, status: 'error' });
                        });
                    });
                }

                if (highlightMatchers.length > 0) {
                    getTitleElements().forEach(node => {
                        const container = getContainer(node);
                        if (container?.getAttribute('data-ns-filter-hit') === 'hidden') return;
                        const author = container ? getAuthorName(container).toLowerCase() : '';
                        if (author && whitelist.has(author)) return;
                        const authorMatched = settings.highlightAuthorEnabled && author && textHasPrepared(author, highlightMatchers);
                        if (textHasPrepared(node.textContent || '', highlightMatchers) || authorMatched) {
                            node.style.setProperty('--ns-filter-highlight-color', settings.highlightColor || '#38bdf8');
                            node.classList.add('ns-filter-highlighted');
                            highlighted += 1;
                        }
                    });
                }

                lastStats = { hidden, highlighted };
                if (selectedFilterMode) applySelectedFilterView(selectedFilterMode);
                renderHighlightStatsToContainer();
            }

            function scheduleApplyFilters() {
                if (applyTimer) clearTimeout(applyTimer);
                applyTimer = setTimeout(() => {
                    applyTimer = null;
                    applyFilters();
                }, 200);
            }

            function nodeCanAffectFilters(node) {
                if (!(node instanceof Element) || isPluginNode(node)) return false;
                if (node.matches?.('article, .nsk-content, .card, .post, .topic, .reply, li, tr, a[href*="/post"], a[href*="/topic"], a[href*="/article"], .post-list-item, .thread-title, .topic-title, .post-title, .article-title, .content-title, h1, h2, h3')) return true;
                return !!node.querySelector?.('article, .nsk-content, .card, .post, .topic, .reply, li, tr, a[href*="/post"], a[href*="/topic"], a[href*="/article"], .post-list-item, .thread-title, .topic-title, .post-title, .article-title, .content-title, h1, h2, h3');
            }

            function initFilterObserver() {
                applyFilters();
                if (observer) return;
                observer = new MutationObserver(function (mutations) {
                    for (const mutation of mutations) {
                        for (const node of mutation.addedNodes) {
                            if (nodeCanAffectFilters(node)) {
                                scheduleApplyFilters();
                                return;
                            }
                        }
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
            }

            function renderHighlightStatsToContainer() {
                const box = document.getElementById('ns-highlight-stats-container');
                if (!box) {
                    if (window.NodeSeekCollapsedActions && typeof window.NodeSeekCollapsedActions.updateHighlightCount === 'function') {
                        window.NodeSeekCollapsedActions.updateHighlightCount();
                    } else if (window.NodeSeekCollapsedActions && typeof window.NodeSeekCollapsedActions.refresh === 'function') {
                        window.NodeSeekCollapsedActions.refresh();
                    }
                    return;
                }
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
                    const tags = document.createElement('div');
                    tags.className = 'ns-filter-stat-tags';
                    [
                        ['hidden', '隐藏 ' + lastStats.hidden],
                        ['highlighted', '高亮 ' + lastStats.highlighted]
                    ].forEach(item => {
                        const tag = document.createElement('button');
                        tag.type = 'button';
                        tag.className = 'ns-filter-stat-tag' + (selectedFilterMode === item[0] ? ' ns-filter-stat-tag-active' : '');
                        tag.textContent = item[1];
                        tag.onclick = function (event) {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleSelectedFilterView(item[0]);
                        };
                        tags.appendChild(tag);
                    });
                    box.appendChild(tags);
                    if (window.NodeSeekCollapsedActions && typeof window.NodeSeekCollapsedActions.updateHighlightCount === 'function') {
                        window.NodeSeekCollapsedActions.updateHighlightCount();
                    } else if (window.NodeSeekCollapsedActions && typeof window.NodeSeekCollapsedActions.refresh === 'function') {
                        window.NodeSeekCollapsedActions.refresh();
                    }
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
                    ['只看隐藏', function () { applySelectedFilterView('hidden'); }],
                    ['只看高亮', function () { applySelectedFilterView('highlighted'); }],
                    ['显示全部', function () { applySelectedFilterView(''); }],
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

            function createLevelSelector(values) {
                let selected = new Set((values || []).map(String).filter(level => LEVEL_OPTIONS.includes(level)));
                const wrap = document.createElement('div');
                wrap.className = 'ns-filter-level-options';

                function render() {
                    wrap.innerHTML = '';
                    LEVEL_OPTIONS.forEach(level => {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = 'ns-filter-level-chip' + (selected.has(level) ? ' ns-filter-level-chip-active' : '');
                        btn.textContent = level;
                        btn.onclick = function (event) {
                            event.preventDefault();
                            event.stopPropagation();
                            if (selected.has(level)) selected.delete(level);
                            else selected.add(level);
                            render();
                        };
                        wrap.appendChild(btn);
                    });
                }

                wrap.getValues = function () {
                    return Array.from(selected).sort((a, b) => Number(a) - Number(b));
                };
                wrap.setValues = function (values) {
                    selected = new Set((values || []).map(String).filter(level => LEVEL_OPTIONS.includes(level)));
                    render();
                };
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
                const levelInput = createLevelSelector(settings.blockLevels);
                const daysInput = document.createElement('input');
                daysInput.type = 'number';
                daysInput.min = '0';
                daysInput.step = '1';
                daysInput.className = 'ns-filter-days-input';
                daysInput.value = Number.isFinite(settings.maxJoinDays) ? String(settings.maxJoinDays) : '';
                daysInput.placeholder = '30';
                const colorInput = document.createElement('input');
                colorInput.type = 'color';
                colorInput.className = 'ns-filter-color-input';
                colorInput.value = settings.highlightColor || '#38bdf8';
                const authorInput = document.createElement('input');
                authorInput.type = 'checkbox';
                authorInput.checked = !!settings.highlightAuthorEnabled;
                const profileFilterInput = document.createElement('input');
                profileFilterInput.type = 'checkbox';
                profileFilterInput.checked = !!settings.profileFilterEnabled;

                dialog.appendChild(field('屏蔽关键词', hideInput));
                dialog.appendChild(field('屏蔽等级', levelInput));
                dialog.appendChild(field('加入天数 <=', daysInput));
                dialog.appendChild(field('高亮关键词', highlightInput));
                dialog.appendChild(field('白名单用户名', whitelistInput));
                dialog.appendChild(field('高亮颜色', colorInput));

                const profileFilterLabel = document.createElement('label');
                profileFilterLabel.className = 'ns-filter-check-row';
                profileFilterLabel.appendChild(profileFilterInput);
                const profileFilterText = document.createElement('span');
                profileFilterText.textContent = '启用等级和加入天数屏蔽';
                profileFilterLabel.appendChild(profileFilterText);
                dialog.appendChild(profileFilterLabel);

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
                        whitelistUsers: whitelistInput.getValues(),
                        profileFilterEnabled: profileFilterInput.checked,
                        blockLevels: levelInput.getValues(),
                        maxJoinDays: daysInput.value.trim() === '' ? null : Number(daysInput.value)
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
                        whitelistUsers: [],
                        profileFilterEnabled: true,
                        blockLevels: ['0', '1'],
                        maxJoinDays: 30
                    });
                    hideInput.setValues([]);
                    highlightInput.setValues([]);
                    whitelistInput.setValues([]);
                    levelInput.setValues(['0', '1']);
                    daysInput.value = '30';
                    profileFilterInput.checked = true;
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
                applyFilters,
                getStats: function () { return { hidden: lastStats.hidden, highlighted: lastStats.highlighted, mode: selectedFilterMode }; },
                showOnlyHighlighted: function () { applySelectedFilterView('highlighted'); },
                toggleHighlighted: function () { toggleSelectedFilterView('highlighted'); },
                showOnlyHidden: function () { applySelectedFilterView('hidden'); },
                toggleHidden: function () { toggleSelectedFilterView('hidden'); },
                showAllFiltered: function () { applySelectedFilterView(''); }
            };
        })();
    }

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
                    return normalizeReplies(JSON.parse(localStorage.getItem('nodeseek_quick_reply') || '{}'));
                } catch (e) {
                    return {};
                }
            }

            function setQuickReplies(replies) {
                localStorage.setItem('nodeseek_quick_reply', JSON.stringify(normalizeReplies(replies)));
            }

            function getAutoSubmit() {
                return localStorage.getItem('nodeseek_quick_reply_auto_submit') === 'true';
            }

            function setAutoSubmit(value) {
                localStorage.setItem('nodeseek_quick_reply_auto_submit', value ? 'true' : 'false');
            }

            function getLastUsed() {
                try {
                    return JSON.parse(localStorage.getItem('nodeseek_quick_reply_last_used') || '{}');
                } catch (e) {
                    return {};
                }
            }

            function setLastUsed(title) {
                const data = getLastUsed();
                data[title] = Date.now();
                localStorage.setItem('nodeseek_quick_reply_last_used', JSON.stringify(data));
            }

            function getSelectedShortcutKeys() {
                try {
                    const value = JSON.parse(localStorage.getItem('nodeseek_quick_reply_shortcuts') || '[]');
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
                localStorage.setItem('nodeseek_quick_reply_shortcuts', JSON.stringify(next));
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

    // 新增：黑名单弹窗 - 调用内置模块
    function showBlacklistDialog() {
        if (window.NodeSeekBlacklistViewer && typeof window.NodeSeekBlacklistViewer.showBlacklistDialog === 'function') {
            window.NodeSeekBlacklistViewer.showBlacklistDialog();
        } else {
            alert('黑名单查看功能未加载');
        }
    }

    // ====== 好友弹窗 ======
    // showFriendsDialog 函数已内置
    const showFriendsDialog = () => window.NodeSeekFriends?.showFriendsDialog();



    // updateFriendRemark 函数已内置
    const updateFriendRemark = (username, newRemark) => window.NodeSeekFriends?.updateFriendRemark(username, newRemark);

    function makeDraggable(dialog, handleSize) {
        if (!dialog || dialog.dataset.nsGlobalDragReady) return;
        dialog.dataset.nsGlobalDragReady = '1';
        const handle = document.createElement('div');
        handle.style.position = 'absolute';
        handle.style.left = '0';
        handle.style.top = '0';
        handle.style.width = ((handleSize && handleSize.width) || 48) + 'px';
        handle.style.height = ((handleSize && handleSize.height) || 38) + 'px';
        handle.style.cursor = 'move';
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
    }

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
    }

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
    requestAnimationFrame(function () {
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

        const DEFAULT_USERSCRIPT_URL = 'https://raw.githubusercontent.com/xixu520/nodeseek/main/Ns.user.js';

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
                return 'https://raw.githubusercontent.com/' + rawMatch[1] + '/' + rawMatch[2] + '/' + rawMatch[3] + '/' + path;
            }
            const githubRawMatch = clean.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/raw\/(?:refs\/heads\/)?([^/]+)\/(.+)$/i);
            if (githubRawMatch) {
                const path = githubRawMatch[4].replace(/\/Ns\.js$/i, '/Ns.user.js');
                return 'https://raw.githubusercontent.com/' + githubRawMatch[1] + '/' + githubRawMatch[2] + '/' + githubRawMatch[3] + '/' + path;
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
            const meta = getScriptMeta();
            const url = getPreferredScriptUrl(meta);
            if (!url || /REPLACE_USER|REPLACE_REPO/.test(url)) {
                statusEl.textContent = '请先把脚本头部 updateURL 改成 GitHub Raw 地址。';
                alert('请先把脚本头部 @updateURL 和 @downloadURL 改成你的 GitHub Raw 地址。');
                return;
            }
            statusEl.textContent = '正在检查更新...';
            try {
                const response = await gmRequestText('GET', url + (url.includes('?') ? '&' : '?') + '_t=' + Date.now());
                if (response.status < 200 || response.status >= 300) throw new Error('状态码 ' + response.status);
                const latestVersion = parseVersionFromScript(response.responseText);
                if (!latestVersion) throw new Error('远端脚本没有 @version');
                const currentVersion = meta.version || '';
                if (compareVersionText(latestVersion, currentVersion) > 0) {
                    statusEl.textContent = '发现新版本：' + latestVersion;
                    const latestName = parseMetaFieldFromScript(response.responseText, 'name') || meta.name || 'NodeseekLite';
                    const latestDesc = parseMetaFieldFromScript(response.responseText, 'description') || '';
                    const downloadUrl = normalizeUserscriptInstallUrl(parseMetaFieldFromScript(response.responseText, 'downloadURL') || url);
                    const message = [
                        '脚本：' + latestName,
                        '当前版本：' + (currentVersion || '未知'),
                        '最新版本：' + latestVersion,
                        latestDesc ? '说明：' + latestDesc : '',
                        '',
                        '点击确定后会在当前标签页打开 Tampermonkey 更新页。',
                        '如果仍显示脚本文本，请确认 Tampermonkey 已启用用户脚本链接识别。'
                    ].filter(Boolean).join('\n');
                    if (confirm(message)) {
                        statusEl.textContent = '正在打开更新页面...';
                        if (openScriptUpdatePage(downloadUrl)) {
                            scheduleScriptRestart(statusEl);
                        } else {
                            throw new Error('无法打开更新页面');
                        }
                    }
                } else {
                    statusEl.textContent = '已是最新版本：' + currentVersion;
                    alert('当前已是最新版本：' + currentVersion);
                }
            } catch (error) {
                statusEl.textContent = '检查失败：' + error.message;
                alert('检查更新失败：' + error.message);
            }
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
        const currentSignMode = localStorage.getItem('nodeseek_sign_mode') || 'fixed';
        // 确保如果是第一次使用，也存入 fixed
        if (!localStorage.getItem('nodeseek_sign_mode')) {
            localStorage.setItem('nodeseek_sign_mode', 'fixed');
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
                localStorage.setItem('nodeseek_sign_mode', 'fixed');
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
                localStorage.setItem('nodeseek_sign_mode', 'random');
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
        signSwitch.checked = localStorage.getItem('nodeseek_sign_enabled') !== 'false';
        signSwitch.style.transform = 'scale(1.2)';
        signSwitch.onchange = function () {
            const newState = this.checked;
            localStorage.setItem('nodeseek_sign_enabled', newState.toString());
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

        updateRightContainer.appendChild(updateStatus);
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

    function rewriteJumpLinks() {
        if (!getSkipJumpPageEnabled()) return;

        const mode = getSkipJumpMode();
        const list = getSkipJumpList();

        document.querySelectorAll('a[href*="/jump?to="]').forEach(link => {
            try {
                if (link.href.includes('/jump?to=')) {
                    const url = new URL(link.href);
                    const target = url.searchParams.get('to');
                    if (target) {
                        const targetUrlStr = decodeURIComponent(target);
                        let targetDomain = '';
                        try {
                            targetDomain = new URL(targetUrlStr).hostname;
                        } catch (e) { }

                        let shouldSkip = true;
                        if (mode === 'whitelist') {
                            // 如果是白名单模式，且名单为空，则不跳过（即显示跳转提醒）
                            if (list.length === 0) {
                                shouldSkip = false;
                            } else {
                                // 仅匹配域名本身或其子域名
                                shouldSkip = list.some(domain => targetDomain === domain || targetDomain.endsWith('.' + domain));
                            }
                        }

                        if (shouldSkip) {
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
                    }
                }
            } catch (e) {
                console.error('Error rewriting jump link', e);
            }
        });
    }

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

    const blacklistEntryObserver = new MutationObserver(() => {
        scheduleEnsureBlacklistNav();
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
        new MutationObserver(bindSafariNodeImageToolbar).observe(document.documentElement, { childList: true, subtree: true });
    } catch (e) { }

})();
