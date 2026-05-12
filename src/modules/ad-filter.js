    if (!window.NodeSeekAdFilter) {
        window.NodeSeekAdFilter = (function () {
            const HIDDEN_ATTR = 'data-ns-ad-hidden';
            const DISPLAY_ATTR = 'data-ns-ad-old-display';
            const PLUGIN_SELECTOR = '#nodeseek-plugin-main-container, #settings-dialog, #webdav-sync-dialog, #blacklist-dialog, #ns-filter-dialog, #quick-reply-dialog, #logs-dialog, #friends-dialog, #nodeimage-dialog, .ns-modal, .ns-dialog';
            const CONTENT_SELECTOR = 'li.post-list-item, .post-list-item, .post-content, .reply-item, .comment-item, .markdown-body, article, main';
            const AD_TEXT_RE = /(?:^|\s|[【[（(])(?:广告|推广|赞助|sponsored|promotion)(?:\s|[】\]）)]|$)/i;
            const AD_TOKEN_RE = /(?:^|[-_\s])(?:sponsor|sponsored|promotion|promoted|advert|advertise|advertisement|banner)(?:[-_\s]|$)/i;
            const AD_HOST_RE = /(?:doubleclick|googlesyndication|googleadservices|adservice|adsystem|adnxs|sponsor|promotion|advert)/i;
            let observer = null;
            let scanTimer = null;

            function isEnabled() {
                if (typeof getAdFilterEnabled === 'function') return getAdFilterEnabled();
                return localStorage.getItem('nodeseek_ad_filter_enabled') === 'true';
            }

            function isPluginNode(node) {
                return !!(node && node.closest && node.closest(PLUGIN_SELECTOR));
            }

            function isContentNode(node) {
                return !!(node && node.closest && node.closest(CONTENT_SELECTOR));
            }

            function getNodeTokenText(node) {
                return [
                    node.id || '',
                    node.className && typeof node.className === 'string' ? node.className : '',
                    node.getAttribute?.('aria-label') || '',
                    node.getAttribute?.('title') || ''
                ].join(' ');
            }

            function queryWithRoot(root, selector) {
                const scope = root && root.querySelectorAll ? root : document;
                const nodes = Array.from(scope.querySelectorAll(selector));
                if (root instanceof Element && root.matches(selector)) nodes.unshift(root);
                return nodes;
            }

            function isVisible(node) {
                if (!(node instanceof HTMLElement)) return false;
                const rect = node.getBoundingClientRect();
                return rect.width > 0 && rect.height > 0;
            }

            function hideNode(node) {
                if (!(node instanceof HTMLElement) || isPluginNode(node) || isContentNode(node)) return;
                if (!node.hasAttribute(HIDDEN_ATTR)) {
                    node.setAttribute(DISPLAY_ATTR, node.style.display || '');
                }
                node.style.display = 'none';
                node.setAttribute(HIDDEN_ATTR, 'true');
            }

            function restoreAll() {
                document.querySelectorAll('[' + HIDDEN_ATTR + '="true"]').forEach(node => {
                    if (!(node instanceof HTMLElement)) return;
                    node.style.display = node.getAttribute(DISPLAY_ATTR) || '';
                    node.removeAttribute(HIDDEN_ATTR);
                    node.removeAttribute(DISPLAY_ATTR);
                });
            }

            function getSafeAdContainer(node) {
                if (!(node instanceof HTMLElement) || isPluginNode(node) || isContentNode(node)) return null;
                const container = node.closest('aside, section, [class*="sidebar"], [class*="widget"], [class*="card"], [class*="panel"], [class*="box"], [class*="banner"], [class*="sponsor"], [class*="promotion"]');
                if (!(container instanceof HTMLElement) || isPluginNode(container) || isContentNode(container)) return null;
                const text = (container.textContent || '').replace(/\s+/g, ' ').trim();
                if (text.length > 320) return null;
                return container;
            }

            function hideClassifiedBlocks(root) {
                const selector = 'aside, [id*="sponsor"], [class*="sponsor"], [id*="promotion"], [class*="promotion"], [id*="banner"], [class*="banner"]';
                queryWithRoot(root, selector).forEach(node => {
                    if (!(node instanceof HTMLElement) || isPluginNode(node) || isContentNode(node)) return;
                    const tokenText = getNodeTokenText(node);
                    const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
                    if (AD_TOKEN_RE.test(tokenText) || (text.length <= 320 && AD_TEXT_RE.test(text))) {
                        hideNode(node);
                    }
                });
            }

            function hideTextMarkedBlocks(root) {
                queryWithRoot(root, 'aside, section, div, span, a').forEach(node => {
                    if (!(node instanceof HTMLElement) || isPluginNode(node) || isContentNode(node) || !isVisible(node)) return;
                    const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
                    if (!text || text.length > 80 || !AD_TEXT_RE.test(text)) return;
                    const container = getSafeAdContainer(node);
                    if (container) hideNode(container);
                });
            }

            function hideAdIframes(root) {
                queryWithRoot(root, 'iframe').forEach(node => {
                    if (!(node instanceof HTMLIFrameElement) || isPluginNode(node) || isContentNode(node)) return;
                    const tokenText = getNodeTokenText(node) + ' ' + (node.src || '');
                    if (!AD_HOST_RE.test(tokenText)) return;
                    hideNode(node);
                });
            }

            function scan(root) {
                if (!isEnabled()) {
                    restoreAll();
                    stopObserver();
                    return;
                }
                hideClassifiedBlocks(root);
                hideTextMarkedBlocks(root);
                hideAdIframes(root);
            }

            function scheduleScan(root) {
                if (scanTimer) clearTimeout(scanTimer);
                scanTimer = setTimeout(function () {
                    scanTimer = null;
                    scan(root || document);
                }, 180);
            }

            function startObserver() {
                if (observer || !document.body) return;
                observer = new MutationObserver(function (mutations) {
                    for (const mutation of mutations) {
                        for (const node of mutation.addedNodes) {
                            if (node instanceof Element) {
                                scheduleScan(node);
                                return;
                            }
                        }
                    }
                });
                observer.observe(document.body, { childList: true, subtree: true });
            }

            function stopObserver() {
                if (!observer) return;
                observer.disconnect();
                observer = null;
            }

            function refresh() {
                if (isEnabled()) {
                    scan(document);
                    startObserver();
                } else {
                    restoreAll();
                    stopObserver();
                }
            }

            function setEnabled(enabled) {
                if (typeof setAdFilterEnabled === 'function') setAdFilterEnabled(!!enabled);
                else localStorage.setItem('nodeseek_ad_filter_enabled', enabled ? 'true' : 'false');
                refresh();
            }

            function init() {
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', refresh, { once: true });
                } else {
                    refresh();
                }
            }

            init();

            return {
                isEnabled,
                setEnabled,
                refresh
            };
        })();
    }
