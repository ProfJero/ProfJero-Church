import { 
    auth, db, doc, setDoc, getDoc, 
    signInWithEmailAndPassword, signOut, onAuthStateChanged, Timestamp 
} from './firebase-config.js';

// Role definitions
const ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    PASTOR: 'pastor',
    TREASURER: 'treasurer',
    SECRETARY: 'secretary',
    STAFF: 'staff',
    VIEWER: 'viewer'
};

// Navigation items with their page names and required roles
const NAV_ITEMS = [
    { 
        id: 'dashboard', 
        label: 'Dashboard', 
        icon: 'fa-tachometer-alt',
        roles: ['super_admin', 'pastor', 'treasurer', 'secretary', 'admin', 'staff', 'viewer'],
        href: 'dashboard.html',
        order: 1
    },
    { 
        id: 'members', 
        label: 'Members Hub', 
        icon: 'fa-users',
        roles: ['super_admin', 'pastor', 'admin', 'staff', 'secretary'],
        href: 'members.html',
        order: 2
    },
    { 
        id: 'attendance', 
        label: 'Attendance AI', 
        icon: 'fa-calendar-check',
        roles: ['super_admin', 'pastor', 'secretary', 'admin'],
        href: 'attendance.html',
        order: 3
    },
    { 
        id: 'admin-content', 
        label: 'Content Manager', 
        icon: 'fa-edit',
        roles: ['super_admin', 'admin', 'secretary'],
        href: 'admin-content.html',
        order: 4
    },
    { 
        id: 'finance', 
        label: 'Smart Finance', 
        icon: 'fa-coins',
        roles: ['super_admin', 'treasurer', 'admin'],
        href: 'finance.html',
        order: 5
    },
    { 
        id: 'sms', 
        label: 'SMS Engine', 
        icon: 'fa-sms',
        roles: ['super_admin', 'pastor', 'admin'],
        href: 'sms.html',
        order: 6
    },
    { 
        id: 'pastoral', 
        label: 'Pastoral Care', 
        icon: 'fa-praying-hands',
        roles: ['super_admin', 'pastor', 'admin'],
        href: 'pastoral.html',
        order: 7
    },
    { 
        id: 'users', 
        label: 'User Management', 
        icon: 'fa-user-shield',
        roles: ['super_admin'],
        href: 'users.html',
        order: 8
    }
];

// Page permissions based on roles
const PAGE_PERMISSIONS = {
    'super_admin': ['dashboard', 'members', 'finance', 'attendance', 'sms', 'pastoral', 'users', 'admin-content', 'profile', 'settings'],
    'pastor': ['dashboard', 'members', 'attendance', 'sms', 'pastoral', 'profile'],
    'treasurer': ['dashboard', 'finance', 'profile'],
    'secretary': ['dashboard', 'members', 'attendance', 'admin-content', 'profile'],
    'admin': ['dashboard', 'members', 'finance', 'attendance', 'sms', 'pastoral', 'admin-content', 'profile'],
    'staff': ['dashboard', 'members', 'profile'],
    'viewer': ['dashboard', 'profile']
};

// Role permissions for granular access control
const rolePermissions = {
    [ROLES.SUPER_ADMIN]: ['view_dashboard', 'manage_members', 'manage_finance', 'manage_attendance', 'manage_sms', 'manage_pastoral', 'manage_users', 'manage_content', 'view_reports', 'delete_data', 'export_data', 'manage_settings'],
    [ROLES.ADMIN]: ['view_dashboard', 'manage_members', 'manage_finance', 'manage_attendance', 'manage_sms', 'manage_pastoral', 'manage_content', 'view_reports', 'export_data'],
    [ROLES.PASTOR]: ['view_dashboard', 'manage_members', 'manage_attendance', 'manage_pastoral', 'view_reports'],
    [ROLES.TREASURER]: ['view_dashboard', 'manage_finance', 'view_reports'],
    [ROLES.SECRETARY]: ['view_dashboard', 'manage_members', 'manage_attendance', 'manage_content', 'view_reports'],
    [ROLES.STAFF]: ['view_dashboard', 'manage_members', 'view_reports'],
    [ROLES.VIEWER]: ['view_dashboard', 'view_reports']
};

