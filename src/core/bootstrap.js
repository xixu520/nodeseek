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
    const PANEL_THEME_MODE_KEY = 'nodeseek_panel_theme_mode';

    // 新增：用户数据缓存的存储键
    const USER_DATA_CACHE_KEY = 'nodeseek_user_data_cache';

    // 新增：用户信息显示状态的存储键
    const USER_INFO_DISPLAY_KEY = 'nodeseek_user_info_display';
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
        { key: 'userInfoSettings', label: '用户信息显示设置', dataKeys: ['userInfoSettings'] },
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

    // 新增：获取用户信息显示状态
    function getUserInfoDisplayState() {
        return localStorage.getItem(USER_INFO_DISPLAY_KEY) !== 'false'; // 默认开启
    }

    // 新增：保存用户信息显示状态
    function setUserInfoDisplayState(isEnabled) {
        localStorage.setItem(USER_INFO_DISPLAY_KEY, isEnabled.toString());
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

    // 新增：计算加入天数
    function calculateJoinDays(createdAt) {
        if (!createdAt) return '未知';
        const joinDate = new Date(createdAt);
        const now = new Date();
        const diffTime = Math.abs(now - joinDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    // 新增：批量处理用户信息的队列
    let userInfoQueue = new Set();
    let isProcessingQueue = false;

    // 新增：显示用户信息
    async function displayUserInfo(userElement, userId) {
        // 确保父元素有相对定位
        const parentElement = userElement.closest('.nsk-content-meta-info') || userElement.parentElement;

        // 检查父元素是否已经显示过用户信息
        if (parentElement && parentElement.querySelector('.user-info-display')) {
            return;
        }

        const userData = await fetchUserData(userId);
        if (!userData) {
            return;
        }

        await displayUserInfoFromData(userElement, userData);
    }

    // 优化后的批量处理用户头像和信息显示
    async function processUserAvatars() {
        // 查找所有用户头像或用户名链接
        const userElements = document.querySelectorAll('a.author-name, .user-avatar, .nsk-content-meta-info a[href*="/space/"]');

        // 收集所有需要处理的用户ID
        const userIds = new Set();
        const elementUserMap = new Map();

        for (const element of userElements) {
            // 检查是否已经显示过用户信息
            const parentElement = element.closest('.nsk-content-meta-info') || element.parentElement;
            if (parentElement && parentElement.querySelector('.user-info-display')) {
                continue;
            }

            let userId = null;
            // 从链接中提取用户ID
            if (element.href && element.href.includes('/space/')) {
                const match = element.href.match(/\/space\/(\d+)/);
                if (match) {
                    userId = match[1];
                    userIds.add(userId);
                    if (!elementUserMap.has(userId)) {
                        elementUserMap.set(userId, []);
                    }
                    elementUserMap.get(userId).push(element);
                }
            }
        }

        // 如果没有新的用户需要处理，直接返回
        if (userIds.size === 0) {
            return;
        }

        // 批量获取用户数据
        await batchFetchUserData(Array.from(userIds), elementUserMap);
    }

    // 新增：批量获取用户数据
    async function batchFetchUserData(userIds, elementUserMap) {
        // 检查缓存，分离需要请求的用户ID
        const cache = getUserDataCache();
        const cachedUsers = [];
        const needFetchUsers = [];

        userIds.forEach(userId => {
            if (cache[userId] && cache[userId].timestamp) {
                cachedUsers.push({ userId, data: cache[userId] });
            } else {
                needFetchUsers.push(userId);
            }
        });

        // 先处理缓存的用户数据
        for (const { userId, data } of cachedUsers) {
            const elements = elementUserMap.get(userId) || [];
            for (const element of elements) {
                await displayUserInfoFromData(element, data);
            }
        }

        // 并发获取需要请求的用户数据（限制并发数）
        const concurrencyLimit = 3; // 限制并发请求数
        const chunks = [];
        for (let i = 0; i < needFetchUsers.length; i += concurrencyLimit) {
            chunks.push(needFetchUsers.slice(i, i + concurrencyLimit));
        }

        for (const chunk of chunks) {
            const promises = chunk.map(async userId => {
                try {
                    const userData = await fetchUserData(userId);
                    if (userData) {
                        const elements = elementUserMap.get(userId) || [];
                        for (const element of elements) {
                            await displayUserInfoFromData(element, userData);
                        }
                    }
                } catch (error) {
                    console.error(`获取用户${userId}数据失败:`, error);
                }
            });

            await Promise.all(promises);
            // 批次间添加小延迟，避免请求过于频繁
            if (chunks.indexOf(chunk) < chunks.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 200));
            }
        }
    }

    // 新增：从已有数据显示用户信息
    async function displayUserInfoFromData(userElement, userData) {
        // 检查用户信息显示开关状态
        if (!getUserInfoDisplayState()) {
            return;
        }

        const parentElement = userElement.closest('.nsk-content-meta-info') || userElement.parentElement;

        // 检查父元素是否已经显示过用户信息
        if (parentElement && parentElement.querySelector('.user-info-display')) {
            return;
        }

        // 计算加入天数
        const joinDays = calculateJoinDays(userData.created_at);

        const isMobile = (window.NodeSeekFilter && typeof window.NodeSeekFilter.isMobileDevice === 'function')
            ? window.NodeSeekFilter.isMobileDevice()
            : (window.innerWidth <= 767);

        // 创建用户信息显示元素
        const infoDiv = document.createElement('div');
        infoDiv.className = 'user-info-display';
        infoDiv.style.cssText = `
            position: ${isMobile ? 'static' : 'absolute'};
            top: ${isMobile ? 'auto' : '-14px'};
            left: 0;
            right: auto;
            max-width: ${isMobile ? '100%' : 'calc(100% - 60px)'};
            margin-top: ${isMobile ? '3px' : '0'};
            color: rgb(173, 87, 223);
            padding: 0px 1px;
            border-radius: 1px;
            font-size: 11px;
            white-space: ${isMobile ? 'normal' : 'nowrap'};
            z-index: 1; /* 极低的z-index值，确保弹窗可以遮盖此元素 */
            pointer-events: auto; /* 允许选择和复制文本 */
            display: flex;
            align-items: center;
            flex-wrap: ${isMobile ? 'wrap' : 'nowrap'};
            user-select: text;
            -webkit-user-select: text;
            -moz-user-select: text;
            -ms-user-select: text;
            line-height: ${isMobile ? '1.35' : '1'};
            overflow: hidden;
            text-overflow: ellipsis;
        `;

        // 横向显示所有信息
        infoDiv.innerHTML = `加入: ${joinDays}天 | 等级: ${userData.rank} | 鸡腿: ${userData.coin} | 星辰: ${userData.stardust} | 主题: ${userData.nPost} | 评论: ${userData.nComment} | 粉丝: ${userData.fans} | 关注: ${userData.follows}`;

        // 确保父元素有相对定位，但不影响其他子元素的布局
        if (parentElement) {
            // 保存原始position值
            const originalPosition = getComputedStyle(parentElement).position;
            if (originalPosition === 'static') {
                parentElement.style.position = 'relative';
            }

            // 为了不影响楼层号位置，确保楼层号元素保持在右侧
            const floorElements = parentElement.querySelectorAll('*');
            floorElements.forEach(el => {
                if (el.textContent && el.textContent.match(/^#\d+$/)) {
                    // 找到楼层号元素，确保其样式不被影响，并向右移动8px
                    const computedStyle = getComputedStyle(el);
                    if (computedStyle.position !== 'absolute' && computedStyle.position !== 'fixed') {
                        el.style.position = 'relative';
                        el.style.zIndex = '1001';
                        el.style.right = '-8px';
                    }
                }
            });

            parentElement.appendChild(infoDiv);
        }
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
