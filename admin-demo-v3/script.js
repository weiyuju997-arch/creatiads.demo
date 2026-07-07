/**
 * Admin Demo v3 - 业务逻辑（简化权限版）
 *
 * 功能模块：
 * 1. 成员管理（含批量操作）
 * 2. 空间管理（含空间详情）
 * 3. 订阅与计费（从 v2 迁移）
 * 4. 权限预览
 */

/* ============================================ */
/* ===== 工具函数 ===== */
/* ============================================ */
function getUser(userId) {
    return USERS.find(u => u.id === userId);
}

function getOrg(orgId) {
    return ORGANIZATIONS.find(o => o.id === orgId);
}

function getWorkspace(wsId) {
    return WORKSPACES.find(w => w.id === wsId);
}

function getPlan(planKey) {
    return SUBSCRIPTION_PLANS[planKey];
}

function getCurrentUser() {
    return getUser(CURRENT_USER_ID);
}

function getCurrentOrg() {
    return CURRENT_CONTEXT.orgId ? getOrg(CURRENT_CONTEXT.orgId) : null;
}

function getUserOrgRole(userId, orgId) {
    const rel = USER_ORG_ROLES.find(r => r.userId === userId && r.orgId === orgId);
    return rel?.orgRole || null;
}

function getUserWorkspaceRole(userId, workspaceId) {
    const rel = USER_WORKSPACE_ROLES.find(r => r.userId === userId && r.workspaceId === workspaceId);
    return rel?.wsRole || null;
}

function isOrgAdmin(userId, orgId) {
    return getUserOrgRole(userId, orgId) === 'Admin';
}

function getOrgMembers(orgId) {
    return USER_ORG_ROLES
        .filter(r => r.orgId === orgId)
        .map(r => {
            const user = getUser(r.userId);
            return { ...user, orgRole: r.orgRole };
        });
}

function getOrgWorkspaces(orgId) {
    return WORKSPACES.filter(w => w.orgId === orgId);
}

function getWorkspaceMembers(wsId) {
    return USER_WORKSPACE_ROLES
        .filter(r => r.workspaceId === wsId)
        .map(r => ({ ...getUser(r.userId), wsRole: r.wsRole, wsEditPerm: r.wsEditPerm || 'edit' }));
}

/* ============================================ */
/* ===== 初始化 ===== */
/* ============================================ */
document.addEventListener('DOMContentLoaded', () => {
    initOrgSelector();
    initUserSwitcher();
    navigateTo('members');
    setupEmbeddedMode();
});

/**
 * 嵌入式模式：当作为 iframe 被父页面加载时
 * - 隐藏顶部"当前组织"选择器（由父页面一级菜单的组织切换替代）
 * - 监听父页面的组织切换消息
 */
function setupEmbeddedMode() {
    const isEmbedded = window.parent && window.parent !== window;
    if (!isEmbedded) return;

    // 隐藏顶部组织选择器（保留 logo 与右侧操作）
    const ctxSwitcher = document.querySelector('.context-switcher');
    if (ctxSwitcher) ctxSwitcher.style.display = 'none';

    // 接收父页面消息
    window.addEventListener('message', (event) => {
        const data = event.data || {};
        if (data.type === 'creatiads-switch-org' && data.orgId != null) {
            switchOrg(data.orgId);
        }
    });
}

function initOrgSelector() {
    const selector = document.getElementById('orgSelector');
    const userOrgs = USER_ORG_ROLES
        .filter(r => r.userId === CURRENT_USER_ID)
        .map(r => getOrg(r.orgId))
        .filter(Boolean);
    
    selector.innerHTML = userOrgs.map(org => 
        `<option value="${org.id}" ${org.id === CURRENT_CONTEXT.orgId ? 'selected' : ''}>${org.name}</option>`
    ).join('');
}

function initUserSwitcher() {
    const selector = document.getElementById('userSwitcher');
    selector.innerHTML = USERS.map(u => 
        `<option value="${u.id}" ${u.id === CURRENT_USER_ID ? 'selected' : ''}>${u.name}</option>`
    ).join('');
}

function switchOrg(orgId) {
    CURRENT_CONTEXT.orgId = parseInt(orgId);
    refreshCurrentPage();
}

function switchUser(userId) {
    CURRENT_USER_ID = parseInt(userId);
    // 自动切换到该用户所属的第一个组织
    const userOrg = USER_ORG_ROLES.find(r => r.userId === CURRENT_USER_ID);
    if (userOrg) {
        CURRENT_CONTEXT.orgId = userOrg.orgId;
    }
    initOrgSelector();
    refreshCurrentPage();
}

function refreshCurrentPage() {
    if (currentPage === 'members') renderMembersPage();
    else if (currentPage === 'workspaces') renderWorkspacesPage();
    else if (currentPage === 'billing') renderBillingPage();
}

/* ============================================ */
/* ===== 导航 ===== */
/* ============================================ */
function navigateTo(page) {
    currentPage = page;
    
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.page === page);
    });
    
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    
    const pageMap = {
        members: 'membersPage',
        workspaces: 'workspacesPage',
        billing: 'billingPage'
    };
    
    document.getElementById(pageMap[page]).classList.add('active');
    refreshCurrentPage();
}

/* ============================================ */
/* ===== 成员管理 ===== */
/* ============================================ */
let batchMode = false;
let selectedMemberIds = new Set();

