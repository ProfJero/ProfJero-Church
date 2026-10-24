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

let allRequests = [];
let allDevotions = [];
let savedDevotions = [];
let isBookmarked = false;
let currentPhoneNumber = '';
let currentUser = null;
let userData = null;
let isOnline = navigator.onLine;
let hasNewDevotion = false;
let newDevotionData = null;
let isInitialized = false;
let currentDevotion = null;

// ============================================
// NETWORK STATUS
// ============================================

window.addEventListener('online', () => {
    isOnline = true;
    console.log('Back online');
    showToast('Back online!', 'success');
    if (currentPhoneNumber) {
        loadMyRequests();
    }
    loadDevotions();
    syncOfflineRequests();
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
// UPDATE DEVOTION IMAGE
// ============================================

function updateDevotionImage(devotionalCard, imageUrl) {
    if (!devotionalCard) return;
    
    // Find or create the image container
    let imageContainer = devotionalCard.querySelector('.devotion-image-container');
    
    if (imageUrl) {
        if (!imageContainer) {
            // Create image container if it doesn't exist
            imageContainer = document.createElement('div');
            imageContainer.className = 'devotion-image-container absolute inset-0 z-0';
            
            // Insert it as the first child
            devotionalCard.insertBefore(imageContainer, devotionalCard.firstChild);
        }
        
        // Create or update the image
        let img = imageContainer.querySelector('img');
        if (!img) {
            img = document.createElement('img');
            img.className = 'w-full h-full object-cover';
            img.alt = 'Devotion Image';
            img.loading = 'lazy';
            imageContainer.appendChild(img);
        }
        
        img.src = imageUrl;
        imageContainer.style.display = 'block';
        imageContainer.style.backgroundImage = 'none';
        
        // Hide the default background image
        devotionalCard.style.backgroundImage = 'none';
        
    } else {
        // Use default background if no image
        if (imageContainer) {
            imageContainer.style.display = 'none';
        }
        
        // Restore default background
        devotionalCard.style.backgroundImage = "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAKRv8mGvAQbzZFsz3dhGG73bX24u1qDAXVC-qD7jpCGpHWH4Qva439lGI8EaoOXGpgtGBCR0_erB-Hk7eDMfduHEEx2vReCKPg6SxbWTVCDfcO1KJaTnFxvotHQfugLYYe1cq1SFqqUgqvK6-mytcd_VF6XGsOk5t4eoE5o7mtRIlFq_7N9tDWuUVJ9ETKep435mVEA2NZNCOCx8YIEmdGNko3Dmb_-P_rZpL00ItoMT5FdRotcsEb')";
    }
}

// ============================================
// UPDATE DEVOTION SECTION
// ============================================

function updateDevotionSection(devotions) {
    const titleEl = document.getElementById('devotionalTitle');
    const verseEl = document.getElementById('devotionalVerse');
    const devotionalCard = document.getElementById('dailyDevotional');
    const bookmarkIcon = document.getElementById('bookmarkIcon');
    
    if (!devotions || devotions.length === 0) {
        if (titleEl) titleEl.textContent = 'No Devotion Available';
        if (verseEl) verseEl.textContent = 'Check back later for today\'s devotion';
        updateDevotionImage(devotionalCard, null);
        if (bookmarkIcon) {
            bookmarkIcon.className = 'far fa-bookmark';
            isBookmarked = false;
        }
        return;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const todayDevotion = devotions.find(d => d.date === today);
    const devotionToShow = todayDevotion || devotions[0];
    
    if (devotionToShow) {
        currentDevotion = devotionToShow;
        
        if (titleEl) titleEl.textContent = devotionToShow.title || 'Daily Devotion';
        if (verseEl) verseEl.textContent = devotionToShow.verse || '';
        
        // Update the devotional image
        updateDevotionImage(devotionalCard, devotionToShow.image);
        
        // Reset bookmark
        if (bookmarkIcon) {
            // Check if already saved
            const saved = JSON.parse(localStorage.getItem('savedDevotions') || '[]');
            const isAlreadySaved = saved.some(d => d.id === devotionToShow.id);
            if (isAlreadySaved) {
                bookmarkIcon.className = 'fas fa-bookmark';
                isBookmarked = true;
            } else {
                bookmarkIcon.className = 'far fa-bookmark';
                isBookmarked = false;
            }
        }
        
        const seenDevotions = JSON.parse(localStorage.getItem('seenDevotions') || '[]');
        if (todayDevotion && !seenDevotions.includes(todayDevotion.id)) {
            hasNewDevotion = true;
            newDevotionData = todayDevotion;
            if (!localStorage.getItem('devotionPopupShown_' + todayDevotion.id)) {
                setTimeout(() => {
                    showNewDevotionPopup(todayDevotion);
                    localStorage.setItem('devotionPopupShown_' + todayDevotion.id, 'true');
                }, 2000);
            }
        }
    }
}

// ============================================
// LOAD DEVOTIONS FROM FIRESTORE
// ============================================

async function loadDevotions() {
    try {
        if (!isOnline) {
            const cachedDevotions = localStorage.getItem('cachedDevotions');
            if (cachedDevotions) {
                try {
                    allDevotions = JSON.parse(cachedDevotions);
                    if (allDevotions.length > 0) {
                        updateDevotionSection(allDevotions);
                        showToast('Offline - showing cached devotions', 'info');
                        return;
                    }
                } catch (e) {
                    console.error('Error parsing cached devotions:', e);
                }
            }
            showToast('No cached devotions available offline', 'error');
            return;
        }
        
        const snapshot = await db.collection('devotions')
            .where('status', '==', 'published')
            .orderBy('date', 'desc')
            .limit(7)
            .get();
        
        if (!snapshot.empty) {
            allDevotions = [];
            snapshot.forEach(doc => {
                allDevotions.push({ id: doc.id, ...doc.data() });
            });
            
            localStorage.setItem('cachedDevotions', JSON.stringify(allDevotions));
            updateDevotionSection(allDevotions);
            console.log('✅ Devotions loaded successfully from Firestore');
        } else {
            allDevotions = [];
            updateDevotionSection([]);
            showToast('No devotions available', 'info');
        }
        
        updateDevotionBadge();
        
    } catch (error) {
        console.error('Error loading devotions:', error);
        const cachedDevotions = localStorage.getItem('cachedDevotions');
        if (cachedDevotions) {
            try {
                allDevotions = JSON.parse(cachedDevotions);
                if (allDevotions.length > 0) {
                    updateDevotionSection(allDevotions);
                    showToast('Using cached devotions', 'info');
                }
            } catch (e) {
                console.error('Error parsing cached devotions:', e);
                allDevotions = [];
                updateDevotionSection([]);
            }
        } else {
            allDevotions = [];
            updateDevotionSection([]);
            showToast('No devotions available. Please check your connection.', 'error');
        }
    }
}

// ============================================
// LOAD DEVOTIONAL FOR MODAL
// ============================================

async function loadDevotional() {
    const loading = document.getElementById('devotionalLoading');
    const display = document.getElementById('devotionalDisplay');
    const modalContent = document.getElementById('devotionalContent');
    
    if (loading) loading.classList.remove('hidden');
    if (display) display.classList.add('hidden');
    
    try {
        let devotion = null;
        const today = new Date().toISOString().split('T')[0];
        
        // Check if we have a cached devotion
        if (allDevotions.length > 0) {
            devotion = allDevotions.find(d => d.date === today) || allDevotions[0];
        }
        
        // If not cached and online, fetch from Firestore
        if (!devotion && isOnline) {
            try {
                const snapshot = await db.collection('devotions')
                    .where('date', '==', today)
                    .where('status', '==', 'published')
                    .get();
                
                if (!snapshot.empty) {
                    devotion = snapshot.docs[0].data();
                    devotion.id = snapshot.docs[0].id;
                } else {
                    const latestSnapshot = await db.collection('devotions')
                        .where('status', '==', 'published')
                        .orderBy('date', 'desc')
                        .limit(1)
                        .get();
                    
                    if (!latestSnapshot.empty) {
                        devotion = latestSnapshot.docs[0].data();
                        devotion.id = latestSnapshot.docs[0].id;
                    }
                }
            } catch (e) {
                console.error('Error fetching from Firestore:', e);
            }
        }
        
        if (!devotion) {
            // Fallback content
            document.getElementById('devotionalModalTitle').textContent = 'No Devotion Available';
            document.getElementById('devotionalModalVerse').textContent = '';
            document.getElementById('devotionalModalContent').innerHTML = 'No devotion content available at the moment. Please check back later.';
            document.getElementById('devotionalModalPrayer').innerHTML = 'Heavenly Father, we thank You for Your Word. Help us to seek You daily and grow in our relationship with You. In Jesus\' name, Amen.';
        } else {
            // Update modal with devotion data
            document.getElementById('devotionalModalTitle').textContent = devotion.title || 'Daily Devotion';
            document.getElementById('devotionalModalVerse').textContent = devotion.verse || '';
            document.getElementById('devotionalModalContent').innerHTML = devotion.content || devotion.message || '';
            document.getElementById('devotionalModalPrayer').innerHTML = devotion.prayer || '';
            
            // Add image to modal if available
            let existingImage = modalContent.querySelector('.devotion-modal-image');
            
            if (devotion.image) {
                if (!existingImage) {
                    existingImage = document.createElement('img');
                    existingImage.className = 'devotion-modal-image w-full h-48 object-cover rounded-xl mb-4';
                    modalContent.insertBefore(existingImage, modalContent.firstChild);
                }
                existingImage.src = devotion.image;
                existingImage.alt = devotion.title || 'Devotion Image';
                existingImage.style.display = 'block';
            } else if (existingImage) {
                existingImage.style.display = 'none';
            }
        }
        
        if (loading) loading.classList.add('hidden');
        if (display) display.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error loading devotional:', error);
        if (loading) {
            loading.innerHTML = `
                <p class="text-red-500"><i class="fas fa-exclamation-circle mr-2"></i>Error loading devotional. Please try again.</p>
                <button onclick="loadDevotional()" class="mt-3 bg-secondary text-white px-4 py-2 rounded-lg text-sm">
                    <i class="fas fa-sync-alt mr-2"></i>Retry
                </button>
            `;
        }
    }
}

// ============================================
// SHOW NEW DEVOTION POPUP
// ============================================

function showNewDevotionPopup(devotion) {
    const modal = document.getElementById('devotionalModal');
    if (!modal) return;
    
    const modalContent = document.getElementById('devotionalContent');
    
    // Update modal content
    document.getElementById('devotionalModalTitle').textContent = devotion.title || 'Daily Devotion';
    document.getElementById('devotionalModalVerse').textContent = devotion.verse || '';
    document.getElementById('devotionalModalContent').innerHTML = devotion.content || devotion.message || '';
    document.getElementById('devotionalModalPrayer').innerHTML = devotion.prayer || '';
    
    // Add image to modal if available
    let existingImage = modalContent.querySelector('.devotion-modal-image');
    
    if (devotion.image) {
        if (!existingImage) {
            existingImage = document.createElement('img');
            existingImage.className = 'devotion-modal-image w-full h-48 object-cover rounded-xl mb-4';
            modalContent.insertBefore(existingImage, modalContent.firstChild);
        }
        existingImage.src = devotion.image;
        existingImage.alt = devotion.title || 'Devotion Image';
        existingImage.style.display = 'block';
    } else if (existingImage) {
        existingImage.style.display = 'none';
    }
    
    document.getElementById('devotionalLoading').classList.add('hidden');
    document.getElementById('devotionalDisplay').classList.remove('hidden');
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    const seenDevotions = JSON.parse(localStorage.getItem('seenDevotions') || '[]');
    if (devotion.id && !seenDevotions.includes(devotion.id)) {
        seenDevotions.push(devotion.id);
        localStorage.setItem('seenDevotions', JSON.stringify(seenDevotions));
    }
    hasNewDevotion = false;
    
    showToast('📖 New Devotion Available!', 'success');
}

// ============================================
// UPDATE DEVOTION BADGE
// ============================================

function updateDevotionBadge() {
    const seenDevotions = JSON.parse(localStorage.getItem('seenDevotions') || '[]');
    const today = new Date().toISOString().split('T')[0];
    const todayDevotion = allDevotions.find(d => d.date === today);
    const badge = document.getElementById('notificationBadge');
    
    if (!badge) return;
    
    const pending = allRequests.filter(r => r.status === 'pending' || r.status === 'urgent').length;
    
    if (pending > 0) {
        badge.classList.remove('hidden');
        badge.textContent = pending;
    } else if (todayDevotion && !seenDevotions.includes(todayDevotion.id)) {
        badge.classList.remove('hidden');
        badge.textContent = '📖';
    } else {
        badge.classList.add('hidden');
    }
}

// ============================================
// MODAL FUNCTIONS
// ============================================

window.openModal = function(type) {
    const modalMap = {
        'prayer': 'prayerModal',
        'counselling': 'counsellingModal',
        'visit': 'visitModal',
        'devotional': 'devotionalModal',
        'urgent': 'urgentModal'
    };
    
    const modalId = modalMap[type];
    if (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            
            if (type === 'devotional') {
                loadDevotional();
            }
            
            if (currentUser && userData) {
                autoFillForms();
            }
        }
    }
};

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
};

// ============================================
// AUTO-FILL FORMS
// ============================================

function autoFillForms() {
    if (!userData) return;
    
    const fields = {
        'prayerName': userData.fullName || '',
        'prayerPhone': userData.phoneNumber || '',
        'prayerEmail': userData.email || '',
        'counsellingName': userData.fullName || '',
        'counsellingPhone': userData.phoneNumber || '',
        'counsellingEmail': userData.email || '',
        'visitName': userData.fullName || '',
        'visitPhone': userData.phoneNumber || '',
        'visitEmail': userData.email || '',
        'urgentName': userData.fullName || '',
        'urgentPhone': userData.phoneNumber || ''
    };
    
    Object.keys(fields).forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.value) {
            el.value = fields[id] || '';
        }
    });
}

