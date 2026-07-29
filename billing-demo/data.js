/**
 * Billing Demo - 套餐与积分（从 admin-demo-v3 拆出）
 *
 * 只保留计费/套餐相关的数据，不含权限/成员/空间等内容。
 */

/* ===== 演示用：当前登录用户 ===== */
let CURRENT_USER_ID = 1;

/* ===== 演示用：当前上下文 ===== */
let CURRENT_CONTEXT = { type: 'org', orgId: 1 };

/* ===== 套餐定义（4 档 · AI 能力分层） =====
 *
 * 定价基线（按 Opus 4.8 最好效果 576 积分/份 · Sonnet 5 346 积分/份 估算）：
 *   套餐    价格   积分     成本    毛利率   单价$/1k   Opus份数   Sonnet份数
 *   Starter $5    1,200    $3.0    40%     $4.17     2 份       3.5 份
 *   Pro     $29   7,000    $17.5   40%     $4.14     12 份      20 份
 *   Team    $129  35,000   $87.5   32%     $3.69     60 份      101 份
 *
 * 积分消耗规则（credits）：
 *   - Chat 简单问答       : 1 积分
 *   - Deep 分析           : 3 积分
 *   - Autopilot 自动触发  : 2 积分
 *   - 执行操作            : 5 积分
 *   - 复盘报告            : 10 积分
 */
const SUBSCRIPTION_PLANS = {
    FREE: {
        key: 'FREE',
        name: 'Starter',
        price: 5,
        priceYearly: 4,
        originalPrice: 9,
        priceUnit: '$5 / month',
        priceUnitYearly: '$4 / month（年付）',
        priceDesc: '个人尝鲜、低成本试水',
        aiLevel: 'AI Chat + 分析',
        limits: {
            hasOrg: false,
            maxWorkspaces: 1,
            maxMembers: -1,
            platforms: ['*'],
            monthlyAdSpend: 5000,
            creditsMonthly: 1200,
            dataRetentionDays: 90
        },
        highlights: [
            'AI 深度分析 + 优化建议（1,200 积分/月）',
            '1 个人空间 · 无组织',
            '支持 Meta、Google、TikTok 等平台媒体',
            '广告账户不限 · 实时同步 <span class="highlight-badge">限免</span>'
        ]
    },
    PRO: {
        key: 'PRO',
        name: 'Pro',
        price: 29,
        priceYearly: 23,
        originalPrice: 39,
        priceUnit: '$29 / month',
        priceUnitYearly: '$23 / month（年付）',
        priceDesc: '个人优化师、Solo 创业者',
        aiLevel: 'AI Chat + 分析',
        limits: {
            hasOrg: false,
            maxWorkspaces: 3,
            maxMembers: -1,
            platforms: ['*'],
            monthlyAdSpend: 50000,
            creditsMonthly: 7000,
            dataRetentionDays: -1
        },
        highlights: [
            'AI 深度分析 + 优化建议（7,000 积分/月）',
            '3 个工作空间 · 无组织',
            '支持 Meta、Google、TikTok 等平台媒体',
            '广告账户不限 · 实时同步 <span class="highlight-badge">限免</span>'
        ]
    },
    TEAM: {
        key: 'TEAM',
        name: 'Team',
        price: 129,
        priceYearly: 103,
        originalPrice: 169,
        priceUnit: '$129 / month',
        priceUnitYearly: '$103 / month（年付）',
        priceDesc: '成长团队、跨境 DTC、中小 Agency',
        aiLevel: 'AI Chat + 分析 + 执行操作',
        recommended: true,
        limits: {
            hasOrg: true,
            maxWorkspaces: 10,
            maxMembers: -1,
            platforms: ['*'],
            monthlyAdSpend: 500000,
            creditsMonthly: 35000,
            dataRetentionDays: -1
        },
        highlights: [
            'AI Agent 执行操作（35,000 积分/月）',
            '组织 + 10 空间 + 数据权限',
            '支持 Meta、Google、TikTok 等平台媒体',
            '广告账户不限 · 实时同步 <span class="highlight-badge">限免</span>'
        ]
    },
    ENTERPRISE: {
        key: 'ENTERPRISE',
        name: 'Enterprise',
        price: -1,
        priceYearly: -1,
        originalPrice: null,
        priceUnit: 'Contact Sales',
        priceUnitYearly: 'Contact Sales',
        priceDesc: '大型 Agency、大客户 · 支持抽成模式',
        aiLevel: '全部能力 + 定制 Agent',
        limits: {
            hasOrg: true,
            maxWorkspaces: -1,
            maxMembers: -1,
            platforms: ['*'],
            monthlyAdSpend: -1,
            creditsMonthly: 100000,
            dataRetentionDays: -1
        },
        highlights: [
            '定制 Agent + Autopilot（100,000 积分/月起）',
            '组织 + 无限空间 + 数据权限',
            'APP Skill 接入',
            '广告账户不限 · 实时同步',
            '专属客户经理 + 优先技术支持',
            '按需定价（固定月费或按量计费）'
        ]
    }
};