function renderMembersPage() {
    const tbody = document.getElementById('memberTableBody');
    const orgId = CURRENT_CONTEXT.orgId;
    if (!orgId) return;
    
    const members = getOrgMembers(orgId);
    
    if (members.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="empty-state">暂无成员</td></tr>`;
        return;
    }
    
    tbody.innerHTML = members.map(m => {
        const orgRoleClass = m.orgRole.toLowerCase();
        const workspaceTags = renderMemberWorkspaces(m.id, orgId, m.orgRole);
        const isChecked = selectedMemberIds.has(m.id);
        
        return `
            <tr>
                <td class="batch-col" style="${batchMode ? '' : 'display:none;'}">
                    <input type="checkbox" class="member-checkbox" data-user-id="${m.id}" ${isChecked ? 'checked' : ''} onchange="toggleMemberSelection(${m.id}, this.checked)">
                </td>
                <td><strong>${m.name}</strong></td>
                <td>${m.email}</td>
                <td><span class="role-badge ${orgRoleClass}">${m.orgRole}</span></td>
                <td>${workspaceTags}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn-link" onclick="openEditMember(${m.id})">编辑</button>
                        ${m.id !== CURRENT_USER_ID ? `<button class="btn-link btn-link-danger" onclick="removeMember(${m.id})">移除</button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    // 非批量模式时显示选中数
    updateBatchSelectedCount();
}

function renderMemberWorkspaces(userId, orgId, orgRole) {
    const orgWs = getOrgWorkspaces(orgId);
    
    if (orgRole === 'Admin') {
        return `<span class="workspace-tag admin-virtual">所有空间（Admin 自动拥有）</span>`;
    }
    
    const joined = orgWs
        .map(ws => ({ ws, role: getUserWorkspaceRole(userId, ws.id) }))
        .filter(item => item.role);
    
    if (joined.length === 0) {
        return `<span style="color:#9ca3af;font-size:12px;">未加入任何空间</span>`;
    }
    
    return `<div class="workspace-tag-list">${joined.map(item => `
        <span class="workspace-tag">
            <span class="ws-name">${item.ws.name}</span>
            <span class="ws-role-tag ${item.role.toLowerCase()}">${item.role}</span>
        </span>
    `).join('')}</div>`;
}

/* ===== 批量操作 ===== */
function toggleBatchMode() {
    batchMode = !batchMode;
    selectedMemberIds.clear();
    
    document.querySelectorAll('.batch-col').forEach(col => {
        col.style.display = batchMode ? '' : 'none';
    });
    
    document.getElementById('batchToolbar').style.display = batchMode ? 'flex' : 'none';
    document.getElementById('batchActionBtn').textContent = batchMode ? '退出批量' : '批量管理';
    
    renderMembersPage();
}

function toggleSelectAllMembers() {
    const allChecked = document.getElementById('selectAllMembers').checked;
    const members = getOrgMembers(CURRENT_CONTEXT.orgId);
    
    if (allChecked) {
        members.forEach(m => {
            if (m.id !== CURRENT_USER_ID) selectedMemberIds.add(m.id);
        });
    } else {
        selectedMemberIds.clear();
    }
    
    renderMembersPage();
}

function toggleMemberSelection(userId, checked) {
    if (checked) selectedMemberIds.add(userId);
    else selectedMemberIds.delete(userId);
    updateBatchSelectedCount();
}

function updateBatchSelectedCount() {
    const countEl = document.getElementById('batchSelectedCount');
    if (countEl) countEl.textContent = selectedMemberIds.size;
}

function batchChangeOrgRole(newRole) {
    if (selectedMemberIds.size === 0) {
        alert('请先选择成员');
        return;
    }
    
    if (!confirm(`确定将选中的 ${selectedMemberIds.size} 名成员角色更改为 ${newRole} 吗？`)) return;
    
    const orgId = CURRENT_CONTEXT.orgId;
    selectedMemberIds.forEach(userId => {
        const rel = USER_ORG_ROLES.find(r => r.userId === userId && r.orgId === orgId);
        if (rel) rel.orgRole = newRole;
    });
    
    alert(`已将 ${selectedMemberIds.size} 名成员角色更改为 ${newRole}`);
    selectedMemberIds.clear();
    renderMembersPage();
}

function batchRemoveMembers() {
    if (selectedMemberIds.size === 0) {
        alert('请先选择成员');
        return;
    }
    
    if (!confirm(`确定将选中的 ${selectedMemberIds.size} 名成员移除出组织吗？\n这些成员将失去访问组织内所有数据源和报表的权限`)) return;
    
    const orgId = CURRENT_CONTEXT.orgId;
    const orgWsIds = getOrgWorkspaces(orgId).map(w => w.id);
    
    selectedMemberIds.forEach(userId => {
        // 移除企业角色
        const orgIdx = USER_ORG_ROLES.findIndex(r => r.userId === userId && r.orgId === orgId);
        if (orgIdx > -1) USER_ORG_ROLES.splice(orgIdx, 1);
        
        // 移除空间角色
        for (let i = USER_WORKSPACE_ROLES.length - 1; i >= 0; i--) {
            const r = USER_WORKSPACE_ROLES[i];
            if (r.userId === userId && orgWsIds.includes(r.workspaceId)) {
                USER_WORKSPACE_ROLES.splice(i, 1);
            }
        }
    });
    
    alert(`已移除 ${selectedMemberIds.size} 名成员`);
    selectedMemberIds.clear();
    renderMembersPage();
}

function openBatchAddToWorkspace() {
    if (selectedMemberIds.size === 0) {
        alert('请先选择成员');
        return;
    }
    
    document.getElementById('batchAddWsCount').textContent = selectedMemberIds.size;
    
    const orgWs = getOrgWorkspaces(CURRENT_CONTEXT.orgId);
    const select = document.getElementById('batchAddWsSelect');
    select.innerHTML = orgWs.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    
    document.getElementById('batchAddWsModal').style.display = 'flex';
}

function closeBatchAddToWorkspace() {
    document.getElementById('batchAddWsModal').style.display = 'none';
}

function confirmBatchAddToWorkspace() {
    const wsId = parseInt(document.getElementById('batchAddWsSelect').value);
    const wsRole = document.getElementById('batchAddWsRole').value;
    
    let added = 0;
    selectedMemberIds.forEach(userId => {
        const existing = USER_WORKSPACE_ROLES.find(r => r.userId === userId && r.workspaceId === wsId);
        if (existing) {
            existing.wsRole = wsRole;
        } else {
            USER_WORKSPACE_ROLES.push({ userId, workspaceId: wsId, wsRole });
        }
        added++;
    });
    
    closeBatchAddToWorkspace();
    alert(`已将 ${added} 名成员添加到「${getWorkspace(wsId).name}」，角色：${wsRole}`);
    selectedMemberIds.clear();
    renderMembersPage();
}

/* ===== 邀请新成员弹窗 ===== */
function openInviteMember() {
    document.getElementById('inviteEmail').value = '';
    document.getElementById('inviteOrgRole').value = 'Member';
    
    const wsListEl = document.getElementById('inviteWorkspaceList');
    const orgWs = getOrgWorkspaces(CURRENT_CONTEXT.orgId);
    
    wsListEl.innerHTML = orgWs.map(ws => `
        <div class="checkbox-list-item">
            <input type="checkbox" id="invite-ws-${ws.id}" value="${ws.id}">
            <label for="invite-ws-${ws.id}">${ws.name}</label>
            <select id="invite-ws-role-${ws.id}">
                <option value="Editor">Editor</option>
                <option value="Owner">Owner</option>
                <option value="Viewer">Viewer</option>
            </select>
        </div>
    `).join('');
    
    document.getElementById('inviteModal').style.display = 'flex';
}

function closeInviteMember() {
    document.getElementById('inviteModal').style.display = 'none';
}

function confirmInviteMember() {
    const emailInput = document.getElementById('inviteEmail').value.trim();
    const orgRole = document.getElementById('inviteOrgRole').value;
    
    if (!emailInput) { alert('请输入邮箱地址'); return; }
    
    // 支持多人邀请（逗号/分号/换行分隔）
    const emails = emailInput.split(/[\n,;]/).map(e => e.trim()).filter(Boolean);
    
    const orgId = CURRENT_CONTEXT.orgId;
    const orgWs = getOrgWorkspaces(orgId);
    
    let invitedCount = 0;
    let skippedCount = 0;
    
    emails.forEach(email => {
        let user = USERS.find(u => u.email === email);
        if (!user) {
            const newId = Math.max(...USERS.map(u => u.id)) + 1;
            user = {
                id: newId,
                name: email.split('@')[0],
                email,
                personalPlan: 'FREE',
                registeredAt: new Date().toISOString().split('T')[0],
                disabled: false
            };
            USERS.push(user);
        }
        
        if (USER_ORG_ROLES.find(r => r.userId === user.id && r.orgId === orgId)) {
            skippedCount++;
            return;
        }
        
        USER_ORG_ROLES.push({ userId: user.id, orgId, orgRole });
        
        orgWs.forEach(ws => {
            const cb = document.getElementById(`invite-ws-${ws.id}`);
            if (cb && cb.checked) {
                const wsRole = document.getElementById(`invite-ws-role-${ws.id}`).value;
                USER_WORKSPACE_ROLES.push({ userId: user.id, workspaceId: ws.id, wsRole });
            }
        });
        
        invitedCount++;
    });
    
    closeInviteMember();
    renderMembersPage();
    
    let msg = `已邀请 ${invitedCount} 名成员加入组织`;
    if (skippedCount > 0) msg += `\n${skippedCount} 名成员已在组织中，已跳过`;
    alert(msg);
}

/* ===== 编辑成员 ===== */
function openEditMember(memberId) {
    editingMemberId = memberId;
    const user = getUser(memberId);
    const orgRole = getUserOrgRole(memberId, CURRENT_CONTEXT.orgId);
    
    document.getElementById('editMemberName').value = user.name;
    document.getElementById('editMemberEmail').value = user.email;
    document.getElementById('editOrgRole').value = orgRole;
    
    renderEditWorkspaceRoleList(memberId);
    
    document.getElementById('editMemberModal').style.display = 'flex';
}

function renderEditWorkspaceRoleList(userId) {
    const listEl = document.getElementById('editWorkspaceRoleList');
    const orgWs = getOrgWorkspaces(CURRENT_CONTEXT.orgId);
    const orgRole = document.getElementById('editOrgRole').value;
    
    if (orgRole === 'Admin') {
        listEl.innerHTML = `<div style="padding:16px;text-align:center;color:#6b7280;font-size:12px;">Admin 自动拥有所有空间权限，无需单独配置</div>`;
        return;
    }
    
    listEl.innerHTML = orgWs.map(ws => {
        const currentRole = getUserWorkspaceRole(userId, ws.id);
        const memberCount = getWorkspaceMembers(ws.id).length;
        
        return `
            <div class="workspace-role-item">
                <div class="ws-info">
                    <div>${ws.name}</div>
                    <div class="ws-meta">${memberCount} 名成员 · ${ws.desc || '暂无描述'}</div>
                </div>
                <select id="edit-ws-role-${ws.id}" class="${!currentRole ? 'not-joined' : ''}">
                    <option value="" ${!currentRole ? 'selected' : ''}>未加入</option>
                    <option value="Owner" ${currentRole === 'Owner' ? 'selected' : ''}>Owner</option>
                    <option value="Editor" ${currentRole === 'Editor' ? 'selected' : ''}>Editor</option>
                    <option value="Viewer" ${currentRole === 'Viewer' ? 'selected' : ''}>Viewer</option>
                </select>
            </div>
        `;
    }).join('');
}

document.addEventListener('change', (e) => {
    if (e.target.id === 'editOrgRole' && editingMemberId) {
        renderEditWorkspaceRoleList(editingMemberId);
    }
});

function closeEditMember() {
    document.getElementById('editMemberModal').style.display = 'none';
    editingMemberId = null;
}

function confirmEditMember() {
    if (!editingMemberId) return;
    
    const orgId = CURRENT_CONTEXT.orgId;
    const newOrgRole = document.getElementById('editOrgRole').value;
    
    const orgRel = USER_ORG_ROLES.find(r => r.userId === editingMemberId && r.orgId === orgId);
    if (orgRel) orgRel.orgRole = newOrgRole;
    
    if (newOrgRole !== 'Admin') {
        const orgWs = getOrgWorkspaces(orgId);
        orgWs.forEach(ws => {
            const select = document.getElementById(`edit-ws-role-${ws.id}`);
            if (!select) return;
            
            const newRole = select.value;
            const existingIdx = USER_WORKSPACE_ROLES.findIndex(r => 
                r.userId === editingMemberId && r.workspaceId === ws.id
            );
            
            if (newRole) {
                if (existingIdx > -1) {
                    USER_WORKSPACE_ROLES[existingIdx].wsRole = newRole;
                } else {
                    USER_WORKSPACE_ROLES.push({ userId: editingMemberId, workspaceId: ws.id, wsRole: newRole });
                }
            } else if (existingIdx > -1) {
                USER_WORKSPACE_ROLES.splice(existingIdx, 1);
            }
        });
    }
    
    closeEditMember();
    renderMembersPage();
    alert('成员信息已更新');
}

function removeMember(userId) {
    if (!confirm('确定将该成员移除出组织吗？该成员将失去访问组织内所有数据源和报表的权限')) return;
    
    const orgId = CURRENT_CONTEXT.orgId;
    
    const orgIdx = USER_ORG_ROLES.findIndex(r => r.userId === userId && r.orgId === orgId);
    if (orgIdx > -1) USER_ORG_ROLES.splice(orgIdx, 1);
    
    const orgWsIds = getOrgWorkspaces(orgId).map(w => w.id);
    for (let i = USER_WORKSPACE_ROLES.length - 1; i >= 0; i--) {
        const r = USER_WORKSPACE_ROLES[i];
        if (r.userId === userId && orgWsIds.includes(r.workspaceId)) {
            USER_WORKSPACE_ROLES.splice(i, 1);
        }
    }
    
    renderMembersPage();
    alert('成员已移除');
}

/* ============================================ */
/* ===== 空间管理 ===== */
/* ============================================ */

// 渲染空间图标
function renderWsIcon(ws, sizeClass = '') {
    if (ws.icon) {
        // 自动上传的自定义图片
        return `<div class="workspace-icon has-image ${sizeClass}"><img src="${ws.icon}" alt="${ws.name}"></div>`;
    }
    // 默认：名称首字+渐变色
    const firstChar = ws.name ? ws.name.charAt(0) : '?';
    const color = ws.iconColor || 'purple';
    return `<div class="workspace-icon ${color} ${sizeClass}">${firstChar}</div>`;
}

function renderWorkspacesPage() {
    const grid = document.getElementById('workspaceGrid');
    const orgId = CURRENT_CONTEXT.orgId;
    if (!orgId) return;
    
    const workspaces = getOrgWorkspaces(orgId);
    
    const cards = workspaces.map(ws => {
        const owner = getUser(ws.ownerId);
        const members = getWorkspaceMembers(ws.id);
        const dsCount = WORKSPACE_DATASOURCES.filter(d => d.workspaceId === ws.id).length;
        const resCount = WORKSPACE_RESOURCES.filter(r => r.workspaceId === ws.id).length;
        
        return `
            <div class="workspace-card" onclick="openWorkspaceDetail(${ws.id})">
                <div class="workspace-card-header">
                    ${renderWsIcon(ws)}
                    <div class="workspace-info">
                        <div class="workspace-name">${ws.name}</div>
                        <div class="workspace-meta">
                            负责人：${owner ? owner.name : '-'} · 创建于 ${ws.createdAt}
                        </div>
                    </div>
                </div>
                <div class="workspace-stats">
                    <div class="workspace-stat">
                        <span class="workspace-stat-icon">👥</span>
                        <span class="workspace-stat-value">${members.length}</span>
                        <span class="workspace-stat-label">成员</span>
                    </div>
                    <div class="workspace-stat">
                        <span class="workspace-stat-icon">🔗</span>
                        <span class="workspace-stat-value">${dsCount}</span>
                        <span class="workspace-stat-label">数据源</span>
                    </div>
                    <div class="workspace-stat">
                        <span class="workspace-stat-icon">📊</span>
                        <span class="workspace-stat-value">${resCount}</span>
                        <span class="workspace-stat-label">报表</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    const createCard = `
        <div class="workspace-card create-new" onclick="openCreateWorkspace()">
            <div class="create-icon">+</div>
            <div class="create-text">创建新空间</div>
        </div>
    `;
    
    grid.innerHTML = cards + createCard;
}

/* ===== 创建空间 ===== */
let tempCreateWsIcon = null; // 上传的图片 base64

function openCreateWorkspace() {
    document.getElementById('createWsName').value = '';
    document.getElementById('createWsDesc').value = '';
    tempCreateWsIcon = null;
    updateWsIconPreview();
    document.getElementById('btnResetCreateIcon').style.display = 'none';
    document.getElementById('createWsModal').style.display = 'flex';
}

function closeCreateWorkspace() {
    document.getElementById('createWsModal').style.display = 'none';
    tempCreateWsIcon = null;
}

// 颜色循环：按组织已有空间数顺序选择
const WS_ICON_COLORS = ['purple', 'teal', 'orange', 'pink', 'blue', 'green'];

function getNextIconColor() {
    const orgWs = getOrgWorkspaces(CURRENT_CONTEXT.orgId);
    return WS_ICON_COLORS[orgWs.length % WS_ICON_COLORS.length];
}

function updateWsIconPreview() {
    const name = document.getElementById('createWsName').value.trim();
    const preview = document.getElementById('createWsIconPreview');
    const textEl = document.getElementById('createWsIconText');
    
    if (tempCreateWsIcon) {
        preview.className = 'ws-icon-preview has-image';
        preview.innerHTML = `<img src="${tempCreateWsIcon}" alt="预览">`;
        return;
    }
    
    const firstChar = name ? name.charAt(0) : '空';
    const color = getNextIconColor();
    preview.className = `ws-icon-preview ${color}`;
    preview.innerHTML = `<span id="createWsIconText">${firstChar}</span>`;
}

function handleWsIconUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
        alert('图片大小不能超过 2MB');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        tempCreateWsIcon = e.target.result;
        updateWsIconPreview();
        document.getElementById('btnResetCreateIcon').style.display = 'inline-flex';
    };
    reader.readAsDataURL(file);
}

