// Toast notification
export function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.classList.remove('hidden', 'bg-red-600', 'bg-green-600', 'bg-blue-600');
    
    if (type === 'error') toast.classList.add('bg-red-600');
    else if (type === 'success') toast.classList.add('bg-green-600');
    else toast.classList.add('bg-blue-600');
    
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// Escape HTML
export function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Format currency
export function formatCurrency(amount) {
    return `GH₵ ${amount.toFixed(2)}`;
}

// Format date
export function formatDate(timestamp) {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
}

// Format datetime
export function formatDateTime(timestamp) {
    if (!timestamp) return '—';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString();
}

// Mobile menu toggle
export function initMobileMenu() {
    const mobileToggle = document.getElementById('mobileMenuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('mobileOverlay');
    
    if (mobileToggle && sidebar && overlay) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('active');
            overlay.classList.toggle('hidden');
        });
        
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.add('hidden');
        });
    }
}

// Set active nav item
export function setActiveNav() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    document.querySelectorAll('.nav-item').forEach(item => {
        const href = item.getAttribute('href');
        if (href === currentPage || (currentPage === 'index.html' && href === 'index.html')) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// Update user display in header
export async function updateUserDisplay() {
    const { auth, onAuthStateChanged } = await import('./firebase-config.js');
    onAuthStateChanged(auth, (user) => {
        const userDisplay = document.getElementById('userDisplay');
        if (userDisplay && user) {
            const email = user.email;
            const displayName = email.split('@')[0];
            userDisplay.innerHTML = `
                <div class="relative group">
                    <button class="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5 hover:bg-gray-200 transition">
                        <i class="fas fa-user-circle text-[#6a1b9a] text-lg"></i>
                        <span class="text-sm font-medium text-gray-700">${escapeHtml(displayName)}</span>
                        <i class="fas fa-chevron-down text-xs text-gray-500"></i>
                    </button>
                    <div class="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 hidden group-hover:block z-50">
                        <div class="p-2">
                            <p class="text-xs text-gray-500 px-3 py-1 border-b">${escapeHtml(user.email)}</p>
                            <button onclick="window.logoutUser()" class="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition">
                                <i class="fas fa-sign-out-alt mr-2"></i> Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
    });
}

// Make logout available globally
window.logoutUser = async function() {
    const { signOut } = await import('./firebase-config.js');
    const { auth } = await import('./firebase-config.js');
    try {
        await signOut(auth);
        showToast('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 500);
    } catch (error) {
        showToast('Error logging out', 'error');
    }
};