/**
 * Admin Demo v3 - 数据模型（极简版）
 * 
 * 核心设计：
 * - 两级固定角色（不可自定义）
 *   - 企业角色：Admin（管理员）/ Member（成员）
 *   - 空间角色：Owner / Editor / Viewer
 * - 工作空间 = 项目，是权限隔离的核心
 * - 权限叠加：企业 Admin 自动拥有所有空间的最高权限
 */

/* ===== 演示用：当前登录用户 ===== */
let CURRENT_USER_ID = 1;

/* ===== 演示用：当前上下文 ===== */
let CURRENT_CONTEXT = { type: 'org', orgId: 1 };

/* ===== 套餐定义（v3 · 精简版 · 4 档 · AI 能力分层） =====
 * 设计原则：
 *   - 4 档主套餐（Free / Pro / Team / Enterprise），USD 计价
 *   - 分层核心：AI 能力（Chat → 分析 → 执行）+ 是否支持组织
 *   - 无席位限制、无平台限制（对齐用户反馈）
 *   - 按月广告花费分档限制（对标 Madgicx）
 *   - 支持月付 / 年付（年付 -20%）
 *   - Agent 使用按积分计量（不是 token）
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
        name: 'Free',
        price: 0,
        priceYearly: 0,
        priceUnit: 'Free forever',
        priceDesc: '个人尝鲜，无需信用卡',
        aiLevel: 'AI Chat + 分析',
        limits: {
            hasOrg: false,
            maxWorkspaces: 1,
            maxMembers: -1,        // 席位不限
            platforms: ['*'],      // 平台不限
            monthlyAdSpend: 5000,  // 月广告花费上限 $5K
            creditsMonthly: 200,
            dataRetentionDays: 90
        },
        highlights: [
            'AI 深度分析 + 优化建议（200 积分/月）',
            '1 个人空间 · 无组织',
            '支持 Meta、Google、TikTok 等平台媒体',
            '接入广告账户 ≤ 2 个 · 每日同步'
        ]
    },
    PRO: {
        key: 'PRO',
        name: 'Pro',
        price: 29,
        priceYearly: 23,           // -20% 年付月均
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
            monthlyAdSpend: 50000, // 月广告花费上限 $50K
            creditsMonthly: 2000,
            dataRetentionDays: -1
        },
        highlights: [
            'AI 深度分析 + 优化建议（2,000 积分/月）',
            '3 个工作空间 · 无组织',
            '支持 Meta、Google、TikTok 等平台媒体',
            '接入广告账户 ≤ 10 个 · 每日同步',
            'Agent 智能助手：报告订阅'
        ]
    },
    TEAM: {
        key: 'TEAM',
        name: 'Team',
        price: 149,
        priceYearly: 119,
        originalPrice: 199,
        priceUnit: '$149 / month',
        priceUnitYearly: '$119 / month（年付）',
        priceDesc: '成长团队、跨境 DTC、中小 Agency',
        aiLevel: 'AI Chat + 分析 + 执行操作',
        recommended: true,
        limits: {
            hasOrg: true,
            maxWorkspaces: 10,
            maxMembers: -1,
            platforms: ['*'],
            monthlyAdSpend: 500000, // 月广告花费上限 $500K
            creditsMonthly: 10000,
            dataRetentionDays: -1
        },
        highlights: [
            'AI Agent 执行操作（10,000 积分/月）',
            '组织 + 10 空间 + 数据权限',
            '支持 Meta、Google、TikTok 等平台媒体',
            '接入广告账户 ≤ 50 个 · 实时同步',
            'Agent 智能助手：一句话授权/协作/报告订阅/修改广告预算、竞价'
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
            creditsMonthly: 100000,  // 起步额度，超出按合同追加
            dataRetentionDays: -1
        },
        highlights: [
            '定制 Agent + Autopilot（100,000 积分/月起）',
            '组织 + 无限空间 + 数据权限',
            'APP Skill 接入',
            '接入广告账户不限 · 实时同步 + 专属数据管道',
            '专属客户经理 + 优先技术支持',
            '按需定价（固定月费或按量计费）'
        ]
    }
};

/* ===== 积分消耗规则（Agent 使用计量） =====
 * 展示在用量卡下方作为说明
 */
