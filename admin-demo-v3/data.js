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

/* ===== 套餐定义 ===== */
const SUBSCRIPTION_PLANS = {
    FREE: {
        key: 'FREE',
        name: '免费版',
        price: 0,
        priceUnit: '永久免费',
        priceDesc: '适合个人尝鲜',
        limits: { maxOrgs: 0, maxWorkspaces: 1, maxMembers: 1, platforms: ['meta', 'google'] },
        highlights: ['1 个个人工作空间', '仅自己使用', '接入 Meta + Google', 'Dashboard + BI 基础报表']
    },
    STARTER: {
        key: 'STARTER',
        name: '入门版',
        price: 99,
        originalPrice: 129,
        priceUnit: '¥99 / 月',
        priceDesc: '适合小团队启动',
        limits: { maxOrgs: 1, maxWorkspaces: 3, maxMembers: 5, platforms: ['meta', 'google', 'tiktok'] },
        highlights: ['可创建 1 个组织', '3 个工作空间', '最多邀请 5 名成员', '接入 Meta / Google / TikTok']
    },
    PRO: {
        key: 'PRO',
        name: '专业版',
        price: 299,
        originalPrice: 399,
        priceUnit: '¥299 / 月',
        priceDesc: '适合成长型团队',
        limits: { maxOrgs: 3, maxWorkspaces: 10, maxMembers: 20, platforms: ['meta', 'google', 'tiktok', 'snapchat'] },
        highlights: ['最多 3 个组织', '10 个工作空间', '最多 20 名成员', '解锁 Snapchat 平台']
    },
    ENTERPRISE: {
        key: 'ENTERPRISE',
        name: '企业版',
        price: -1,
        originalPrice: null,
        priceUnit: '联系销售',
        priceDesc: '适合大型企业',
        limits: { maxOrgs: -1, maxWorkspaces: -1, maxMembers: -1, platforms: ['*'] },
        highlights: ['不限组织数量', '不限工作空间', '不限成员人数', '接入全部广告平台', '专属客户成功经理']
    }
};

/* ===== 用户个人套餐 ===== */
const USER_SUBSCRIPTIONS = [
    { userId: 1, plan: 'PRO', startDate: '2025-09-01', expireDate: '2026-09-01', autoRenew: true },
    { userId: 2, plan: 'STARTER', startDate: '2025-12-01', expireDate: '2026-12-01', autoRenew: true },
    { userId: 3, plan: 'PRO', startDate: '2025-08-15', expireDate: '2026-08-15', autoRenew: false },
    { userId: 4, plan: 'FREE', startDate: '2024-04-01', expireDate: null, autoRenew: false },
    { userId: 5, plan: 'FREE', startDate: '2024-05-01', expireDate: null, autoRenew: false },
    { userId: 6, plan: 'FREE', startDate: '2024-06-01', expireDate: null, autoRenew: false },
    { userId: 7, plan: 'FREE', startDate: '2024-07-01', expireDate: null, autoRenew: false }
];

/* ===== 组织套餐 ===== */
const ORG_SUBSCRIPTIONS = [
    { orgId: 1, plan: 'ENTERPRISE', startDate: '2024-01-01', expireDate: '2027-01-01', autoRenew: true, contractAmount: 50000 },
    { orgId: 2, plan: 'STARTER', startDate: '2025-08-01', expireDate: '2026-08-01', autoRenew: true },
    { orgId: 3, plan: 'PRO', startDate: '2025-09-01', expireDate: '2026-09-01', autoRenew: true }
];

