import { db, collection, addDoc, getDocs, query, orderBy, where, Timestamp, doc, deleteDoc, updateDoc } from './firebase-config.js';
import { 
    showToast, 
    protectPage, 
    updateUserDisplay,
    getCurrentUserRole,
    logoutUser
} from './auth.js';

// Cloudinary Configuration - Replace with your actual credentials
const CLOUDINARY_CONFIG = {
    cloudName: 'trajmf3x',
    uploadPreset: 'rgcicare',
    folder: 'rgci-content'
};

// Push Notification Worker URL
const WORKER_URL = 'https://rgci-push-worker.rgcinternational001.workers.dev';

// State variables
let allDevotions = [];
let allEvents = [];
let editingDevotionId = null;
let editingEventId = null;
let currentUserData = null;
let devotionQuill = null;
let eventQuill = null;

// DOM Elements
const loadingState = document.getElementById('loadingState');
const contentArea = document.getElementById('contentArea');

// ============================================
// PUSH NOTIFICATION FUNCTIONS
// ============================================

/**
 * Send push notification to all subscribers
 */
async function sendPushNotification(title, body, data = {}) {
    try {
        console.log('📤 Sending push notification...', { title, body });
        
        const response = await fetch(WORKER_URL + '/api/send-notification', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                body: body,
                icon: data.icon || '/icons/icon-192x192.png',
                badge: data.badge || '/icons/icon-72x72.png',
                vibrate: [200, 100, 200],
                data: {
                    url: data.url || '/index.html',
                    type: data.type || 'notification',
                    id: data.id || ''
                },
                // These are important for rich notifications
                requireInteraction: true,
                silent: false,
                tag: data.tag || 'rgci-notification',
                renotify: true,
                actions: [
                    {
                        action: 'open',
                        title: 'View Details'
                    },
                    {
                        action: 'dismiss',
                        title: 'Dismiss'
                    }
                ]
            })
        });
        
        const result = await response.json();
        console.log('📊 Push notification result:', result);
        
        if (result.sent > 0) {
            showToast(`✅ Notification sent to ${result.sent} subscribers!`, 'success');
        } else if (result.total === 0) {
            showToast('ℹ️ No subscribers to notify', 'info');
        } else {
            showToast(`⚠️ Sent: ${result.sent}, Failed: ${result.failed}`, 'info');
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Error sending push notification:', error);
        showToast('❌ Failed to send notifications', 'error');
        return null;
    }
}


/**
 * Send notification when a new devotion is published
 */
async function notifyNewDevotion(devotion) {
    // Extract a preview of the content (first 100 characters, strip HTML)
    const contentPreview = devotion.content 
        ? devotion.content.replace(/<[^>]*>/g, '').substring(0, 100) + '...' 
        : '';
    
    const title = '📖 New Devotion Available';
    const body = `"${devotion.title}" - ${devotion.verse}`;
    
    const data = {
        url: '/index.html?tab=devotion',
        type: 'devotion',
        id: devotion.id || 'new',
        icon: '/icons/icon-192x192.png',
        tag: 'devotion-' + (devotion.id || Date.now()),
        contentPreview: contentPreview
    };
    
    return await sendPushNotification(title, body, data);
}

/**
 * Send notification when a new event is published
 */
async function notifyNewEvent(event) {
    const eventDate = event.startDate 
        ? new Date(event.startDate).toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          }) 
        : 'Coming soon';
    
    const title = `📅 ${event.title}`;
    const body = `${event.category} • ${eventDate} • ${event.location || 'RGCI'}`;
    
    const data = {
        url: '/events.html',
        type: 'event',
        id: event.id || 'new',
        icon: event.image || '/icons/icon-192x192.png',
        tag: 'event-' + (event.id || Date.now())
    };
    
    return await sendPushNotification(title, body, data);
}


/**
 * Send notification when an event is approaching (1 day before)
 */
async function notifyEventReminder(event) {
    const eventDate = event.startDate 
        ? new Date(event.startDate).toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric' 
          }) 
        : 'tomorrow';
    
    const title = '⏰ Event Reminder';
    const body = `"${event.title}" is ${eventDate}! Don't miss it.`;
    
    const data = {
        url: '/events.html',
        type: 'event_reminder',
        id: event.id || 'new',
        icon: event.image || '/icons/icon-192x192.png',
        tag: 'reminder-' + (event.id || Date.now())
    };
    
    return await sendPushNotification(title, body, data);
}

