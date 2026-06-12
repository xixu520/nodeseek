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

    let commentAutoLoadReady = false;
    let commentAutoLoadTimer = null;
    let commentAutoLoadCooldownUntil = 0;
    let commentAutoLoadObserver = null;

    function isCommentDetailPage() {
        const path = window.location.pathname || '';
        return path.includes('/topic/') || path.includes('/article/') || /\/post-\d+/i.test(path);
    }

    function isElementVisible(el) {
        if (!el || !(el instanceof HTMLElement)) return false;
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
    }

    function isCommentLoadMoreText(text) {
        const clean = String(text || '').replace(/\s+/g, '');
        if (!clean || clean.length > 24) return false;
        return clean.includes('加载更多')
            || clean.includes('更多评论')
            || clean.includes('查看更多评论')
            || clean.includes('展开更多评论')
            || clean.includes('显示更多评论')
            || clean === '查看更多'
            || clean === '展开更多';
    }

    function isCommentLoadMoreCandidate(el) {
        if (!isElementVisible(el)) return false;
        if (el.closest('#nodeseek-plugin-main-container, #settings-dialog, #webdav-sync-dialog, #blacklist-dialog, #ns-filter-dialog, #quick-reply-dialog, #logs-dialog, #friends-dialog, #nodeimage-dialog')) return false;
        if (el.disabled || el.getAttribute('aria-disabled') === 'true') return false;
        if (!isCommentLoadMoreText(el.textContent)) return false;

        const rect = el.getBoundingClientRect();
        return rect.top < window.innerHeight + 220 && rect.bottom > -40;
    }

    function tryAutoLoadMoreComments() {
        if (!getCommentAutoLoadMoreEnabled()) return;
        if (!isCommentDetailPage()) return;
        if (Date.now() < commentAutoLoadCooldownUntil) return;

        const bottom = window.innerHeight + 260;
        const candidates = Array.from(document.querySelectorAll('button, a, [role="button"]')).filter(function (el) {
            const rect = el.getBoundingClientRect();
            return rect.top < bottom && rect.bottom > -40;
        });
        const target = candidates.find(isCommentLoadMoreCandidate);
        if (!target) return;

        commentAutoLoadCooldownUntil = Date.now() + 1600;
        target.click();
        if (typeof addLog === 'function') addLog('评论区自动加载更多');
    }

    function scheduleCommentAutoLoadMore(delay) {
        if (commentAutoLoadTimer) clearTimeout(commentAutoLoadTimer);
        commentAutoLoadTimer = setTimeout(function () {
            commentAutoLoadTimer = null;
            tryAutoLoadMoreComments();
        }, typeof delay === 'number' ? delay : 180);
    }

    function ensureCommentAutoLoadMore() {
        if (!getCommentAutoLoadMoreEnabled() || !isCommentDetailPage()) {
            if (commentAutoLoadObserver) {
                commentAutoLoadObserver.disconnect();
                commentAutoLoadObserver = null;
            }
            return;
        }
        if (commentAutoLoadReady && commentAutoLoadObserver) return;
        commentAutoLoadReady = true;
        if (!window.__nsCommentAutoLoadEventsBound) {
            window.__nsCommentAutoLoadEventsBound = true;
            window.addEventListener('scroll', function () { scheduleCommentAutoLoadMore(160); }, { passive: true });
            window.addEventListener('resize', function () { scheduleCommentAutoLoadMore(240); });
        }
        commentAutoLoadObserver = new MutationObserver(function (mutations) {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (!(node instanceof Element)) continue;
                    if (isCommentLoadMoreCandidate(node) || node.querySelector?.('button, a, [role="button"]')) {
                        scheduleCommentAutoLoadMore(320);
                        return;
                    }
                }
            }
        });
        commentAutoLoadObserver.observe(document.body, { childList: true, subtree: true });
        scheduleCommentAutoLoadMore(800);
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
        ensureCommentAutoLoadMore();
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
