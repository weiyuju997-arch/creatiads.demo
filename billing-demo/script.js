/**
 * Billing Demo - 套餐与积分（从 admin-demo-v3 拆出）
 *
 * 只保留 billing 相关的渲染 + 升级流程，不含权限/成员/空间等内容。
 */

/* ============================================ */
/* ===== 状态 ===== */
/* ============================================ */
let currentPage = 'overview';           // 'overview' | 'history'
let selectedBillingCycle = 'monthly';   // 'monthly' | 'yearly'
let pendingUpgradePlan = null;

/* ============================================ */
/* ===== 初始化 ===== */
/* ============================================ */
document.addEventListener('DOMContentLoaded', () => {
    initOrgSelector();
    initUserSwitcher();
    navigateTo('overview');
    setupEmbeddedMode();
});

/**
 * 嵌入式模式：当作为 iframe 被父页面加载时
 * - 隐藏顶部"当前组织"选择器（由父页面统一控制）
 * - 监听父页面的组织切换消息
 */
function setupEmbeddedMode() {
    const isEmbedded = window.parent && window.parent !== window;
    if (!isEmbedded) return;

    // 打上嵌入模式标记，由 CSS 统一处理布局差异
    document.body.classList.add('is-embedded');

    window.addEventListener('message', (event) => {
        const data = event.data || {};
        if (data.type === 'creatiads-switch-org' && data.orgId != null) {
            switchOrg(data.orgId);
        }
    });
}

function initOrgSelector() {
    const selector = document.getElementById('orgSelector');
    if (!selector) return;
    selector.innerHTML = ORGANIZATIONS.map(org =>
        `<option value="${org.id}" ${org.id === CURRENT_CONTEXT.orgId ? 'selected' : ''}>${org.name}</option>`
    ).join('');
}

function initUserSwitcher() {
    const selector = document.getElementById('userSwitcher');
    if (!selector) return;
    // 演示用简化：仅列出组织所有者作为可切用户候选（避免依赖 USERS 表）
    const options = ORGANIZATIONS.map(o => `<option value="${o.id}">${o.name}</option>`);
    selector.innerHTML = options.join('');
}

function switchOrg(orgId) {
    CURRENT_CONTEXT.orgId = parseInt(orgId);
    refreshCurrentPage();
}

function switchUser(orgId) {
    // demo 模式下 switchUser 也用作 org 切换
    switchOrg(orgId);
    initOrgSelector();
}

function refreshCurrentPage() {
    if (currentPage === 'overview') renderOverviewPage();
    else if (currentPage === 'history') renderHistoryPage();
}

/* ============================================ */
/* ===== 导航 ===== */
/* ============================================ */
function navigateTo(page) {
    currentPage = page;

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });

    document.querySelectorAll('.page-content').forEach(p => {
        p.classList.remove('active');
        p.style.display = 'none';
    });

    const pageMap = {
        overview: 'overviewPage',
        history:  'historyPage'
    };
    const el = document.getElementById(pageMap[page]);
    if (el) {
        el.classList.add('active');
        el.style.display = '';
    }
    refreshCurrentPage();
}

/* ============================================ */
/* ===== 概览页 ===== */
/* ============================================ */
function renderOverviewPage() {
    renderBillingPlanCard();
    renderBillingUsage();
    renderPlanComparison();
    renderAddons();
}