// ============================================
// BOOKMARK FUNCTIONALITY
// ============================================

window.toggleBookmark = function() {
    isBookmarked = !isBookmarked;
    const icon = document.getElementById('bookmarkIcon');
    if (!icon) return;
    
    if (isBookmarked) {
        icon.className = 'fas fa-bookmark';
        if (currentDevotion) {
            let saved = JSON.parse(localStorage.getItem('savedDevotions') || '[]');
            const exists = saved.some(d => d.id === currentDevotion.id);
            if (!exists) {
                saved.push({
                    ...currentDevotion,
                    savedAt: new Date().toISOString()
                });
                localStorage.setItem('savedDevotions', JSON.stringify(saved));
                savedDevotions = saved;
                showToast('Devotional saved! 📖', 'success');
                renderSavedDevotions();
            } else {
                showToast('Already saved!', 'info');
            }
        }
    } else {
        icon.className = 'far fa-bookmark';
        // Remove from saved
        if (currentDevotion) {
            let saved = JSON.parse(localStorage.getItem('savedDevotions') || '[]');
            saved = saved.filter(d => d.id !== currentDevotion.id);
            localStorage.setItem('savedDevotions', JSON.stringify(saved));
            savedDevotions = saved;
            showToast('Bookmark removed', 'info');
            renderSavedDevotions();
        }
    }
};

