    const NodeSeekUserLabelRules = (function () {
        const SERVER_WORDS = /(?:vps|server|独服|杜甫|服务器|云主机|云服务器|小鸡|鸡鸡|线路|宽带|家宽|nat|iplc|iepl|bgp|cn2|gia|cmi|4837|9929|9929|9929|甲骨文|搬瓦工|瓦工|netcup|ovh|hetzner|racknerd|cloudcone|hostdare|vultr|linode|digitalocean|oracle|aws|lightsail|绿云|狗云|腾讯云|阿里云|华为云)/i;
        const NON_SERVER_WORDS = /(?:账号|账户|会员|充值|代充|资格|认证|礼品卡|手机号|邮箱|邀请码|软件|订阅|chatgpt|gpt|plus|team|api|key|域名)/i;
        const BUY_WORDS = /(?:^|[\s【\[（(0-9.￥¥元])(?:收|求购|蹲|接盘|收购|想收|高价收|溢价收)(?=$|[\s】\]）)]|[a-z0-9\u4e00-\u9fff])/i;
        const SELL_WORDS = /(?:^|[\s【\[（(0-9.￥¥元])(?:出|出售|转让|转手|已出|降价出|明盘出)(?=$|[\s】\]）)]|[a-z0-9\u4e00-\u9fff])/i;
        const BUY_NEGATIVE = /(?:不收|暂停收|停止收|收到了|已收到|收款|回收站|丰收)/i;
        const SELL_NEGATIVE = /(?:不出|别出|出问题|出错|出租|发出|推出|出现|出发|出处)/i;
        const PROVIDER_WORDS = [
            '甲骨文', '搬瓦工', '绿云', '狗云', '腾讯云', '阿里云', '华为云', 'netcup', 'ovh',
            'hetzner', 'racknerd', 'cloudcone', 'hostdare', 'vultr', 'linode', 'digitalocean',
            'oracle', 'lightsail', 'aws', 'cn2', 'gia', 'cmi', '4837', '9929', 'iplc', 'iepl', 'bgp'
        ];
        const TOKEN_STOP = new Set([
            'vps', 'server', 'nat', 'hk', 'jp', 'us', 'sg', 'de', 'uk', 'cn', 'la', 'ny', '月', '年',
            '收', '出', '出售', '求购', '转让', '已出', '降价', '明盘', '小鸡', '服务器', '云主机', '线路'
        ]);

        function normalizeText(value) {
            return String(value || '')
                .toLowerCase()
                .replace(/https?:\/\/\S+/g, ' ')
                .replace(/@[\w\-\u4e00-\u9fff]+/g, ' ')
                .replace(/#\s*\d+/g, ' ')
                .replace(/[\p{P}\p{S}\s]+/gu, '')
                .trim();
        }

        function isServerTradeTitle(title) {
            const text = String(title || '');
            return SERVER_WORDS.test(text) && !(NON_SERVER_WORDS.test(text) && !/(?:vps|server|服务器|云主机|小鸡|独服|杜甫)/i.test(text));
        }

        function tradeDirection(title) {
            const text = String(title || '');
            if (!isServerTradeTitle(text)) return '';
            if (BUY_WORDS.test(text) && !BUY_NEGATIVE.test(text)) return 'buy';
            if (SELL_WORDS.test(text) && !SELL_NEGATIVE.test(text)) return 'sell';
            return '';
        }

        function productTokens(title) {
            const text = String(title || '').toLowerCase();
            const result = new Set();
            PROVIDER_WORDS.forEach(word => {
                if (text.includes(word.toLowerCase())) result.add(word.toLowerCase());
            });
            const ascii = text.match(/[a-z][a-z0-9._-]{2,}|\d{3,5}/g) || [];
            ascii.forEach(token => {
                const clean = token.replace(/^[._-]+|[._-]+$/g, '');
                if (clean.length >= 3 && !TOKEN_STOP.has(clean) && !/^\d+(?:\.\d+)?$/.test(clean)) result.add(clean);
            });
            return Array.from(result);
        }

        function evidenceForDiscussion(item) {
            const postId = item && item.post_id;
            return postId ? {
                url: 'https://www.nodeseek.com/post-' + postId + '-1',
                kind: '主题'
            } : null;
        }

        function analyzeTrading(discussions) {
            const sample = Array.isArray(discussions) ? discussions.slice(0, 45) : [];
            const trades = sample.map((item, index) => ({
                item,
                index,
                direction: tradeDirection(item && item.title),
                tokens: productTokens(item && item.title)
            })).filter(item => item.direction);
            const buys = trades.filter(item => item.direction === 'buy');
            const sells = trades.filter(item => item.direction === 'sell');
            const pairKeys = new Set();
            sells.forEach(sell => {
                buys.forEach(buy => {
                    if (buy.index <= sell.index) return;
                    const common = sell.tokens.filter(token => buy.tokens.includes(token));
                    common.forEach(token => pairKeys.add(token));
                });
            });
            const matched = buys.length >= 4 && sells.length >= 4 && trades.length >= 10 && pairKeys.size >= 2;
            const evidence = trades.map(entry => evidenceForDiscussion(entry.item)).filter(Boolean).slice(0, 12);
            return {
                matched,
                sampleCount: sample.length,
                buyCount: buys.length,
                sellCount: sells.length,
                tradeCount: trades.length,
                pairCount: pairKeys.size,
                pairKeys: Array.from(pairKeys).slice(0, 8),
                evidence
            };
        }

        function bigrams(text) {
            const value = normalizeText(text);
            if (value.length < 2) return new Set(value ? [value] : []);
            const result = new Set();
            for (let i = 0; i < value.length - 1; i += 1) result.add(value.slice(i, i + 2));
            return result;
        }

        function textSimilarity(left, right) {
            const a = normalizeText(left);
            const b = normalizeText(right);
            if (!a || !b) return 0;
            if (a === b) return 1;
            const aa = bigrams(a);
            const bb = bigrams(b);
            let same = 0;
            aa.forEach(item => { if (bb.has(item)) same += 1; });
            const total = aa.size + bb.size - same;
            return total ? same / total : 0;
        }

        function joinDaysFromProfile(profile, now) {
            const raw = profile && (profile.created_at || profile.created_at_str);
            const date = new Date(raw || '');
            if (!Number.isNaN(date.getTime())) return Math.max(1, Math.floor(((now || Date.now()) - date.getTime()) / 86400000));
            const match = String(raw || '').match(/(\d+)\s*days?/i);
            return match ? Math.max(1, Number(match[1])) : 0;
        }

        function analyzeComments(comments, profile, now) {
            const sample = Array.isArray(comments) ? comments.slice(0, 45) : [];
            const normalized = sample.map(item => normalizeText(item && item.text));
            const duplicateIndexes = new Set();
            const parent = sample.map((_, index) => index);
            function find(value) {
                while (parent[value] !== value) {
                    parent[value] = parent[parent[value]];
                    value = parent[value];
                }
                return value;
            }
            function unite(a, b) {
                const aa = find(a);
                const bb = find(b);
                if (aa !== bb) parent[bb] = aa;
            }
            for (let i = 0; i < normalized.length; i += 1) {
                if (!normalized[i]) continue;
                for (let j = i + 1; j < normalized.length; j += 1) {
                    if (!normalized[j]) continue;
                    if (textSimilarity(normalized[i], normalized[j]) >= 0.85) {
                        duplicateIndexes.add(i);
                        duplicateIndexes.add(j);
                        unite(i, j);
                    }
                }
            }
            const clusters = new Map();
            sample.forEach((item, index) => {
                const root = find(index);
                if (!clusters.has(root)) clusters.set(root, { count: 0, posts: new Set(), indexes: [] });
                const cluster = clusters.get(root);
                cluster.count += 1;
                cluster.indexes.push(index);
                if (item && item.post_id) cluster.posts.add(String(item.post_id));
            });
            const largest = Array.from(clusters.values()).sort((a, b) => b.count - a.count)[0] || { count: 0, posts: new Set(), indexes: [] };
            const duplicateRatio = sample.length ? duplicateIndexes.size / sample.length : 0;
            const shortCount = normalized.filter(text => text && text.length <= 8).length;
            const shortRatio = sample.length ? shortCount / sample.length : 0;
            const repeatedAcrossPosts = largest.count >= 8 && largest.posts.size >= 5;
            const conditions = [duplicateRatio >= 0.4, shortRatio >= 0.6, repeatedAcrossPosts].filter(Boolean).length;
            const totalComments = Number(profile && (profile.nComment ?? profile.n_comment)) || 0;
            const joinDays = joinDaysFromProfile(profile, now);
            const dailyAverage = joinDays ? totalComments / joinDays : 0;
            const matched = sample.length >= 30 && totalComments >= 100 && dailyAverage >= 5 && conditions >= 2;
            const evidenceIndexes = new Set(Array.from(duplicateIndexes).concat(largest.indexes || []));
            const evidence = Array.from(evidenceIndexes).map(index => {
                const item = sample[index];
                if (!item || !item.post_id) return null;
                return {
                    url: 'https://www.nodeseek.com/post-' + item.post_id + '-1#' + (item.floor_id || 0),
                    kind: '评论'
                };
            }).filter(Boolean).slice(0, 12);
            return {
                matched,
                sampleCount: sample.length,
                totalComments,
                joinDays,
                dailyAverage,
                duplicateRatio,
                shortRatio,
                largestRepeatCount: largest.count,
                largestRepeatPostCount: largest.posts.size,
                conditionCount: conditions,
                evidence
            };
        }

        function shouldSkipScan(record, cached, now, noMatchTtl, failedTtl) {
            if (record && (Object.keys(record.labels || {}).length || Object.keys(record.ignored || {}).length)) return true;
            if (!cached) return false;
            const checkedAt = Number(cached.checkedAt || cached.failedAt || 0);
            const age = Math.max(0, Number(now || Date.now()) - checkedAt);
            if (cached.status === 'failed') return age < failedTtl;
            return age < noMatchTtl;
        }

        function canScanToday(state, today, limit) {
            if (!state || state.date !== today) return true;
            return state.halted !== true && (Number(state.count) || 0) < limit;
        }

        function nextRequestDelay(lastRequestAt, now, gap) {
            return Math.max(0, Number(gap) - (Number(now) - Number(lastRequestAt || 0)));
        }

        return {
            analyzeTrading,
            analyzeComments,
            isServerTradeTitle,
            tradeDirection,
            normalizeText,
            textSimilarity,
            shouldSkipScan,
            canScanToday,
            nextRequestDelay
        };
    })();

    if (typeof module !== 'undefined' && module.exports) module.exports = NodeSeekUserLabelRules;