function renderBillingPlanCard() {
    const org = getCurrentOrg();
    if (!org) return;

    const sub = ORG_SUBSCRIPTIONS.find(s => s.orgId === org.id);
    if (!sub) return;

    const plan = getPlan(sub.plan);

    const cycle = sub.billingCycle || 'monthly';
    const currentPrice = cycle === 'yearly' ? plan.priceYearly : plan.price;
    const priceLabel = plan.price === 0
        ? 'Free forever'
        : (plan.price === -1
            ? plan.priceUnit
            : `$${currentPrice} / month${cycle === 'yearly' ? '（年付）' : ''}`);

    // 已是顶配（Enterprise）时不显示升级按钮
    const isTopTier = plan.key === 'ENTERPRISE';
    // 推荐下一档：FREE → PRO, PRO → TEAM, TEAM → ENTERPRISE
    const nextTierMap = { FREE: 'PRO', PRO: 'TEAM', TEAM: 'ENTERPRISE' };
    const nextKey = nextTierMap[plan.key];
    const nextPlan = nextKey ? SUBSCRIPTION_PLANS[nextKey] : null;
    const upgradeBtnText = nextPlan ? `升级到 ${nextPlan.name}` : '升级套餐';

    document.getElementById('billingPlanCard').innerHTML = `
        <div class="billing-plan-header">
            <div>
                <div class="billing-plan-name">${plan.name}</div>
                <div class="billing-plan-meta">到期时间: ${sub.expireDate || '永久'} · ${priceLabel}</div>
            </div>
            ${isTopTier ? '' : `<button class="btn-plan-upgrade" onclick="openUpgradeModal('${nextKey}')">${upgradeBtnText}</button>`}
        </div>
    `;
}

function renderBillingUsage() {
    const org = getCurrentOrg();
    if (!org) return;

    const usage = ORG_USAGE[org.id] || { seats: 0, credits: 0, creditsLimit: 100, workspaces: 0, workspacesLimit: 1 };
    const sub = ORG_SUBSCRIPTIONS.find(s => s.orgId === org.id);
    const plan = sub ? getPlan(sub.plan) : null;
    const cycle = sub?.billingCycle || 'monthly';
    const monthlyPrice = plan && plan.price > 0
        ? (cycle === 'yearly' ? plan.priceYearly : plan.price)
        : 0;

    const fmt = (n) => n === -1 ? '∞' : n.toLocaleString();

    const creditsPercent = usage.creditsLimit === -1 ? 0 : (usage.credits / usage.creditsLimit * 100);
    const creditsUnlimited = usage.creditsLimit === -1;
    const creditsWarn = !creditsUnlimited && creditsPercent > 80;
    const creditsBarColor = creditsWarn ? '#ef4444' : '#14b8a6';
    const creditsHint = creditsUnlimited
        ? '无限调用'
        : (creditsWarn ? '即将用完，可购买积分包' : `已使用 ${Math.round(creditsPercent)}%`);
    const creditsHintColor = creditsWarn ? '#ef4444' : '#6b7280';

    const wsPercent = usage.workspacesLimit === -1 ? 0 : (usage.workspaces / usage.workspacesLimit * 100);
    const wsUnlimited = usage.workspacesLimit === -1;

    document.getElementById('billingUsageGrid').innerHTML = `
        <div class="usage-card">
            <div class="usage-card-head">
                <span class="usage-card-icon" style="background:#ecfdf5;color:#059669;">●</span>
                <span class="usage-card-label">本月 Agent 积分</span>
            </div>
            <div class="usage-card-value">${fmt(usage.credits)} <span class="usage-card-limit">/ ${fmt(usage.creditsLimit)}</span></div>
            ${creditsUnlimited ? '' : `<div class="usage-card-bar"><div class="usage-card-bar-fill" style="width:${Math.min(creditsPercent, 100)}%;background:${creditsBarColor};"></div></div>`}
            <div class="usage-card-hint" style="color:${creditsHintColor};">${creditsHint}</div>
        </div>
        <div class="usage-card">
            <div class="usage-card-head">
                <span class="usage-card-icon" style="background:#eff6ff;color:#2563eb;">●</span>
                <span class="usage-card-label">工作空间</span>
            </div>
            <div class="usage-card-value">${fmt(usage.workspaces)} <span class="usage-card-limit">/ ${fmt(usage.workspacesLimit)}</span></div>
            ${wsUnlimited ? '' : `<div class="usage-card-bar"><div class="usage-card-bar-fill" style="width:${Math.min(wsPercent, 100)}%;background:#2563eb;"></div></div>`}
            <div class="usage-card-hint">席位不限</div>
        </div>
        <div class="usage-card">
            <div class="usage-card-head">
                <span class="usage-card-icon" style="background:#fef3c7;color:#d97706;">●</span>
                <span class="usage-card-label">本月账单</span>
            </div>
            <div class="usage-card-value">${monthlyPrice > 0 ? '$' + monthlyPrice.toLocaleString() : 'Free'}</div>
            <div class="usage-card-hint">${cycle === 'yearly' ? '年付月均 · 不含 Add-on' : '月付 · 不含 Add-on'}</div>
        </div>
    `;
}

