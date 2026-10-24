import { auth, db, collection, getDocs, query, orderBy, doc, deleteDoc, updateDoc, Timestamp, getDoc } from './firebase-config.js';
import { createUserWithEmailAndPassword } from './firebase-config.js';
import { 
    protectPage, 
    showToast, 
    getCurrentUserRole, 
    getCurrentUserData, 
    logoutUser, 
    hasPagePermission,
    updateUserDisplay 
} from './auth.js';
import { createUserProfile } from './auth.js';

// State
let isSubmitting = false;
let currentUserData = null;

// Initialize page
async function initUsersPage() {
    try {
        // Protect page - only Super Admin can access
        const userData = await protectPage('users');
        
        if (!userData) {
            return;
        }
        
        currentUserData = userData;
        
        // Update user display
        updateUserDisplay(currentUserData);
        
        // Setup user dropdown
        setupUserDropdown();
        
        // Load users
        await loadUsers();
        
        // Setup event listeners
        setupEventListeners();
    } catch (error) {
        console.error('Error initializing users page:', error);
        showToast('Error loading page. Please refresh.', 'error');
    }
}

// Setup user dropdown for profile and logout
function setupUserDropdown() {
    const userDisplay = document.getElementById('userDisplay');
    if (!userDisplay) return;
    
    // Check if dropdown already exists
    if (document.querySelector('.user-dropdown')) return;
    
    const userInfo = currentUserData || { fullName: 'User', email: '' };
    const initials = userInfo.fullName ? userInfo.fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
    
    userDisplay.innerHTML = `
        <div class="user-dropdown">
            <div class="user-avatar" id="userAvatar" title="${escapeHtml(userInfo.fullName || 'User')}">
                ${initials}
            </div>
            <div class="user-dropdown-content" id="userDropdown">
                <div style="padding: 12px 20px; border-bottom: 1px solid #f0e6f6;">
                    <div style="font-weight: 600; color: #1a1a1a;">${escapeHtml(userInfo.fullName || 'User')}</div>
                    <div style="font-size: 12px; color: #888;">${escapeHtml(userInfo.email || '')}</div>
                    <div style="font-size: 11px; color: #6a1b9a; margin-top: 4px; background: #f3e8ff; padding: 2px 10px; border-radius: 12px; display: inline-block;">
                        ${userInfo.role ? userInfo.role.replace('_', ' ').toUpperCase() : 'Unknown'}
                    </div>
                </div>
                <a href="profile.html">
                    <i class="fas fa-user-circle"></i> My Profile
                </a>
                ${userInfo.role === 'super_admin' ? `
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

// Load users
async function loadUsers() {
    const container = document.getElementById('usersList');
    try {
        // Show loading state
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <i class="fas fa-spinner fa-spin text-2xl mb-2 block"></i>
                Loading users...
            </div>
        `;
        
        const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const users = [];
        snapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });
        
        if (users.length === 0) {
            container.innerHTML = `
                <div class="text-center py-12 text-gray-400">
                    <i class="fas fa-users text-5xl mb-3 opacity-50"></i>
                    <p>No users found. Create your first user above.</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="overflow-x-auto">
                <table class="min-w-full">
                    <thead class="bg-gradient-to-r from-[#6a1b9a] to-[#9c4dcc] text-white rounded-lg">
                        <tr>
                            <th class="px-4 py-3 text-left text-sm">User</th>
                            <th class="px-4 py-3 text-left text-sm">Role</th>
                            <th class="px-4 py-3 text-left text-sm">Contact</th>
                            <th class="px-4 py-3 text-left text-sm">Department</th>
                            <th class="px-4 py-3 text-left text-sm">Status</th>
                            <th class="px-4 py-3 text-center text-sm">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr class="border-b hover:bg-gray-50 transition">
                                <td class="px-4 py-3">
                                    <div class="font-medium text-gray-800">${escapeHtml(user.fullName || user.email)}</div>
                                    <div class="text-xs text-gray-400">${escapeHtml(user.email)}</div>
                                </td>
                                <td class="px-4 py-3">
                                    <span class="px-2 py-1 text-xs rounded-full ${getRoleBadge(user.role)}">
                                        ${user.role ? user.role.replace('_', ' ').toUpperCase() : 'Unknown'}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-sm">${escapeHtml(user.phoneNumber || '—')}</td>
                                <td class="px-4 py-3 text-sm">${escapeHtml(user.department || '—')}</td>
                                <td class="px-4 py-3">
                                    <span class="px-2 py-1 text-xs rounded-full ${user.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                                        ${user.isActive !== false ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td class="px-4 py-3 text-center">
                                    <button onclick="window.toggleUserStatus('${user.id}', ${user.isActive !== false ? 'false' : 'true'})" 
                                        class="text-blue-600 hover:text-blue-800 mx-1 transition" 
                                        title="${user.isActive !== false ? 'Deactivate' : 'Activate'}">
                                        <i class="fas ${user.isActive !== false ? 'fa-ban' : 'fa-check-circle'}"></i>
                                    </button>
                                    <button onclick="window.deleteUser('${user.id}')" 
                                        class="text-red-600 hover:text-red-800 mx-1 transition" 
                                        title="Delete">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Error loading users:', error);
        container.innerHTML = `
            <div class="text-center py-8 text-red-500">
                <i class="fas fa-exclamation-circle text-2xl mb-2 block"></i>
                Error loading users. Please refresh the page.
                <br>
                <button onclick="loadUsers()" class="mt-2 bg-[#6a1b9a] text-white px-4 py-2 rounded-lg">
                    <i class="fas fa-sync-alt mr-2"></i> Retry
                </button>
            </div>
        `;
    }
}

// Get role badge class
function getRoleBadge(role) {
    const badges = {
        'super_admin': 'bg-purple-100 text-purple-700',
        'pastor': 'bg-blue-100 text-blue-700',
        'treasurer': 'bg-green-100 text-green-700',
        'secretary': 'bg-orange-100 text-orange-700',
        'admin': 'bg-indigo-100 text-indigo-700',
        'staff': 'bg-gray-100 text-gray-700',
        'viewer': 'bg-cyan-100 text-cyan-700'
    };
    return badges[role] || 'bg-gray-100 text-gray-700';
}

// Create new user
async function createUser(userData) {
    const btn = document.getElementById('createUserBtn');
    const originalText = btn.innerHTML;
    
    try {
        // Show loading state
        btn.innerHTML = '<span class="btn-spinner"></span><span class="btn-text">Creating...</span>';
        btn.classList.add('btn-loading');
        btn.disabled = true;
        
        const { email, password, fullName, role, phone, department } = userData;
        
        // Create Firebase Auth user
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Create Firestore profile
        await createUserProfile(user.uid, {
            email: email,
            fullName: fullName,
            role: role,
            phoneNumber: phone,
            department: department,
            createdBy: auth.currentUser?.uid,
            isActive: true
        });
        
        showToast(`User ${fullName} created successfully! ✅`, 'success');
        document.getElementById('userForm').reset();
        await loadUsers();
        
        // Reset button
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        
        return true;
    } catch (error) {
        console.error('Error creating user:', error);
        let errorMessage = 'Error creating user. Please try again.';
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Email already in use. Please use a different email.';
        } else if (error.message) {
            errorMessage = error.message;
        }
        showToast(errorMessage, 'error');
        
        // Reset button
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        
        return false;
    }
}