function resetCreateWsIcon() {
    tempCreateWsIcon = null;
    document.getElementById('createWsIconFile').value = '';
    document.getElementById('btnResetCreateIcon').style.display = 'none';
    updateWsIconPreview();
}

function confirmCreateWorkspace() {
    const name = document.getElementById('createWsName').value.trim();
    const desc = document.getElementById('createWsDesc').value.trim();
    
    if (!name) { alert('空间名称不能为空'); return; }
    
    const orgId = CURRENT_CONTEXT.orgId;
    const newId = Math.max(...WORKSPACES.map(w => w.id)) + 1;
    
    WORKSPACES.push({
        id: newId,
        orgId,
        ownerId: CURRENT_USER_ID,
        name,
        desc,
        icon: tempCreateWsIcon,           // 自动上传的图片 base64
        iconColor: getNextIconColor(),    // 默认颜色
        isPersonal: false,
        createdAt: new Date().toISOString().split('T')[0]
    });
    
    USER_WORKSPACE_ROLES.push({ userId: CURRENT_USER_ID, workspaceId: newId, wsRole: 'Owner' });
    
    closeCreateWorkspace();
    renderWorkspacesPage();
    alert(`空间「${name}」已创建成功`);
}

function deleteWorkspace(wsId) {
    if (!confirm('确定要删除该空间吗？空间内所有成员将失去访问权限')) return;
    
    const idx = WORKSPACES.findIndex(w => w.id === wsId);
    if (idx > -1) WORKSPACES.splice(idx, 1);
    
    for (let i = USER_WORKSPACE_ROLES.length - 1; i >= 0; i--) {
        if (USER_WORKSPACE_ROLES[i].workspaceId === wsId) {
            USER_WORKSPACE_ROLES.splice(i, 1);
        }
    }
    
    renderWorkspacesPage();
    alert('空间已删除');
}

/* ============================================ */
/* ===== 空间详情弹窗 ===== */
/* ============================================ */
let tempDetailIcon = null; // 空间详情页可修改的图片

function openWorkspaceDetail(wsId) {
    viewingWorkspaceId = wsId;
    const ws = getWorkspace(wsId);
    if (!ws) return;
    
    document.getElementById('wsDetailTitle').textContent = ws.name;
    document.getElementById('wsDetailSubtitle').textContent = ws.desc || '暂无描述';
    
    // 填充基本信息
    document.getElementById('wsDetailName').value = ws.name;
    document.getElementById('wsDetailDesc').value = ws.desc || '';
    
    // 图片预览 & 重置按钮
    tempDetailIcon = ws.icon;
    updateWsDetailIconPreview();
    document.getElementById('btnResetDetailIcon').style.display = ws.icon ? 'inline-flex' : 'none';
    
    // 负责人 Owner 下拉
    const wsMembers = getWorkspaceMembers(wsId);
    const ownerSelect = document.getElementById('wsDetailOwner');
    ownerSelect.innerHTML = wsMembers.map(m => 
        `<option value="${m.id}" ${m.id === ws.ownerId ? 'selected' : ''}>${m.name}</option>`
    ).join('');
    
    // 权限控制
    const isAdmin = isOrgAdmin(CURRENT_USER_ID, CURRENT_CONTEXT.orgId);
    const myWsRole = getUserWorkspaceRole(CURRENT_USER_ID, wsId);
    const canManage = isAdmin || myWsRole === 'Owner';
    
    document.getElementById('wsDetailName').disabled = !canManage;
    document.getElementById('wsDetailDesc').disabled = !canManage;
    document.getElementById('wsDetailOwner').disabled = !canManage;
    document.getElementById('btnUploadDetailIcon').style.display = canManage ? 'inline-flex' : 'none';
    document.getElementById('btnSaveWsInfo').style.display = canManage ? 'inline-flex' : 'none';
    document.getElementById('wsDetailDangerZone').style.display = canManage ? 'block' : 'none';
    
    // 更新 tab 数字角标
    const dsCount = WORKSPACE_DATASOURCES.filter(d => d.workspaceId === wsId).length;
    const resCount = WORKSPACE_RESOURCES.filter(r => r.workspaceId === wsId).length;
    const tabBtns = document.querySelectorAll('#workspaceDetailModal .tab-btn');
    tabBtns[0].textContent = '基本信息';
    tabBtns[1].textContent = '成员管理 (' + wsMembers.length + ')';
    tabBtns[2].textContent = '数据源 (' + dsCount + ')';
    tabBtns[3].textContent = '报表 (' + resCount + ')';
    tabBtns[4].textContent = '数据权限';
    if (tabBtns[5]) tabBtns[5].textContent = '空间设置';
    
    // 加载空间设置
    if (!WORKSPACE_SETTINGS[wsId]) {
        WORKSPACE_SETTINGS[wsId] = { defaultRole: 'Editor', datasourceVisible: true, allowMemberInvite: false, allowExternalShare: true };
    }
    
    switchWsDetailTab('info');
    renderWsDetailMembers(wsId);
    
    document.getElementById('workspaceDetailModal').style.display = 'flex';
}

function updateWsDetailIconPreview() {
    const name = document.getElementById('wsDetailName').value.trim();
    const preview = document.getElementById('wsDetailIconPreview');
    
    if (tempDetailIcon) {
        preview.className = 'ws-icon-preview has-image';
        preview.innerHTML = `<img src="${tempDetailIcon}" alt="预览">`;
        return;
    }
    
    const ws = getWorkspace(viewingWorkspaceId);
    const firstChar = name ? name.charAt(0) : '空';
    const color = ws?.iconColor || 'purple';
    preview.className = `ws-icon-preview ${color}`;
    preview.innerHTML = `<span>${firstChar}</span>`;
}

function handleWsDetailIconUpload(input) {
    const file = input.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) {
        alert('图片大小不能超过 2MB');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        tempDetailIcon = e.target.result;
        updateWsDetailIconPreview();
        document.getElementById('btnResetDetailIcon').style.display = 'inline-flex';
    };
    reader.readAsDataURL(file);
}

function resetWsDetailIcon() {
    tempDetailIcon = null;
    document.getElementById('wsDetailIconFile').value = '';
    document.getElementById('btnResetDetailIcon').style.display = 'none';
    updateWsDetailIconPreview();
}

function closeWorkspaceDetail() {
    document.getElementById('workspaceDetailModal').style.display = 'none';
    viewingWorkspaceId = null;
    tempDetailIcon = null;
}