// ============================================
// HELPER FUNCTIONS
// ============================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>"]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        if (m === '"') return '&quot;';
        return m;
    });
}

// ============================================
// TOAST NOTIFICATION
// ============================================

export function showToast(message, type = 'info') {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'fixed bottom-5 left-1/2 transform -translate-x-1/2 z-50 bg-gray-800 text-white px-5 py-2 rounded-full shadow-lg text-sm font-medium transition-all duration-300';
        document.body.appendChild(toast);
    }
    
    if (toast._timeout) {
        clearTimeout(toast._timeout);
    }
    
    const colors = {
        success: 'bg-green-600',
        error: 'bg-red-600',
        info: 'bg-blue-600',
        warning: 'bg-yellow-600'
    };
    
    toast.className = `fixed bottom-5 left-1/2 transform -translate-x-1/2 z-50 ${colors[type] || 'bg-gray-800'} text-white px-5 py-2 rounded-full shadow-lg text-sm font-medium transition-all duration-300`;
    toast.textContent = message;
    toast.classList.remove('hidden', 'opacity-0');
    toast.classList.add('opacity-100');
    
    toast._timeout = setTimeout(() => {
        toast.classList.add('opacity-0');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 300);
    }, 4000);
}

// ============================================
// USER PROFILE FUNCTIONS
// ============================================

export async function createUserProfile(userId, userData) {
    try {
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, {
            uid: userId,
            email: userData.email,
            fullName: userData.fullName,
            role: userData.role,
            phoneNumber: userData.phoneNumber || '',
            department: userData.department || '',
            permissions: rolePermissions[userData.role] || [],
            isActive: true,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
            createdBy: userData.createdBy || null,
            lastLogin: null
        });
        return { success: true };
    } catch (error) {
        console.error('Error creating user profile:', error);
        return { success: false, error: error.message };
    }
}

export async function getCurrentUserData() {
    const user = auth.currentUser;
    if (!user) return null;
    
    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
            const userData = userDoc.data();
            sessionStorage.setItem('userRole', userData.role);
            sessionStorage.setItem('userProfile', JSON.stringify(userData));
            return { id: userDoc.id, ...userData };
        }
        return null;
    } catch (error) {
        console.error('Error getting user data:', error);
        return null;
    }
}

// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        let userRole = ROLES.VIEWER;
        let userProfile = null;
        
        if (userDoc.exists()) {
            userProfile = userDoc.data();
            userRole = userProfile.role;
            
            await setDoc(doc(db, 'users', user.uid), { 
                lastLogin: Timestamp.now(),
                updatedAt: Timestamp.now()
            }, { merge: true });
            
            sessionStorage.setItem('userRole', userRole);
            sessionStorage.setItem('userProfile', JSON.stringify(userProfile));
            
            showToast(`Welcome ${userProfile.fullName || user.email}!`, 'success');
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
            
            return { success: true, user, role: userRole, profile: userProfile };
        } else {
            showToast('Account not fully set up. Please contact administrator.', 'error');
            await signOut(auth);
            return { success: false, error: 'Account not configured' };
        }
    } catch (error) {
        let errorMessage = 'Login failed. ';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = 'Account not found. Please check your email.';
                break;
            case 'auth/wrong-password':
                errorMessage = 'Incorrect password. Please try again.';
                break;
            case 'auth/invalid-email':
                errorMessage = 'Invalid email address.';
                break;
            case 'auth/user-disabled':
                errorMessage = 'This account has been disabled. Contact administrator.';
                break;
            case 'auth/too-many-requests':
                errorMessage = 'Too many failed attempts. Please try again later.';
                break;
            default:
                errorMessage += error.message;
        }
        showToast(errorMessage, 'error');
        return { success: false, error: errorMessage };
    }
}