/* Send notification when a prayer request is updated
 */
async function notifyPrayerRequestUpdate(request, status) {
    const statusMessages = {
        'pending': 'is pending review',
        'responded': 'has been responded to',
        'scheduled': 'has been scheduled',
        'completed': 'has been completed'
    };
    
    const statusEmojis = {
        'pending': '⏳',
        'responded': '💬',
        'scheduled': '📅',
        'completed': '✅'
    };
    
    const title = `🙏 Prayer Request ${statusEmojis[status] || '📌'}`;
    const body = `Your prayer request "${request.request?.substring(0, 30)}..." ${statusMessages[status] || 'has been updated'}`;
    
    const data = {
        url: '/index.html',
        type: 'prayer_update',
        id: request.id || '',
        icon: '/icons/icon-192x192.png',
        tag: 'prayer-' + (request.id || Date.now())
    };
    
    return await sendPushNotification(title, body, data);
}

/**
 * Send notification when a counselling request is updated
 */
async function notifyCounsellingUpdate(request, status) {
    const title = '💬 Counselling Update';
    const body = `Your counselling request has been ${status}. A pastor will reach out soon.`;
    
    const data = {
        url: '/index.html',
        type: 'counselling_update',
        id: request.id || '',
        icon: '/icons/icon-192x192.png',
        tag: 'counselling-' + (request.id || Date.now())
    };
    
    return await sendPushNotification(title, body, data);
}

/**
 * Send notification when a visit request is updated
 */
async function notifyVisitUpdate(request, status) {
    const title = '🏠 Visit Request Update';
    const body = `Your visit request has been ${status}. The team will contact you.`;
    
    const data = {
        url: '/index.html',
        type: 'visit_update',
        id: request.id || '',
        icon: '/icons/icon-192x192.png',
        tag: 'visit-' + (request.id || Date.now())
    };
    
    return await sendPushNotification(title, body, data);
}

// ============================================
// CHECK FOR EVENTS TOMORROW (For scheduled reminders)
// ============================================

function checkUpcomingEvents() {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const tomorrowEvents = allEvents.filter(e => 
        e.startDate === tomorrowStr && 
        e.status === 'published' &&
        e.eventStatus === 'upcoming'
    );
    
    tomorrowEvents.forEach(event => {
        // Check if reminder was already sent
        const reminderKey = `event_reminder_${event.id}`;
        if (!localStorage.getItem(reminderKey)) {
            notifyEventReminder(event);
            localStorage.setItem(reminderKey, 'sent');
            console.log(`📅 Reminder sent for event: ${event.title}`);
        }
    });
}

// ============================================
// INITIALIZE
// ============================================

export async function initAdminContentPage() {
    try {
        const userData = await protectPage('admin-content');
        
        if (!userData) {
            return;
        }
        
        currentUserData = userData;
        
        updateUserDisplay(userData);
        initQuillEditors();
        setDefaultDates();
        await Promise.all([loadDevotions(), loadEvents()]);
        
        // Check for upcoming events (for reminders)
        setTimeout(checkUpcomingEvents, 3000);
        
        setupEventListeners();
        setupTabs();
        setupLogoutListener();
        
        loadingState.classList.add('hidden');
        contentArea.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error initializing admin content page:', error);
        showToast('Error loading content page', 'error');
    }
}

// Initialize Quill editors
function initQuillEditors() {
    if (document.getElementById('devotionEditor')) {
        devotionQuill = new Quill('#devotionEditor', {
            theme: 'snow',
            placeholder: 'Write your devotional message...',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    ['blockquote', 'code-block'],
                    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                    [{ 'script': 'sub'}, { 'script': 'super' }],
                    [{ 'indent': '-1'}, { 'indent': '+1' }],
                    [{ 'align': [] }],
                    ['link', 'image', 'video'],
                    ['clean']
                ]
            }
        });
        
        devotionQuill.on('text-change', function() {
            const content = devotionQuill.root.innerHTML;
            document.getElementById('devotionContent').value = content;
        });
    }
}

// Setup logout listener
function setupLogoutListener() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await logoutUser();
        });
    }
}