// ============================================
// SAVED DEVOTIONS
// ============================================

function loadSavedDevotions() {
    const saved = localStorage.getItem('savedDevotions');
    if (saved) {
        try {
            savedDevotions = JSON.parse(saved);
            renderSavedDevotions();
        } catch (e) {
            console.error('Error parsing saved devotions:', e);
            savedDevotions = [];
            renderSavedDevotions();
        }
    } else {
        savedDevotions = [];
        renderSavedDevotions();
    }
}

function renderSavedDevotions() {
    const container = document.getElementById('savedDevotionsList');
    if (!container) return;
    
    if (savedDevotions.length === 0) {
        container.innerHTML = `
            <div class="text-center py-4 text-on-surface-variant text-sm">
                <i class="fas fa-bookmark text-4xl block mx-auto mb-2 opacity-30"></i>
                No saved devotions yet. Tap the bookmark icon on any devotion to save it.
            </div>
        `;
        return;
    }
    
    container.innerHTML = savedDevotions.slice(0, 3).map((dev, index) => `
        <div class="bg-surface-container-lowest p-4 rounded-xl shadow-soft border border-outline-variant/5 cursor-pointer hover:shadow-md transition" onclick="viewSavedDevotion(${index})">
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-headline-sm text-primary text-[15px]">${dev.title || 'Devotion'}</h4>
                    <p class="text-[12px] text-on-surface-variant italic">${dev.verse || ''}</p>
                </div>
                <button onclick="event.stopPropagation(); removeSavedDevotion(${index})" class="text-gray-400 hover:text-red-500 transition">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="text-[13px] text-gray-600 mt-2 line-clamp-2">${dev.content ? dev.content.substring(0, 100) + '...' : ''}</div>
            <p class="text-[10px] text-gray-400 mt-1">Saved: ${new Date(dev.savedAt).toLocaleDateString()}</p>
        </div>
    `).join('');
}