/* ===== 积分消耗规则 ===== */
const CREDIT_RULES = [
    { action: 'Chat 简单问答',       credits: 1,  example: '"昨天消耗多少？"' },
    { action: 'Deep 分析',           credits: 3,  example: '"分析 A 计划下降原因"' },
    { action: 'Autopilot 自动触发',  credits: 2,  example: '规则命中自动执行' },
    { action: '执行操作',            credits: 5,  example: '"帮我给张三开通空间 A 的查看权限"' },
    { action: '复盘报告生成',        credits: 10, example: '"生成客户 A 本月投放复盘"' }
];

/* ===== Add-ons（客单价拉升器） ===== */
const ADDONS = {
    CREDITS_TOPUP: {
        key: 'CREDITS_TOPUP',
        name: '积分增量包（一次性）',
        price: 19,
        priceUnit: '$19 / 3,000 积分',
        desc: '一次性购买，用完为止（永不过期），主套餐积分不够时补充',
        availableFor: ['FREE', 'PRO', 'TEAM'],
        icon: '⚡',
        oneTime: true
    },
    CREDITS_SUB: {
        key: 'CREDITS_SUB',
        name: '积分订阅包',
        price: 49,
        priceUnit: '$49 / month · 12,000 积分',
        desc: '按月订阅额外积分，每月自动刷新（未用完不累积）',
        availableFor: ['PRO', 'TEAM'],
        icon: '🔋'
    },
    BULK_CREATION: {
        key: 'BULK_CREATION',
        name: '广告批量创编工具',
        price: 39,
        priceUnit: '$39 / month',
        desc: '支持 Meta、Google、TikTok、Amazon 等平台的广告批量创建、复制、修改',
        availableFor: ['TEAM', 'ENTERPRISE'],
        icon: '📦'
    },
    EXTRA_WORKSPACES: {
        key: 'EXTRA_WORKSPACES',
        name: '额外工作空间',
        price: 10,
        priceUnit: '$10 / workspace / month',
        desc: '超出套餐空间限制时按需加购',
        availableFor: ['PRO', 'TEAM'],
        icon: '🗂️'
    }
};

/* ===== 组织套餐 ===== */
const ORG_SUBSCRIPTIONS = [
    { orgId: 1, plan: 'PRO',        billingCycle: 'monthly', startDate: '2025-12-01', expireDate: '2026-12-01', autoRenew: true },
    { orgId: 2, plan: 'PRO',        billingCycle: 'monthly', startDate: '2025-08-01', expireDate: '2026-08-01', autoRenew: true },
    { orgId: 3, plan: 'TEAM',       billingCycle: 'yearly',  startDate: '2025-09-01', expireDate: '2026-09-01', autoRenew: true }
];