function switchWsDetailTab(tab) {
    document.querySelectorAll('#workspaceDetailModal .tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    document.getElementById('wsDetailInfoTab').style.display = tab === 'info' ? 'block' : 'none';
    document.getElementById('wsDetailMembersTab').style.display = tab === 'members' ? 'block' : 'none';
    document.getElementById('wsDetailDatasourcesTab').style.display = tab === 'datasources' ? 'block' : 'none';
    document.getElementById('wsDetailResourcesTab').style.display = tab === 'resources' ? 'block' : 'none';
    const dataPermTab = document.getElementById('wsDetailDataPermissionsTab');
    if (dataPermTab) dataPermTab.style.display = tab === 'datapermissions' ? 'block' : 'none';
    document.getElementById('wsDetailSettingsTab').style.display = tab === 'settings' ? 'block' : 'none';
    
    // 只在基本信息 Tab 显示保存按钮
    const isAdmin = isOrgAdmin(CURRENT_USER_ID, CURRENT_CONTEXT.orgId);
    const myWsRole = getUserWorkspaceRole(CURRENT_USER_ID, viewingWorkspaceId);
    const canManage = isAdmin || myWsRole === 'Owner';
    document.getElementById('btnSaveWsInfo').style.display = (tab === 'info' && canManage) ? 'inline-flex' : 'none';
    
    if (tab === 'datasources') renderWsDatasources(viewingWorkspaceId);
    if (tab === 'resources') renderWsResources(viewingWorkspaceId);
    if (tab === 'datapermissions') renderWsDataPermissions(viewingWorkspaceId);
    if (tab === 'settings') renderWsSettings(viewingWorkspaceId);
}

function renderWsDetailMembers(wsId) {
    const members = getWorkspaceMembers(wsId);
    const tbody = document.getElementById('wsMembersTableBody');
    
    document.getElementById('wsMembersCount').textContent = `共 ${members.length} 名成员`;
    
    const isAdmin = isOrgAdmin(CURRENT_USER_ID, CURRENT_CONTEXT.orgId);
    const myWsRole = getUserWorkspaceRole(CURRENT_USER_ID, wsId);
    const canManage = isAdmin || myWsRole === 'Owner';
    
    // 根据空间设置控制"添加成员"和"批量添加"按钮可见性
    const wsSettings = WORKSPACE_SETTINGS[wsId] || {};
    const canAddMember = canManage || wsSettings.allowMemberInvite;
    const addBtns = document.querySelectorAll('#wsDetailMembersTab .page-actions button');
    addBtns.forEach(btn => btn.style.display = canAddMember ? 'inline-flex' : 'none');
    
    if (members.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="empty-state">暂无成员</td></tr>`;
        return;
    }
    
    tbody.innerHTML = members.map(m => {
        const orgRole = getUserOrgRole(m.id, CURRENT_CONTEXT.orgId);
        const canEditRole = canManage;
        const canRemove = canManage && m.id !== CURRENT_USER_ID;
        return `
            <tr>
                <td>${m.name}</td>
                <td>${m.email}</td>
                <td><span class="role-badge ${orgRole?.toLowerCase()}">${orgRole || '-'}</span></td>
                <td>${renderWsRoleCell(m, orgRole, canEditRole)}</td>
                <td>${renderWsPermCell(m, orgRole, canEditRole)}</td>
                <td>
                    ${canRemove ? `<button class="btn-link btn-link-danger" onclick="removeWsMember(${m.id})">移除</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * 空间角色列 —— Owner / Editor / Viewer 三选一
 * 规则：企业 Admin 强制 Owner，不可改
 */
function renderWsRoleCell(m, orgRole, canEditRole) {
    const isOrgAdmin = orgRole === 'Admin';

    // 企业 Admin：永远 Owner，锁定
    if (isOrgAdmin) {
        return '<span class="role-badge owner">Owner</span>';
    }

    if (!canEditRole) {
        return '<span class="role-badge ' + (m.wsRole || '').toLowerCase() + '">' + (m.wsRole || '-') + '</span>';
    }

    return '<select class="ws-role-select" onchange="setWsRolePreset(' + m.id + ', this.value)">' +
        '<option value="Owner" '  + (m.wsRole === 'Owner'  ? 'selected' : '') + '>Owner</option>' +
        '<option value="Editor" ' + (m.wsRole === 'Editor' ? 'selected' : '') + '>Editor</option>' +
        '<option value="Viewer" ' + (m.wsRole === 'Viewer' ? 'selected' : '') + '>Viewer</option>' +
    '</select>';
}

/**
 * 权限列
 *   Owner  → "全部权限"（锁死）
 *   Editor → "可编辑 / 可查看" 下拉，控制该 Editor 对空间内资源的默认操作能力
 *   Viewer → "仅分享的资源"（不可选；分享时逐个决定编辑/查看）
 */
function renderWsPermCell(m, orgRole, canEditRole) {
    const isOrgAdmin = orgRole === 'Admin';
    const wsRole = m.wsRole;

    if (wsRole === 'Owner') {
        return '<span class="ws-perm-locked" title="' + (isOrgAdmin ? '企业 Admin 强制拥有全部权限' : 'Owner 拥有全部权限') + '">全部权限</span>';
    }

    if (wsRole === 'Viewer') {
        return '<span class="ws-perm-readonly ws-perm-viewer-hint" title="Viewer 默认无空间级权限，仅能查看被逐个分享的资源">仅分享的资源</span>';
    }

    // Editor
    if (!canEditRole) {
        return '<span class="ws-perm-readonly">' + (m.wsEditPerm === 'view' ? '可查看' : '可编辑') + '</span>';
    }

    const perm = m.wsEditPerm || 'edit';
    return '<select class="ws-perm-select" onchange="setEditorPerm(' + m.id + ', this.value)">' +
        '<option value="edit" ' + (perm === 'edit' ? 'selected' : '') + '>可编辑</option>' +
        '<option value="view" ' + (perm === 'view' ? 'selected' : '') + '>可查看</option>' +
    '</select>';
}

/** 修改 Editor 的编辑权限档位（edit / view）*/
function setEditorPerm(userId, perm) {
    const rel = USER_WORKSPACE_ROLES.find(r => r.userId === userId && r.workspaceId === viewingWorkspaceId);
    if (rel) rel.wsEditPerm = perm;
    renderWsDetailMembers(viewingWorkspaceId);
}

/** 统一入口：设置某成员在当前空间的角色（Owner / Editor / Viewer）*/
function setWsRolePreset(userId, newRole) {
    const rel = USER_WORKSPACE_ROLES.find(r => r.userId === userId && r.workspaceId === viewingWorkspaceId);
    if (rel) rel.wsRole = newRole;
    renderWsDetailMembers(viewingWorkspaceId);
}

function changeWsMemberRole(userId, newRole) {
    const rel = USER_WORKSPACE_ROLES.find(r => r.userId === userId && r.workspaceId === viewingWorkspaceId);
    if (rel) rel.wsRole = newRole;
    renderWsDetailMembers(viewingWorkspaceId);
}

function removeWsMember(userId) {
    if (!confirm('确定将该成员移出空间吗？')) return;
    
    const idx = USER_WORKSPACE_ROLES.findIndex(r => r.userId === userId && r.workspaceId === viewingWorkspaceId);
    if (idx > -1) USER_WORKSPACE_ROLES.splice(idx, 1);
    
    renderWsDetailMembers(viewingWorkspaceId);
}

function renderWsDatasources(wsId) {
    const dsList = WORKSPACE_DATASOURCES.filter(d => d.workspaceId === wsId);
    const tbody = document.getElementById('wsDatasourcesTableBody');
    const descEl = document.getElementById('wsDatasourceDesc');
    
    descEl.textContent = '本空间的 ' + dsList.length + ' 个数据源，所有 Editor 以上成员可使用';
    
    if (dsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="empty-state">暂无数据源</td></tr>';
        return;
    }
    
    tbody.innerHTML = dsList.map(ds => {
        const statusClass = ds.status === 'normal' ? 'status-normal' : 'status-error';
        const statusText = ds.status === 'normal' ? '正常' : '异常';
        return '<tr>' +
            '<td><strong>' + ds.name + '</strong></td>' +
            '<td>' + ds.type + '</td>' +
            '<td><span class="ds-status ' + statusClass + '">' + statusText + '</span></td>' +
            '<td><button class="btn-link" onclick="alert(\'跳转到连接器列表 - Demo\')">查看 →</button></td>' +
            '</tr>';
    }).join('');
}

function renderWsResources(wsId) {
    const resList = WORKSPACE_RESOURCES.filter(r => r.workspaceId === wsId);
    const tbody = document.getElementById('wsResourcesTableBody');
    
    if (resList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="empty-state">暂无报表</td></tr>';
        return;
    }
    
    tbody.innerHTML = resList.map(res => {
        return '<tr>' +
            '<td><strong>' + res.name + '</strong></td>' +
            '<td>' + res.owner + '</td>' +
            '<td><button class="btn-link" onclick="alert(\'跳转到看板 - Demo\')">查看 →</button></td>' +
            '</tr>';
    }).join('');
}

function renderWsSettings(wsId) {
    const settings = WORKSPACE_SETTINGS[wsId];
    if (!settings) return;
    
    document.getElementById('wsSettingDefaultRole').value = settings.defaultRole;
    document.getElementById('wsSettingDatasourceVisible').checked = settings.datasourceVisible;
    document.getElementById('wsSettingAllowInvite').checked = settings.allowMemberInvite;
    document.getElementById('wsSettingExternalShare').checked = settings.allowExternalShare;
    
    // 非管理员/Owner 时，所有设置只读
    const isAdmin = isOrgAdmin(CURRENT_USER_ID, CURRENT_CONTEXT.orgId);
    const myWsRole = getUserWorkspaceRole(CURRENT_USER_ID, wsId);
    const canManage = isAdmin || myWsRole === 'Owner';
    
    document.getElementById('wsSettingDefaultRole').disabled = !canManage;
    document.getElementById('wsSettingDatasourceVisible').disabled = !canManage;
    document.getElementById('wsSettingAllowInvite').disabled = !canManage;
    document.getElementById('wsSettingExternalShare').disabled = !canManage;
    
    // 隐藏保存按钮
    const saveBtn = document.querySelector('#wsDetailSettingsTab .btn-primary');
    if (saveBtn) saveBtn.style.display = canManage ? 'inline-flex' : 'none';
}

function saveWsSettings() {
    if (!viewingWorkspaceId) return;
    
    const settings = WORKSPACE_SETTINGS[viewingWorkspaceId];
    settings.defaultRole = document.getElementById('wsSettingDefaultRole').value;
    settings.datasourceVisible = document.getElementById('wsSettingDatasourceVisible').checked;
    settings.allowMemberInvite = document.getElementById('wsSettingAllowInvite').checked;
    settings.allowExternalShare = document.getElementById('wsSettingExternalShare').checked;
    
    alert('空间设置已保存');
}

function openAddMemberToWs() {
    const wsId = viewingWorkspaceId;
    const orgMembers = getOrgMembers(CURRENT_CONTEXT.orgId);
    const wsMemberIds = getWorkspaceMembers(wsId).map(m => m.id);
    
    const candidates = orgMembers.filter(m => !wsMemberIds.includes(m.id));
    
    if (candidates.length === 0) {
        alert('所有组织成员都已加入该空间');
        return;
    }
    
    const select = document.getElementById('addMemberToWsUserSelect');
    select.innerHTML = candidates.map(m => `<option value="${m.id}">${m.name} (${m.email})</option>`).join('');
    
    // 非管理员/Owner 且开启允许成员邀请时，角色固定为 Viewer，下拉框隐藏
    const isAdmin = isOrgAdmin(CURRENT_USER_ID, CURRENT_CONTEXT.orgId);
    const myWsRole = getUserWorkspaceRole(CURRENT_USER_ID, wsId);
    const canManage = isAdmin || myWsRole === 'Owner';
    const wsSettings = WORKSPACE_SETTINGS[wsId] || {};
    
    const roleGroup = document.getElementById('addMemberToWsRole').closest('.form-group');
    if (!canManage && wsSettings.allowMemberInvite) {
        roleGroup.style.display = 'none';
        document.getElementById('addMemberToWsRole').value = 'Viewer';
    } else {
        roleGroup.style.display = 'block';
        document.getElementById('addMemberToWsRole').value = 'Editor';
    }
    
    document.getElementById('addMemberToWsModal').style.display = 'flex';
}

function closeAddMemberToWs() {
    document.getElementById('addMemberToWsModal').style.display = 'none';
}

function confirmAddMemberToWs() {
    const userId = parseInt(document.getElementById('addMemberToWsUserSelect').value);
    const wsRole = document.getElementById('addMemberToWsRole').value;
    
    USER_WORKSPACE_ROLES.push({ userId, workspaceId: viewingWorkspaceId, wsRole });
    
    closeAddMemberToWs();
    renderWsDetailMembers(viewingWorkspaceId);
    alert('成员已添加');
}

function saveWorkspaceInfo() {
    const ws = getWorkspace(viewingWorkspaceId);
    if (!ws) return;
    
    const newName = document.getElementById('wsDetailName').value.trim();
    const newDesc = document.getElementById('wsDetailDesc').value.trim();
    const newOwnerId = parseInt(document.getElementById('wsDetailOwner').value);
    
    if (!newName) { alert('空间名称不能为空'); return; }
    
    ws.name = newName;
    ws.desc = newDesc;
    ws.icon = tempDetailIcon; // 保存图片（null 表示恢复默认）
    
    // 如果变更了Owner，要确保新 Owner 有空间角色
    if (newOwnerId !== ws.ownerId) {
        const newOwnerRel = USER_WORKSPACE_ROLES.find(r => r.userId === newOwnerId && r.workspaceId === viewingWorkspaceId);
        if (newOwnerRel) {
            newOwnerRel.wsRole = 'Owner';
        }
        ws.ownerId = newOwnerId;
    }
    
    document.getElementById('wsDetailTitle').textContent = newName;
    document.getElementById('wsDetailSubtitle').textContent = newDesc || '暂无描述';
    
    renderWorkspacesPage();
    alert('空间信息已保存');
}

function deleteWorkspaceFromDetail() {
    if (!confirm('确定要永久删除该空间吗？此操作不可恢复')) return;
    
    deleteWorkspace(viewingWorkspaceId);
    closeWorkspaceDetail();
}

/* ============================================ */
/* ===== 订阅与计费 ===== */
/* ============================================ */
function renderBillingPage() {
    renderBillingPlanCard();
    renderBillingUsage();
    renderPlanComparison();
    renderBillingHistory();
}

function renderBillingPlanCard() {
    const org = getCurrentOrg();
    if (!org) return;
    
    const sub = ORG_SUBSCRIPTIONS.find(s => s.orgId === org.id);
    if (!sub) return;
    
    const plan = getPlan(sub.plan);
    const planColors = { FREE: '#6b7280', STARTER: '#2dd4bf', PRO: '#22d3ee', ENTERPRISE: '#2dd4bf' };
    const bgColor = planColors[plan.key] || '#2dd4bf';
    
    document.getElementById('billingPlanCard').innerHTML = `
        <div class="billing-plan-header" style="background: linear-gradient(135deg, ${bgColor}, ${bgColor}dd);">
            <div>
                <div class="billing-plan-label">当前套餐</div>
                <div class="billing-plan-name">${plan.name}</div>
                <div class="billing-plan-meta">下次续费: ${sub.expireDate || '永久'} · ${plan.price === 0 ? '免费' : '¥' + plan.price.toLocaleString() + '/月'}</div>
            </div>
            <button class="btn btn-outline-light" onclick="openUpgradeModal('${plan.key}')">升级套餐</button>
        </div>
    `;
}

function renderBillingUsage() {
    const org = getCurrentOrg();
    if (!org) return;
    
    const usage = ORG_USAGE[org.id] || { seats: 0, seatsLimit: 10, aiTokens: 0, aiTokensLimit: 1000000, storage: 0, storageLimit: 10 };
    const sub = ORG_SUBSCRIPTIONS.find(s => s.orgId === org.id);
    const plan = sub ? getPlan(sub.plan) : null;
    const monthlyPrice = plan && plan.price > 0 ? plan.price : 0;
    
    const aiTokensUsed = (usage.aiTokens / 1000000).toFixed(1);
    const aiTokensLimit = (usage.aiTokensLimit / 1000000).toFixed(0);
    const aiTokensPercent = (usage.aiTokens / usage.aiTokensLimit * 100).toFixed(0);
    const seatsRemaining = usage.seatsLimit - usage.seats;
    const storageRemaining = usage.storageLimit - usage.storage;
    
    document.getElementById('billingUsageGrid').innerHTML = `
        <div class="usage-card">
            <div class="usage-card-label">已用席位</div>
            <div class="usage-card-value">${usage.seats} / ${usage.seatsLimit}</div>
            <div class="usage-card-hint" style="color:#10b981;">还可邀请 ${seatsRemaining} 人</div>
        </div>
        <div class="usage-card">
            <div class="usage-card-label">本月 AI Token</div>
            <div class="usage-card-value">${aiTokensUsed}M / ${aiTokensLimit}M</div>
            <div class="usage-card-hint" style="color:${aiTokensPercent > 80 ? '#ef4444' : '#10b981'};">${aiTokensPercent > 80 ? '即将用完' : '使用正常'}</div>
        </div>
        <div class="usage-card">
            <div class="usage-card-label">数据存储</div>
            <div class="usage-card-value">${usage.storage} GB / ${usage.storageLimit} GB</div>
            <div class="usage-card-hint" style="color:#10b981;">还可 ${storageRemaining} GB</div>
        </div>
        <div class="usage-card">
            <div class="usage-card-label">本月账单</div>
            <div class="usage-card-value">¥${monthlyPrice.toLocaleString()}</div>
            <div class="usage-card-hint" style="color:#9ca3af;">含 0 元加购项</div>
        </div>
    `;
}

function renderPlanComparison() {
    const org = getCurrentOrg();
    if (!org) return;
    
    const sub = ORG_SUBSCRIPTIONS.find(s => s.orgId === org.id);
    const currentPlanKey = sub?.plan || 'FREE';
    
    const planKeys = ['FREE', 'STARTER', 'PRO', 'ENTERPRISE'];
    const container = document.getElementById('planComparison');
    
    container.innerHTML = planKeys.map(key => {
        const plan = SUBSCRIPTION_PLANS[key];
        const isCurrent = key === currentPlanKey;
        const priceDisplay = plan.price === -1 ? plan.priceUnit : (plan.price === 0 ? '免费' : '¥' + plan.price);
        const originalPriceDisplay = plan.originalPrice ? '<span class="plan-original-price">原价¥' + plan.originalPrice + '/月</span>' : '';
        
        return `
            <div class="plan-card ${isCurrent ? 'current' : ''}">
                <div class="plan-card-header">
                    <div class="plan-card-name">${plan.name}</div>
                    <div class="plan-card-price">${priceDisplay}<span class="plan-price-unit">${plan.price > 0 ? ' / 月' : ''}</span>${originalPriceDisplay}</div>
                    <div class="plan-card-desc">${plan.priceDesc}</div>
                </div>
                <ul class="plan-card-highlights">
                    ${plan.highlights.map(h => '<li class="plan-highlight">' + h + '</li>').join('')}
                </ul>
                <div class="plan-card-action">
                    ${isCurrent ? '<span class="plan-current-tag">当前套餐</span>' : '<button class="btn btn-primary btn-sm" onclick="openUpgradeModal(\'' + key + '\')">' + (key === 'ENTERPRISE' ? '联系我们' : '升级') + '</button>'}
                </div>
            </div>
        `;
    }).join('');
}

function renderBillingHistory() {
    const org = getCurrentOrg();
    if (!org) return;
    
    const records = BILLING_RECORDS
        .filter(r => r.scope === 'org' && r.scopeId === org.id)
        .sort((a, b) => b.paidAt.localeCompare(a.paidAt));
    
    const tbody = document.getElementById('billingTableBody');
    
    if (records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">暂无账单记录</td></tr>';
        return;
    }
    
    tbody.innerHTML = records.map(r => {
        const statusClass = r.status === 'paid' ? 'status-paid' : 'status-pending';
        const statusText = r.status === 'paid' ? '已支付' : r.status;
        return '<tr>' +
            '<td>' + r.paidAt.substring(0, 7) + '</td>' +
            '<td>¥' + r.amount.toLocaleString() + '</td>' +
            '<td>' + r.method + '</td>' +
            '<td><span class="billing-status ' + statusClass + '">' + statusText + '</span></td>' +
            '<td><button class="btn-link" onclick="alert(\'下载发票 - Demo\')">下载发票</button></td>' +
            '</tr>';
    }).join('');
}

let pendingUpgradePlan = null;

function openUpgradeModal(planKey) {
    const targetPlan = SUBSCRIPTION_PLANS[planKey];
    pendingUpgradePlan = planKey;
    
    document.getElementById('upgradeModalTitle').textContent = `升级到 ${targetPlan.name}`;
    
    const priceText = targetPlan.price === -1 ? '联系我们' : (targetPlan.price === 0 ? '免费' : `¥${targetPlan.price}/月`);
    
    document.getElementById('upgradeModalBody').innerHTML = `
        <div class="form-group">
            <div style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:6px;padding:16px;">
                <div style="font-size:14px;color:#115e59;margin-bottom:8px;">目标套餐</div>
                <div style="font-size:24px;font-weight:700;color:#0d9488;">${targetPlan.name}</div>
                <div style="font-size:18px;color:#0d9488;margin-top:4px;">${priceText}</div>
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
                    <option>微信支付</option>
                    <option>支付宝</option>
                    <option>银行转账</option>
                </select>
            </div>
        ` : ''}
    `;
    
    document.getElementById('upgradeModal').style.display = 'flex';
}

function closeUpgradeModal() {
    document.getElementById('upgradeModal').style.display = 'none';
    pendingUpgradePlan = null;
}

function confirmUpgrade() {
    if (!pendingUpgradePlan) return;
    
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
    
    // 生成账单
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
            method: '微信支付',
            invoice: `INV-${Date.now()}`,
            status: 'paid'
        });
    }
    
    closeUpgradeModal();
    renderBillingPage();
    alert(`已升级到 ${plan.name}！`);
}