/* ===== 账单 ===== */
const BILLING_RECORDS = [
    { id: 1, scope: 'user', scopeId: 1, plan: 'PRO', type: '续费', amount: 299, paidAt: '2025-09-01', method: '微信支付', invoice: 'INV-2025-09-001', status: 'paid' },
    { id: 2, scope: 'user', scopeId: 1, plan: 'PRO', type: '初次订阅', amount: 299, paidAt: '2024-09-01', method: '支付宝', invoice: 'INV-2024-09-001', status: 'paid' },
    { id: 10, scope: 'user', scopeId: 3, plan: 'PRO', type: '续费', amount: 299, paidAt: '2025-08-15', method: '信用卡', invoice: 'INV-2025-08-015', status: 'paid' },
    { id: 20, scope: 'user', scopeId: 2, plan: 'STARTER', type: '初次订阅', amount: 99, paidAt: '2025-12-01', method: '微信支付', invoice: 'INV-2025-12-001', status: 'paid' },
    { id: 100, scope: 'org', scopeId: 2, plan: 'STARTER', type: '续费', amount: 99, paidAt: '2025-08-01', method: '微信支付', invoice: 'INV-2025-08-100', status: 'paid' },
    { id: 101, scope: 'org', scopeId: 2, plan: 'STARTER', type: '初次订阅', amount: 99, paidAt: '2024-08-01', method: '微信支付', invoice: 'INV-2024-08-100', status: 'paid' },
    { id: 110, scope: 'org', scopeId: 3, plan: 'PRO', type: '续费', amount: 299, paidAt: '2025-09-01', method: '对公转账', invoice: 'INV-2025-09-110', status: 'paid' },
    { id: 111, scope: 'org', scopeId: 3, plan: 'PRO', type: '从 STARTER 升级', amount: 200, paidAt: '2024-12-01', method: '对公转账', invoice: 'INV-2024-12-111', status: 'paid' },
    { id: 112, scope: 'org', scopeId: 3, plan: 'STARTER', type: '初次订阅', amount: 99, paidAt: '2024-09-01', method: '对公转账', invoice: 'INV-2024-09-112', status: 'paid' },
    { id: 120, scope: 'org', scopeId: 1, plan: 'ENTERPRISE', type: '年度合同', amount: 50000, paidAt: '2024-01-01', method: '对公转账', invoice: 'INV-2024-01-120', status: 'paid' },
    { id: 121, scope: 'org', scopeId: 1, plan: 'ENTERPRISE', type: '月度账单', amount: 4999, paidAt: '2026-06-01', method: '对公账户', invoice: 'INV-2026-06-121', status: 'paid' },
    { id: 122, scope: 'org', scopeId: 1, plan: 'ENTERPRISE', type: '月度账单', amount: 4999, paidAt: '2026-05-01', method: '对公账户', invoice: 'INV-2026-05-122', status: 'paid' },
    { id: 123, scope: 'org', scopeId: 1, plan: 'ENTERPRISE', type: '月度账单', amount: 4999, paidAt: '2026-04-01', method: '对公账户', invoice: 'INV-2026-04-123', status: 'paid' },
    { id: 124, scope: 'org', scopeId: 1, plan: 'ENTERPRISE', type: '月度账单', amount: 4999, paidAt: '2026-03-01', method: '对公账户', invoice: 'INV-2026-03-124', status: 'paid' },
    { id: 125, scope: 'org', scopeId: 1, plan: 'ENTERPRISE', type: '月度账单', amount: 4999, paidAt: '2026-02-01', method: '对公账户', invoice: 'INV-2026-02-125', status: 'paid' }
];

/* ===== 用户 ===== */
const USERS = [
    { id: 1, name: '张三', email: 'zhangsan@example.com', personalPlan: 'PRO', registeredAt: '2024-01-01', disabled: false },
    { id: 2, name: '李四', email: 'lisi@example.com', personalPlan: 'STARTER', registeredAt: '2024-02-01', disabled: false },
    { id: 3, name: 'David', email: 'david@tec-do.com', personalPlan: 'PRO', registeredAt: '2024-03-01', disabled: false },
    { id: 4, name: 'Grace', email: 'grace@example.com', personalPlan: 'FREE', registeredAt: '2024-04-01', disabled: false },
    { id: 5, name: '王五', email: 'wangwu@example.com', personalPlan: 'FREE', registeredAt: '2024-05-01', disabled: false },
    { id: 6, name: '小王', email: 'xiaowang@example.com', personalPlan: 'FREE', registeredAt: '2024-06-01', disabled: false },
    { id: 7, name: 'Kiki', email: 'kiki@tec-do.com', personalPlan: 'FREE', registeredAt: '2024-07-01', disabled: false }
];

/* ===== 组织 ===== */
const ORGANIZATIONS = [
    { id: 1, name: '钛动科技', ownerId: 1, plan: 'ENTERPRISE', createdAt: '2024-01-01' },
    { id: 2, name: '张三工作室', ownerId: 1, plan: 'STARTER', createdAt: '2024-08-01' },
    { id: 3, name: '创意公司', ownerId: 3, plan: 'PRO', createdAt: '2024-09-01' }
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

/* ===== 组织用量（示例） ===== */
const ORG_USAGE = {
    1: { seats: 23, seatsLimit: 50, aiTokens: 2400000, aiTokensLimit: 5000000, storage: 12, storageLimit: 50 },
    2: { seats: 3, seatsLimit: 10, aiTokens: 800000, aiTokensLimit: 1000000, storage: 2, storageLimit: 10 },
    3: { seats: 8, seatsLimit: 20, aiTokens: 1500000, aiTokensLimit: 3000000, storage: 5, storageLimit: 20 }
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
