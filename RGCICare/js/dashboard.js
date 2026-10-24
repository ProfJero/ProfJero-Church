import { db, collection, getDocs, query, orderBy, limit, Timestamp } from './firebase-config.js';
import { 
    protectPage, 
    updateUserDisplay, 
    getCurrentUserRole, 
    showToast, 
    getCurrentUserProfile,
    hasPagePermission,
    getUserNavItems,
    logoutUser
} from './auth.js';

// State
let currentUserData = null;

// Initialize page
export async function initDashboard() {
    try {
        // Protect page - requires authentication
        const userData = await protectPage('dashboard');
        
        if (!userData) {
            return;
        }
        
        currentUserData = userData;
        
        // Update welcome message
        const welcomeEl = document.getElementById('welcomeMessage');
        if (welcomeEl && userData.fullName) {
            welcomeEl.textContent = `Welcome back, ${userData.fullName}!`;
        }
        
        // Update user display with logout functionality
        updateUserDisplay(userData);
        
        // Load dashboard data
        await loadDashboardData();
        
        // Generate quick actions based on permissions
        generateQuickActions();
        
        // Hide loading, show content
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('dashboardContent').classList.remove('hidden');
        
        // Setup logout button listener (additional safety)
        setupLogoutListener();
        
    } catch (error) {
        console.error('Error initializing dashboard:', error);
        showToast('Error loading dashboard', 'error');
    }
}

// Setup logout listener
function setupLogoutListener() {
    // Find logout button in dropdown
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await logoutUser();
        });
    }
    
    // Also check for sidebar logout if it exists
    const sidebarLogoutBtn = document.getElementById('sidebarLogoutBtn');
    if (sidebarLogoutBtn) {
        sidebarLogoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await logoutUser();
        });
    }
}

// Load dashboard data
async function loadDashboardData() {
    try {
        // Fetch all data in parallel
        const [membersSnap, offeringsSnap, attendanceSnap, messagesSnap] = await Promise.all([
            getDocs(collection(db, "members")),
            getDocs(collection(db, "offerings")),
            getDocs(query(collection(db, "attendance"), orderBy("checkInTime", "desc"), limit(10))),
            getDocs(query(collection(db, "communications"), orderBy("createdAt", "desc"), limit(5)))
        ]);
        
        // Calculate total offerings
        let totalOfferings = 0;
        let monthlyOfferings = 0;
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        offeringsSnap.forEach(doc => {
            const data = doc.data();
            const amount = data.amount || 0;
            totalOfferings += amount;
            
            if (data.date && data.date.toDate) {
                const offeringDate = data.date.toDate();
                if (offeringDate.getMonth() === currentMonth && offeringDate.getFullYear() === currentYear) {
                    monthlyOfferings += amount;
                }
            }
        });
        
        // Update stats
        document.getElementById('memberCount').textContent = membersSnap.size;
        document.getElementById('totalOfferings').textContent = `GH₵ ${totalOfferings.toFixed(2)}`;
        document.getElementById('monthlyOfferings').textContent = `GH₵ ${monthlyOfferings.toFixed(2)}`;
        document.getElementById('checkinCount').textContent = attendanceSnap.size;
        
        // Recent check-ins
        const recentCheckins = [];
        attendanceSnap.forEach(doc => recentCheckins.push(doc.data()));
        const checkinsDiv = document.getElementById('recentCheckins');
        
        if (recentCheckins.length === 0) {
            checkinsDiv.innerHTML = '<div class="text-center py-6 text-gray-400">No check-ins yet today</div>';
        } else {
            checkinsDiv.innerHTML = recentCheckins.slice(0, 5).map(checkin => `
                <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                        <p class="font-medium text-gray-800">${escapeHtml(checkin.memberName || 'Unknown')}</p>
                        <p class="text-xs text-gray-400">${formatDateTime(checkin.checkInTime)}</p>
                    </div>
                    <span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Present</span>
                </div>
            `).join('');
        }
        
        // Recent announcements
        const announcements = [];
        messagesSnap.forEach(doc => announcements.push(doc.data()));
        const announcementsDiv = document.getElementById('recentAnnouncements');
        
        if (announcements.length === 0) {
            announcementsDiv.innerHTML = '<div class="text-center py-6 text-gray-400">No announcements sent yet</div>';
        } else {
            announcementsDiv.innerHTML = announcements.map(ann => `
                <div class="p-3 bg-purple-50 rounded-lg border-l-4 border-[#9c4dcc]">
                    <p class="text-sm text-gray-700">${escapeHtml(ann.message)}</p>
                    <p class="text-xs text-gray-400 mt-1">${formatDateTime(ann.createdAt)}</p>
                </div>
            `).join('');
        }
        
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showToast('Error loading dashboard data', 'error');
    }
}