/* ============================================ */
/* ===== 权限预览 ===== */
/* ============================================ */
function openPermissionPreview() {
    const orgId = CURRENT_CONTEXT.orgId;
    const members = getOrgMembers(orgId);
    
    const select = document.getElementById('previewUserSelect');
    select.innerHTML = members.map(m => 
        `<option value="${m.id}" ${m.id === CURRENT_USER_ID ? 'selected' : ''}>${m.name} (${m.email})</option>`
    ).join('');
    
    renderPermissionPreview();
    document.getElementById('permissionPreviewModal').style.display = 'flex';
}

function closePermissionPreview() {
    document.getElementById('permissionPreviewModal').style.display = 'none';
}

function renderPermissionPreview() {
    const userId = parseInt(document.getElementById('previewUserSelect').value);
    const orgId = CURRENT_CONTEXT.orgId;
    const user = getUser(userId);
    const orgRole = getUserOrgRole(userId, orgId);
    const isAdmin = orgRole === 'Admin';
    
    const orgWs = getOrgWorkspaces(orgId);
    
    // 区分有权限的空间 vs 无权限的空间
    const accessibleWs = [];
    const noAccessWs = [];
    
    orgWs.forEach(ws => {
        if (isAdmin) {
            accessibleWs.push({ ...ws, wsRole: 'Admin', source: 'admin' });
        } else {
            const role = getUserWorkspaceRole(userId, ws.id);
            if (role) {
                accessibleWs.push({ ...ws, wsRole: role, source: 'member' });
            } else {
                noAccessWs.push(ws);
            }
        }
    });
    
    // 统计权限分布
    const roleStats = { Owner: 0, Editor: 0, Viewer: 0 };
    accessibleWs.forEach(ws => {
        if (ws.wsRole === 'Admin' || ws.wsRole === 'Owner') roleStats.Owner++;
        else if (ws.wsRole === 'Editor') roleStats.Editor++;
        else if (ws.wsRole === 'Viewer') roleStats.Viewer++;
    });
    
    document.getElementById('previewContent').innerHTML = `
        <!-- 权限摘要 -->
        <div class="preview-summary">
            <div class="preview-summary-item">
                <span class="preview-summary-label">用户</span>
                <span class="preview-summary-value">${user.name} (${user.email})</span>
            </div>
            <div class="preview-summary-item">
                <span class="preview-summary-label">企业角色</span>
                <span class="preview-summary-value">
                    <span class="role-badge ${orgRole.toLowerCase()}">${orgRole}</span>
                </span>
            </div>
            <div class="preview-summary-item">
                <span class="preview-summary-label">可访问空间</span>
                <span class="preview-summary-value">${accessibleWs.length} / ${orgWs.length} 个</span>
            </div>
            <div class="preview-summary-item">
                <span class="preview-summary-label">权限分布</span>
                <span class="preview-summary-value">
                    ${isAdmin ? '所有空间（Admin 自动拥有全部权限）' : `${roleStats.Owner} 个 Owner · ${roleStats.Editor} 个 Editor · ${roleStats.Viewer} 个 Viewer`}
                </span>
            </div>
        </div>
        
        <!-- 可访问的空间 -->
        <div class="preview-section">
            <div class="preview-section-title">✅ 可访问的空间（${accessibleWs.length}个）</div>
            ${accessibleWs.length === 0 ? `
                <div class="preview-empty">该用户未加入任何组织或未加入任何空间</div>
            ` : `
                <div class="preview-workspace-list">
                    ${accessibleWs.map(ws => `
                        <div class="preview-workspace-item">
                            <div>
                                <div class="preview-workspace-name">${ws.name}</div>
                                <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${ws.desc || '暂无描述'}</div>
                            </div>
                            <span class="role-badge ${ws.wsRole.toLowerCase()}">${ws.wsRole}</span>
                        </div>
                    `).join('')}
                </div>
            `}
        </div>
        
        <!-- 无权限的空间 -->
        ${!isAdmin && noAccessWs.length > 0 ? `
            <div class="preview-section">
                <div class="preview-section-title" style="color:#9ca3af;">🔒 无权限的空间（${noAccessWs.length}个）</div>
                <div class="preview-workspace-list">
                    ${noAccessWs.map(ws => `
                        <div class="preview-workspace-item" style="opacity:0.6;">
                            <div>
                                <div class="preview-workspace-name" style="color:#9ca3af;">${ws.name}</div>
                                <div style="font-size:11px;color:#9ca3af;margin-top:2px;">${ws.desc || '暂无描述'}</div>
                            </div>
                            <span style="font-size:12px;color:#9ca3af;">未加入</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        
        <!-- 该用户能做什么 -->
        <div class="preview-section">
            <div class="preview-section-title">📌 该用户可以做什么</div>
            <div class="preview-workspace-list">
                ${isAdmin ? `
                    <div class="preview-workspace-item"><span>✅ 管理组织内所有成员/角色/移除成员</span></div>
                    <div class="preview-workspace-item"><span>✅ 创建/删除空间及所有空间设置</span></div>
                    <div class="preview-workspace-item"><span>✅ 强制加入任意空间</span></div>
                    <div class="preview-workspace-item"><span>✅ 管理组织订阅和账单</span></div>
                    <div class="preview-workspace-item"><span>✅ 查看所有空间的全部数据</span></div>
                ` : `
                    <div class="preview-workspace-item"><span>✅ 访问已加入的 ${accessibleWs.length} 个空间</span></div>
                    ${roleStats.Owner > 0 ? `<div class="preview-workspace-item"><span>✅ 管理 ${roleStats.Owner} 个空间（作为 Owner）</span></div>` : ''}
                    ${roleStats.Editor > 0 ? `<div class="preview-workspace-item"><span>✅ 在 ${roleStats.Editor} 个空间中创建/编辑数据源</span></div>` : ''}
                    ${roleStats.Viewer > 0 ? `<div class="preview-workspace-item"><span>✅ 在 ${roleStats.Viewer} 个空间中查看报表和数据源</span></div>` : ''}
                    <div class="preview-workspace-item" style="color:#9ca3af;"><span>🔒 未加入的空间无权访问</span></div>
                `}
            </div>
        </div>
    `;
}

/* ============================================ */
/* ===== 角色权限说明切换 ===== */
/* ============================================ */
function toggleRolePermissionHint() {
    const hint = document.getElementById('rolePermissionHint');
    const toggle = document.getElementById('rolePermissionToggle');
    if (hint.style.display === 'none' || !hint.style.display) {
        hint.style.display = 'block';
        toggle.textContent = '收起 ▴';
    } else {
        hint.style.display = 'none';
        toggle.textContent = '展开详情 ▾';
    }
}

function toggleWsRolePermissionHint() {
    const hint = document.getElementById('wsRolePermissionHint');
    const toggle = document.getElementById('wsRolePermissionToggle');
    if (hint.style.display === 'none' || !hint.style.display) {
        hint.style.display = 'block';
        toggle.textContent = '收起 ▴';
    } else {
        hint.style.display = 'none';
        toggle.textContent = '展开详情 ▾';
    }
}

/* ============================================ */
/* ===== 空间详情：批量添加成员 ===== */
/* ============================================ */
function openBatchAddMembersToWs() {
    document.getElementById('batchAddMembersEmails').value = '';
    
    // 非管理员/Owner 且开启允许成员邀请时，角色固定为 Viewer，下拉框隐藏
    const isAdmin = isOrgAdmin(CURRENT_USER_ID, CURRENT_CONTEXT.orgId);
    const myWsRole = getUserWorkspaceRole(CURRENT_USER_ID, viewingWorkspaceId);
    const canManage = isAdmin || myWsRole === 'Owner';
    const wsSettings = WORKSPACE_SETTINGS[viewingWorkspaceId] || {};
    
    const roleGroup = document.getElementById('batchAddMembersRole').closest('.form-group');
    if (!canManage && wsSettings.allowMemberInvite) {
        roleGroup.style.display = 'none';
        document.getElementById('batchAddMembersRole').value = 'Viewer';
    } else {
        roleGroup.style.display = 'block';
        document.getElementById('batchAddMembersRole').value = 'Editor';
    }
    
    document.getElementById('batchAddMembersToWsModal').style.display = 'flex';
}

function closeBatchAddMembersToWs() {
    document.getElementById('batchAddMembersToWsModal').style.display = 'none';
}

function confirmBatchAddMembersToWs() {
    const emailInput = document.getElementById('batchAddMembersEmails').value.trim();
    const wsRole = document.getElementById('batchAddMembersRole').value;
    
    if (!emailInput) {
        alert('请输入邮箱地址');
        return;
    }
    
    const emails = emailInput.split(/[\n,;]/).map(e => e.trim()).filter(Boolean);
    const orgId = CURRENT_CONTEXT.orgId;
    const wsId = viewingWorkspaceId;
    
    let added = 0;
    let skipped = 0;
    let notInOrg = 0;
    
    emails.forEach(email => {
        let user = USERS.find(u => u.email === email);
        
        // 用户不存在则自动创建
        if (!user) {
            const newId = Math.max(...USERS.map(u => u.id)) + 1;
            user = {
                id: newId,
                name: email.split('@')[0],
                email,
                personalPlan: 'FREE',
                registeredAt: new Date().toISOString().split('T')[0],
                disabled: false
            };
            USERS.push(user);
        }
        
        // 检查是否已在组织中
        if (!USER_ORG_ROLES.find(r => r.userId === user.id && r.orgId === orgId)) {
            notInOrg++;
            return;
        }
        
        // 检查是否已在该空间中
        if (USER_WORKSPACE_ROLES.find(r => r.userId === user.id && r.workspaceId === wsId)) {
            skipped++;
            return;
        }
        
        USER_WORKSPACE_ROLES.push({ userId: user.id, workspaceId: wsId, wsRole: wsRole });
        added++;
    });
    
    closeBatchAddMembersToWs();
    renderWsDetailMembers(wsId);
    
    let msg = '已将 ' + added + ' 名成员加入空间（角色：' + wsRole + '）';
    if (skipped > 0) msg += '\n' + skipped + ' 名成员已在空间中，已跳过';
    if (notInOrg > 0) msg += '\n' + notInOrg + ' 名成员不在当前组织中，已跳过';
    alert(msg);
}


/* ============================================================
 * 数据权限（成员视图）
 * ============================================================ */

function toggleDataPermRule() {
    const hint = document.getElementById('dataPermRuleHint');
    const toggle = document.getElementById('dataPermRuleToggle');
    if (!hint || !toggle) return;
    const isOpen = hint.style.display !== 'none';
    hint.style.display = isOpen ? 'none' : 'block';
    toggle.textContent = isOpen ? '展开详情 ▾' : '收起 ▴';
}

function renderWsDataPermissions(wsId) {
    const wsMembers = getWorkspaceMembers(wsId);
    const wsAccounts = AD_ACCOUNTS.filter(a => a.workspaceId === wsId);
    const canManage = canManageWsDataPerm(wsId);

    const desc = document.getElementById('wsMemberPermDesc');
    if (desc) {
        desc.textContent = '本空间共 ' + wsMembers.length + ' 名成员 · ' + wsAccounts.length + ' 个广告账户'
            + (canManage ? ' · 你是空间 Owner，可配置每位成员的数据权限' : ' · 仅空间 Owner 可配置');
    }

    const tbody = document.getElementById('wsMemberPermTableBody');
    if (!tbody) return;

    if (wsMembers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty-state">该空间尚无成员</td></tr>';
    } else {
        tbody.innerHTML = wsMembers.map(m => renderMemberPermRow(m, wsId, wsAccounts, canManage)).join('');
    }

    // 批量授权按钮：仅 Owner 且空间有账户和非 Owner 成员时可见
    const bulkBtn = document.getElementById('btnBulkGrant');
    if (bulkBtn) {
        const hasEligibleMembers = wsMembers.some(m => m.wsRole !== 'Owner');
        bulkBtn.style.display = (canManage && wsAccounts.length > 0 && hasEligibleMembers) ? 'inline-flex' : 'none';
    }
}

function renderMemberPermRow(member, wsId, wsAccounts, canManage) {
    const mode = getUserWorkspaceDataMode(member.id, wsId);
    const wsRole = member.wsRole;
    const isSelf = member.id === CURRENT_USER_ID;

    const ownAccounts = wsAccounts.filter(a => a.ownerUserId === member.id);
    const extraIds = getUserExtraGrantedAccountIds(member.id, wsId);
    const visibleCount = wsAccounts.filter(a => canUserAccessAdAccount(member.id, a.id)).length;

    // 档位选项：根据角色决定哪些可选
    const modeSelectHtml = renderModeSelect(member.id, wsId, mode, wsRole, canManage);

    // 可见账户描述
    let visibleDesc;
    if (mode === 'all') {
        visibleDesc = '<span class="dp-visible-all">全部 <strong>' + wsAccounts.length + '</strong> 个账户</span>';
    } else {
        const ownTxt = ownAccounts.length > 0 ? '自己授权的 <strong>' + ownAccounts.length + '</strong> 个' : '无自己授权的账户';
        const extraTxt = extraIds.length > 0 ? '<span class="dp-extra-count">+ 追加 <strong>' + extraIds.length + '</strong> 个</span>' : '';
        visibleDesc = '<div class="dp-visible-detail">'
            + '<span>' + ownTxt + '</span>'
            + extraTxt
            + '<span class="dp-visible-total">共可见 ' + visibleCount + ' / ' + wsAccounts.length + '</span>'
            + '</div>';
    }

    // 操作按钮：Editor / Viewer 且档位为 own+extra 时可"追加账户"
    let actionsHtml = '';
    if (mode === 'own+extra' && canManage) {
        actionsHtml = '<button class="btn-link" onclick="openExtraGrantModal(' + member.id + ')">追加账户 →</button>';
    } else if (wsRole === 'Owner') {
        actionsHtml = '<span style="color:#9ca3af; font-size:12px;">看全部</span>';
    } else {
        actionsHtml = '<span style="color:#9ca3af; font-size:12px;">—</span>';
    }

    const orgRole = getUserOrgRole(member.id, CURRENT_CONTEXT.orgId);

    return '<tr>' +
        '<td>' +
            '<div style="font-weight:600;">' + escapeHtml(member.name) + (isSelf ? ' <span class="perm-tag-me">我</span>' : '') + '</div>' +
            '<div style="font-size:11px; color:#9ca3af; margin-top:2px;">' + escapeHtml(member.email) +
                (orgRole === 'Admin' ? ' · <span style="color:#0f766e;">企业 Admin</span>' : '') +
            '</div>' +
        '</td>' +
        '<td><span class="role-badge ' + (wsRole || '').toLowerCase() + '">' + (wsRole || '-') + '</span></td>' +
        '<td>' + modeSelectHtml + '</td>' +
        '<td>' + visibleDesc + '</td>' +
        '<td>' + actionsHtml + '</td>' +
        '</tr>';
}

function renderModeSelect(userId, wsId, mode, wsRole, canManage) {
    // Owner: 强制 all，禁用
    if (wsRole === 'Owner') {
        return '<span class="dp-mode-tag dp-mode-all">全部账户（Owner 强制）</span>';
    }
    // Viewer: 强制 own+extra，禁用
    if (wsRole === 'Viewer') {
        return '<span class="dp-mode-tag dp-mode-partial">仅自己授权 + 追加</span>';
    }
    // Editor: 可切
    if (!canManage) {
        const label = mode === 'all' ? '全部账户' : '仅自己授权 + 追加';
        return '<span class="dp-mode-tag ' + (mode === 'all' ? 'dp-mode-all' : 'dp-mode-partial') + '">' + label + '</span>';
    }
    return '<select class="dp-mode-select" onchange="onChangeMemberMode(' + userId + ', this.value)">'
        + '<option value="all"' + (mode === 'all' ? ' selected' : '') + '>全部账户</option>'
        + '<option value="own+extra"' + (mode === 'own+extra' ? ' selected' : '') + '>仅自己授权 + 追加</option>'
        + '</select>';
}

function onChangeMemberMode(userId, newMode) {
    setUserWorkspaceDataMode(userId, viewingWorkspaceId, newMode);
    renderWsDataPermissions(viewingWorkspaceId);
}

/** 当前用户是否能管理本空间的数据权限（仅空间 Owner）*/
function canManageWsDataPerm(wsId) {
    const myWsRole = getUserWorkspaceRole(CURRENT_USER_ID, wsId);
    return myWsRole === 'Owner';
}

/* ===== 追加账户勾选面板 ===== */
let extraGrantEditingUserId = null;
let extraGrantCandidates = [];      // 当前面板可选的账户（不含 TA 自己授权的）
let extraGrantSelected = new Set(); // 当前面板的选中集合（跨搜索保留）

function openExtraGrantModal(userId) {
    extraGrantEditingUserId = userId;
    const wsId = viewingWorkspaceId;
    const user = getUser(userId);
    if (!user) return;

    const subtitle = document.getElementById('extraGrantSubtitle');
    if (subtitle) subtitle.textContent = '为 ' + user.name + ' 追加账户授权（在此空间）';

    // 候选池：空间内 - TA 自己授权的
    extraGrantCandidates = AD_ACCOUNTS
        .filter(a => a.workspaceId === wsId && a.ownerUserId !== userId);
    // 初始化选中：数据库中当前已授予的
    extraGrantSelected = new Set(getUserExtraGrantedAccountIds(userId, wsId));

    // 重置搜索框
    const searchEl = document.getElementById('extraGrantSearch');
    if (searchEl) searchEl.value = '';

    renderExtraGrantList();
    document.getElementById('extraGrantModal').style.display = 'flex';
}

function renderExtraGrantList() {
    const rawKw = document.getElementById('extraGrantSearch')?.value || '';
    const keywords = parseKeywords(rawKw);
    const list = document.getElementById('extraGrantAccountList');
    if (!list) return;

    // 过滤（账户名 / 账户 code / 授权人名 / 授权人邮箱）
    const filtered = extraGrantCandidates.filter(a => {
        if (keywords.length === 0) return true;
        const owner = getUser(a.ownerUserId);
        const hay = [
            a.accountName || '',
            a.accountCode || '',
            owner?.name || '',
            owner?.email || ''
        ].join('  ').toLowerCase();
        // 任一关键词命中即通过
        return keywords.some(k => hay.includes(k));
    });

    // 按平台分组保留原顺序
    const groups = {};
    filtered.forEach(a => {
        (groups[a.platform] = groups[a.platform] || []).push(a);
    });

    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding:24px;">' +
            (extraGrantCandidates.length === 0 ? '该空间没有可追加授权的账户' : '没有匹配的账户') +
        '</div>';
    } else {
        list.innerHTML = Object.keys(groups).map(platform => {
            const platformLabel = (PLATFORMS.find(p => p.key === platform) || {}).name || platform;
            const rows = groups[platform].map(a => {
                const owner = getUser(a.ownerUserId);
                const isChecked = extraGrantSelected.has(a.id);
                const nameHtml = highlightMatchMulti(a.accountName, keywords);
                const ownerName = owner ? highlightMatchMulti(owner.name, keywords) : '-';
                const code = highlightMatchMulti(a.accountCode, keywords);
                return '<label class="dp-extra-item">' +
                    '<input type="checkbox" data-account-id="' + a.id + '" ' + (isChecked ? 'checked' : '') + ' onchange="onExtraGrantToggle(' + a.id + ', this.checked)">' +
                    '<div style="flex:1; min-width:0;">' +
                        '<div style="font-weight:500;">' + nameHtml + '</div>' +
                        '<div style="font-size:11px; color:#9ca3af;">' + code + ' · 授权人 ' + ownerName + '</div>' +
                    '</div>' +
                '</label>';
            }).join('');
            return '<div class="dp-extra-group">' +
                '<div class="dp-extra-group-head"><span class="platform-badge platform-' + escapeHtml(platform) + '">' + escapeHtml(platformLabel) + '</span> · ' + groups[platform].length + ' 个账户</div>' +
                rows +
            '</div>';
        }).join('');
    }

    updateExtraGrantBatchInfo();
}

function onExtraGrantToggle(accountId, checked) {
    if (checked) extraGrantSelected.add(accountId);
    else extraGrantSelected.delete(accountId);
    updateExtraGrantBatchInfo();
}

function extraGrantSelectAll(selectAll) {
    // 只对"当前搜索可见"的行生效
    const boxes = document.querySelectorAll('#extraGrantAccountList input[type="checkbox"]');
    boxes.forEach(cb => {
        const id = parseInt(cb.dataset.accountId);
        cb.checked = selectAll;
        if (selectAll) extraGrantSelected.add(id);
        else extraGrantSelected.delete(id);
    });
    updateExtraGrantBatchInfo();
}

function updateExtraGrantBatchInfo() {
    const info = document.getElementById('extraGrantBatchInfo');
    if (!info) return;
    info.textContent = '已选 ' + extraGrantSelected.size + ' / ' + extraGrantCandidates.length;
}

function parseKeywords(raw) {
    if (!raw) return [];
    return String(raw)
        .split(/[\s,;，；\n\t]+/)
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
}

function highlightMatchMulti(text, keywords) {
    if (!text) return '';
    const t = String(text);
    if (!keywords || keywords.length === 0) return escapeHtml(t);

    // 找出所有关键词命中区间（可能重叠，合并成不相交的区段）
    const lower = t.toLowerCase();
    const spans = [];
    keywords.forEach(k => {
        if (!k) return;
        let idx = lower.indexOf(k);
        while (idx !== -1) {
            spans.push([idx, idx + k.length]);
            idx = lower.indexOf(k, idx + 1);
        }
    });
    if (spans.length === 0) return escapeHtml(t);

    // 合并区间
    spans.sort((a, b) => a[0] - b[0]);
    const merged = [];
    spans.forEach(([s, e]) => {
        const last = merged[merged.length - 1];
        if (last && s <= last[1]) last[1] = Math.max(last[1], e);
        else merged.push([s, e]);
    });

    // 拼接输出
    let out = '';
    let cursor = 0;
    merged.forEach(([s, e]) => {
        out += escapeHtml(t.slice(cursor, s));
        out += '<mark class="dp-hit">' + escapeHtml(t.slice(s, e)) + '</mark>';
        cursor = e;
    });
    out += escapeHtml(t.slice(cursor));
    return out;
}

function closeExtraGrantModal() {
    document.getElementById('extraGrantModal').style.display = 'none';
    extraGrantEditingUserId = null;
    extraGrantCandidates = [];
    extraGrantSelected = new Set();
}

function saveExtraGrant() {
    if (extraGrantEditingUserId == null) return;
    setUserExtraGrantedAccounts(extraGrantEditingUserId, viewingWorkspaceId, Array.from(extraGrantSelected));
    closeExtraGrantModal();
    renderWsDataPermissions(viewingWorkspaceId);
}

/**
 * 初始化左右两个视角的选择器：默认挑选两个"能看到的账户数不同"的成员，
 * 让对比效果最直观。
 */
function initDpCompareSelectors(wsId) {
    const selA = document.getElementById('dpViewerA');
    const selB = document.getElementById('dpViewerB');
    if (!selA || !selB) return;

    const wsMembers = getWorkspaceMembers(wsId);
    if (wsMembers.length === 0) {
        selA.innerHTML = '';
        selB.innerHTML = '';
        return;
    }

    const wsAccounts = AD_ACCOUNTS.filter(a => a.workspaceId === wsId);
    const membersWithCount = wsMembers.map(m => ({
        ...m,
        visibleCount: wsAccounts.filter(a => canUserAccessAdAccount(m.id, a.id)).length
    }));

    // 挑对比度最大的两个人：可见数最多的人 vs 最少的人
    const sortedDesc = [...membersWithCount].sort((a, b) => b.visibleCount - a.visibleCount);
    const defaultA = sortedDesc[0]?.id;
    const defaultB = sortedDesc[sortedDesc.length - 1]?.id;

    const optionsHtml = membersWithCount.map(m =>
        '<option value="' + m.id + '">' + escapeHtml(m.name) + '（可见 ' + m.visibleCount + ' 个账户）</option>'
    ).join('');

    selA.innerHTML = optionsHtml;
    selB.innerHTML = optionsHtml;
    if (defaultA != null) selA.value = String(defaultA);
    if (defaultB != null && defaultB !== defaultA) selB.value = String(defaultB);
    else selB.value = String(membersWithCount[Math.min(1, membersWithCount.length - 1)].id);
}

/** 左右并排渲染两个视角下的同一份看板 */
function renderDpCompare() {
    const wsId = viewingWorkspaceId;
    if (wsId == null) return;
    const selA = document.getElementById('dpViewerA');
    const selB = document.getElementById('dpViewerB');
    if (!selA || !selB) return;

    const uidA = parseInt(selA.value);
    const uidB = parseInt(selB.value);
    renderDpBoardInto(document.getElementById('dpBoardA'), uidA, wsId);
    renderDpBoardInto(document.getElementById('dpBoardB'), uidB, wsId);

    // 洞察：两个视角能看到的账户数差异
    const wsAccounts = AD_ACCOUNTS.filter(a => a.workspaceId === wsId);
    const visA = wsAccounts.filter(a => canUserAccessAdAccount(uidA, a.id)).length;
    const visB = wsAccounts.filter(a => canUserAccessAdAccount(uidB, a.id)).length;
    const nameA = (getUser(uidA) || {}).name || '-';
    const nameB = (getUser(uidB) || {}).name || '-';
    const insight = document.getElementById('dpInsight');
    if (insight) {
        if (uidA === uidB) {
            insight.innerHTML = '<span class="dp-insight-icon">💡</span> 两个视角选择了同一人，请分别选择不同成员以看到差异。';
        } else if (visA === visB) {
            insight.innerHTML = '<span class="dp-insight-icon">💡</span> <strong>' + escapeHtml(nameA) + '</strong> 和 <strong>' + escapeHtml(nameB) + '</strong> 恰好都能看到 <strong>' + visA + '</strong> 个账户（看板结果相同）。';
        } else {
            insight.innerHTML = '<span class="dp-insight-icon">💡</span> <strong>' + escapeHtml(nameA) + '</strong> 能看到 <strong>' + visA + '</strong> 个账户，<strong>' + escapeHtml(nameB) + '</strong> 能看到 <strong>' + visB + '</strong> 个。同一份「ROI 周报」在两人眼里，KPI 与明细都不同。';
        }
    }
}

/** 在指定容器里渲染某个视角下的 KPI + 明细 */
function renderDpBoardInto(container, userId, wsId) {
    if (!container) return;
    const wsAccounts = AD_ACCOUNTS.filter(a => a.workspaceId === wsId);
    const visible = wsAccounts.filter(a => canUserAccessAdAccount(userId, a.id));
    const hiddenCount = wsAccounts.length - visible.length;

    const agg = visible.reduce((acc, a) => {
        const m = AD_ACCOUNT_METRICS[a.id];
        if (!m) return acc;
        acc.spend += m.spend;
        acc.conv  += m.conversions;
        acc.roasWeighted += m.roas * m.spend;
        return acc;
    }, { spend: 0, conv: 0, roasWeighted: 0 });
    const roas = agg.spend > 0 ? (agg.roasWeighted / agg.spend).toFixed(2) : '—';

    const kpiRow =
        '<div class="dp-kpi-row">' +
            '<div class="dp-kpi"><div class="dp-kpi-label">花费</div><div class="dp-kpi-value">¥' + fmtNumber(agg.spend) + '</div></div>' +
            '<div class="dp-kpi"><div class="dp-kpi-label">转化</div><div class="dp-kpi-value">' + fmtNumber(agg.conv) + '</div></div>' +
            '<div class="dp-kpi"><div class="dp-kpi-label">ROAS</div><div class="dp-kpi-value">' + roas + '</div></div>' +
        '</div>';

    const listHtml = visible.length === 0
        ? '<div class="dp-empty">📭 该用户没有任何广告账户的访问权限，看板为空</div>'
        : '<div class="dp-list">' +
            '<div class="dp-list-head"><span>账户</span><span>花费</span><span>ROAS</span></div>' +
            visible.map(a => {
                const m = AD_ACCOUNT_METRICS[a.id] || {};
                return '<div class="dp-list-row">' +
                    '<span class="dp-list-name">' +
                        '<span class="platform-badge platform-' + escapeHtml(a.platform) + '">' + escapeHtml((PLATFORMS.find(p => p.key === a.platform) || {}).name || a.platform) + '</span>' +
                        escapeHtml(a.accountName) +
                    '</span>' +
                    '<span class="dp-list-num">¥' + fmtNumber(m.spend || 0) + '</span>' +
                    '<span class="dp-list-num">' + (m.roas || 0).toFixed(2) + '</span>' +
                '</div>';
            }).join('') +
        '</div>';

    const maskHtml = hiddenCount > 0
        ? '<div class="dp-mask">🔒 还有 <strong>' + hiddenCount + '</strong> 个账户未共享给此用户，已自动隐藏</div>'
        : '<div class="dp-mask dp-mask-ok">✅ 空间内所有账户均对此用户可见</div>';

    container.innerHTML = kpiRow + listHtml + maskHtml;
}

/* ===== 工具函数 ===== */
function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmtNumber(n) {
    if (n == null || isNaN(n)) return '0';
    return Number(n).toLocaleString('zh-CN');
}


/* ============================================================
 * 批量授权：多账户 × 多成员
 * ============================================================ */
let bulkAccountCandidates = [];      // 空间内全部账户（候选）
let bulkMemberCandidates = [];       // 空间内非 Owner 成员（候选，Owner 不需要额外授权）
let bulkSelectedAccounts = new Set();
let bulkSelectedMembers = new Set();

function openBulkGrantModal() {
    const wsId = viewingWorkspaceId;
    if (wsId == null) return;

    bulkAccountCandidates = AD_ACCOUNTS.filter(a => a.workspaceId === wsId);
    bulkMemberCandidates = getWorkspaceMembers(wsId).filter(m => m.wsRole !== 'Owner');

    bulkSelectedAccounts = new Set();
    bulkSelectedMembers = new Set();

    // 重置搜索
    const s1 = document.getElementById('bulkAccSearch');
    const s2 = document.getElementById('bulkMemberSearch');
    if (s1) s1.value = '';
    if (s2) s2.value = '';

    renderBulkAccList();
    renderBulkMemberList();
    updateBulkPreview();

    document.getElementById('bulkGrantModal').style.display = 'flex';
}

function closeBulkGrantModal() {
    document.getElementById('bulkGrantModal').style.display = 'none';
    bulkAccountCandidates = [];
    bulkMemberCandidates = [];
    bulkSelectedAccounts = new Set();
    bulkSelectedMembers = new Set();
}

function renderBulkAccList() {
    const kws = parseKeywords(document.getElementById('bulkAccSearch')?.value || '');
    const list = document.getElementById('bulkAccList');
    if (!list) return;

    const filtered = bulkAccountCandidates.filter(a => {
        if (kws.length === 0) return true;
        const owner = getUser(a.ownerUserId);
        const hay = [a.accountName, a.accountCode, owner?.name, owner?.email].filter(Boolean).join('  ').toLowerCase();
        return kws.some(k => hay.includes(k));
    });

    // 按平台分组
    const groups = {};
    filtered.forEach(a => (groups[a.platform] = groups[a.platform] || []).push(a));

    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding:20px;">' +
            (bulkAccountCandidates.length === 0 ? '该空间没有广告账户' : '没有匹配的账户') +
        '</div>';
    } else {
        list.innerHTML = Object.keys(groups).map(platform => {
            const platformLabel = (PLATFORMS.find(p => p.key === platform) || {}).name || platform;
            const rows = groups[platform].map(a => {
                const owner = getUser(a.ownerUserId);
                const isChecked = bulkSelectedAccounts.has(a.id);
                return '<label class="dp-extra-item">' +
                    '<input type="checkbox" data-account-id="' + a.id + '" ' + (isChecked ? 'checked' : '') + ' onchange="onBulkAccountToggle(' + a.id + ', this.checked)">' +
                    '<div style="flex:1; min-width:0;">' +
                        '<div style="font-weight:500;">' + highlightMatchMulti(a.accountName, kws) + '</div>' +
                        '<div style="font-size:11px; color:#9ca3af;">' + highlightMatchMulti(a.accountCode, kws) + ' · 授权人 ' + (owner ? highlightMatchMulti(owner.name, kws) : '-') + '</div>' +
                    '</div>' +
                '</label>';
            }).join('');
            return '<div class="dp-extra-group">' +
                '<div class="dp-extra-group-head"><span class="platform-badge platform-' + escapeHtml(platform) + '">' + escapeHtml(platformLabel) + '</span> · ' + groups[platform].length + ' 个账户</div>' +
                rows +
            '</div>';
        }).join('');
    }

    document.getElementById('bulkAccCount').textContent = bulkSelectedAccounts.size + ' / ' + bulkAccountCandidates.length;
    updateBulkPreview();
}