// Set today's date as default
function setDefaultDates() {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date();
    const datetimeLocal = now.toISOString().slice(0, 16);
    
    const devotionDate = document.getElementById('devotionDate');
    const eventStartDate = document.getElementById('eventStartDate');
    const devotionScheduleDate = document.getElementById('devotionScheduleDate');
    const eventScheduleDate = document.getElementById('eventScheduleDate');
    
    if (devotionDate && !devotionDate.value) {
        devotionDate.value = today;
    }
    if (eventStartDate && !eventStartDate.value) {
        eventStartDate.value = today;
    }
    if (devotionScheduleDate && !devotionScheduleDate.value) {
        devotionScheduleDate.value = datetimeLocal;
    }
    if (eventScheduleDate && !eventScheduleDate.value) {
        eventScheduleDate.value = datetimeLocal;
    }
}

// Toggle devotion form
window.toggleDevotionForm = function() {
    const container = document.getElementById('devotionFormContainer');
    const toggle = document.getElementById('devotionFormToggle');
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        toggle.className = 'fas fa-chevron-up';
    } else {
        container.classList.add('hidden');
        toggle.className = 'fas fa-chevron-down';
    }
};

// Toggle event form
window.toggleEventForm = function() {
    const container = document.getElementById('eventFormContainer');
    const toggle = document.getElementById('eventFormToggle');
    if (container.classList.contains('hidden')) {
        container.classList.remove('hidden');
        toggle.className = 'fas fa-chevron-up';
    } else {
        container.classList.add('hidden');
        toggle.className = 'fas fa-chevron-down';
    }
};

// Handle image upload for devotions
window.handleDevotionImageUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('devotionImagePreview');
        preview.innerHTML = `
            <div class="flex items-center gap-3 p-2 bg-green-50 rounded-lg border border-green-200">
                <img src="${e.target.result}" alt="Preview" class="image-preview">
                <div>
                    <p class="text-sm font-medium text-gray-700">${file.name}</p>
                    <p class="text-xs text-gray-500">${(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button type="button" onclick="removeDevotionImage()" class="text-red-500 hover:text-red-700 ml-auto">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        document.getElementById('devotionUploadArea').classList.add('hidden');
    };
    reader.readAsDataURL(file);
    
    uploadToCloudinary(file, 'devotionImage', 'devotionImagePreview');
};

// Handle image upload for events
window.handleEventImageUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const preview = document.getElementById('eventImagePreview');
        preview.innerHTML = `
            <div class="flex items-center gap-3 p-2 bg-green-50 rounded-lg border border-green-200">
                <img src="${e.target.result}" alt="Preview" class="image-preview">
                <div>
                    <p class="text-sm font-medium text-gray-700">${file.name}</p>
                    <p class="text-xs text-gray-500">${(file.size / 1024).toFixed(1)} KB</p>
                </div>
                <button type="button" onclick="removeEventImage()" class="text-red-500 hover:text-red-700 ml-auto">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        document.getElementById('eventUploadArea').classList.add('hidden');
    };
    reader.readAsDataURL(file);
    
    uploadToCloudinary(file, 'eventImage', 'eventImagePreview');
};

// Upload to Cloudinary
function uploadToCloudinary(file, targetField, targetPreview) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    formData.append('folder', CLOUDINARY_CONFIG.folder);
    
    const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
    
    fetch(cloudinaryUrl, {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.secure_url) {
            document.getElementById(targetField).value = data.secure_url;
            showToast('Image uploaded successfully!', 'success');
        } else {
            showToast('Error uploading image', 'error');
        }
    })
    .catch(error => {
        console.error('Upload error:', error);
        showToast('Error uploading image', 'error');
    });
}

// Remove devotion image
window.removeDevotionImage = function() {
    document.getElementById('devotionImagePreview').innerHTML = '';
    document.getElementById('devotionImage').value = '';
    document.getElementById('devotionUploadArea').classList.remove('hidden');
    document.getElementById('devotionImageInput').value = '';
};

// Remove event image
window.removeEventImage = function() {
    document.getElementById('eventImagePreview').innerHTML = '';
    document.getElementById('eventImage').value = '';
    document.getElementById('eventUploadArea').classList.remove('hidden');
    document.getElementById('eventImageInput').value = '';
};

