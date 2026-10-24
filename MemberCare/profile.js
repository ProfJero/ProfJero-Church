// ============================================
// FIREBASE CONFIGURATION
// ============================================

const firebaseConfig = {
    apiKey: "AIzaSyCgm9pUMKIsecyxmRNy55LWggLVSVrN4Uk",
    authDomain: "rgci-management.firebaseapp.com",
    projectId: "rgci-management",
    storageBucket: "rgci-management.firebasestorage.app",
    messagingSenderId: "1056711925495",
    appId: "1:1056711925495:web:4aec050ca41610f2347df2",
    measurementId: "G-MXGH6CVQ85"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Enable offline persistence
db.enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
        console.warn('Firestore persistence error:', err);
    });

// ============================================
// STATE MANAGEMENT
// ============================================

let currentUser = null;
let userData = null;
let isLoginMode = true;
let isOnline = navigator.onLine;
let allRequests = [];
let allDevotions = [];
let savedDevotions = [];
let myEvents = [];
let allEvents = [];
let editingField = null;

// ============================================
// DOM ELEMENTS
// ============================================

const loadingState = document.getElementById('loadingState');
const profileContent = document.getElementById('profileContent');
const loginModal = document.getElementById('loginModal');

// ============================================
// NETWORK STATUS
// ============================================

window.addEventListener('online', () => {
    isOnline = true;
    console.log('Back online');
    showToast('Back online!', 'success');
    if (currentUser) {
        loadUserProfile();
    }
});

window.addEventListener('offline', () => {
    isOnline = false;
    console.log('Offline mode');
    showToast('You are offline. Using cached data.', 'info');
});

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    container.classList.remove('hidden');
    
    const colors = {
        success: 'toast-success',
        error: 'toast-error',
        info: 'toast-info'
    };
    
    container.innerHTML = `
        <div class="toast-message ${colors[type] || colors.info}">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'} mr-2"></i>
            ${message}
        </div>
    `;
    
    clearTimeout(container._timeout);
    container._timeout = setTimeout(() => {
        container.classList.add('hidden');
    }, 5000);
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function openLoginModal() {
    if (!loginModal) return;
    loginModal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    switchToLogin();
}

function closeLoginModal() {
    if (!loginModal) return;
    loginModal.classList.add('hidden');
    document.body.style.overflow = 'auto';
}

window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;

// ============================================
// CUSTOM MODAL SYSTEM
// ============================================

function openCustomModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

function closeCustomModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
}

window.openCustomModal = openCustomModal;
window.closeCustomModal = closeCustomModal;

// ============================================
// SWITCH BETWEEN LOGIN AND SIGNUP
// ============================================

function switchToLogin() {
    isLoginMode = true;
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const modalTitle = document.getElementById('loginModalTitle');
    
    if (loginTab) {
        loginTab.className = 'flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all bg-secondary text-white';
    }
    if (signupTab) {
        signupTab.className = 'flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all text-gray-600 hover:bg-gray-200';
    }
    if (loginForm) loginForm.classList.remove('hidden');
    if (signupForm) signupForm.classList.add('hidden');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="fas fa-user-circle text-secondary mr-2"></i>Sign In';
    }
}

function switchToSignup() {
    isLoginMode = false;
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const modalTitle = document.getElementById('loginModalTitle');
    
    if (signupTab) {
        signupTab.className = 'flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all bg-secondary text-white';
    }
    if (loginTab) {
        loginTab.className = 'flex-1 py-2.5 rounded-lg font-semibold text-sm transition-all text-gray-600 hover:bg-gray-200';
    }
    if (signupForm) signupForm.classList.remove('hidden');
    if (loginForm) loginForm.classList.add('hidden');
    if (modalTitle) {
        modalTitle.innerHTML = '<i class="fas fa-user-plus text-secondary mr-2"></i>Create Account';
    }
    
    // Pre-fill gender dropdown if it exists
    const genderSelect = document.getElementById('signupGender');
    if (genderSelect) {
        genderSelect.value = '';
    }
}


// ============================================
// HANDLE LOGIN
// ============================================

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value;
    
    if (!email || !password) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    const btn = document.getElementById('loginSubmitBtn');
    const btnText = document.getElementById('loginBtnText');
    const spinner = document.getElementById('loginSpinner');
    
    if (btnText) btnText.textContent = 'Signing In...';
    if (spinner) spinner.classList.remove('hidden');
    if (btn) btn.disabled = true;
    
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        showToast('Welcome back! 👋', 'success');
        closeLoginModal();
        await loadUserProfile();
    } catch (error) {
        console.error('Login error:', error);
        let message = 'Login failed. Please try again.';
        if (error.code === 'auth/user-not-found') {
            message = 'Account not found. Please sign up first.';
        } else if (error.code === 'auth/wrong-password') {
            message = 'Incorrect password. Please try again.';
        } else if (error.code === 'auth/invalid-email') {
            message = 'Invalid email address.';
        } else if (error.code === 'auth/too-many-requests') {
            message = 'Too many failed attempts. Please try again later.';
        }
        showToast(message, 'error');
    }
    
    if (btnText) btnText.textContent = 'Sign In';
    if (spinner) spinner.classList.add('hidden');
    if (btn) btn.disabled = false;
}

// ============================================
// HANDLE SIGNUP
// ============================================

// ============================================
// HANDLE SIGNUP
// ============================================