function renderBulkMemberList() {
    const kws = parseKeywords(document.getElementById('bulkMemberSearch')?.value || '');
    const list = document.getElementById('bulkMemberList');
    if (!list) return;

    const filtered = bulkMemberCandidates.filter(m => {
        if (kws.length === 0) return true;
        const hay = [m.name, m.email].filter(Boolean).join('  ').toLowerCase();
        return kws.some(k => hay.includes(k));
    });

    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state" style="padding:20px;">' +
            (bulkMemberCandidates.length === 0 ? '空间内没有可授权的成员（Owner 已看全部）' : '没有匹配的成员') +
        '</div>';
    } else {
        list.innerHTML = filtered.map(m => {
            const isChecked = bulkSelectedMembers.has(m.id);
            const mode = getUserWorkspaceDataMode(m.id, viewingWorkspaceId);
            const modeLabel = mode === 'all' ? '<span class="dp-mode-tag dp-mode-all" style="font-size:10px; padding:1px 6px;">全部</span>' : '';
            return '<label class="dp-extra-item">' +
                '<input type="checkbox" data-user-id="' + m.id + '" ' + (isChecked ? 'checked' : '') + ' onchange="onBulkMemberToggle(' + m.id + ', this.checked)">' +
                '<div style="flex:1; min-width:0;">' +
                    '<div style="font-weight:500;">' + highlightMatchMulti(m.name, kws) + ' <span class="role-badge ' + (m.wsRole || '').toLowerCase() + '" style="font-size:10px; padding:1px 5px; margin-left:4px;">' + (m.wsRole || '-') + '</span> ' + modeLabel + '</div>' +
                    '<div style="font-size:11px; color:#9ca3af;">' + highlightMatchMulti(m.email, kws) + '</div>' +
                '</div>' +
            '</label>';
        }).join('');
    }

    document.getElementById('bulkMemberCount').textContent = bulkSelectedMembers.size + ' / ' + bulkMemberCandidates.length;
    updateBulkPreview();
}