const CREDIT_RULES = [
    { action: 'Chat 简单问答',       credits: 1,  example: '"昨天消耗多少？"' },
    { action: 'Deep 分析',           credits: 3,  example: '"分析 A 计划下降原因"' },
    { action: 'Autopilot 自动触发',  credits: 2,  example: '规则命中自动执行' },
    { action: '执行操作',            credits: 5,  example: '"帮我给张三开通空间 A 的查看权限"' },
    { action: '复盘报告生成',        credits: 10, example: '"生成客户 A 本月投放复盘"' }
];

/* ===== Add-ons（客单价拉升器） =====
 * 独立售卖，主套餐门槛低 + 深度用户按需付费
 * 参考：Madgicx Tracking Pro $49、Motion AI Studio、Triple Whale Moby AI Pro
 */
const ADDONS = {
    CREDITS_TOPUP: {
        key: 'CREDITS_TOPUP',
        name: '积分增量包（一次性）',
        price: 19,
        priceUnit: '$19 / 1,000 积分',
        desc: '一次性购买，用完为止（永不过期），主套餐积分不够时补充',
        availableFor: ['FREE', 'PRO', 'TEAM'],
        icon: '⚡',
        oneTime: true
    },
    CREDITS_SUB: {
        key: 'CREDITS_SUB',
        name: '积分订阅包',
        price: 49,
        priceUnit: '$49 / month · 5,000 积分',
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

/* ===== 用户个人套餐（新版 4 档：Free/Pro/Team/Enterprise，含 billingCycle） ===== */
const USER_SUBSCRIPTIONS = [
    { userId: 1, plan: 'TEAM', billingCycle: 'yearly',  startDate: '2025-09-01', expireDate: '2026-09-01', autoRenew: true },
    { userId: 2, plan: 'PRO',  billingCycle: 'monthly', startDate: '2025-12-01', expireDate: '2026-12-01', autoRenew: true },
    { userId: 3, plan: 'TEAM', billingCycle: 'monthly', startDate: '2025-08-15', expireDate: '2026-08-15', autoRenew: false },
    { userId: 4, plan: 'FREE', billingCycle: null,      startDate: '2024-04-01', expireDate: null,        autoRenew: false },
    { userId: 5, plan: 'FREE', billingCycle: null,      startDate: '2024-05-01', expireDate: null,        autoRenew: false },
    { userId: 6, plan: 'FREE', billingCycle: null,      startDate: '2024-06-01', expireDate: null,        autoRenew: false },
    { userId: 7, plan: 'FREE', billingCycle: null,      startDate: '2024-07-01', expireDate: null,        autoRenew: false }
];

/* ===== 组织套餐 ===== */
const ORG_SUBSCRIPTIONS = [
    { orgId: 1, plan: 'ENTERPRISE', billingCycle: 'yearly',  startDate: '2024-01-01', expireDate: '2027-01-01', autoRenew: true, contractAmount: 24000 },
    { orgId: 2, plan: 'PRO',        billingCycle: 'monthly', startDate: '2025-08-01', expireDate: '2026-08-01', autoRenew: true },
    { orgId: 3, plan: 'TEAM',       billingCycle: 'yearly',  startDate: '2025-09-01', expireDate: '2026-09-01', autoRenew: true }
];

/* ===== 账单（USD 计价，对齐出海市场） ===== */
const BILLING_RECORDS = [
    // 用户订阅账单
    { id: 1,   scope: 'user', scopeId: 1, plan: 'TEAM',       type: '年付续费',   amount: 1428,  paidAt: '2025-09-01', method: 'Stripe (Visa)', invoice: 'INV-2025-09-001', status: 'paid' },
    { id: 2,   scope: 'user', scopeId: 1, plan: 'TEAM',       type: '初次订阅',   amount: 1428,  paidAt: '2024-09-01', method: 'Stripe (Visa)', invoice: 'INV-2024-09-001', status: 'paid' },
    { id: 10,  scope: 'user', scopeId: 3, plan: 'TEAM',       type: '月付续费',   amount: 149,   paidAt: '2025-08-15', method: 'PayPal',        invoice: 'INV-2025-08-015', status: 'paid' },
    { id: 20,  scope: 'user', scopeId: 2, plan: 'PRO',        type: '初次订阅',   amount: 29,    paidAt: '2025-12-01', method: 'Stripe (Card)', invoice: 'INV-2025-12-001', status: 'paid' },

    // 组织订阅账单
    { id: 100, scope: 'org',  scopeId: 2, plan: 'PRO',        type: '月付续费',   amount: 29,    paidAt: '2025-08-01', method: 'Stripe (Card)', invoice: 'INV-2025-08-100', status: 'paid' },
    { id: 101, scope: 'org',  scopeId: 2, plan: 'PRO',        type: '初次订阅',   amount: 29,    paidAt: '2024-08-01', method: 'Stripe (Card)', invoice: 'INV-2024-08-100', status: 'paid' },
    { id: 110, scope: 'org',  scopeId: 3, plan: 'TEAM',       type: '年付续费',   amount: 1428,  paidAt: '2025-09-01', method: 'Wire Transfer', invoice: 'INV-2025-09-110', status: 'paid' },
    { id: 111, scope: 'org',  scopeId: 3, plan: 'TEAM',       type: '从 PRO 升级', amount: 120,  paidAt: '2024-12-01', method: 'Stripe (Card)', invoice: 'INV-2024-12-111', status: 'paid' },
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

/* ===== 用户 ===== */
const USERS = [
    { id: 1, name: '张三',  email: 'zhangsan@example.com', personalPlan: 'TEAM',  registeredAt: '2024-01-01', disabled: false },
    { id: 2, name: '李四',  email: 'lisi@example.com',     personalPlan: 'PRO',   registeredAt: '2024-02-01', disabled: false },
    { id: 3, name: 'David', email: 'david@tec-do.com',     personalPlan: 'TEAM', registeredAt: '2024-03-01', disabled: false },
    { id: 4, name: 'Grace', email: 'grace@example.com',    personalPlan: 'FREE',  registeredAt: '2024-04-01', disabled: false },
    { id: 5, name: '王五',  email: 'wangwu@example.com',   personalPlan: 'FREE',  registeredAt: '2024-05-01', disabled: false },
    { id: 6, name: '小王',  email: 'xiaowang@example.com', personalPlan: 'FREE',  registeredAt: '2024-06-01', disabled: false },
    { id: 7, name: 'Kiki',  email: 'kiki@tec-do.com',      personalPlan: 'FREE',  registeredAt: '2024-07-01', disabled: false }
];

/* ===== 组织 ===== */
const ORGANIZATIONS = [
    { id: 1, name: '钛动科技',   ownerId: 1, plan: 'ENTERPRISE', createdAt: '2024-01-01' },
    { id: 2, name: '张三工作室', ownerId: 1, plan: 'PRO',        createdAt: '2024-08-01' },
    { id: 3, name: '创意公司',   ownerId: 3, plan: 'TEAM',       createdAt: '2024-09-01' }
];

/* ===== 用户-组织关系（企业角色 Admin / Member） ===== */
const USER_ORG_ROLES = [
    // 钛动科技
    { userId: 1, orgId: 1, orgRole: 'Admin' },    // 张三 CEO
    { userId: 2, orgId: 1, orgRole: 'Admin' },    // 李四 团队 Leader
    { userId: 3, orgId: 1, orgRole: 'Member' },   // David
    { userId: 5, orgId: 1, orgRole: 'Member' },   // 王五 优化师
    { userId: 7, orgId: 1, orgRole: 'Member' },   // Kiki 分析师
    
    // 张三工作室
    { userId: 1, orgId: 2, orgRole: 'Admin' },
    
    // 创意公司
    { userId: 3, orgId: 3, orgRole: 'Admin' },
    { userId: 1, orgId: 3, orgRole: 'Member' }
];

/* ===== 工作空间（项目） ===== */
const WORKSPACES = [
    // 个人空间
    { id: 1, orgId: null, ownerId: 1, name: '张三的个人工作区', desc: '', icon: null, iconColor: 'purple', isPersonal: true, createdAt: '2024-01-01' },
    { id: 2, orgId: null, ownerId: 2, name: '李四的个人工作区', desc: '', icon: null, iconColor: 'teal', isPersonal: true, createdAt: '2024-02-01' },
    { id: 3, orgId: null, ownerId: 3, name: 'David的个人工作区', desc: '', icon: null, iconColor: 'orange', isPersonal: true, createdAt: '2024-03-01' },
    
    // 钛动科技
    { id: 10, orgId: 1, ownerId: 1, name: '投放团队', desc: '主投放项目', icon: null, iconColor: 'purple', isPersonal: false, createdAt: '2024-01-01' },
    { id: 11, orgId: 1, ownerId: 2, name: '海外业务', desc: '海外市场投放', icon: null, iconColor: 'teal', isPersonal: false, createdAt: '2024-01-15' },
    { id: 12, orgId: 1, ownerId: 2, name: '子品牌投放', desc: '子品牌专属项目', icon: null, iconColor: 'orange', isPersonal: false, createdAt: '2024-03-01' },
    { id: 13, orgId: 1, ownerId: 2, name: '数据汇报组', desc: '老板看的汇总报告', icon: null, iconColor: 'pink', isPersonal: false, createdAt: '2024-04-01' },
    { id: 14, orgId: 1, ownerId: 5, name: '财务报表', desc: '财务数据', icon: null, iconColor: 'blue', isPersonal: false, createdAt: '2024-02-01' },
    
    // 张三工作室
    { id: 20, orgId: 2, ownerId: 1, name: '默认项目', desc: '', icon: null, iconColor: 'green', isPersonal: false, createdAt: '2024-08-01' },
    
    // 创意公司
    { id: 30, orgId: 3, ownerId: 3, name: '设计协作空间', desc: '', icon: null, iconColor: 'purple', isPersonal: false, createdAt: '2024-09-01' },
    { id: 31, orgId: 3, ownerId: 3, name: '创意项目', desc: '', icon: null, iconColor: 'pink', isPersonal: false, createdAt: '2024-09-10' }
];

/* ===== 用户-空间关系（空间角色 Owner / Editor / Viewer） ===== */
const USER_WORKSPACE_ROLES = [
    // 个人空间
    { userId: 1, workspaceId: 1, wsRole: 'Owner' },
    { userId: 2, workspaceId: 2, wsRole: 'Owner' },
    { userId: 3, workspaceId: 3, wsRole: 'Owner' },
    
    // 投放团队
    { userId: 1, workspaceId: 10, wsRole: 'Owner' },    // 张三 CEO
    { userId: 2, workspaceId: 10, wsRole: 'Owner' },    // 李四 团队 Leader
    { userId: 5, workspaceId: 10, wsRole: 'Editor' },   // 王五 优化师
    { userId: 7, workspaceId: 10, wsRole: 'Viewer' },   // Kiki 分析师
    
    // 海外业务（张三未加入，但因为是 Admin 可强制加入）
    { userId: 2, workspaceId: 11, wsRole: 'Owner' },
    
    // 子品牌投放
    { userId: 2, workspaceId: 12, wsRole: 'Owner' },
    { userId: 3, workspaceId: 12, wsRole: 'Editor' },
    
    // 数据汇报组
    { userId: 5, workspaceId: 13, wsRole: 'Viewer' },
    
    // 财务报表
    { userId: 5, workspaceId: 14, wsRole: 'Owner' },
    { userId: 1, workspaceId: 14, wsRole: 'Viewer' },
    
    // 张三工作室
    { userId: 1, workspaceId: 20, wsRole: 'Owner' },
    
    // 创意公司
    { userId: 3, workspaceId: 30, wsRole: 'Owner' },
    { userId: 1, workspaceId: 30, wsRole: 'Editor' },
    { userId: 3, workspaceId: 31, wsRole: 'Owner' },
    { userId: 1, workspaceId: 31, wsRole: 'Viewer' }
];

/* ===== 广告平台 ===== */
const PLATFORMS = [
    { key: 'meta', name: 'Meta', icon: 'M' },
    { key: 'google', name: 'Google', icon: 'G' },
    { key: 'tiktok', name: 'TikTok', icon: 'T' },
    { key: 'snapchat', name: 'Snapchat', icon: 'S' },
    { key: 'kwai', name: 'Kwai', icon: 'K' },
    { key: 'huawei', name: 'Huawei', icon: 'H' },
    { key: 'apple', name: 'Apple', icon: 'A' }
];

/* ===== 状态变量 ===== */
let currentPage = 'members';
let editingMemberId = null;
let editingWorkspaceId = null;
let viewingWorkspaceId = null;

/* ===== 空间设置（示例） ===== */
const WORKSPACE_SETTINGS = {
    10: { defaultRole: 'Editor', datasourceVisible: true, allowMemberInvite: false, allowExternalShare: true },
    11: { defaultRole: 'Viewer', datasourceVisible: true, allowMemberInvite: true, allowExternalShare: false },
    12: { defaultRole: 'Editor', datasourceVisible: false, allowMemberInvite: false, allowExternalShare: true },
    13: { defaultRole: 'Viewer', datasourceVisible: true, allowMemberInvite: false, allowExternalShare: false },
    14: { defaultRole: 'Editor', datasourceVisible: true, allowMemberInvite: false, allowExternalShare: true }
};

/* ===== 空间数据源（示例） ===== */
const WORKSPACE_DATASOURCES = [
    { id: 1, workspaceId: 10, name: '巨量账户A - 主品牌', type: '巨量引擎', status: 'normal', owner: '张三' },
    { id: 2, workspaceId: 10, name: '千川D - 全店', type: '千川', status: 'normal', owner: '李四' },
    { id: 3, workspaceId: 10, name: '淘宝旗舰店', type: '淘宝', status: 'normal', owner: '王五' },
    { id: 4, workspaceId: 10, name: '抖店主账号', type: '抖店', status: 'normal', owner: 'Kiki' },
    { id: 5, workspaceId: 11, name: 'TikTokAds - US', type: 'TikTok', status: 'normal', owner: '李四' },
    { id: 6, workspaceId: 12, name: '千川E - 子品牌', type: '千川', status: 'normal', owner: '李四' },
    { id: 7, workspaceId: 12, name: '巨量账户B - 子品牌', type: '巨量引擎', status: 'error', owner: 'David' }
];

/* ===== 空间报表/资源（示例） ===== */
const WORKSPACE_RESOURCES = [
    { id: 1, workspaceId: 10, name: 'ROI 周报', type: '看板', owner: '张三', updatedAt: '10 分钟前' },
    { id: 2, workspaceId: 10, name: '账户A消耗趋势', type: '看板', owner: '李四', updatedAt: '1 小时前' },
    { id: 3, workspaceId: 10, name: '千川投放分析', type: '分析', owner: '王五', updatedAt: '昨天' },
    { id: 4, workspaceId: 10, name: '抖音素材效果对比', type: '看板', owner: '张三', updatedAt: '2 天前' },
    { id: 5, workspaceId: 10, name: '月度汇总报表', type: '看板', owner: 'Kiki', updatedAt: '3 天前' },
    { id: 6, workspaceId: 11, name: 'TikTok US 日报', type: '看板', owner: '李四', updatedAt: '1 小时前' },
    { id: 7, workspaceId: 12, name: '子品牌 ROI 分析', type: '分析', owner: '李四', updatedAt: '昨天' }
];

/* ===== 组织用量（示例，配合新套餐口径） =====
 * 字段：
 *   seats           — 已用席位（不设上限，仅展示）
 *   credits         — 本月已用积分
 *   creditsLimit    — 每月积分额度（-1 无限）
 *   adSpend         — 本月已管理广告花费（USD）
 *   adSpendLimit    — 每月广告花费上限（-1 无限）
 *   workspaces      — 已用空间数
 *   workspacesLimit — 空间上限（-1 无限）
 */
const ORG_USAGE = {
    1: { seats: 23, credits: 42000, creditsLimit: 100000, adSpend: 4800000, adSpendLimit: -1,   workspaces: 5, workspacesLimit: -1 },  // Enterprise (积分合同定制)
    2: { seats: 3,  credits: 960,   creditsLimit: 2000,  adSpend: 12800,  adSpendLimit: 50000,  workspaces: 1, workspacesLimit: 3  },  // Pro
    3: { seats: 8,  credits: 3200,  creditsLimit: 10000, adSpend: 128000, adSpendLimit: 500000, workspaces: 3, workspacesLimit: 10 }   // Team
};


/* ============================================================
 * 数据权限模型（广告账户级）
 * ------------------------------------------------------------
 * 规则（方案 C + a + i + iii）：
 * - 归属：谁授权（OAuth）广告账户，谁就是"账户 Owner"（ownerUserId）
 * - 共享：账户 Owner 可显式共享给指定成员（AD_ACCOUNT_GRANTS）
 * - 粒度：账户级（不细化到 Campaign）
 * - 过滤：报表遇到无权限账户时，静默过滤该账户产生的数据行
 * - 管理：入口位于「空间详情 → 数据权限」tab
 *
 * 特别说明：
 * - 企业 Admin / 空间 Owner 也不能"强看"别人的私有账户，
 *   除非账户 Owner 显式共享，或删除账户后由他人重新授权。
 * ============================================================ */

/* ===== 广告账户 =====
 * ownerUserId = 授权人（授权即归属）
 */
const AD_ACCOUNTS = [
    // 投放团队（wsId 10）
    { id: 1001, platform: 'meta',    accountName: 'Meta · 品牌主账号',      accountCode: 'act_1001', ownerUserId: 1, workspaceId: 10, status: 'active',  syncedAt: '2 分钟前'  },
    { id: 1002, platform: 'meta',    accountName: 'Meta · 子品牌',          accountCode: 'act_1002', ownerUserId: 2, workspaceId: 10, status: 'active',  syncedAt: '5 分钟前'  },
    { id: 1003, platform: 'google',  accountName: 'Google Ads · 主账户',    accountCode: '123-456-7890', ownerUserId: 1, workspaceId: 10, status: 'active',  syncedAt: '10 分钟前' },
    { id: 1004, platform: 'tiktok',  accountName: 'TikTok · 全店',          accountCode: 'ttads_2001', ownerUserId: 5, workspaceId: 10, status: 'active',  syncedAt: '1 小时前'  },
    { id: 1005, platform: 'tiktok',  accountName: 'TikTok · 高端线',        accountCode: 'ttads_2002', ownerUserId: 7, workspaceId: 10, status: 'active',  syncedAt: '20 分钟前' },
    { id: 1006, platform: 'google',  accountName: 'Google Ads · 竞品 SEM',  accountCode: '234-567-8901', ownerUserId: 2, workspaceId: 10, status: 'active',  syncedAt: '30 分钟前' },

    // 海外业务（wsId 11）
    { id: 1101, platform: 'meta',    accountName: 'Meta · US Market',       accountCode: 'act_1101', ownerUserId: 2, workspaceId: 11, status: 'active',  syncedAt: '10 分钟前' },
    { id: 1102, platform: 'tiktok',  accountName: 'TikTok · US',            accountCode: 'ttads_1102', ownerUserId: 2, workspaceId: 11, status: 'active',  syncedAt: '15 分钟前' },

    // 子品牌投放（wsId 12）
    { id: 1201, platform: 'meta',    accountName: 'Meta · 子品牌线',        accountCode: 'act_1201', ownerUserId: 3, workspaceId: 12, status: 'active',  syncedAt: '5 分钟前'  },
    { id: 1202, platform: 'google',  accountName: 'Google Ads · 子品牌',    accountCode: '345-678-9012', ownerUserId: 2, workspaceId: 12, status: 'active',  syncedAt: '25 分钟前' },
];

/* ===== 广告账户显式共享（额外追加，不含"自己授权的"）=====
 * accountId × userId 表示"该用户被 Owner 额外授权访问该账户"
 * grantedBy = 授权人（一般是账户 Owner）
 * 说明：用户可见账户 = 自己授权的账户 ∪ 被额外授权的账户；
 *      当空间数据权限档位为 "all" 时，忽略此表，直接允许访问空间内全部账户。
 */
const AD_ACCOUNT_GRANTS = [
    // 李四（2）的 Meta 子品牌共享给王五（5）
    { accountId: 1002, userId: 5, grantedBy: 2, grantedAt: '2026-06-15' },

    // 王五（5）的 TikTok 全店共享给 Kiki（7）
    { accountId: 1004, userId: 7, grantedBy: 5, grantedAt: '2026-06-25' },
];

/* ===== 用户 × 空间的数据权限档位 =====
 * mode:
 *   'all'       —— 该用户在此空间下能看到全部广告账户（Owner 默认；Editor 可选）
 *   'own+extra' —— 只能看到"自己授权的账户" + AD_ACCOUNT_GRANTS 中被额外授权的
 *                （Editor 可选；Viewer 强制）
 *
 * 未在表内的用户默认按空间角色兜底：
 *   Owner  -> 'all'
 *   Editor -> 'own+extra'
 *   Viewer -> 'own+extra'
 */
const USER_WORKSPACE_DATA_PERMS = [
    // 投放团队（wsId 10）
    { userId: 1, workspaceId: 10, mode: 'all' },        // 张三是 Owner，默认 all
    { userId: 2, workspaceId: 10, mode: 'all' },        // 李四是 Owner，默认 all
    { userId: 5, workspaceId: 10, mode: 'own+extra' },  // 王五 Editor，仅自己授权 + 追加
    { userId: 7, workspaceId: 10, mode: 'own+extra' },  // Kiki Viewer

    // 海外业务（wsId 11）
    { userId: 2, workspaceId: 11, mode: 'all' },        // Owner
];

/* ===== Mock：广告账户 -> 每日聚合指标（用于面板演示行级过滤）===== */
const AD_ACCOUNT_METRICS = {
    // { spend, impressions, clicks, conversions, roas }
    1001: { spend: 128432, impressions: 4820000, clicks: 128300, conversions: 6412, roas: 3.85 },
    1002: { spend:  62145, impressions: 2140000, clicks:  58200, conversions: 2850, roas: 3.12 },
    1003: { spend: 210840, impressions: 6180000, clicks: 192400, conversions: 9210, roas: 2.98 },
    1004: { spend:  84520, impressions: 3210000, clicks:  91800, conversions: 4103, roas: 2.72 },
    1005: { spend:  45820, impressions: 1520000, clicks:  38200, conversions: 1820, roas: 3.44 },
    1006: { spend:  38210, impressions: 1180000, clicks:  22300, conversions:  912, roas: 1.68 },
    1101: { spend:  92340, impressions: 3240000, clicks:  70100, conversions: 3420, roas: 3.05 },
    1102: { spend:  54210, impressions: 2010000, clicks:  46200, conversions: 2210, roas: 2.85 },
    1201: { spend:  32410, impressions:  980000, clicks:  22400, conversions:  920, roas: 2.42 },
    1202: { spend:  41230, impressions: 1240000, clicks:  28100, conversions: 1150, roas: 2.61 },
};

/* ============================================================
 * 数据权限工具函数
 * ============================================================ */

/**
 * 获取用户在某空间的"数据权限档位"。
 * 如果表中未显式记录，则按空间角色兜底：
 *   Owner  -> 'all'
 *   Editor -> 'own+extra'
 *   Viewer -> 'own+extra'
 */
function getUserWorkspaceDataMode(userId, workspaceId) {
    const rec = USER_WORKSPACE_DATA_PERMS.find(p => p.userId === userId && p.workspaceId === workspaceId);
    if (rec) return rec.mode;

    const wsRole = getUserWorkspaceRole ? getUserWorkspaceRole(userId, workspaceId) : null;
    if (wsRole === 'Owner') return 'all';
    return 'own+extra';
}

/**
 * 设置用户在某空间的数据权限档位。
 * 空间 Owner 不允许改成非 'all'（会被 UI 层禁用；此处做兜底防护）。
 * Viewer 不允许改成 'all'。
 */
function setUserWorkspaceDataMode(userId, workspaceId, mode) {
    const wsRole = getUserWorkspaceRole ? getUserWorkspaceRole(userId, workspaceId) : null;
    if (wsRole === 'Owner') mode = 'all';
    if (wsRole === 'Viewer') mode = 'own+extra';

    const idx = USER_WORKSPACE_DATA_PERMS.findIndex(p => p.userId === userId && p.workspaceId === workspaceId);
    if (idx > -1) USER_WORKSPACE_DATA_PERMS[idx].mode = mode;
    else USER_WORKSPACE_DATA_PERMS.push({ userId, workspaceId, mode });
    return mode;
}

/** 判断用户是否能看到某个广告账户（按空间档位 + 自己授权 + 显式追加） */
function canUserAccessAdAccount(userId, accountId) {
    const acc = AD_ACCOUNTS.find(a => a.id === accountId);
    if (!acc) return false;

    // 自己 OAuth 授权的账户永远可见
    if (acc.ownerUserId === userId) return true;

    const mode = getUserWorkspaceDataMode(userId, acc.workspaceId);
    if (mode === 'all') return true;

    // 'own+extra' 模式下，仅有被显式追加授权的账户可见
    return AD_ACCOUNT_GRANTS.some(g => g.accountId === accountId && g.userId === userId);
}

/** 获取当前用户能访问的、指定空间下的所有账户 */
function getAccessibleAdAccounts(userId, workspaceId) {
    return AD_ACCOUNTS.filter(a =>
        (workspaceId == null || a.workspaceId === workspaceId) &&
        canUserAccessAdAccount(userId, a.id)
    );
}

/** 用户在某空间被追加授权的账户 ID 列表（不含"自己授权的"） */
function getUserExtraGrantedAccountIds(userId, workspaceId) {
    return AD_ACCOUNTS
        .filter(a => a.workspaceId === workspaceId && a.ownerUserId !== userId)
        .filter(a => AD_ACCOUNT_GRANTS.some(g => g.accountId === a.id && g.userId === userId))
        .map(a => a.id);
}

/** 覆盖某用户在空间的"追加授权账户"（先删后加）*/
function setUserExtraGrantedAccounts(userId, workspaceId, accountIds) {
    const set = new Set(accountIds);
    // 先删除该用户在该空间下的所有 grants
    for (let i = AD_ACCOUNT_GRANTS.length - 1; i >= 0; i--) {
        const g = AD_ACCOUNT_GRANTS[i];
        const acc = AD_ACCOUNTS.find(a => a.id === g.accountId);
        if (g.userId === userId && acc && acc.workspaceId === workspaceId) {
            AD_ACCOUNT_GRANTS.splice(i, 1);
        }
    }
    // 重新写入
    const today = new Date().toISOString().slice(0, 10);
    set.forEach(accountId => {
        AD_ACCOUNT_GRANTS.push({ accountId, userId, grantedBy: CURRENT_USER_ID, grantedAt: today });
    });
}