async function handleSignup(e) {
    e.preventDefault();
    const name = document.getElementById('signupName')?.value.trim();
    const phone = document.getElementById('signupPhone')?.value.trim();
    const email = document.getElementById('signupEmail')?.value.trim();
    const password = document.getElementById('signupPassword')?.value;
    const dob = document.getElementById('signupDob')?.value;
    const gender = document.getElementById('signupGender')?.value;
    
    if (!name || !phone || !email || !password) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    if (password.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    const btn = document.getElementById('signupSubmitBtn');
    const btnText = document.getElementById('signupBtnText');
    const spinner = document.getElementById('signupSpinner');
    
    if (btnText) btnText.textContent = 'Creating Account...';
    if (spinner) spinner.classList.remove('hidden');
    if (btn) btn.disabled = true;
    
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        currentUser = userCredential.user;
        
        await db.collection('users').doc(currentUser.uid).set({
            fullName: name,
            phoneNumber: phone,
            email: email,
            dateOfBirth: dob || '',
            gender: gender || '',
            role: 'member',
            isActive: true,
            memberSince: new Date().getFullYear().toString(),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        showToast('Account created successfully! 🎉', 'success');
        closeLoginModal();
        await loadUserProfile();
    } catch (error) {
        console.error('Signup error:', error);
        let message = 'Signup failed. Please try again.';
        if (error.code === 'auth/email-already-in-use') {
            message = 'Email already in use. Please sign in.';
        } else if (error.code === 'auth/weak-password') {
            message = 'Password is too weak. Please use a stronger password.';
        } else if (error.code === 'auth/invalid-email') {
            message = 'Invalid email address.';
        }
        showToast(message, 'error');
    }
    
    if (btnText) btnText.textContent = 'Create Account';
    if (spinner) spinner.classList.add('hidden');
    if (btn) btn.disabled = false;
}

// ============================================
// GET INITIALS FROM NAME
// ============================================

function getInitials(name) {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// ============================================
// LOAD USER PROFILE
// ============================================

async function loadUserProfile() {
    const user = auth.currentUser;
    if (!user) {
        if (loadingState) loadingState.classList.add('hidden');
        if (profileContent) profileContent.classList.add('hidden');
        setTimeout(() => {
            openLoginModal();
        }, 500);
        return;
    }
    
    currentUser = user;
    
    try {
        const cachedUserData = localStorage.getItem('cachedUserData_' + user.uid);
        if (cachedUserData) {
            try {
                userData = JSON.parse(cachedUserData);
                renderProfile(userData);
                console.log('📦 Using cached user data');
            } catch (e) {
                console.error('Error parsing cached user data:', e);
            }
        }
        
        if (!isOnline) {
            showToast('Offline - showing cached profile', 'info');
            if (loadingState) loadingState.classList.add('hidden');
            if (profileContent) profileContent.classList.remove('hidden');
            return;
        }
        
        const userDoc = await db.collection('users').doc(user.uid).get();
        
        if (userDoc.exists) {
            userData = userDoc.data();
            userData.uid = user.uid;
            localStorage.setItem('cachedUserData_' + user.uid, JSON.stringify(userData));
            renderProfile(userData);
            console.log('✅ User data loaded from Firestore');
        } else {
            userData = {
                fullName: user.displayName || 'User',
                email: user.email || '',
                phoneNumber: user.phoneNumber || '',
                uid: user.uid
            };
            renderProfile(userData);
        }
        
        await loadUserStats();
        await loadUserRequests();
        await loadSavedDevotions();
        await loadSavedEvents();
        
        if (loadingState) loadingState.classList.add('hidden');
        if (profileContent) profileContent.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading profile:', error);
        const cachedUserData = localStorage.getItem('cachedUserData_' + user.uid);
        if (cachedUserData) {
            try {
                userData = JSON.parse(cachedUserData);
                renderProfile(userData);
                if (loadingState) loadingState.classList.add('hidden');
                if (profileContent) profileContent.classList.remove('hidden');
                showToast('Using cached profile data', 'info');
                return;
            } catch (e) {
                console.error('Error parsing cached user data:', e);
            }
        }
        
        showToast('Error loading profile data', 'error');
        if (loadingState) {
            loadingState.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <i class="fas fa-exclamation-circle text-4xl block mx-auto mb-2 opacity-30"></i>
                    <p>Error loading profile. Please refresh.</p>
                    <button onclick="location.reload()" class="mt-3 bg-secondary text-white px-4 py-2 rounded-lg">
                        <i class="fas fa-sync-alt mr-2"></i>Retry
                    </button>
                </div>
            `;
        }
    }
}

// ============================================
// LOAD USER STATS
// ============================================

async function loadUserStats() {
    if (!currentUser) return;
    
    try {
        const requestsSnapshot = await db.collection('pastoral_requests')
            .where('phone', '==', userData?.phoneNumber || '')
            .get();
        
        const requestsCount = requestsSnapshot.size;
        const savedDevs = JSON.parse(localStorage.getItem('savedDevotions') || '[]');
        const savedEvents = JSON.parse(localStorage.getItem('savedEvents') || '[]');
        
        updateActivityCounts(requestsCount, savedDevs.length, savedEvents.length);
        
    } catch (error) {
        console.error('Error loading user stats:', error);
    }
}

// ============================================
// UPDATE ACTIVITY COUNTS
// ============================================

function updateActivityCounts(requestsCount, savedDevsCount, savedEventsCount) {
    const container = document.getElementById('activitiesGrid');
    if (!container) return;
    
    const activities = [
        { label: 'Events', count: savedEventsCount, icon: 'fa-calendar-alt', color: 'bg-purple-100 text-purple-700', sub: 'saved' },
        { label: 'Requests', count: requestsCount, icon: 'fa-hands-praying', color: 'bg-amber-100 text-amber-700', sub: 'submitted' },
        { label: 'Devotions', count: savedDevsCount, icon: 'fa-book-bible', color: 'bg-blue-100 text-blue-700', sub: 'saved' },
        { label: 'Attendance', count: '—', icon: 'fa-user-plus', color: 'bg-green-100 text-green-700', sub: 'services' },
        { label: 'Counselling', count: '—', icon: 'fa-comments', color: 'bg-rose-100 text-rose-700', sub: 'sessions' },
        { label: 'Giving', count: '—', icon: 'fa-coins', color: 'bg-emerald-100 text-emerald-700', sub: 'transactions' }
    ];
    
    container.innerHTML = activities.map(item => `
        <div class="activity-card bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/30 card-shadow flex flex-col items-center text-center active:scale-95 transition-transform" onclick="handleActivityClick('${item.label}')">
            <div class="w-10 h-10 ${item.color} rounded-lg flex items-center justify-center mb-2">
                <i class="fas ${item.icon} text-lg"></i>
            </div>
            <p class="text-[10px] uppercase font-bold text-on-surface-variant mb-1">${item.label}</p>
            <p class="text-headline-md leading-none mb-1">${item.count}</p>
            <p class="text-[9px] text-outline leading-tight">${item.sub}</p>
        </div>
    `).join('');
}

// ============================================
// HANDLE ACTIVITY CLICK
// ============================================

function handleActivityClick(label) {
    if (label === 'Events') {
        showToast(`You have ${myEvents.length || 0} saved events`, 'info');
    } else if (label === 'Requests') {
        showToast(`You have ${allRequests.length || 0} submitted requests`, 'info');
    } else if (label === 'Devotions') {
        showToast(`You have ${savedDevotions.length || 0} saved devotions`, 'info');
    } else {
        showToast(`${label} feature coming soon!`, 'info');
    }
}

// ============================================
// LOAD USER REQUESTS
// ============================================

async function loadUserRequests() {
    if (!currentUser || !userData?.phoneNumber) return;
    
    try {
        const snapshot = await db.collection('pastoral_requests')
            .where('phone', '==', userData.phoneNumber)
            .orderBy('createdAt', 'desc')
            .limit(5)
            .get();
        
        allRequests = [];
        snapshot.forEach(doc => {
            allRequests.push({ id: doc.id, ...doc.data() });
        });
        
    } catch (error) {
        console.error('Error loading user requests:', error);
    }
}

// ============================================
// LOAD SAVED DEVOTIONS
// ============================================

function loadSavedDevotions() {
    const saved = localStorage.getItem('savedDevotions');
    if (saved) {
        try {
            savedDevotions = JSON.parse(saved);
        } catch (e) {
            savedDevotions = [];
        }
    } else {
        savedDevotions = [];
    }
}

// ============================================
// LOAD SAVED EVENTS
// ============================================

function loadSavedEvents() {
    const saved = localStorage.getItem('savedEvents');
    if (saved) {
        try {
            myEvents = JSON.parse(saved);
        } catch (e) {
            myEvents = [];
        }
    } else {
        myEvents = [];
    }
}

// ============================================
// RENDER PROFILE DATA
// ============================================

function renderProfile(data) {
    if (!data) return;
    
    const nameEl = document.getElementById('profileName');
    const memberIdEl = document.getElementById('profileMemberId');
    const memberSinceEl = document.getElementById('profileMemberSince');
    const avatar = document.getElementById('profileAvatar');
    
    if (nameEl) nameEl.textContent = data.fullName || 'User';
    if (memberIdEl) {
        memberIdEl.textContent = `Member ID: ${data.memberId || 'RGCI-' + String(Math.floor(1000 + Math.random() * 9000))}`;
    }
    if (memberSinceEl) {
        memberSinceEl.textContent = data.memberSince ? `Member since ${data.memberSince}` : 'Member since 2024';
    }
    
    if (avatar) {
        if (data.photoURL) {
            avatar.innerHTML = `<img src="${data.photoURL}" alt="${data.fullName}" class="w-full h-full object-cover rounded-full"/>`;
        } else {
            avatar.textContent = getInitials(data.fullName);
            avatar.className = 'w-24 h-24 rounded-full border-4 border-tertiary-fixed-dim overflow-hidden bg-secondary flex items-center justify-center text-white text-3xl font-bold';
        }
    }
    
    renderPersonalInfo(data);
    renderChurchInfo(data);
    renderActivities();
    renderLibrary();
    renderPreferences();
    renderNotifications();
    renderHelp();
}

// ============================================
// RENDER PERSONAL INFORMATION
// ============================================

function renderPersonalInfo(data) {
    const container = document.getElementById('personalInfoList');
    if (!container) return;
    
    // Format date for display
    const formatDateDisplay = (dateStr) => {
        if (!dateStr || dateStr === '—' || dateStr === '') return '—';
        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) return '—';
            return date.toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
            });
        } catch {
            return '—';
        }
    };
    
    // Format gender for display
    const formatGenderDisplay = (gender) => {
        if (!gender || gender === '—' || gender === '') return '—';
        return gender.charAt(0).toUpperCase() + gender.slice(1);
    };
    
    const infoItems = [
        { 
            label: 'Full Name', 
            value: data.fullName || '—', 
            icon: 'fa-user', 
            field: 'fullName',
            type: 'text'
        },
        { 
            label: 'Phone Number', 
            value: data.phoneNumber || '—', 
            icon: 'fa-phone', 
            field: 'phoneNumber',
            type: 'tel'
        },
        { 
            label: 'Email Address', 
            value: data.email || '—', 
            icon: 'fa-envelope', 
            field: 'email',
            type: 'email'
        },
        { 
            label: 'Date of Birth', 
            value: formatDateDisplay(data.dateOfBirth), 
            icon: 'fa-calendar-alt', 
            field: 'dateOfBirth',
            type: 'date'
        },
        { 
            label: 'Gender', 
            value: formatGenderDisplay(data.gender), 
            icon: 'fa-venus-mars', 
            field: 'gender',
            type: 'select'
        },
        { 
            label: 'Location', 
            value: data.location || '—', 
            icon: 'fa-map-pin', 
            field: 'location',
            type: 'text'
        }
    ];
    
    const colorMap = {
        'fa-user': 'bg-purple-100 text-purple-600',
        'fa-phone': 'bg-green-100 text-green-600',
        'fa-envelope': 'bg-blue-100 text-blue-600',
        'fa-calendar-alt': 'bg-orange-100 text-orange-600',
        'fa-venus-mars': 'bg-pink-100 text-pink-600',
        'fa-map-pin': 'bg-indigo-100 text-indigo-600'
    };
    
    container.innerHTML = infoItems.map(item => `
        <div class="info-row flex items-center gap-4" onclick="openEditFieldModal('${item.field}', '${item.label}', '${item.type}')">
            <div class="profile-icon-circle ${colorMap[item.icon] || 'bg-gray-100 text-gray-600'}">
                <i class="fas ${item.icon}"></i>
            </div>
            <div class="flex-1">
                <p class="text-body-sm text-on-surface-variant">${item.label}</p>
                <p class="text-body-lg font-semibold" id="field_${item.field}">${item.value}</p>
            </div>
            <i class="fas fa-chevron-right text-outline-variant text-sm"></i>
        </div>
    `).join('');
}

// ============================================
// OPEN EDIT FIELD MODAL
// ============================================

function openEditFieldModal(field, label, type = 'text') {
    editingField = field;
    const modal = document.getElementById('editFieldModal');
    const labelEl = document.getElementById('editFieldLabel');
    const inputContainer = document.getElementById('editFieldInputContainer');
    
    // Get the current value from the display field
    const fieldElement = document.getElementById(`field_${field}`);
    let currentValue = fieldElement?.textContent || '';
    
    // Clean up the value for editing
    if (currentValue === '—' || currentValue === '') {
        currentValue = '';
    }
    
    if (labelEl) labelEl.textContent = `Edit ${label}`;
    
    // Build the appropriate input based on type
    let inputHTML = '';
    
    if (type === 'date') {
        // Get the raw date value from userData
        let dateValue = '';
        if (userData && userData.dateOfBirth) {
            try {
                const date = new Date(userData.dateOfBirth);
                if (!isNaN(date.getTime())) {
                    dateValue = date.toISOString().split('T')[0];
                }
            } catch (e) {
                console.warn('Error parsing date:', e);
            }
        }
        
        inputHTML = `
            <label class="block text-sm font-medium text-gray-700 mb-1">Select your date of birth</label>
            <input type="date" id="editFieldInput" class="w-full px-4 py-2.5 border border-gray-300 rounded-xl input-focus transition" 
                   value="${dateValue}">
            <p class="text-xs text-gray-400 mt-1">Click the calendar icon to select a date</p>
        `;
    } else if (type === 'select') {
        // Gender dropdown
        const genderOptions = ['Male', 'Female'];
        const currentGender = userData?.gender || '';
        
        inputHTML = `
            <label class="block text-sm font-medium text-gray-700 mb-1">Select your gender</label>
            <select id="editFieldInput" class="w-full px-4 py-2.5 border border-gray-300 rounded-xl input-focus transition">
                <option value="">Select gender</option>
                ${genderOptions.map(g => `
                    <option value="${g.toLowerCase()}" ${g.toLowerCase() === currentGender.toLowerCase() ? 'selected' : ''}>
                        ${g}
                    </option>
                `).join('')}
            </select>
        `;
    } else if (type === 'tel') {
        inputHTML = `
            <label class="block text-sm font-medium text-gray-700 mb-1">Enter ${label}</label>
            <input type="tel" id="editFieldInput" class="w-full px-4 py-2.5 border border-gray-300 rounded-xl input-focus transition" 
                   value="${currentValue}" placeholder="Enter ${label}">
        `;
    } else if (type === 'email') {
        inputHTML = `
            <label class="block text-sm font-medium text-gray-700 mb-1">Enter ${label}</label>
            <input type="email" id="editFieldInput" class="w-full px-4 py-2.5 border border-gray-300 rounded-xl input-focus transition" 
                   value="${currentValue}" placeholder="Enter ${label}">
        `;
    } else {
        inputHTML = `
            <label class="block text-sm font-medium text-gray-700 mb-1">Enter ${label}</label>
            <input type="text" id="editFieldInput" class="w-full px-4 py-2.5 border border-gray-300 rounded-xl input-focus transition" 
                   value="${currentValue}" placeholder="Enter ${label}">
        `;
    }
    
    if (inputContainer) {
        inputContainer.innerHTML = inputHTML;
    }
    
    openCustomModal('editFieldModal');
}


// ============================================
// SAVE FIELD EDIT
// ============================================

async function saveFieldEdit() {
    const inputEl = document.getElementById('editFieldInput');
    let newValue = inputEl?.value?.trim() || '';
    
    // For gender, we need to check if a value was selected
    if (editingField === 'gender' && !newValue) {
        // Check if it's a select element
        if (inputEl && inputEl.tagName === 'SELECT') {
            newValue = inputEl.value;
        }
        if (!newValue) {
            showToast('Please select a gender', 'error');
            return;
        }
    }
    
    // For date, we need to handle empty values
    if (editingField === 'dateOfBirth' && !newValue) {
        // Allow empty date
        newValue = '';
    }
    
    // For other fields, require a value
    if (!newValue && editingField !== 'dateOfBirth' && editingField !== 'gender') {
        showToast('Please enter a value', 'error');
        return;
    }
    
    if (!currentUser || !editingField) {
        showToast('Error updating field', 'error');
        return;
    }
    
    try {
        await db.collection('users').doc(currentUser.uid).update({
            [editingField]: newValue
        });
        
        userData[editingField] = newValue;
        localStorage.setItem('cachedUserData_' + currentUser.uid, JSON.stringify(userData));
        
        // Update UI with formatted value
        const fieldEl = document.getElementById(`field_${editingField}`);
        if (fieldEl) {
            if (editingField === 'dateOfBirth' && newValue) {
                try {
                    const date = new Date(newValue);
                    if (!isNaN(date.getTime())) {
                        fieldEl.textContent = date.toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'long', 
                            day: 'numeric' 
                        });
                    } else {
                        fieldEl.textContent = '—';
                    }
                } catch {
                    fieldEl.textContent = '—';
                }
            } else if (editingField === 'gender') {
                fieldEl.textContent = newValue ? newValue.charAt(0).toUpperCase() + newValue.slice(1) : '—';
            } else {
                fieldEl.textContent = newValue || '—';
            }
        }
        
        showToast('Field updated successfully! ✅', 'success');
        closeCustomModal('editFieldModal');
        
    } catch (error) {
        console.error('Error updating field:', error);
        showToast('Error updating field. Please try again.', 'error');
    }
}

// ============================================
// RENDER CHURCH INFORMATION
// ============================================

function renderChurchInfo(data) {
    const container = document.getElementById('churchInfoList');
    if (!container) return;
    
    const churchItems = [
        { label: 'Membership Status', value: 'Active', badge: true },
        { label: 'Department', value: data.department || '—' },
        { label: 'Fellowship / Group', value: data.fellowship || '—' },
        { label: 'Role', value: data.role || 'Member' },
        { label: 'Branch / Assembly', value: data.branch || 'RGCI Main Assembly' },
        { label: 'Date Joined', value: data.dateJoined || '—' }
    ];
    
    container.innerHTML = churchItems.map(item => `
        <div class="flex justify-between items-center py-3 first:pt-0 last:pb-0">
            <span class="text-body-md text-on-surface-variant">${item.label}</span>
            <span class="${item.badge ? 'bg-green-100 text-green-700 px-3 py-1 rounded-full text-label-md font-bold' : 'text-body-md font-semibold text-right'}">
                ${item.value}
            </span>
        </div>
    `).join('');
}

// ============================================
// RENDER ACTIVITIES
// ============================================

function renderActivities() {
    const container = document.getElementById('activitiesGrid');
    if (!container) return;
    
    const activities = [
        { label: 'Events', count: myEvents.length || 0, icon: 'fa-calendar-alt', color: 'bg-purple-100 text-purple-700', sub: 'saved' },
        { label: 'Requests', count: allRequests.length || 0, icon: 'fa-hands-praying', color: 'bg-amber-100 text-amber-700', sub: 'submitted' },
        { label: 'Devotions', count: savedDevotions.length || 0, icon: 'fa-book-bible', color: 'bg-blue-100 text-blue-700', sub: 'saved' },
        { label: 'Attendance', count: '—', icon: 'fa-user-plus', color: 'bg-green-100 text-green-700', sub: 'services' },
        { label: 'Counselling', count: '—', icon: 'fa-comments', color: 'bg-rose-100 text-rose-700', sub: 'sessions' },
        { label: 'Giving', count: '—', icon: 'fa-coins', color: 'bg-emerald-100 text-emerald-700', sub: 'transactions' }
    ];
    
    container.innerHTML = activities.map(item => `
        <div class="activity-card bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/30 card-shadow flex flex-col items-center text-center active:scale-95 transition-transform" onclick="handleActivityClick('${item.label}')">
            <div class="w-10 h-10 ${item.color} rounded-lg flex items-center justify-center mb-2">
                <i class="fas ${item.icon} text-lg"></i>
            </div>
            <p class="text-[10px] uppercase font-bold text-on-surface-variant mb-1">${item.label}</p>
            <p class="text-headline-md leading-none mb-1">${item.count}</p>
            <p class="text-[9px] text-outline leading-tight">${item.sub}</p>
        </div>
    `).join('');
}

// ============================================
// RENDER LIBRARY
// ============================================

function renderLibrary() {
    const container = document.getElementById('libraryList');
    if (!container) return;
    
    const items = [
        { label: 'Saved Devotionals', count: savedDevotions.length || 0, icon: 'fa-book-bible' },
        { label: 'Saved Events', count: myEvents.length || 0, icon: 'fa-calendar-alt' },
        { label: 'Sermons / Messages', count: 0, icon: 'fa-church' },
        { label: 'Notes & Bookmarks', count: 0, icon: 'fa-bookmark' }
    ];
    
    container.innerHTML = items.map((item, index) => `
        <div class="menu-item flex items-center gap-4" onclick="openLibraryItem(${index})">
            <i class="fas ${item.icon} text-secondary"></i>
            <span class="flex-1 font-semibold">${item.label}</span>
            <span class="text-sm text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">${item.count}</span>
            <i class="fas fa-chevron-right text-outline-variant text-sm"></i>
        </div>
    `).join('');
}

// ============================================
// OPEN LIBRARY ITEM
// ============================================

function openLibraryItem(index) {
    const items = ['Saved Devotionals', 'Saved Events', 'Sermons / Messages', 'Notes & Bookmarks'];
    const item = items[index];
    
    if (item === 'Saved Devotionals') {
        if (savedDevotions.length === 0) {
            showToast('No saved devotions yet', 'info');
        } else {
            showToast(`You have ${savedDevotions.length} saved devotions`, 'success');
            openCustomModal('savedDevotionsModal');
            renderSavedDevotionsModal();
        }
    } else if (item === 'Saved Events') {
        if (myEvents.length === 0) {
            showToast('No saved events yet', 'info');
        } else {
            showToast(`You have ${myEvents.length} saved events`, 'success');
            openCustomModal('savedEventsModal');
            renderSavedEventsModal();
        }
    } else {
        showToast(`${item} feature coming soon!`, 'info');
    }
}

// ============================================
// RENDER SAVED DEVOTIONS MODAL
// ============================================

function renderSavedDevotionsModal() {
    const container = document.getElementById('savedDevotionsModalContent');
    if (!container) return;
    
    if (savedDevotions.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <i class="fas fa-book text-4xl block mx-auto mb-2 opacity-30"></i>
                <p>No saved devotions yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = savedDevotions.map((dev, index) => `
        <div class="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-3">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-semibold text-primary">${dev.title || 'Devotion'}</h4>
                    <p class="text-sm text-gray-500 italic">${dev.verse || ''}</p>
                    <p class="text-sm text-gray-600 mt-2 line-clamp-2">${dev.content || ''}</p>
                    <p class="text-xs text-gray-400 mt-1">Saved: ${new Date(dev.savedAt).toLocaleDateString()}</p>
                </div>
                <button onclick="removeSavedDevotionFromModal(${index})" class="text-red-400 hover:text-red-600 transition">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// ============================================
// REMOVE SAVED DEVOTION FROM MODAL
// ============================================

function removeSavedDevotionFromModal(index) {
    savedDevotions.splice(index, 1);
    localStorage.setItem('savedDevotions', JSON.stringify(savedDevotions));
    renderSavedDevotionsModal();
    renderLibrary();
    showToast('Devotion removed', 'info');
}

// ============================================
// RENDER SAVED EVENTS MODAL
// ============================================

function renderSavedEventsModal() {
    const container = document.getElementById('savedEventsModalContent');
    if (!container) return;
    
    if (myEvents.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <i class="fas fa-calendar-times text-4xl block mx-auto mb-2 opacity-30"></i>
                <p>No saved events yet</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = myEvents.map((eventId) => {
        const event = allEvents.find(e => e.id === eventId) || { title: 'Event', startDate: 'Unknown' };
        return `
            <div class="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-3">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-semibold text-primary">${event.title || 'Event'}</h4>
                        <p class="text-sm text-gray-500">${event.startDate ? new Date(event.startDate).toLocaleDateString() : 'Unknown date'}</p>
                        <p class="text-sm text-gray-600">${event.location || 'RGCI'}</p>
                    </div>
                    <button onclick="removeSavedEventFromModal('${eventId}')" class="text-red-400 hover:text-red-600 transition">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// REMOVE SAVED EVENT FROM MODAL
// ============================================

function removeSavedEventFromModal(eventId) {
    const index = myEvents.indexOf(eventId);
    if (index > -1) {
        myEvents.splice(index, 1);
        localStorage.setItem('savedEvents', JSON.stringify(myEvents));
        renderSavedEventsModal();
        renderLibrary();
        showToast('Event removed', 'info');
    }
}

// ============================================
// RENDER PREFERENCES
// ============================================

function renderPreferences() {
    const container = document.getElementById('preferencesList');
    if (!container) return;
    
    const items = [
        { label: 'Notifications', sub: 'Manage what you receive', icon: 'fa-bell', action: 'openNotificationsModal' },
        { label: 'Appearance', sub: 'Light / Dark / System', icon: 'fa-moon', action: 'openAppearanceModal' },
        { label: 'Privacy', sub: 'Manage visibility & info', icon: 'fa-lock', action: 'openPrivacyModal' },
        { label: 'Change Password', sub: 'Keep your account secure', icon: 'fa-key', action: 'openPasswordModal' },
        { label: 'Language', sub: 'English', icon: 'fa-language', action: 'openLanguageModal' }
    ];
    
    container.innerHTML = items.map(item => `
        <div class="menu-item flex items-center gap-4" onclick="${item.action}()">
            <i class="fas ${item.icon} text-on-surface-variant"></i>
            <div class="flex-1">
                <p class="font-semibold">${item.label}</p>
                <p class="text-body-sm text-on-surface-variant">${item.sub}</p>
            </div>
            <i class="fas fa-chevron-right text-outline-variant text-sm"></i>
        </div>
    `).join('');
}

// ============================================
// OPEN NOTIFICATIONS MODAL
// ============================================

function openNotificationsModal() {
    openCustomModal('notificationsModal');
    const container = document.getElementById('notificationPrefsList');
    if (container) {
        const items = [
            { label: 'Push Notifications', checked: true },
            { label: 'Email Notifications', checked: true },
            { label: 'SMS Notifications', checked: false },
            { label: 'Event Reminders', checked: true },
            { label: 'Daily Devotionals', checked: true }
        ];
        
        container.innerHTML = items.map((item) => `
            <div class="flex justify-between items-center py-3 border-b border-gray-100 last:border-0">
                <span class="text-sm font-medium text-gray-700">${item.label}</span>
                <label class="toggle-switch">
                    <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="showToast('${item.label} ${this.checked ? 'enabled' : 'disabled'}', 'success')">
                    <span class="toggle-slider"></span>
                </label>
            </div>
        `).join('');
    }
}

// ============================================
// OPEN APPEARANCE MODAL
// ============================================

function openAppearanceModal() {
    openCustomModal('appearanceModal');
    const container = document.getElementById('appearanceOptions');
    if (container) {
        const currentTheme = localStorage.getItem('theme') || 'light';
        const themes = [
            { value: 'light', label: 'Light', icon: 'fa-sun' },
            { value: 'dark', label: 'Dark', icon: 'fa-moon' },
            { value: 'system', label: 'System', icon: 'fa-desktop' }
        ];
        
        container.innerHTML = themes.map(theme => `
            <div class="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-gray-50 transition ${currentTheme === theme.value ? 'bg-secondary/5 border-2 border-secondary' : 'border-2 border-transparent'}" 
                 onclick="changeTheme('${theme.value}')">
                <div class="w-10 h-10 rounded-full ${currentTheme === theme.value ? 'bg-secondary text-white' : 'bg-gray-100 text-gray-600'} flex items-center justify-center">
                    <i class="fas ${theme.icon}"></i>
                </div>
                <span class="font-medium">${theme.label}</span>
                ${currentTheme === theme.value ? '<i class="fas fa-check-circle text-secondary ml-auto"></i>' : ''}
            </div>
        `).join('');
    }
}

// ============================================
// CHANGE THEME
// ============================================

function changeTheme(theme) {
    localStorage.setItem('theme', theme);
    document.documentElement.className = theme;
    showToast(`Theme changed to ${theme}`, 'success');
    openAppearanceModal();
}

// ============================================
// OPEN PRIVACY MODAL
// ============================================

function openPrivacyModal() {
    openCustomModal('privacyModal');
    const container = document.getElementById('privacyOptions');
    if (container) {
        const options = [
            { label: 'Profile Visibility', value: userData?.visibility || 'public', choices: ['public', 'members', 'private'] },
            { label: 'Show Phone Number', value: userData?.showPhone || 'members', choices: ['everyone', 'members', 'private'] },
            { label: 'Show Email', value: userData?.showEmail || 'members', choices: ['everyone', 'members', 'private'] }
        ];
        
        container.innerHTML = options.map(opt => `
            <div class="py-3 border-b border-gray-100 last:border-0">
                <p class="text-sm font-medium text-gray-700 mb-2">${opt.label}</p>
                <select class="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-secondary/20 focus:border-secondary" 
                        onchange="updatePrivacy('${opt.label}', this.value)">
                    ${opt.choices.map(c => `<option value="${c}" ${c === opt.value ? 'selected' : ''}>${c.charAt(0).toUpperCase() + c.slice(1)}</option>`).join('')}
                </select>
            </div>
        `).join('');
    }
}

// ============================================
// UPDATE PRIVACY
// ============================================

function updatePrivacy(label, value) {
    showToast(`${label} updated to ${value}`, 'success');
}

// ============================================
// OPEN PASSWORD MODAL
// ============================================

function openPasswordModal() {
    openCustomModal('passwordModal');
    const currentPwd = document.getElementById('currentPassword');
    const newPwd = document.getElementById('newPassword');
    const confirmPwd = document.getElementById('confirmPassword');
    if (currentPwd) currentPwd.value = '';
    if (newPwd) newPwd.value = '';
    if (confirmPwd) confirmPwd.value = '';
}

// ============================================
// CHANGE PASSWORD
// ============================================

async function changePassword(e) {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword')?.value;
    const newPassword = document.getElementById('newPassword')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('Passwords do not match', 'error');
        return;
    }
    
    try {
        const credential = firebase.auth.EmailAuthProvider.credential(
            currentUser.email,
            currentPassword
        );
        
        await currentUser.reauthenticateWithCredential(credential);
        await currentUser.updatePassword(newPassword);
        
        showToast('Password changed successfully! ✅', 'success');
        closeCustomModal('passwordModal');
        
    } catch (error) {
        console.error('Password change error:', error);
        if (error.code === 'auth/wrong-password') {
            showToast('Current password is incorrect', 'error');
        } else if (error.code === 'auth/requires-recent-login') {
            showToast('Please sign in again to change password', 'error');
        } else {
            showToast('Error changing password. Please try again.', 'error');
        }
    }
}

// ============================================
// OPEN LANGUAGE MODAL
// ============================================

function openLanguageModal() {
    openCustomModal('languageModal');
    const container = document.getElementById('languageOptions');
    if (container) {
        const languages = [
            { value: 'en', label: 'English', flag: '🇬🇧' },
            { value: 'fr', label: 'French', flag: '🇫🇷' },
            { value: 'es', label: 'Spanish', flag: '🇪🇸' },
            { value: 'pt', label: 'Portuguese', flag: '🇵🇹' },
            { value: 'tw', label: 'Twi', flag: '🇬🇭' },
            { value: 'ga', label: 'Ga', flag: '🇬🇭' }
        ];
        
        const currentLang = localStorage.getItem('language') || 'en';
        
        container.innerHTML = languages.map(lang => `
            <div class="flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-gray-50 transition ${currentLang === lang.value ? 'bg-secondary/5 border-2 border-secondary' : 'border-2 border-transparent'}" 
                 onclick="changeLanguage('${lang.value}')">
                <span class="text-2xl">${lang.flag}</span>
                <span class="font-medium">${lang.label}</span>
                ${currentLang === lang.value ? '<i class="fas fa-check-circle text-secondary ml-auto"></i>' : ''}
            </div>
        `).join('');
    }
}

// ============================================
// CHANGE LANGUAGE
// ============================================

function changeLanguage(language) {
    localStorage.setItem('language', language);
    showToast(`Language changed to ${language}`, 'success');
    openLanguageModal();
}

// ============================================
// RENDER NOTIFICATIONS
// ============================================

function renderNotifications() {
    const container = document.getElementById('notificationList');
    if (!container) return;
    
    const items = [
        { label: 'Church announcements', active: true },
        { label: 'Event reminders', active: true },
        { label: 'Daily devotionals', active: true },
        { label: 'Prayer / care updates', active: true },
        { label: 'SMS notifications', active: false }
    ];
    
    container.innerHTML = items.map((item) => `
        <div class="flex justify-between items-center">
            <span class="text-body-md">${item.label}</span>
            <label class="toggle-switch">
                <input type="checkbox" ${item.active ? 'checked' : ''} onchange="showToast('${item.label} ${this.checked ? 'enabled' : 'disabled'}', 'success')">
                <span class="toggle-slider"></span>
            </label>
        </div>
    `).join('');
}

// ============================================
// RENDER HELP
// ============================================

function renderHelp() {
    const container = document.getElementById('helpList');
    if (!container) return;
    
    const items = [
        { label: 'Help Centre', icon: 'fa-question-circle', action: 'openHelpCentre' },
        { label: 'Contact RGCI', icon: 'fa-headset', action: 'openContactModal' },
        { label: 'Report a Problem', icon: 'fa-flag', action: 'openReportModal' },
        { label: 'Terms & Privacy', icon: 'fa-shield-alt', action: 'openTermsModal' }
    ];
    
    container.innerHTML = items.map(item => `
        <div class="menu-item flex items-center gap-4" onclick="${item.action}()">
            <i class="fas ${item.icon} text-on-surface-variant"></i>
            <span class="flex-1 font-semibold">${item.label}</span>
            <i class="fas fa-chevron-right text-outline-variant text-sm"></i>
        </div>
    `).join('');
}

// ============================================
// OPEN HELP CENTRE
// ============================================

function openHelpCentre() {
    openCustomModal('helpCentreModal');
}

// ============================================
// OPEN CONTACT MODAL
// ============================================

function openContactModal() {
    openCustomModal('contactModal');
}

// ============================================
// SEND CONTACT MESSAGE
// ============================================

async function sendContactMessage(e) {
    e.preventDefault();
    const name = document.getElementById('contactName')?.value.trim();
    const email = document.getElementById('contactEmail')?.value.trim();
    const subject = document.getElementById('contactSubject')?.value.trim();
    const message = document.getElementById('contactMessage')?.value.trim();
    
    if (!name || !email || !subject || !message) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    showToast('Message sent! We\'ll get back to you soon. 🙏', 'success');
    closeCustomModal('contactModal');
    document.getElementById('contactForm')?.reset();
}

// ============================================
// OPEN REPORT MODAL
// ============================================

function openReportModal() {
    openCustomModal('reportModal');
}

// ============================================
// SUBMIT REPORT
// ============================================

async function submitReport(e) {
    e.preventDefault();
    const type = document.getElementById('reportType')?.value;
    const description = document.getElementById('reportDescription')?.value.trim();
    
    if (!type || !description) {
        showToast('Please fill in all fields', 'error');
        return;
    }
    
    showToast('Report submitted! We\'ll look into it. 🙏', 'success');
    closeCustomModal('reportModal');
    document.getElementById('reportForm')?.reset();
}

// ============================================
// OPEN TERMS MODAL
// ============================================

function openTermsModal() {
    openCustomModal('termsModal');
}

// ============================================
// HANDLE LOGOUT
// ============================================

async function handleLogout() {
    if (confirm('Are you sure you want to log out?')) {
        try {
            await auth.signOut();
            showToast('Logged out successfully', 'success');
            if (currentUser) {
                localStorage.removeItem('cachedUserData_' + currentUser.uid);
            }
            location.reload();
        } catch (error) {
            console.error('Logout error:', error);
            showToast('Error logging out', 'error');
        }
    }
}

// ============================================
// SETUP EVENT LISTENERS
// ============================================

function setupEventListeners() {
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            openPreferencesModal();
        });
    }
    
    const editProfileBtn = document.getElementById('editProfileBtn');
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            openEditProfileModal();
        });
    }
    
    const editInfoBtn = document.getElementById('editInfoBtn');
    if (editInfoBtn) {
        editInfoBtn.addEventListener('click', () => {
            openEditProfileModal();
        });
    }
    
    const changePhotoBtn = document.getElementById('changePhotoBtn');
    if (changePhotoBtn) {
        changePhotoBtn.addEventListener('click', () => {
            openPhotoModal();
        });
    }
    
    const viewAllActivitiesBtn = document.getElementById('viewAllActivitiesBtn');
    if (viewAllActivitiesBtn) {
        viewAllActivitiesBtn.addEventListener('click', () => {
            showToast('View all activities feature coming soon!', 'info');
        });
    }
    
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    const backBtn = document.querySelector('header .fa-arrow-left')?.parentElement;
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }
    
    const loginTab = document.getElementById('loginTab');
    const signupTab = document.getElementById('signupTab');
    const switchToSignupBtn = document.getElementById('switchToSignup');
    const switchToLoginBtn = document.getElementById('switchToLogin');
    
    if (loginTab) {
        const newLoginTab = loginTab.cloneNode(true);
        loginTab.parentNode.replaceChild(newLoginTab, loginTab);
        newLoginTab.addEventListener('click', switchToLogin);
    }
    
    if (signupTab) {
        const newSignupTab = signupTab.cloneNode(true);
        signupTab.parentNode.replaceChild(newSignupTab, signupTab);
        newSignupTab.addEventListener('click', switchToSignup);
    }
    
    if (switchToSignupBtn) {
        const newSwitchToSignup = switchToSignupBtn.cloneNode(true);
        switchToSignupBtn.parentNode.replaceChild(newSwitchToSignup, switchToSignupBtn);
        newSwitchToSignup.addEventListener('click', switchToSignup);
    }
    
    if (switchToLoginBtn) {
        const newSwitchToLogin = switchToLoginBtn.cloneNode(true);
        switchToLoginBtn.parentNode.replaceChild(newSwitchToLogin, switchToLoginBtn);
        newSwitchToLogin.addEventListener('click', switchToLogin);
    }
    
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        const newLoginForm = loginForm.cloneNode(true);
        loginForm.parentNode.replaceChild(newLoginForm, loginForm);
        newLoginForm.addEventListener('submit', handleLogin);
    }
    
    const signupForm = document.getElementById('signupForm');
    if (signupForm) {
        const newSignupForm = signupForm.cloneNode(true);
        signupForm.parentNode.replaceChild(newSignupForm, signupForm);
        newSignupForm.addEventListener('submit', handleSignup);
    }
}

// ============================================
// ADDITIONAL MODAL FUNCTIONS
// ============================================

function openPreferencesModal() {
    openCustomModal('preferencesModal');
}

function openEditProfileModal() {
    openCustomModal('editProfileModal');
    const fullNameEl = document.getElementById('editFullName');
    const phoneEl = document.getElementById('editPhone');
    const emailEl = document.getElementById('editEmail');
    const locationEl = document.getElementById('editLocation');
    const bioEl = document.getElementById('editBio');
    
    if (fullNameEl) fullNameEl.value = userData?.fullName || '';
    if (phoneEl) phoneEl.value = userData?.phoneNumber || '';
    if (emailEl) emailEl.value = userData?.email || '';
    if (locationEl) locationEl.value = userData?.location || '';
    if (bioEl) bioEl.value = userData?.bio || '';
}

// ============================================
// SAVE PROFILE
// ============================================

async function saveProfile(e) {
    e.preventDefault();
    const fullName = document.getElementById('editFullName')?.value.trim();
    const phone = document.getElementById('editPhone')?.value.trim();
    const email = document.getElementById('editEmail')?.value.trim();
    const location = document.getElementById('editLocation')?.value.trim();
    const bio = document.getElementById('editBio')?.value.trim();
    
    if (!fullName || !phone || !email) {
        showToast('Please fill in required fields', 'error');
        return;
    }
    
    try {
        const updateData = {
            fullName: fullName,
            phoneNumber: phone,
            email: email,
            location: location || '',
            bio: bio || ''
        };
        
        await db.collection('users').doc(currentUser.uid).update(updateData);
        userData = { ...userData, ...updateData };
        localStorage.setItem('cachedUserData_' + currentUser.uid, JSON.stringify(userData));
        
        renderProfile(userData);
        showToast('Profile updated successfully! ✅', 'success');
        closeCustomModal('editProfileModal');
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showToast('Error updating profile. Please try again.', 'error');
    }
}

// ============================================
// OPEN PHOTO MODAL
// ============================================

function openPhotoModal() {
    openCustomModal('photoModal');
    const input = document.getElementById('photoInput');
    if (input) input.value = '';
}

// ============================================
// UPLOAD PHOTO
// ============================================

function uploadPhoto() {
    const input = document.getElementById('photoInput');
    const file = input?.files[0];
    
    if (!file) {
        showToast('Please select a photo', 'error');
        return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
        showToast('Image must be less than 2MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const photoData = e.target.result;
        const avatar = document.getElementById('profileAvatar');
        if (avatar) {
            avatar.innerHTML = `<img src="${photoData}" alt="Profile Photo" class="w-full h-full object-cover rounded-full"/>`;
        }
        
        localStorage.setItem('profilePhoto_' + currentUser.uid, photoData);
        showToast('Photo updated successfully! 📸', 'success');
        closeCustomModal('photoModal');
    };
    reader.readAsDataURL(file);
}

// ============================================
// AUTH STATE LISTENER
// ============================================

auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('✅ User authenticated:', user.uid);
        loadUserProfile();
        setTimeout(setupEventListeners, 500);
    } else {
        console.log('👤 User not authenticated');
        if (loadingState) loadingState.classList.add('hidden');
        if (profileContent) profileContent.classList.add('hidden');
        setTimeout(() => {
            openLoginModal();
            setTimeout(setupEventListeners, 300);
        }, 500);
    }
});

// ============================================
// STICKY HEADER EFFECT
// ============================================

window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (header) {
        if (window.scrollY > 10) {
            header.classList.add('shadow-md', 'bg-white/90', 'backdrop-blur-md');
            header.classList.remove('bg-surface');
        } else {
            header.classList.remove('shadow-md', 'bg-white/90', 'backdrop-blur-md');
            header.classList.add('bg-surface');
        }
    }
});

// Check if app is installed and running standalone
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                     window.navigator.standalone === true;

if (isStandalone) {
    console.log('📱 App is installed and running in standalone mode');
    // You can add special logic for installed app here
}

// ============================================
// EXPORT FOR DEBUGGING
// ============================================

window.__profileApp = {
    db,
    auth,
    currentUser,
    userData,
    allRequests,
    allDevotions,
    savedDevotions,
    myEvents,
    allEvents,
    isOnline,
    loadUserProfile,
    renderProfile,
    handleLogout,
    openEditFieldModal,
    saveFieldEdit,
    changeTheme,
    changeLanguage,
    changePassword
};

console.log('📋 Profile app state exported to window.__profileApp for debugging');