function onBulkAccountToggle(accountId, checked) {
    if (checked) bulkSelectedAccounts.add(accountId);
    else bulkSelectedAccounts.delete(accountId);
    document.getElementById('bulkAccCount').textContent = bulkSelectedAccounts.size + ' / ' + bulkAccountCandidates.length;
    updateBulkPreview();
}

function onBulkMemberToggle(userId, checked) {
    if (checked) bulkSelectedMembers.add(userId);
    else bulkSelectedMembers.delete(userId);
    document.getElementById('bulkMemberCount').textContent = bulkSelectedMembers.size + ' / ' + bulkMemberCandidates.length;
    updateBulkPreview();
}

function bulkSelectAllAccounts(select) {
    const boxes = document.querySelectorAll('#bulkAccList input[type="checkbox"]');
    boxes.forEach(cb => {
        const id = parseInt(cb.dataset.accountId);
        cb.checked = select;
        if (select) bulkSelectedAccounts.add(id);
        else bulkSelectedAccounts.delete(id);
    });
    document.getElementById('bulkAccCount').textContent = bulkSelectedAccounts.size + ' / ' + bulkAccountCandidates.length;
    updateBulkPreview();
}

function bulkSelectAllMembers(select) {
    const boxes = document.querySelectorAll('#bulkMemberList input[type="checkbox"]');
    boxes.forEach(cb => {
        const id = parseInt(cb.dataset.userId);
        cb.checked = select;
        if (select) bulkSelectedMembers.add(id);
        else bulkSelectedMembers.delete(id);
    });
    document.getElementById('bulkMemberCount').textContent = bulkSelectedMembers.size + ' / ' + bulkMemberCandidates.length;
    updateBulkPreview();
}