// Generate quick actions based on user permissions
function generateQuickActions() {
    const container = document.getElementById('quickActions');
    if (!container) return;
    
    const role = getCurrentUserRole();
    const actions = [];
    
    // Common actions for all users
    actions.push({
        name: 'View Members',
        icon: 'fas fa-users',
        page: 'members.html',
        color: 'bg-purple-100 text-purple-700',
        permission: 'members'
    });
    
    // Role-specific actions
    if (['super_admin', 'pastor', 'secretary'].includes(role)) {
        actions.push({
            name: 'Mark Attendance',
            icon: 'fas fa-qrcode',
            page: 'attendance.html',
            color: 'bg-blue-100 text-blue-700',
            permission: 'attendance'
        });
    }
    
    if (['super_admin', 'treasurer'].includes(role)) {
        actions.push({
            name: 'Record Offering',
            icon: 'fas fa-hand-holding-usd',
            page: 'finance.html',
            color: 'bg-green-100 text-green-700',
            permission: 'finance'
        });
    }
    
    if (['super_admin', 'pastor'].includes(role)) {
        actions.push({
            name: 'Send SMS',
            icon: 'fas fa-bullhorn',
            page: 'sms.html',
            color: 'bg-orange-100 text-orange-700',
            permission: 'sms'
        });
        actions.push({
            name: 'Pastoral Care',
            icon: 'fas fa-praying-hands',
            page: 'pastoral.html',
            color: 'bg-indigo-100 text-indigo-700',
            permission: 'pastoral'
        });
    }
    
    if (role === 'super_admin') {
        actions.push({
            name: 'Manage Users',
            icon: 'fas fa-user-shield',
            page: 'users.html',
            color: 'bg-red-100 text-red-700',
            permission: 'users'
        });
    }
    
    // Filter actions based on page permissions
    const filteredActions = actions.filter(action => {
        return hasPagePermission(action.permission);
    });
    
    if (filteredActions.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-gray-400">No quick actions available</div>';
        return;
    }
    
    container.innerHTML = filteredActions.map(action => `
        <a href="${action.page}" class="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all hover:border-[#6a1b9a]">
            <div class="w-10 h-10 ${action.color} rounded-lg flex items-center justify-center">
                <i class="${action.icon}"></i>
            </div>
            <span class="font-medium text-gray-700">${action.name}</span>
            <i class="fas fa-chevron-right ml-auto text-gray-400"></i>
        </a>
    `).join('');
}

// Helper functions
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function formatDateTime(timestamp) {
    if (!timestamp) return '—';
    if (timestamp.toDate) {
        return timestamp.toDate().toLocaleString();
    }
    return new Date(timestamp).toLocaleString();
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', initDashboard);

// Mobile menu functionality
const mobileToggle = document.getElementById('mobileMenuToggle');
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('mobileOverlay');

if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
        overlay.classList.toggle('hidden');
    });
}

if (overlay) {
    overlay.addEventListener('click', () => {
        sidebar.classList.remove('active');
        overlay.classList.add('hidden');
    });
}

// Make logout available globally
window.logoutUser = logoutUser;