// Toggle user status with loading
window.toggleUserStatus = async (userId, newStatus) => {
    const buttons = document.querySelectorAll(`button[onclick*="toggleUserStatus('${userId}'"]`);
    let btn = buttons[0];
    const originalHtml = btn ? btn.innerHTML : '';
    
    try {
        // Show loading on button
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            btn.disabled = true;
        }
        
        await updateDoc(doc(db, "users", userId), {
            isActive: newStatus,
            updatedAt: Timestamp.now()
        });
        showToast(`User ${newStatus ? 'activated' : 'deactivated'} successfully`, 'success');
        await loadUsers();
    } catch (error) {
        showToast('Error updating status', 'error');
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }
};

// Delete user with loading
window.deleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) return;
    
    const buttons = document.querySelectorAll(`button[onclick*="deleteUser('${userId}'"]`);
    let btn = buttons[0];
    const originalHtml = btn ? btn.innerHTML : '';
    
    try {
        if (btn) {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            btn.disabled = true;
        }
        
        await deleteDoc(doc(db, "users", userId));
        showToast('User deleted successfully', 'success');
        await loadUsers();
    } catch (error) {
        showToast('Error deleting user', 'error');
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }
};

// Setup event listeners
function setupEventListeners() {
    // Create user form
    document.getElementById('userForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (isSubmitting) return;
        
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const fullName = document.getElementById('fullName').value.trim();
        const role = document.getElementById('role').value;
        const phone = document.getElementById('phone').value.trim();
        const department = document.getElementById('department').value.trim();
        
        if (!email || !password || !fullName || !role) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        if (password.length < 6) {
            showToast('Password must be at least 6 characters', 'error');
            return;
        }
        
        isSubmitting = true;
        
        const success = await createUser({
            email,
            password,
            fullName,
            role,
            phone,
            department
        });
        
        isSubmitting = false;
    });
    
    // Refresh users
    document.getElementById('refreshUsersBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('refreshUsersBtn');
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        btn.disabled = true;
        await loadUsers();
        btn.innerHTML = '<i class="fas fa-sync-alt"></i>';
        btn.disabled = false;
    });
    
    // Search functionality
    document.getElementById('searchInput').addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const rows = document.querySelectorAll('#usersList tbody tr');
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    });
    
    // Sidebar logout
    document.getElementById('sidebarLogoutBtn')?.addEventListener('click', async (e) => {
        e.preventDefault();
        await logoutUser();
    });
}

// Helper functions
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

// Initialize
document.addEventListener('DOMContentLoaded', initUsersPage);