window.viewSavedDevotion = function(index) {
    const dev = savedDevotions[index];
    if (!dev) return;
    
    // Open devotional modal with saved devotion
    document.getElementById('devotionalModalTitle').textContent = dev.title || 'Saved Devotion';
    document.getElementById('devotionalModalVerse').textContent = dev.verse || '';
    document.getElementById('devotionalModalContent').innerHTML = dev.content || '';
    document.getElementById('devotionalModalPrayer').innerHTML = dev.prayer || '';
    
    const modalContent = document.getElementById('devotionalContent');
    let existingImage = modalContent.querySelector('.devotion-modal-image');
    if (dev.image) {
        if (!existingImage) {
            existingImage = document.createElement('img');
            existingImage.className = 'devotion-modal-image w-full h-48 object-cover rounded-xl mb-4';
            modalContent.insertBefore(existingImage, modalContent.firstChild);
        }
        existingImage.src = dev.image;
        existingImage.alt = dev.title || 'Devotion Image';
        existingImage.style.display = 'block';
    } else if (existingImage) {
        existingImage.style.display = 'none';
    }
    
    document.getElementById('devotionalLoading').classList.add('hidden');
    document.getElementById('devotionalDisplay').classList.remove('hidden');
    
    document.getElementById('devotionalModal').classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.removeSavedDevotion = function(index) {
    savedDevotions.splice(index, 1);
    localStorage.setItem('savedDevotions', JSON.stringify(savedDevotions));
    renderSavedDevotions();
    showToast('Devotion removed', 'info');
};

// ============================================
// SUBMIT REQUEST FUNCTIONS
// ============================================

async function submitPrayerRequest(data) {
    const btn = document.getElementById('prayerSubmitText');
    const spinner = document.getElementById('prayerSpinner');
    
    if (btn) btn.innerHTML = '<span class="loading-spinner inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></span>Submitting...';
    if (spinner) spinner.classList.remove('hidden');
    
    try {
        const visibility = document.querySelector('input[name="prayerVisibility"]:checked')?.value || 'private';
        
        const requestData = {
            fullName: data.fullName,
            phone: data.phone,
            email: data.email || '',
            request: data.request,
            followup: data.followup || 'no',
            type: 'prayer_request',
            visibility: visibility,
            status: 'pending',
            createdAt: new Date().toISOString(),
            userId: currentUser ? currentUser.uid : null
        };
        
        if (isOnline) {
            await db.collection('pastoral_requests').add(requestData);
            showToast('Prayer request submitted! 🙏 ' + (visibility === 'public' ? '(shared publicly)' : '(private)'), 'success');
        } else {
            saveOfflineRequest(requestData);
            showToast('Saved offline - will sync when online', 'info');
        }
        
        closeModal('prayerModal');
        document.getElementById('prayerForm')?.reset();
        
        if (data.phone) {
            currentPhoneNumber = data.phone;
            localStorage.setItem('rgci_member_phone', data.phone);
            await loadMyRequests();
        }
        
    } catch (error) {
        console.error('Error submitting prayer request:', error);
        showToast('Error submitting request. Please try again.', 'error');
    }
    
    if (btn) btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Submit Prayer Request';
    if (spinner) spinner.classList.add('hidden');
}

async function submitCounsellingRequest(data) {
    const btn = document.getElementById('counsellingSubmitText');
    const spinner = document.getElementById('counsellingSpinner');
    
    if (btn) btn.innerHTML = '<span class="loading-spinner inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></span>Submitting...';
    if (spinner) spinner.classList.remove('hidden');
    
    try {
        const requestData = {
            fullName: data.fullName,
            phone: data.phone,
            email: data.email || '',
            message: data.message,
            contactMethod: data.contactMethod || 'phone',
            type: 'counselling_request',
            status: 'pending',
            createdAt: new Date().toISOString(),
            userId: currentUser ? currentUser.uid : null
        };
        
        if (isOnline) {
            await db.collection('pastoral_requests').add(requestData);
            showToast('Counselling request submitted! 💬', 'success');
        } else {
            saveOfflineRequest(requestData);
            showToast('Saved offline - will sync when online', 'info');
        }
        
        closeModal('counsellingModal');
        document.getElementById('counsellingForm')?.reset();
        
        if (data.phone) {
            currentPhoneNumber = data.phone;
            localStorage.setItem('rgci_member_phone', data.phone);
            await loadMyRequests();
        }
        
    } catch (error) {
        console.error('Error submitting counselling request:', error);
        showToast('Error submitting request. Please try again.', 'error');
    }
    
    if (btn) btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Submit Counselling Request';
    if (spinner) spinner.classList.add('hidden');
}

async function submitVisitRequest(data) {
    const btn = document.getElementById('visitSubmitText');
    const spinner = document.getElementById('visitSpinner');
    
    if (btn) btn.innerHTML = '<span class="loading-spinner inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></span>Submitting...';
    if (spinner) spinner.classList.remove('hidden');
    
    try {
        const requestData = {
            fullName: data.fullName,
            phone: data.phone,
            email: data.email || '',
            address: data.address,
            reason: data.reason || '',
            preferredDate: data.preferredDate || '',
            type: 'visit_request',
            status: 'pending',
            createdAt: new Date().toISOString(),
            userId: currentUser ? currentUser.uid : null
        };
        
        if (isOnline) {
            await db.collection('pastoral_requests').add(requestData);
            showToast('Visit request submitted! 🏠', 'success');
        } else {
            saveOfflineRequest(requestData);
            showToast('Saved offline - will sync when online', 'info');
        }
        
        closeModal('visitModal');
        document.getElementById('visitForm')?.reset();
        
        if (data.phone) {
            currentPhoneNumber = data.phone;
            localStorage.setItem('rgci_member_phone', data.phone);
            await loadMyRequests();
        }
        
    } catch (error) {
        console.error('Error submitting visit request:', error);
        showToast('Error submitting request. Please try again.', 'error');
    }
    
    if (btn) btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Submit Visit Request';
    if (spinner) spinner.classList.add('hidden');
}

async function submitUrgentRequest(data) {
    const btn = document.getElementById('urgentSubmitText');
    const spinner = document.getElementById('urgentSpinner');
    
    if (btn) btn.innerHTML = '<span class="loading-spinner inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></span>Submitting...';
    if (spinner) spinner.classList.remove('hidden');
    
    try {
        const requestData = {
            fullName: data.fullName,
            phone: data.phone,
            message: data.message,
            type: 'urgent_request',
            status: 'urgent',
            createdAt: new Date().toISOString(),
            userId: currentUser ? currentUser.uid : null
        };
        
        if (isOnline) {
            await db.collection('pastoral_requests').add(requestData);
            showToast('Urgent request sent! A pastor will contact you shortly. 📞', 'success');
        } else {
            saveOfflineRequest(requestData);
            showToast('Saved offline - will sync when online', 'info');
        }
        
        closeModal('urgentModal');
        document.getElementById('urgentForm')?.reset();
        
    } catch (error) {
        console.error('Error submitting urgent request:', error);
        showToast('Error submitting request. Please try again.', 'error');
    }
    
    if (btn) btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i>Send Urgent Request';
    if (spinner) spinner.classList.add('hidden');
}

// ============================================
// SAVE OFFLINE REQUESTS
// ============================================

function saveOfflineRequest(requestData) {
    const offlineRequests = JSON.parse(localStorage.getItem('offlineRequests') || '[]');
    offlineRequests.push({ ...requestData, offline: true });
    localStorage.setItem('offlineRequests', JSON.stringify(offlineRequests));
}

async function syncOfflineRequests() {
    if (!isOnline || !currentUser) return;
    
    try {
        const offlineRequests = JSON.parse(localStorage.getItem('offlineRequests') || '[]');
        if (offlineRequests.length === 0) return;
        
        console.log(`Syncing ${offlineRequests.length} offline requests...`);
        let syncedCount = 0;
        
        for (const request of offlineRequests) {
            const { offline, ...data } = request;
            try {
                await db.collection('pastoral_requests').add(data);
                syncedCount++;
            } catch (e) {
                console.error('Error syncing request:', e);
            }
        }
        
        if (syncedCount > 0) {
            const remaining = offlineRequests.slice(syncedCount);
            localStorage.setItem('offlineRequests', JSON.stringify(remaining));
            showToast(`${syncedCount} offline request(s) synced!`, 'success');
            await loadMyRequests();
        }
        
    } catch (error) {
        console.error('Error syncing offline requests:', error);
    }
}

// ============================================
// LOAD MY REQUESTS
// ============================================

async function loadMyRequests() {
    const phone = currentPhoneNumber || localStorage.getItem('rgci_member_phone') || '';
    
    if (!phone) {
        renderMyRequests([]);
        return;
    }
    
    try {
        const cachedRequests = localStorage.getItem('cachedRequests_' + phone);
        if (cachedRequests) {
            try {
                allRequests = JSON.parse(cachedRequests);
                renderMyRequests(allRequests);
                updateNotificationBadge();
            } catch (e) {
                console.error('Error parsing cached requests:', e);
            }
        }
        
        if (!isOnline) {
            showToast('Offline - showing cached requests', 'info');
            return;
        }
        
        const snapshot = await db.collection('pastoral_requests')
            .where('phone', '==', phone)
            .orderBy('createdAt', 'desc')
            .get();
        
        if (!snapshot.empty) {
            allRequests = [];
            snapshot.forEach(doc => {
                allRequests.push({ id: doc.id, ...doc.data() });
            });
        } else {
            allRequests = [];
        }
        
        localStorage.setItem('cachedRequests_' + phone, JSON.stringify(allRequests));
        renderMyRequests(allRequests);
        updateNotificationBadge();
        
    } catch (error) {
        console.error('Error loading requests:', error);
        const cachedRequests = localStorage.getItem('cachedRequests_' + phone);
        if (cachedRequests) {
            try {
                allRequests = JSON.parse(cachedRequests);
                renderMyRequests(allRequests);
                updateNotificationBadge();
            } catch (e) {
                renderMyRequests([]);
            }
        } else {
            renderMyRequests([]);
        }
    }
}

function renderMyRequests(requests) {
    const container = document.getElementById('myRequestsList');
    if (!container) return;
    
    if (!requests || requests.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-on-surface-variant text-sm">
                <i class="fas fa-inbox text-4xl block mx-auto mb-2 opacity-30"></i>
                No requests yet. Tap the buttons above to get started.
            </div>
        `;
        return;
    }
    
    const iconMap = {
        'prayer_request': 'fa-hands-praying',
        'counselling_request': 'fa-comments',
        'visit_request': 'fa-home',
        'urgent_request': 'fa-exclamation-triangle'
    };
    
    const colorMap = {
        'prayer_request': 'bg-primary-fixed text-secondary',
        'counselling_request': 'bg-error-container text-error',
        'visit_request': 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
        'urgent_request': 'bg-red-100 text-red-700'
    };
    
    const typeLabels = {
        'prayer_request': 'Prayer Request',
        'counselling_request': 'Counselling',
        'visit_request': 'Visit Request',
        'urgent_request': 'Urgent Request'
    };
    
    container.innerHTML = requests.slice(0, 3).map(req => {
        const icon = iconMap[req.type] || 'fa-inbox';
        const colorClass = colorMap[req.type] || 'bg-gray-100 text-gray-700';
        const statusClass = `status-${req.status || 'pending'}`;
        const statusLabel = req.status ? req.status.charAt(0).toUpperCase() + req.status.slice(1) : 'Pending';
        const description = req.request || req.message || req.reason || '';
        
        return `
            <div class="bg-surface-container-lowest p-4 rounded-xl flex items-center justify-between shadow-soft border border-outline-variant/5">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-full ${colorClass} flex items-center justify-center">
                        <i class="fas ${icon}"></i>
                    </div>
                    <div>
                        <h4 class="font-headline-sm text-primary text-[15px]">${typeLabels[req.type] || req.type || 'Request'}</h4>
                        <p class="text-[12px] text-on-surface-variant">${description.substring(0, 30)}${description.length > 30 ? '...' : ''}</p>
                    </div>
                </div>
                <div class="flex items-center gap-3">
                    <span class="status-badge ${statusClass}">${statusLabel}</span>
                    <i class="fas fa-chevron-right text-outline text-sm"></i>
                </div>
            </div>
        `;
    }).join('');
}

function renderAllRequests() {
    const container = document.getElementById('allRequestsList');
    if (!container) return;
    
    if (allRequests.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400"><i class="fas fa-inbox text-4xl block mx-auto mb-2 opacity-30"></i>No requests yet.</div>';
        return;
    }
    
    const typeLabels = {
        'prayer_request': 'Prayer Request',
        'counselling_request': 'Counselling',
        'visit_request': 'Visit Request',
        'urgent_request': 'Urgent Request'
    };
    
    container.innerHTML = allRequests.map(req => {
        const statusClass = `status-${req.status || 'pending'}`;
        const statusLabel = req.status ? req.status.charAt(0).toUpperCase() + req.status.slice(1) : 'Pending';
        const date = req.createdAt ? new Date(req.createdAt).toLocaleDateString() : 'Unknown date';
        const description = req.request || req.message || req.reason || 'No details';
        
        return `
            <div class="bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div class="flex justify-between items-start">
                    <div>
                        <h4 class="font-medium text-gray-800">${typeLabels[req.type] || req.type || 'Request'}</h4>
                        <p class="text-sm text-gray-500">${req.fullName || 'Unknown'} • ${date}</p>
                    </div>
                    <span class="status-badge ${statusClass}">${statusLabel}</span>
                </div>
                <p class="text-sm text-gray-600 mt-2">${description}</p>
                ${req.visibility ? `<p class="text-xs text-gray-400 mt-1"><i class="fas ${req.visibility === 'public' ? 'fa-globe' : 'fa-lock'}"></i> ${req.visibility}</p>` : ''}
            </div>
        `;
    }).join('');
}

// ============================================
// UPDATE NOTIFICATION BADGE
// ============================================

function updateNotificationBadge() {
    const pending = allRequests.filter(r => r.status === 'pending' || r.status === 'urgent').length;
    const badge = document.getElementById('notificationBadge');
    if (!badge) return;
    
    const seenDevotions = JSON.parse(localStorage.getItem('seenDevotions') || '[]');
    const today = new Date().toISOString().split('T')[0];
    const todayDevotion = allDevotions.find(d => d.date === today);
    const hasNewDevotion = todayDevotion && !seenDevotions.includes(todayDevotion.id);
    
    if (pending > 0) {
        badge.classList.remove('hidden');
        badge.textContent = pending;
    } else if (hasNewDevotion) {
        badge.classList.remove('hidden');
        badge.textContent = '📖';
    } else {
        badge.classList.add('hidden');
    }
}

// ============================================
// SETUP EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Prayer form
    document.getElementById('prayerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            fullName: document.getElementById('prayerName')?.value || '',
            phone: document.getElementById('prayerPhone')?.value || '',
            email: document.getElementById('prayerEmail')?.value || '',
            request: document.getElementById('prayerRequest')?.value || '',
            followup: document.getElementById('prayerFollowup')?.value || 'no'
        };
        await submitPrayerRequest(data);
    });

    // Counselling form
    document.getElementById('counsellingForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            fullName: document.getElementById('counsellingName')?.value || '',
            phone: document.getElementById('counsellingPhone')?.value || '',
            email: document.getElementById('counsellingEmail')?.value || '',
            message: document.getElementById('counsellingMessage')?.value || '',
            contactMethod: document.getElementById('counsellingContactMethod')?.value || 'phone'
        };
        await submitCounsellingRequest(data);
    });

    // Visit form
    document.getElementById('visitForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            fullName: document.getElementById('visitName')?.value || '',
            phone: document.getElementById('visitPhone')?.value || '',
            email: document.getElementById('visitEmail')?.value || '',
            address: document.getElementById('visitAddress')?.value || '',
            reason: document.getElementById('visitReason')?.value || '',
            preferredDate: document.getElementById('visitPreferredDate')?.value || ''
        };
        await submitVisitRequest(data);
    });

    // Urgent form
    document.getElementById('urgentForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const data = {
            fullName: document.getElementById('urgentName')?.value || '',
            phone: document.getElementById('urgentPhone')?.value || '',
            message: document.getElementById('urgentMessage')?.value || ''
        };
        await submitUrgentRequest(data);
    });

    // View All button
    document.getElementById('viewAllRequestsBtn')?.addEventListener('click', () => {
        renderAllRequests();
        document.getElementById('viewAllModal')?.classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    // View Saved Devotions button
    document.getElementById('viewSavedDevotionsBtn')?.addEventListener('click', () => {
        renderSavedDevotions();
        const modal = document.getElementById('viewAllModal');
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
            const titleEl = modal.querySelector('h3');
            if (titleEl) {
                titleEl.innerHTML = '<i class="fas fa-bookmark text-secondary mr-2"></i>Saved Devotions';
            }
        }
    });

    // Notification button
    document.getElementById('notificationBtn')?.addEventListener('click', () => {
        const pending = allRequests.filter(r => r.status === 'pending' || r.status === 'urgent').length;
        const seenDevotions = JSON.parse(localStorage.getItem('seenDevotions') || '[]');
        const today = new Date().toISOString().split('T')[0];
        const todayDevotion = allDevotions.find(d => d.date === today);
        const hasNewDevotion = todayDevotion && !seenDevotions.includes(todayDevotion.id);
        
        let notifications = [];
        if (pending > 0) notifications.push(`${pending} pending request(s)`);
        if (hasNewDevotion) {
            notifications.push('New devotion available');
            if (todayDevotion) {
                const seen = JSON.parse(localStorage.getItem('seenDevotions') || '[]');
                if (!seen.includes(todayDevotion.id)) {
                    seen.push(todayDevotion.id);
                    localStorage.setItem('seenDevotions', JSON.stringify(seen));
                    updateDevotionBadge();
                }
            }
        }
        if (savedDevotions.length > 0) notifications.push(`${savedDevotions.length} saved devotions`);
        
        if (notifications.length === 0) {
            showToast('No new notifications', 'info');
        } else {
            showToast(notifications.join(' • '), 'info');
        }
    });

    // Auto-load requests when phone number is entered
    document.getElementById('prayerPhone')?.addEventListener('blur', (e) => {
        if (e.target.value) {
            currentPhoneNumber = e.target.value;
            localStorage.setItem('rgci_member_phone', e.target.value);
            loadMyRequests();
        }
    });
}

// ============================================
// INITIALIZE PAGE
// ============================================

async function initPage() {
    if (isInitialized) return;
    isInitialized = true;
    
    console.log('🚀 Initializing RGCI Member Portal...');
    console.log('📁 Project:', firebaseConfig.projectId);
    
    loadSavedDevotions();
    
    try {
        await loadDevotions();
        console.log('✅ Devotions loaded successfully');
    } catch (error) {
        console.error('Error loading devotions:', error);
    }
    
    setupEventListeners();
    
    const savedPhone = localStorage.getItem('rgci_member_phone');
    if (savedPhone) {
        currentPhoneNumber = savedPhone;
        const prayerPhone = document.getElementById('prayerPhone');
        if (prayerPhone) prayerPhone.value = savedPhone;
        try {
            await loadMyRequests();
        } catch (error) {
            console.error('Error loading requests:', error);
        }
    }
    
    if (isOnline && currentUser) {
        await syncOfflineRequests();
    }
    
    console.log('✅ RGCI Member Portal initialized successfully!');
}

// ============================================
// CLICK OUTSIDE MODAL TO CLOSE
// ============================================

document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal-container');
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = 'auto';
        }
    });
});

// ============================================
// STICKY HEADER EFFECT
// ============================================

window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (header) {
        if (window.scrollY > 20) {
            header.classList.add('shadow-md', 'bg-white/90', 'backdrop-blur-md');
            header.classList.remove('bg-background');
        } else {
            header.classList.remove('shadow-md', 'bg-white/90', 'backdrop-blur-md');
            header.classList.add('bg-background');
        }
    }
});

// ============================================
// AUTHENTICATION
// ============================================

document.addEventListener('DOMContentLoaded', async () => {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            console.log('✅ User authenticated:', user.uid);
            
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    userData = userDoc.data();
                    console.log('✅ User data loaded');
                    autoFillForms();
                    if (userData.phoneNumber) {
                        currentPhoneNumber = userData.phoneNumber;
                        localStorage.setItem('rgci_member_phone', userData.phoneNumber);
                        const prayerPhone = document.getElementById('prayerPhone');
                        if (prayerPhone) prayerPhone.value = userData.phoneNumber;
                    }
                }
            } catch (error) {
                console.error('Error loading user data:', error);
            }
            
            await loadMyRequests();
            await syncOfflineRequests();
            
        } else {
            console.log('👤 User not authenticated, trying anonymous...');
            try {
                const userCredential = await auth.signInAnonymously();
                currentUser = userCredential.user;
                console.log('✅ Anonymous auth successful');
            } catch (error) {
                console.warn('⚠️ Anonymous auth failed:', error);
            }
        }
        
        if (!isInitialized) {
            await initPage();
        }
    });
});

// Check if app is installed and running standalone
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                     window.navigator.standalone === true;

if (isStandalone) {
    console.log('📱 App is installed and running in standalone mode');
}

// ============================================
// EXPORT FOR DEBUGGING
// ============================================

window.__app = {
    db,
    auth,
    allRequests,
    allDevotions,
    savedDevotions,
    currentUser,
    userData,
    isOnline,
    currentDevotion,
    loadDevotions,
    loadMyRequests,
    syncOfflineRequests,
    firebaseConfig,
    updateDevotionImage,
    updateDevotionSection
};

console.log('📋 App state exported to window.__app for debugging');