export function getCurrentUserRole() {
    return sessionStorage.getItem('userRole') || ROLES.VIEWER;
}

export function getCurrentUserProfile() {
    const profile = sessionStorage.getItem('userProfile');
    return profile ? JSON.parse(profile) : null;
}

export async function logoutUser() {
    try {
        await signOut(auth);
        sessionStorage.clear();
        localStorage.removeItem('userRole');
        showToast('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 500);
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error logging out', 'error');
    }
}

// ============================================
// PERMISSION FUNCTIONS
// ============================================

export function hasPermission(permission) {
    const userRole = getCurrentUserRole();
    const permissions = rolePermissions[userRole] || [];
    return permissions.includes(permission);
}

export function hasPagePermission(page) {
    const userRole = getCurrentUserRole();
    const allowedPages = PAGE_PERMISSIONS[userRole] || ['dashboard'];
    return allowedPages.includes(page);
}

export function getUserNavItems() {
    const userRole = getCurrentUserRole();
    return NAV_ITEMS
        .filter(item => item.roles.includes(userRole))
        .sort((a, b) => a.order - b.order);
}

// ============================================
// NAVIGATION UPDATE FUNCTIONS
// ============================================

function updateNavItems(navContainer, role) {
    const navItems = NAV_ITEMS.filter(item => item.roles.includes(role));
    
    const children = navContainer.children;
    const itemsToRemove = [];
    
    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (child.classList && child.classList.contains('nav-item')) {
            itemsToRemove.push(child);
        }
    }
    
    itemsToRemove.forEach(item => item.remove());
    
    let lastItem = null;
    navItems.forEach((item) => {
        const a = document.createElement('a');
        a.href = item.href;
        a.className = 'nav-item flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 hover:bg-purple-50 transition-all';
        a.dataset.page = item.id;
        
        const currentPage = window.location.pathname.split('/').pop().replace('.html', '');
        if (currentPage === item.id) {
            a.classList.add('active');
        }
        
        a.innerHTML = `
            <i class="fas ${item.icon} w-5 text-[#6a1b9a]"></i>
            <span>${item.label}</span>
        `;
        
        if (lastItem) {
            lastItem.parentNode.insertBefore(a, lastItem.nextSibling);
        } else {
            let firstNavItem = null;
            for (let i = 0; i < navContainer.children.length; i++) {
                if (navContainer.children[i].classList && navContainer.children[i].classList.contains('nav-item')) {
                    firstNavItem = navContainer.children[i];
                    break;
                }
            }
            if (firstNavItem) {
                navContainer.insertBefore(a, firstNavItem);
            } else {
                navContainer.appendChild(a);
            }
        }
        lastItem = a;
    });
    
    const userManagementLink = document.getElementById('userManagementLink');
    if (userManagementLink) {
        userManagementLink.style.display = role === 'super_admin' ? 'block' : 'none';
    }
}

function updateNavigationForRole(role) {
    const navContainer = document.getElementById('mainNav');
    if (!navContainer) {
        const nav = document.querySelector('nav');
        if (nav) {
            updateNavItems(nav, role);
        }
        return;
    }
    updateNavItems(navContainer, role);
}

// ============================================
// USER DISPLAY UPDATE
// ============================================