function renderPlanComparison() {
    const org = getCurrentOrg();
    if (!org) return;

    const sub = ORG_SUBSCRIPTIONS.find(s => s.orgId === org.id);
    const currentPlanKey = sub?.plan || 'FREE';

    const planKeys = ['FREE', 'PRO', 'TEAM', 'ENTERPRISE'];
    const container = document.getElementById('planComparison');
    const currentIdx = planKeys.indexOf(currentPlanKey);

    container.innerHTML = planKeys.map((key, idx) => {
        const plan = SUBSCRIPTION_PLANS[key];
        const isCurrent = key === currentPlanKey;
        const isRecommended = plan.recommended === true;
        const isEnterprise = key === 'ENTERPRISE';
        const isLower = idx < currentIdx;   // 位阶低于当前 → 降级

        const displayPrice = plan.price;
        const priceMain = isEnterprise
            ? 'Custom'
            : (displayPrice === 0 ? '$0' : '$' + displayPrice);
        const priceUnit = isEnterprise ? '' : '<span class="plan-price-unit">/month</span>';

        let originalPriceHtml = '';
        if (!isEnterprise && plan.originalPrice && plan.originalPrice > plan.price) {
            originalPriceHtml = `<span class="plan-original-price">$${plan.originalPrice}/month</span>`;
        }

        let actionHtml;
        if (isCurrent) {
            actionHtml = '<button class="plan-action-btn plan-action-current" disabled>当前套餐</button>';
        } else {
            let btnText;
            if (isEnterprise) {
                btnText = '联系销售';
            } else if (isLower) {
                btnText = `降级到 ${plan.name}`;
            } else {
                btnText = `升级到 ${plan.name}`;
            }
            const btnClass = isRecommended ? 'plan-action-btn plan-action-primary' : 'plan-action-btn plan-action-outline';
            actionHtml = `<button class="${btnClass}" onclick="openUpgradeModal('${key}')">${btnText}</button>`;
        }

        const credits = plan.limits.creditsMonthly;
        const creditsLine = isEnterprise
            ? `${credits.toLocaleString()}+ 积分 · 定制方案`
            : `${credits.toLocaleString()} 积分 · 随时取消`;

        const recommendBadge = isRecommended
            ? '<div class="plan-recommend-badge">75% 的用户升级到此套餐</div>'
            : '';

        return `
            <div class="plan-card-v2 ${isCurrent ? 'is-current' : ''} ${isRecommended ? 'is-recommended' : ''}">
                ${recommendBadge}
                <div class="plan-card-top">
                    <div class="plan-card-name-row">
                        <span class="plan-card-name">${plan.name}</span>
                    </div>
                    <div class="plan-card-price-row">
                        <span class="plan-card-price">${priceMain}</span>${priceUnit}
                        ${originalPriceHtml}
                    </div>
                </div>
                <div class="plan-card-cta">
                    ${actionHtml}
                </div>
                <div class="plan-card-credits">${creditsLine}</div>
                <div class="plan-card-features-title">包含内容：</div>
                <ul class="plan-card-features">
                    ${plan.highlights.map(h => '<li>' + h + '</li>').join('')}
                </ul>
            </div>
        `;
    }).join('');
}

function renderAddons() {
    const container = document.getElementById('addonGrid');
    if (!container) return;

    const org = getCurrentOrg();
    const sub = org ? ORG_SUBSCRIPTIONS.find(s => s.orgId === org.id) : null;
    const currentPlanKey = sub?.plan || 'FREE';

    container.innerHTML = Object.values(ADDONS).map(addon => {
        const isAvailable = addon.availableFor.includes(currentPlanKey);
        return `
            <div class="addon-card ${isAvailable ? '' : 'addon-locked'}">
                <div class="addon-icon">${addon.icon}</div>
                <div class="addon-body">
                    <div class="addon-name">${addon.name}</div>
                    <div class="addon-desc">${addon.desc}</div>
                    <div class="addon-price">${addon.priceUnit}</div>
                </div>
                <div class="addon-action">
                    ${isAvailable
                        ? '<button class="btn btn-secondary btn-sm" onclick="alert(\'加购 ' + addon.name + ' - Demo\')">加购</button>'
                        : '<span class="addon-locked-tag">需升级到 ' + addon.availableFor[0] + '</span>'
                    }
                </div>
            </div>
        `;
    }).join('');
}