// Handle status change for devotions
function handleDevotionStatusChange() {
    const status = document.getElementById('devotionStatus').value;
    const scheduleContainer = document.getElementById('devotionScheduleDateContainer');
    const displayDateContainer = document.getElementById('devotionDisplayDateContainer');
    
    if (status === 'scheduled') {
        scheduleContainer.classList.remove('hidden');
        displayDateContainer.classList.add('hidden');
    } else {
        scheduleContainer.classList.add('hidden');
        displayDateContainer.classList.remove('hidden');
    }
}

// Handle status change for events
function handleEventStatusChange() {
    const status = document.getElementById('eventStatusSelect').value;
    const scheduleContainer = document.getElementById('eventScheduleDateContainer');
    
    if (status === 'scheduled') {
        scheduleContainer.classList.remove('hidden');
    } else {
        scheduleContainer.classList.add('hidden');
    }
}

// ============================================
// DEVOTION FUNCTIONS
// ============================================

// Load devotions
async function loadDevotions() {
    try {
        const q = query(collection(db, "devotions"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        allDevotions = [];
        snapshot.forEach(doc => {
            allDevotions.push({ id: doc.id, ...doc.data() });
        });
        renderDevotions();
        updateDevotionStats();
    } catch (error) {
        console.error('Error loading devotions:', error);
        showToast('Error loading devotions', 'error');
    }
}

// Render devotions
function renderDevotions() {
    const container = document.getElementById('devotionsList');
    const filter = document.getElementById('devotionFilter').value;
    
    let filtered = [...allDevotions];
    if (filter !== 'all') {
        filtered = filtered.filter(d => d.status === filter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <i class="fas fa-book-bible text-4xl block mx-auto mb-2 opacity-30"></i>
                No devotions found.
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(devotion => {
        const statusClass = devotion.status === 'published' ? 'status-active' : 
                           devotion.status === 'scheduled' ? 'status-scheduled' : 'status-draft';
        const borderColor = devotion.status === 'published' ? 'border-green-500' : 
                           devotion.status === 'scheduled' ? 'border-blue-500' : 'border-yellow-500';
        
        let scheduleInfo = '';
        if (devotion.status === 'scheduled' && devotion.scheduleDate) {
            scheduleInfo = `<p class="schedule-info"><i class="far fa-clock mr-1"></i> Scheduled for: ${new Date(devotion.scheduleDate).toLocaleString()}</p>`;
        }
        
        return `
            <div class="devotion-card bg-gray-50 rounded-lg p-4 border-l-4 ${borderColor}">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 flex-wrap">
                            <h4 class="font-semibold text-gray-800">${escapeHtml(devotion.title)}</h4>
                            <span class="status-badge ${statusClass}">
                                ${devotion.status}
                            </span>
                        </div>
                        <p class="text-sm text-gray-500 mt-1">${escapeHtml(devotion.verse)}</p>
                        <div class="text-sm text-gray-600 mt-2 line-clamp-2">${devotion.content ? devotion.content.substring(0, 150) + (devotion.content.length > 150 ? '...' : '') : ''}</div>
                        ${devotion.image ? `<img src="${devotion.image}" alt="${devotion.title}" class="w-32 h-20 object-cover rounded-lg mt-2">` : ''}
                        <p class="text-xs text-gray-400 mt-2"><i class="far fa-calendar-alt mr-1"></i> ${formatDateString(devotion.date)}</p>
                        ${scheduleInfo}
                    </div>
                    <div class="flex gap-2 ml-4">
                        <button onclick="editDevotion('${devotion.id}')" class="text-blue-600 hover:text-blue-800 transition" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteDevotion('${devotion.id}')" class="text-red-500 hover:text-red-700 transition" title="Delete">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        ${devotion.status === 'published' ? `<button onclick="resendDevotionNotification('${devotion.id}')" class="text-green-600 hover:text-green-800 transition" title="Resend Notification">
                            <i class="fas fa-bell"></i>
                        </button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Update devotion stats
function updateDevotionStats() {
    document.getElementById('totalDevotions').textContent = allDevotions.length;
    document.getElementById('publishedDevotions').textContent = allDevotions.filter(d => d.status === 'published').length;
    document.getElementById('scheduledDevotions').textContent = allDevotions.filter(d => d.status === 'scheduled').length;
    document.getElementById('draftDevotions').textContent = allDevotions.filter(d => d.status === 'draft').length;
}

// Save devotion
async function saveDevotion(e) {
    e.preventDefault();
    
    const title = document.getElementById('devotionTitle').value.trim();
    const verse = document.getElementById('devotionVerse').value.trim();
    const content = devotionQuill ? devotionQuill.root.innerHTML : document.getElementById('devotionContent').value;
    const prayer = document.getElementById('devotionPrayer').value.trim();
    const image = document.getElementById('devotionImage').value.trim();
    const date = document.getElementById('devotionDate').value;
    const status = document.getElementById('devotionStatus').value;
    const scheduleDate = document.getElementById('devotionScheduleDate').value;
    
    if (!title || !verse || !content || content === '<p><br></p>') {
        showToast('Please fill in all required fields (Title, Verse, and Content)', 'error');
        return;
    }
    
    const btn = document.getElementById('saveDevotionBtn');
    const btnText = document.getElementById('devotionBtnText');
    const spinner = document.getElementById('devotionBtnSpinner');
    
    btnText.textContent = 'Saving...';
    spinner.classList.remove('hidden');
    btn.disabled = true;
    btn.classList.add('btn-loading');
    
    try {
        const data = { 
            title, 
            verse, 
            content, 
            prayer, 
            image, 
            date,
            status,
            updatedAt: Timestamp.now() 
        };
        
        if (status === 'scheduled' && scheduleDate) {
            data.scheduleDate = scheduleDate;
            data.publishAt = Timestamp.fromDate(new Date(scheduleDate));
        } else {
            data.scheduleDate = null;
            data.publishAt = null;
        }
        
        let isNew = false;
        if (editingDevotionId) {
            await updateDoc(doc(db, "devotions", editingDevotionId), data);
            showToast('Devotion updated successfully!', 'success');
            editingDevotionId = null;
        } else {
            data.createdAt = Timestamp.now();
            await addDoc(collection(db, "devotions"), data);
            showToast('Devotion created successfully!', 'success');
            isNew = true;
        }
        
        // Send notification if published
        if (status === 'published') {
            const savedDevotion = { title, verse, content, prayer, image, date, id: editingDevotionId || 'new' };
            await notifyNewDevotion(savedDevotion);
        }
        
        document.getElementById('devotionForm').reset();
        if (devotionQuill) {
            devotionQuill.root.innerHTML = '';
        }
        setDefaultDates();
        removeDevotionImage();
        await loadDevotions();
        
    } catch (error) {
        console.error('Error saving devotion:', error);
        showToast('Error saving devotion', 'error');
    }
    
    btnText.textContent = editingDevotionId ? 'Update Devotion' : 'Save Devotion';
    spinner.classList.add('hidden');
    btn.disabled = false;
    btn.classList.remove('btn-loading');
}

// Resend devotion notification
window.resendDevotionNotification = async function(id) {
    const devotion = allDevotions.find(d => d.id === id);
    if (!devotion) {
        showToast('Devotion not found', 'error');
        return;
    }
    
    showToast('Sending notification...', 'info');
    await notifyNewDevotion(devotion);
};

// Edit devotion
window.editDevotion = async function(id) {
    const devotion = allDevotions.find(d => d.id === id);
    if (!devotion) return;
    
    editingDevotionId = id;
    document.getElementById('devotionTitle').value = devotion.title;
    document.getElementById('devotionVerse').value = devotion.verse;
    document.getElementById('devotionDate').value = devotion.date;
    document.getElementById('devotionPrayer').value = devotion.prayer || '';
    document.getElementById('devotionStatus').value = devotion.status || 'draft';
    document.getElementById('devotionBtnText').textContent = 'Update Devotion';
    
    if (devotionQuill) {
        devotionQuill.root.innerHTML = devotion.content || '';
    }
    document.getElementById('devotionContent').value = devotion.content || '';
    
    if (devotion.image) {
        document.getElementById('devotionImage').value = devotion.image;
        const preview = document.getElementById('devotionImagePreview');
        preview.innerHTML = `
            <div class="flex items-center gap-3 p-2 bg-green-50 rounded-lg border border-green-200">
                <img src="${devotion.image}" alt="Preview" class="image-preview">
                <button type="button" onclick="removeDevotionImage()" class="text-red-500 hover:text-red-700 ml-auto">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        document.getElementById('devotionUploadArea').classList.add('hidden');
    }
    
    if (devotion.status === 'scheduled' && devotion.scheduleDate) {
        document.getElementById('devotionScheduleDate').value = devotion.scheduleDate.slice(0, 16);
        document.getElementById('devotionScheduleDateContainer').classList.remove('hidden');
        document.getElementById('devotionDisplayDateContainer').classList.add('hidden');
    } else {
        document.getElementById('devotionScheduleDateContainer').classList.add('hidden');
        document.getElementById('devotionDisplayDateContainer').classList.remove('hidden');
    }
    
    document.getElementById('devotionFormContainer').classList.remove('hidden');
    document.getElementById('devotionFormToggle').className = 'fas fa-chevron-up';
    document.getElementById('devotionForm').scrollIntoView({ behavior: 'smooth' });
    
    showToast('Editing: ' + devotion.title, 'info');
};

// Delete devotion
window.deleteDevotion = async function(id) {
    if (!confirm('Are you sure you want to delete this devotion?')) return;
    
    try {
        await deleteDoc(doc(db, "devotions", id));
        showToast('Devotion deleted successfully', 'success');
        await loadDevotions();
    } catch (error) {
        console.error('Error deleting devotion:', error);
        showToast('Error deleting devotion', 'error');
    }
};

// ============================================
// EVENT FUNCTIONS
// ============================================

// Load events
async function loadEvents() {
    try {
        const q = query(collection(db, "events"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        allEvents = [];
        snapshot.forEach(doc => {
            allEvents.push({ id: doc.id, ...doc.data() });
        });
        renderEvents();
        updateEventStats();
    } catch (error) {
        console.error('Error loading events:', error);
        showToast('Error loading events', 'error');
    }
}

// Render events
function renderEvents() {
    const container = document.getElementById('eventsList');
    const filter = document.getElementById('eventFilter').value;
    
    let filtered = [...allEvents];
    if (filter !== 'all') {
        filtered = filtered.filter(e => e.status === filter);
    }
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <i class="fas fa-calendar-alt text-4xl block mx-auto mb-2 opacity-30"></i>
                No events found.
            </div>
        `;
        return;
    }
    
    const categoryColors = {
        worship: 'bg-blue-100 text-blue-700',
        conference: 'bg-purple-100 text-purple-700',
        youth: 'bg-pink-100 text-pink-700',
        campus: 'bg-green-100 text-green-700',
        teaching: 'bg-yellow-100 text-yellow-700'
    };
    
    container.innerHTML = filtered.map(event => {
        const statusClass = event.status === 'published' ? 'status-active' : 
                           event.status === 'scheduled' ? 'status-scheduled' : 'status-draft';
        
        let scheduleInfo = '';
        if (event.status === 'scheduled' && event.scheduleDate) {
            scheduleInfo = `<p class="schedule-info"><i class="far fa-clock mr-1"></i> Scheduled for: ${new Date(event.scheduleDate).toLocaleString()}</p>`;
        }
        
        return `
            <div class="event-card-admin bg-white rounded-lg p-4 border ${event.featured ? 'border-yellow-400 bg-yellow-50/30' : 'border-gray-200'}">
                <div class="flex justify-between items-start">
                    <div class="flex-1">
                        <div class="flex items-center gap-3 flex-wrap">
                            <h4 class="font-semibold text-gray-800">${escapeHtml(event.title)}</h4>
                            <span class="status-badge ${statusClass}">
                                ${event.status}
                            </span>
                            ${event.featured ? '<span class="status-badge status-active"><i class="fas fa-star mr-1"></i>Featured</span>' : ''}
                            <span class="text-xs px-2 py-1 rounded-full ${categoryColors[event.category] || 'bg-gray-100 text-gray-700'}">
                                ${event.category}
                            </span>
                        </div>
                        <div class="flex flex-wrap gap-4 mt-2 text-sm text-gray-500">
                            <span><i class="far fa-calendar-alt mr-1"></i> ${formatDateString(event.startDate)}${event.endDate ? ' - ' + formatDateString(event.endDate) : ''}</span>
                            ${event.time ? `<span><i class="far fa-clock mr-1"></i> ${escapeHtml(event.time)}</span>` : ''}
                            ${event.location ? `<span><i class="fas fa-map-pin mr-1"></i> ${escapeHtml(event.location)}</span>` : ''}
                        </div>
                        ${event.description ? `<p class="text-sm text-gray-600 mt-2 line-clamp-2">${escapeHtml(event.description.substring(0, 120))}${event.description.length > 120 ? '...' : ''}</p>` : ''}
                        ${event.image ? `<img src="${event.image}" alt="${event.title}" class="w-32 h-20 object-cover rounded-lg mt-2">` : ''}
                        ${scheduleInfo}
                    </div>
                    <div class="flex gap-2 ml-4">
                        <button onclick="editEvent('${event.id}')" class="text-blue-600 hover:text-blue-800 transition" title="Edit">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button onclick="deleteEvent('${event.id}')" class="text-red-500 hover:text-red-700 transition" title="Delete">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        ${event.status === 'published' ? `<button onclick="resendEventNotification('${event.id}')" class="text-green-600 hover:text-green-800 transition" title="Resend Notification">
                            <i class="fas fa-bell"></i>
                        </button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Update event stats
function updateEventStats() {
    document.getElementById('totalEvents').textContent = allEvents.length;
    document.getElementById('publishedEvents').textContent = allEvents.filter(e => e.status === 'published').length;
    document.getElementById('scheduledEvents').textContent = allEvents.filter(e => e.status === 'scheduled').length;
    document.getElementById('featuredEvents').textContent = allEvents.filter(e => e.featured).length;
}

// Save event
async function saveEvent(e) {
    e.preventDefault();
    
    const title = document.getElementById('eventTitle').value.trim();
    const category = document.getElementById('eventCategory').value;
    const startDate = document.getElementById('eventStartDate').value;
    const endDate = document.getElementById('eventEndDate').value;
    const time = document.getElementById('eventTime').value.trim();
    const location = document.getElementById('eventLocation').value.trim();
    const description = document.getElementById('eventDescription').value.trim();
    const image = document.getElementById('eventImage').value.trim();
    const featured = document.getElementById('eventFeatured').checked;
    const eventStatus = document.getElementById('eventStatus').value;
    const status = document.getElementById('eventStatusSelect').value;
    const scheduleDate = document.getElementById('eventScheduleDate').value;
    
    if (!title || !category || !startDate) {
        showToast('Please fill in all required fields', 'error');
        return;
    }
    
    const btn = document.getElementById('saveEventBtn');
    const btnText = document.getElementById('eventBtnText');
    const spinner = document.getElementById('eventBtnSpinner');
    
    btnText.textContent = 'Saving...';
    spinner.classList.remove('hidden');
    btn.disabled = true;
    btn.classList.add('btn-loading');
    
    try {
        const data = { 
            title, 
            category, 
            startDate, 
            endDate, 
            time, 
            location, 
            description, 
            image, 
            featured, 
            eventStatus,
            status,
            updatedAt: Timestamp.now() 
        };
        
        if (status === 'scheduled' && scheduleDate) {
            data.scheduleDate = scheduleDate;
            data.publishAt = Timestamp.fromDate(new Date(scheduleDate));
        } else {
            data.scheduleDate = null;
            data.publishAt = null;
        }
        
        let isNew = false;
        if (editingEventId) {
            await updateDoc(doc(db, "events", editingEventId), data);
            showToast('Event updated successfully!', 'success');
            editingEventId = null;
        } else {
            data.createdAt = Timestamp.now();
            await addDoc(collection(db, "events"), data);
            showToast('Event created successfully!', 'success');
            isNew = true;
        }
        
        // Send notification if published
        if (status === 'published') {
            const savedEvent = { title, category, startDate, endDate, time, location, description, image, featured, id: editingEventId || 'new' };
            await notifyNewEvent(savedEvent);
        }
        
        document.getElementById('eventForm').reset();
        setDefaultDates();
        removeEventImage();
        await loadEvents();
        
    } catch (error) {
        console.error('Error saving event:', error);
        showToast('Error saving event', 'error');
    }
    
    btnText.textContent = editingEventId ? 'Update Event' : 'Save Event';
    spinner.classList.add('hidden');
    btn.disabled = false;
    btn.classList.remove('btn-loading');
}

// Resend event notification
window.resendEventNotification = async function(id) {
    const event = allEvents.find(e => e.id === id);
    if (!event) {
        showToast('Event not found', 'error');
        return;
    }
    
    showToast('Sending notification...', 'info');
    await notifyNewEvent(event);
};

// Edit event
window.editEvent = async function(id) {
    const event = allEvents.find(e => e.id === id);
    if (!event) return;
    
    editingEventId = id;
    document.getElementById('eventTitle').value = event.title;
    document.getElementById('eventCategory').value = event.category || 'worship';
    document.getElementById('eventStartDate').value = event.startDate;
    document.getElementById('eventEndDate').value = event.endDate || '';
    document.getElementById('eventTime').value = event.time || '';
    document.getElementById('eventLocation').value = event.location || '';
    document.getElementById('eventDescription').value = event.description || '';
    document.getElementById('eventFeatured').checked = event.featured || false;
    document.getElementById('eventStatus').value = event.eventStatus || 'upcoming';
    document.getElementById('eventStatusSelect').value = event.status || 'draft';
    document.getElementById('eventBtnText').textContent = 'Update Event';
    
    if (event.image) {
        document.getElementById('eventImage').value = event.image;
        const preview = document.getElementById('eventImagePreview');
        preview.innerHTML = `
            <div class="flex items-center gap-3 p-2 bg-green-50 rounded-lg border border-green-200">
                <img src="${event.image}" alt="Preview" class="image-preview">
                <button type="button" onclick="removeEventImage()" class="text-red-500 hover:text-red-700 ml-auto">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        document.getElementById('eventUploadArea').classList.add('hidden');
    }
    
    if (event.status === 'scheduled' && event.scheduleDate) {
        document.getElementById('eventScheduleDate').value = event.scheduleDate.slice(0, 16);
        document.getElementById('eventScheduleDateContainer').classList.remove('hidden');
    } else {
        document.getElementById('eventScheduleDateContainer').classList.add('hidden');
    }
    
    document.getElementById('eventFormContainer').classList.remove('hidden');
    document.getElementById('eventFormToggle').className = 'fas fa-chevron-up';
    document.getElementById('eventForm').scrollIntoView({ behavior: 'smooth' });
    
    showToast('Editing: ' + event.title, 'info');
};

// Delete event
window.deleteEvent = async function(id) {
    if (!confirm('Are you sure you want to delete this event?')) return;
    
    try {
        await deleteDoc(doc(db, "events", id));
        showToast('Event deleted successfully', 'success');
        await loadEvents();
    } catch (error) {
        console.error('Error deleting event:', error);
        showToast('Error deleting event', 'error');
    }
};

// ============================================
// TAB SWITCHING
// ============================================

function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

function formatDateString(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ============================================
// SETUP EVENT LISTENERS
// ============================================

function setupEventListeners() {
    document.getElementById('devotionForm').addEventListener('submit', saveDevotion);
    document.getElementById('eventForm').addEventListener('submit', saveEvent);
    document.getElementById('devotionStatus').addEventListener('change', handleDevotionStatusChange);
    document.getElementById('eventStatusSelect').addEventListener('change', handleEventStatusChange);
    document.getElementById('devotionFilter').addEventListener('change', renderDevotions);
    document.getElementById('eventFilter').addEventListener('change', renderEvents);
    document.getElementById('refreshDevotions').addEventListener('click', loadDevotions);
    document.getElementById('refreshEvents').addEventListener('click', loadEvents);
}

// Initialize
document.addEventListener('DOMContentLoaded', initAdminContentPage);

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

// Make functions available globally
window.handleDevotionImageUpload = handleDevotionImageUpload;
window.handleEventImageUpload = handleEventImageUpload;
window.removeDevotionImage = removeDevotionImage;
window.removeEventImage = removeEventImage;
window.editDevotion = editDevotion;
window.editEvent = editEvent;
window.deleteDevotion = deleteDevotion;
window.deleteEvent = deleteEvent;
window.toggleDevotionForm = toggleDevotionForm;
window.toggleEventForm = toggleEventForm;
window.handleDevotionStatusChange = handleDevotionStatusChange;
window.handleEventStatusChange = handleEventStatusChange;
window.resendDevotionNotification = resendDevotionNotification;
window.resendEventNotification = resendEventNotification;