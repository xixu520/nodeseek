const test = require('node:test');
const assert = require('node:assert/strict');
const rules = require('../src/modules/user-labels-rules.js');

function discussion(postId, title) {
    return { post_id: postId, title };
}

function comment(postId, floorId, text) {
    return { post_id: postId, floor_id: floorId, text };
}

test('只把服务器收售识别为交易方向', () => {
    assert.equal(rules.tradeDirection('收 Netcup RS1000 VPS'), 'buy');
    assert.equal(rules.tradeDirection('降价出 Netcup RS1000 VPS'), 'sell');
    assert.equal(rules.tradeDirection('90出 Netcup RS1000 VPS'), 'sell');
    assert.equal(rules.tradeDirection('收 GPT Plus 账号'), '');
    assert.equal(rules.tradeDirection('VPS 出问题了'), '');
    assert.equal(rules.tradeDirection('已经收到 VPS 退款'), '');
});

test('频繁收售且存在两组先收后出时产生炒鸡结果', () => {
    const rows = [
        discussion(1, '出 Netcup RS1000 VPS'),
        discussion(2, '出 Cloudcone VPS'),
        discussion(3, '降价出 Netcup VPS'),
        discussion(4, '转让 Cloudcone VPS'),
        discussion(5, '出 Hetzner VPS'),
        discussion(6, '收 Netcup RS1000 VPS'),
        discussion(7, '求购 Cloudcone VPS'),
        discussion(8, '收 Netcup VPS'),
        discussion(9, '蹲 Cloudcone VPS'),
        discussion(10, '收 Hetzner VPS')
    ];
    const result = rules.analyzeTrading(rows);
    assert.equal(result.matched, true);
    assert.ok(result.pairCount >= 2);
    assert.equal(result.evidence.length, 10);
});

test('普通交易和只有单向出售不产生炒鸡结果', () => {
    const rows = Array.from({ length: 12 }, (_, index) => discussion(index + 1, '出售 GPT Plus 账号'));
    const result = rules.analyzeTrading(rows);
    assert.equal(result.matched, false);
});

test('机械短回复达到严格条件时产生灌水结果', () => {
    const rows = Array.from({ length: 45 }, (_, index) => comment(100 + (index % 10), index + 1, index % 2 ? '支持一下' : '支持一下！'));
    const result = rules.analyzeComments(rows, {
        nComment: 1000,
        created_at: new Date(Date.now() - 100 * 86400000).toISOString()
    });
    assert.equal(result.matched, true);
    assert.ok(result.duplicateRatio >= 0.4);
    assert.ok(result.shortRatio >= 0.6);
});

test('内容丰富的高频正常讨论不产生灌水结果', () => {
    const subjects = ['网络路由', '硬盘性能', '备份恢复', '系统更新', '账户安全', '价格比较', '售后处理', '线路延迟', '内存占用'];
    const actions = ['先核对实际记录', '建议保留原始配置', '可以分时段复测', '需要查看完整说明', '最好确认服务条款'];
    const rows = Array.from({ length: 45 }, (_, index) => comment(
        200 + index,
        index + 1,
        `${subjects[index % subjects.length]}的问题要结合第${index + 1}项现象分析，${actions[Math.floor(index / subjects.length) % actions.length]}，再决定处理方式。`
    ));
    const result = rules.analyzeComments(rows, {
        nComment: 1000,
        created_at: new Date(Date.now() - 100 * 86400000).toISOString()
    });
    assert.equal(result.matched, false);
});

test('检查频率遵守标签、三十天结果和失败次日重试限制', () => {
    const now = Date.now();
    assert.equal(rules.shouldSkipScan({ labels: { trader: {} } }, null, now, 30 * 86400000, 86400000), true);
    assert.equal(rules.shouldSkipScan(null, { status: 'complete', checkedAt: now - 29 * 86400000 }, now, 30 * 86400000, 86400000), true);
    assert.equal(rules.shouldSkipScan(null, { status: 'complete', checkedAt: now - 31 * 86400000 }, now, 30 * 86400000, 86400000), false);
    assert.equal(rules.shouldSkipScan(null, { status: 'failed', failedAt: now - 23 * 3600000 }, now, 30 * 86400000, 86400000), true);
    assert.equal(rules.shouldSkipScan(null, { status: 'failed', failedAt: now - 25 * 3600000 }, now, 30 * 86400000, 86400000), false);
});

test('每日上限和三秒间隔按保守档执行', () => {
    assert.equal(rules.canScanToday({ date: '2026-09-12', count: 19, halted: false }, '2026-09-12', 20), true);
    assert.equal(rules.canScanToday({ date: '2026-09-12', count: 20, halted: false }, '2026-09-12', 20), false);
    assert.equal(rules.canScanToday({ date: '2026-09-12', count: 1, halted: true }, '2026-09-12', 20), false);
    assert.equal(rules.canScanToday({ date: '2026-09-11', count: 20, halted: true }, '2026-09-12', 20), true);
    assert.equal(rules.nextRequestDelay(1000, 2500, 3000), 1500);
    assert.equal(rules.nextRequestDelay(1000, 4500, 3000), 0);
});

test('普通艾特不会被当作风险对象', () => {
    assert.deepEqual(rules.riskMentionNames('感谢 @张三 的帮助，顺便讨论一下服务器。'), []);
    assert.equal(rules.hasRiskContext('普通交流', '感谢 @张三 的帮助', false), false);
});

test('只有风险表述附近的艾特才列为候选', () => {
    const text = '提醒大家，我向 @争议卖家 付款后一直未交付。感谢 @热心网友 帮忙整理资料。';
    assert.deepEqual(rules.riskMentionNames(text), ['争议卖家']);
    assert.equal(rules.hasRiskContext('交易争议记录', text, false), true);
});

test('曝光分类可以提示但不会凭普通艾特确定对象', () => {
    assert.equal(rules.hasRiskContext('情况说明', '正文没有风险关键词', true), true);
    assert.deepEqual(rules.riskMentionNames('请 @版主 看一下'), []);
});