/* ============================================ */
/* ===== 账单历史页 ===== */
/* ============================================ */
function renderHistoryPage() {
    const org = getCurrentOrg();
    if (!org) return;

    const records = BILLING_RECORDS
        .filter(r => r.scope === 'org' && r.scopeId === org.id)
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt));

    const tbody = document.getElementById('billingTableBody');
    if (!tbody) return;

    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty-state">暂无账单记录</td></tr>';
        return;
    }

    tbody.innerHTML = records.map(r => {
        const statusClass = r.status === 'paid' ? 'status-paid' : 'status-pending';
        const statusText = r.status === 'paid' ? '已支付' : r.status;
        return '<tr>' +
            '<td>' + r.paidAt.substring(0, 7) + '</td>' +
            '<td>' + (r.type || '-') + '</td>' +
            '<td>$' + r.amount.toLocaleString() + '</td>' +
            '<td>' + r.method + '</td>' +
            '<td><span class="billing-status ' + statusClass + '">' + statusText + '</span></td>' +
            '<td><button class="btn-link" onclick="alert(\'下载发票 - Demo\')">下载发票</button></td>' +
            '</tr>';
    }).join('');
}

/* ============================================ */
/* ===== 升级套餐弹窗 ===== */
/* ============================================ */
function openUpgradeModal(planKey) {
    const targetPlan = SUBSCRIPTION_PLANS[planKey];
    pendingUpgradePlan = planKey;

    const modal = document.getElementById('upgradeModal');
    const isContactSales = planKey === 'ENTERPRISE';

    const confirmBtn = document.getElementById('upgradeConfirmBtn');

    // Enterprise 走「联系销售」表单流
    if (isContactSales) {
        modal.classList.add('is-contact-sales');
        document.getElementById('upgradeModalTitle').textContent = '联系销售';
        if (confirmBtn) confirmBtn.textContent = '提交';
        document.getElementById('upgradeModalBody').innerHTML = `
            <div class="form-group">
                <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px 16px;margin-bottom:16px;">
                    <div style="font-size:13px;color:#1e40af;">
                        感兴趣的套餐：<strong style="color:#1d4ed8;">Enterprise</strong> · ${targetPlan.aiLevel || ''}
                    </div>
                    <div style="font-size:12px;color:#4b5563;margin-top:6px;">
                        留下你的联系方式，我们的销售顾问会在 1 个工作日内主动联系你，为你定制方案与报价。
                    </div>
                </div>
            </div>
            <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="form-group">
                    <label>姓名 <span style="color:#ef4444;">*</span></label>
                    <input type="text" class="form-input" id="salesName" placeholder="请输入你的姓名">
                </div>
                <div class="form-group">
                    <label>公司</label>
                    <input type="text" class="form-input" id="salesCompany" placeholder="公司/团队名称">
                </div>
            </div>
            <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="form-group">
                    <label>邮箱 <span style="color:#ef4444;">*</span></label>
                    <input type="email" class="form-input" id="salesEmail" placeholder="name@company.com">
                </div>
                <div class="form-group">
                    <label>电话 <span style="color:#ef4444;">*</span></label>
                    <input type="tel" class="form-input" id="salesPhone" placeholder="+86 138 0000 0000">
                </div>
            </div>
            <div class="form-group">
                <label>月广告花费预估</label>
                <select class="form-input" id="salesAdSpend">
                    <option value="">请选择</option>
                    <option>&lt; $50K</option>
                    <option>$50K - $200K</option>
                    <option>$200K - $500K</option>
                    <option>$500K - $1M</option>
                    <option>&gt; $1M</option>
                </select>
            </div>
            <div class="form-group">
                <label>需求说明</label>
                <textarea class="form-input" id="salesNote" rows="3" placeholder="简单描述你的团队规模、主要广告平台、期望的功能..."></textarea>
            </div>
        `;
        modal.style.display = 'flex';
        return;
    }

    // 常规升级/降级流
    modal.classList.remove('is-contact-sales');
    if (confirmBtn) confirmBtn.textContent = '确认支付';

    const org = getCurrentOrg();
    const sub = org ? ORG_SUBSCRIPTIONS.find(s => s.orgId === org.id) : null;
    const currentPlanKey = sub?.plan || 'FREE';
    const planKeys = ['FREE', 'PRO', 'TEAM', 'ENTERPRISE'];
    const isDowngrade = planKeys.indexOf(planKey) < planKeys.indexOf(currentPlanKey);
    const actionWord = isDowngrade ? '降级' : '升级';

    document.getElementById('upgradeModalTitle').textContent = `${actionWord}到 ${targetPlan.name}`;

    const priceText = targetPlan.price === 0
        ? 'Free forever'
        : `$${targetPlan.price} / month`;

    document.getElementById('upgradeModalBody').innerHTML = `
        <div class="form-group">
            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:16px;">
                <div style="font-size:14px;color:#1e40af;margin-bottom:8px;">目标套餐 · ${targetPlan.aiLevel || ''}</div>
                <div style="font-size:24px;font-weight:700;color:#1d4ed8;">${targetPlan.name}</div>
                <div style="font-size:18px;color:#2563eb;margin-top:4px;">${priceText}</div>
            </div>
        </div>
        <div class="form-group">
            <label>套餐权益</label>
            <ul class="plan-features" style="border:1px solid #e5e7eb;border-radius:6px;padding:12px;">
                ${targetPlan.highlights.map(h => `<li>${h}</li>`).join('')}
            </ul>
        </div>
        ${targetPlan.price > 0 ? `
            <div class="form-group">
                <label>支付方式</label>
                <select class="form-input">
                    <option>Stripe (Credit Card)</option>
                    <option>PayPal</option>
                    <option>Wire Transfer</option>
                </select>
            </div>
        ` : ''}
    `;

    modal.style.display = 'flex';
}