export function updateUserDisplay(userProfile) {
    const userDisplay = document.getElementById('userDisplay');
    if (!userDisplay) return;
    
    if (!userProfile) {
        userDisplay.innerHTML = `<a href="login.html" class="text-sm text-[#6a1b9a] font-medium">Login</a>`;
        return;
    }
    
    const roleBadges = {
        super_admin: 'bg-red-100 text-red-700',
        admin: 'bg-purple-100 text-purple-700',
        pastor: 'bg-blue-100 text-blue-700',
        treasurer: 'bg-green-100 text-green-700',
        secretary: 'bg-yellow-100 text-yellow-700',
        staff: 'bg-gray-100 text-gray-700',
        viewer: 'bg-cyan-100 text-cyan-700'
    };
    
    const badgeClass = roleBadges[userProfile.role] || 'bg-gray-100 text-gray-700';
    const roleLabel = (userProfile.role || 'viewer').replace('_', ' ').toUpperCase();
    const initials = userProfile.fullName ? 
        userProfile.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 
        'U';
    
    userDisplay.innerHTML = `
        <div class="user-dropdown">
            <div class="user-avatar" id="userAvatar" title="${escapeHtml(userProfile.fullName || 'User')}" style="cursor: pointer;">
                ${initials}
            </div>
            <div class="user-dropdown-content" id="userDropdown">
                <div style="padding: 12px 20px; border-bottom: 1px solid #f0e6f6;">
                    <div style="font-weight: 600; color: #1a1a1a;">${escapeHtml(userProfile.fullName || 'User')}</div>
                    <div style="font-size: 12px; color: #888;">${escapeHtml(userProfile.email || '')}</div>
                    <div style="font-size: 11px; color: #6a1b9a; margin-top: 4px; background: #f3e8ff; padding: 2px 10px; border-radius: 12px; display: inline-block;">
                        ${roleLabel}
                    </div>
                </div>
                <a href="profile.html">
                    <i class="fas fa-user-circle"></i> My Profile
                </a>
                ${userProfile.role === 'super_admin' || userProfile.role === 'admin' || userProfile.role === 'secretary' ? `
                    <a href="admin-content.html">
                        <i class="fas fa-edit"></i> Content Manager
                    </a>
                ` : ''}
                ${userProfile.role === 'super_admin' ? `
                    <a href="settings.html">
                        <i class="fas fa-cog"></i> Settings
                    </a>
                ` : ''}
                <div class="dropdown-divider"></div>
                <a href="#" id="logoutBtn" class="logout-item">
                    <i class="fas fa-sign-out-alt"></i> Logout
                </a>
            </div>
        </div>
    `;
    
    // Setup dropdown toggle
    const avatar = document.getElementById('userAvatar');
    const dropdown = document.getElementById('userDropdown');
    
    if (avatar && dropdown) {
        avatar.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.user-dropdown')) {
                dropdown.classList.remove('show');
            }
        });
    }
    
    // Setup logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await logoutUser();
        });
    }
}

// ============================================
// PAGE PROTECTION
// ============================================

export function protectPage(page = null) {
    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            unsubscribe();
            
            if (!user) {
                showToast('Please login to continue', 'info');
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 500);
                return;
            }
            
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                
                if (!userDoc.exists()) {
                    showToast('User profile not found. Please contact administrator.', 'error');
                    await signOut(auth);
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 1500);
                    return;
                }
                
                const userData = userDoc.data();
                const userRole = userData.role;
                
                if (userData.isActive === false) {
                    showToast('Your account has been deactivated. Contact administrator.', 'error');
                    await signOut(auth);
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 1500);
                    return;
                }
                
                sessionStorage.setItem('userRole', userRole);
                sessionStorage.setItem('userProfile', JSON.stringify(userData));
                localStorage.setItem('userRole', userRole);
                
                if (page) {
                    const hasAccess = hasPagePermission(page);
                    if (!hasAccess) {
                        showToast('Access denied. You do not have permission to view this page.', 'error');
                        setTimeout(() => {
                            window.location.href = 'dashboard.html';
                        }, 1500);
                        return;
                    }
                }
                
                updateUserDisplay(userData);
                updateNavigationForRole(userRole);
                
                resolve(userData);
            } catch (error) {
                console.error('Error in protectPage:', error);
                showToast('Error loading user data. Please refresh.', 'error');
                resolve(null);
            }
        });
    });
}

// ============================================
// MAKE LOGOUT AVAILABLE GLOBALLY
// ============================================

window.logoutUser = logoutUser;

// ============================================
// EXPORTS - ALL IN ONE PLACE
// ============================================

export { 
    ROLES,
    NAV_ITEMS,
    PAGE_PERMISSIONS,
    rolePermissions
};