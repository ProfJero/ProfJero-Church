// User Roles and Permissions Matrix
export const ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    PASTOR: 'pastor',
    TREASURER: 'treasurer',
    SECRETARY: 'secretary',
    STAFF: 'staff',
    VIEWER: 'viewer'
};

export const PERMISSIONS = {
    VIEW_DASHBOARD: 'view_dashboard',
    MANAGE_MEMBERS: 'manage_members',
    MANAGE_FINANCE: 'manage_finance',
    MANAGE_ATTENDANCE: 'manage_attendance',
    MANAGE_SMS: 'manage_sms',
    MANAGE_PASTORAL: 'manage_pastoral',
    MANAGE_USERS: 'manage_users',
    VIEW_REPORTS: 'view_reports',
    DELETE_DATA: 'delete_data',
    EXPORT_DATA: 'export_data'
};

// Role-based permission mapping
export const rolePermissions = {
    [ROLES.SUPER_ADMIN]: [
        PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.MANAGE_MEMBERS, PERMISSIONS.MANAGE_FINANCE,
        PERMISSIONS.MANAGE_ATTENDANCE, PERMISSIONS.MANAGE_SMS, PERMISSIONS.MANAGE_PASTORAL,
        PERMISSIONS.MANAGE_USERS, PERMISSIONS.VIEW_REPORTS, PERMISSIONS.DELETE_DATA, PERMISSIONS.EXPORT_DATA
    ],
    [ROLES.ADMIN]: [
        PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.MANAGE_MEMBERS, PERMISSIONS.MANAGE_FINANCE,
        PERMISSIONS.MANAGE_ATTENDANCE, PERMISSIONS.MANAGE_SMS, PERMISSIONS.MANAGE_PASTORAL,
        PERMISSIONS.VIEW_REPORTS, PERMISSIONS.EXPORT_DATA
    ],
    [ROLES.PASTOR]: [
        PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.MANAGE_MEMBERS, PERMISSIONS.MANAGE_ATTENDANCE,
        PERMISSIONS.MANAGE_PASTORAL, PERMISSIONS.VIEW_REPORTS
    ],
    [ROLES.TREASURER]: [
        PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.MANAGE_FINANCE, PERMISSIONS.VIEW_REPORTS
    ],
    [ROLES.SECRETARY]: [
        PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.MANAGE_MEMBERS, PERMISSIONS.MANAGE_ATTENDANCE,
        PERMISSIONS.MANAGE_SMS, PERMISSIONS.VIEW_REPORTS
    ],
    [ROLES.STAFF]: [
        PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.MANAGE_MEMBERS, PERMISSIONS.VIEW_REPORTS
    ],
    [ROLES.VIEWER]: [
        PERMISSIONS.VIEW_DASHBOARD, PERMISSIONS.VIEW_REPORTS
    ]
};

// Check if user has a specific permission
export function hasPermission(userRole, permission) {
    if (!userRole) return false;
    const userPermissions = rolePermissions[userRole];
    return userPermissions ? userPermissions.includes(permission) : false;
}

// Get all roles for dropdown
export function getAllRoles() {
    return [
        { value: ROLES.SUPER_ADMIN, label: 'Super Admin', description: 'Full system access' },
        { value: ROLES.ADMIN, label: 'Admin', description: 'Manage all church operations' },
        { value: ROLES.PASTOR, label: 'Pastor', description: 'Pastoral care & members' },
        { value: ROLES.TREASURER, label: 'Treasurer', description: 'Finance only' },
        { value: ROLES.SECRETARY, label: 'Secretary', description: 'Members & attendance' },
        { value: ROLES.STAFF, label: 'Staff', description: 'Basic access' },
        { value: ROLES.VIEWER, label: 'Viewer', description: 'Read-only access' }
    ];
}

// Get role badge color
export function getRoleBadge(role) {
    const badges = {
        [ROLES.SUPER_ADMIN]: 'bg-red-100 text-red-700',
        [ROLES.ADMIN]: 'bg-purple-100 text-purple-700',
        [ROLES.PASTOR]: 'bg-blue-100 text-blue-700',
        [ROLES.TREASURER]: 'bg-green-100 text-green-700',
        [ROLES.SECRETARY]: 'bg-yellow-100 text-yellow-700',
        [ROLES.STAFF]: 'bg-gray-100 text-gray-700',
        [ROLES.VIEWER]: 'bg-cyan-100 text-cyan-700'
    };
    return badges[role] || 'bg-gray-100 text-gray-700';
}