function updateBulkPreview() {
    const preview = document.getElementById('bulkPreview');
    if (!preview) return;
    const a = bulkSelectedAccounts.size;
    const m = bulkSelectedMembers.size;
    if (a === 0 || m === 0) {
        preview.className = 'dp-bulk-preview';
        preview.innerHTML = '<span style="color:#9ca3af;">请在左右两侧至少各选择一项</span>';
        return;
    }
    const pairs = a * m;
    preview.className = 'dp-bulk-preview dp-bulk-preview-ready';
    preview.innerHTML = '将把 <strong>' + a + '</strong> 个广告账户，追加授权给 <strong>' + m + '</strong> 名成员（共 <strong>' + pairs + '</strong> 条授权关系）';
}

function saveBulkGrant() {
    if (bulkSelectedAccounts.size === 0 || bulkSelectedMembers.size === 0) {
        alert('请至少选择一个账户和一名成员');
        return;
    }

    // 对每个成员，把其"已有追加授权"和"本次新增账户"合并，去重后写入
    // 注意：不覆盖成员在其他账户上的授权，只做增量追加
    bulkSelectedMembers.forEach(userId => {
        const existing = new Set(getUserExtraGrantedAccountIds(userId, viewingWorkspaceId));
        bulkSelectedAccounts.forEach(accountId => {
            // 跳过用户是账户 Owner 的（本来就能看）
            const acc = AD_ACCOUNTS.find(a => a.id === accountId);
            if (!acc || acc.ownerUserId === userId) return;
            existing.add(accountId);
        });
        setUserExtraGrantedAccounts(userId, viewingWorkspaceId, Array.from(existing));
    });

    const summary = '已把 ' + bulkSelectedAccounts.size + ' 个账户追加授权给 ' + bulkSelectedMembers.size + ' 名成员';
    closeBulkGrantModal();
    renderWsDataPermissions(viewingWorkspaceId);
    alert(summary);
}