function closeUpgradeModal() {
    document.getElementById('upgradeModal').style.display = 'none';
    pendingUpgradePlan = null;
}

function confirmUpgrade() {
    if (!pendingUpgradePlan) return;

    // Enterprise 走联系销售流程：校验表单，提交后 toast
    if (pendingUpgradePlan === 'ENTERPRISE') {
        const name = document.getElementById('salesName')?.value.trim();
        const email = document.getElementById('salesEmail')?.value.trim();
        const phone = document.getElementById('salesPhone')?.value.trim();
        if (!name) {
            alert('请填写姓名');
            return;
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            alert('请填写正确的邮箱');
            return;
        }
        if (!phone || phone.replace(/[\s\-+()]/g, '').length < 7) {
            alert('请填写正确的电话');
            return;
        }
        // Demo：只提示，不真的发请求
        closeUpgradeModal();
        alert('已提交，销售顾问会在 1 个工作日内联系你');
        return;
    }

    // 常规升级/降级：直接切换套餐 + 补账单记录
    const org = getCurrentOrg();
    const sub = ORG_SUBSCRIPTIONS.find(s => s.orgId === org.id);
    if (sub) {
        sub.plan = pendingUpgradePlan;
        sub.startDate = new Date().toISOString().split('T')[0];
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        sub.expireDate = nextYear.toISOString().split('T')[0];
    }
    org.plan = pendingUpgradePlan;

    const plan = SUBSCRIPTION_PLANS[pendingUpgradePlan];
    if (plan.price > 0) {
        const newId = Math.max(...BILLING_RECORDS.map(r => r.id)) + 1;
        BILLING_RECORDS.push({
            id: newId,
            scope: 'org',
            scopeId: org.id,
            plan: pendingUpgradePlan,
            type: '订阅',
            amount: plan.price,
            paidAt: new Date().toISOString().split('T')[0],
            method: 'Stripe (Credit Card)',
            invoice: `INV-${Date.now()}`,
            status: 'paid'
        });
    }

    closeUpgradeModal();
    refreshCurrentPage();
    alert(`已切换到 ${plan.name}！`);
}