/* ===== 账单（USD 计价） ===== */
const BILLING_RECORDS = [
    { id: 100, scope: 'org',  scopeId: 2, plan: 'PRO',        type: '月付续费',   amount: 29,    paidAt: '2025-08-01', method: 'Stripe (Card)', invoice: 'INV-2025-08-100', status: 'paid' },
    { id: 101, scope: 'org',  scopeId: 2, plan: 'PRO',        type: '初次订阅',   amount: 29,    paidAt: '2024-08-01', method: 'Stripe (Card)', invoice: 'INV-2024-08-100', status: 'paid' },
    { id: 110, scope: 'org',  scopeId: 3, plan: 'TEAM',       type: '年付续费',   amount: 1236,  paidAt: '2025-09-01', method: 'Wire Transfer', invoice: 'INV-2025-09-110', status: 'paid' },
    { id: 111, scope: 'org',  scopeId: 3, plan: 'TEAM',       type: '从 PRO 升级', amount: 100,   paidAt: '2024-12-01', method: 'Stripe (Card)', invoice: 'INV-2024-12-111', status: 'paid' },
    { id: 112, scope: 'org',  scopeId: 3, plan: 'PRO',        type: '初次订阅',   amount: 29,    paidAt: '2024-09-01', method: 'Stripe (Card)', invoice: 'INV-2024-09-112', status: 'paid' },

    // Enterprise 年度合同 + 月度账单
    { id: 120, scope: 'org',  scopeId: 1, plan: 'ENTERPRISE', type: '年度合同',   amount: 24000, paidAt: '2024-01-01', method: 'Wire Transfer', invoice: 'INV-2024-01-120', status: 'paid' },
    { id: 121, scope: 'org',  scopeId: 1, plan: 'ENTERPRISE', type: '月度账单',   amount: 2000,  paidAt: '2026-06-01', method: 'Wire Transfer', invoice: 'INV-2026-06-121', status: 'paid' },
    { id: 122, scope: 'org',  scopeId: 1, plan: 'ENTERPRISE', type: '月度账单',   amount: 2000,  paidAt: '2026-05-01', method: 'Wire Transfer', invoice: 'INV-2026-05-122', status: 'paid' },
    { id: 123, scope: 'org',  scopeId: 1, plan: 'ENTERPRISE', type: '月度账单',   amount: 2000,  paidAt: '2026-04-01', method: 'Wire Transfer', invoice: 'INV-2026-04-123', status: 'paid' },
    { id: 124, scope: 'org',  scopeId: 1, plan: 'ENTERPRISE', type: '月度账单',   amount: 2000,  paidAt: '2026-03-01', method: 'Wire Transfer', invoice: 'INV-2026-03-124', status: 'paid' },
    { id: 125, scope: 'org',  scopeId: 1, plan: 'ENTERPRISE', type: '月度账单',   amount: 2000,  paidAt: '2026-02-01', method: 'Wire Transfer', invoice: 'INV-2026-02-125', status: 'paid' },

    // Add-on 账单
    { id: 200, scope: 'org',  scopeId: 3, plan: 'TEAM',       type: 'Add-on · Amazon 批量创编', amount: 39, paidAt: '2025-09-01', method: 'Wire Transfer', invoice: 'INV-2025-09-201', status: 'paid' },
    { id: 201, scope: 'org',  scopeId: 3, plan: 'TEAM',       type: 'Add-on · 达人营销标签',    amount: 19, paidAt: '2025-09-01', method: 'Wire Transfer', invoice: 'INV-2025-09-202', status: 'paid' },
    { id: 202, scope: 'org',  scopeId: 3, plan: 'TEAM',       type: 'Add-on · 积分包 · 1,000',  amount: 19, paidAt: '2025-11-15', method: 'Stripe (Card)', invoice: 'INV-2025-11-202', status: 'paid' },
    { id: 210, scope: 'org',  scopeId: 1, plan: 'ENTERPRISE', type: 'Add-on · 白牌品牌',        amount: 99, paidAt: '2026-06-01', method: 'Wire Transfer', invoice: 'INV-2026-06-210', status: 'paid' }
];

/* ===== 组织 ===== */
const ORGANIZATIONS = [
    { id: 1, name: '钛动科技',   ownerId: 1, plan: 'ENTERPRISE', createdAt: '2024-01-01' },
    { id: 2, name: '张三工作室', ownerId: 1, plan: 'PRO',        createdAt: '2024-08-01' },
    { id: 3, name: '创意公司',   ownerId: 3, plan: 'TEAM',       createdAt: '2024-09-01' }
];

/* ===== 组织用量（Agent 积分 / 广告花费 / 工作空间等）===== */
const ORG_USAGE = {
    1: { seats: 3,  credits: 4800,  creditsLimit: 7000,   adSpend: 18400, adSpendLimit: 50000,  workspaces: 2, workspacesLimit: 3  },  // Pro
    2: { seats: 3,  credits: 3200,  creditsLimit: 7000,   adSpend: 12800, adSpendLimit: 50000,  workspaces: 1, workspacesLimit: 3  },  // Pro
    3: { seats: 8,  credits: 11200, creditsLimit: 35000,  adSpend: 128000, adSpendLimit: 500000, workspaces: 3, workspacesLimit: 10 }   // Team
};

/* ===== 辅助函数 ===== */
function getPlan(key) {
    return SUBSCRIPTION_PLANS[key] || SUBSCRIPTION_PLANS.FREE;
}

function getCurrentOrg() {
    return ORGANIZATIONS.find(o => o.id === CURRENT_CONTEXT.orgId);
}

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
