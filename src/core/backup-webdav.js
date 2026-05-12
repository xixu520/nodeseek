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

        // 新增：用户信息显示设置
        let userInfoSettings = {};
        try {
            const userInfoDisplay = localStorage.getItem('nodeseek_user_info_display');
            if (userInfoDisplay !== null) {
                userInfoSettings.display = userInfoDisplay !== 'false';
            }
        } catch (error) {
            console.error('导出用户信息显示设置失败:', error);
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
            userInfoSettings: userInfoSettings, // 新增：用户信息显示设置
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

                    // 新增：处理用户信息显示设置
                    if (json.userInfoSettings && typeof json.userInfoSettings === 'object') {
                        try {
                            if (typeof json.userInfoSettings.display !== 'undefined') {
                                setUserInfoDisplayState(json.userInfoSettings.display);
                                importInfo.push(`用户信息显示设置(${json.userInfoSettings.display ? '开启' : '关闭'})`);
                            }
                        } catch (error) {
                            console.error('导入用户信息显示设置失败:', error);
                            importInfo.push('用户信息显示设置(失败)');
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

        const userInfoSettings = {};
        try {
            const userInfoDisplay = localStorage.getItem('nodeseek_user_info_display');
            if (userInfoDisplay !== null) userInfoSettings.display = userInfoDisplay !== 'false';
        } catch (error) {
            console.error('读取用户信息显示设置失败:', error);
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
            userInfoSettings: userInfoSettings,
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

            if (json.userInfoSettings && typeof json.userInfoSettings === 'object' && typeof json.userInfoSettings.display !== 'undefined') {
                setUserInfoDisplayState(json.userInfoSettings.display);
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
