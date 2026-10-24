import { db, collection, addDoc, getDocs, query, orderBy, where, Timestamp, doc, updateDoc, deleteDoc } from './firebase-config.js';
import { 
    showToast, 
    protectPage, 
    updateUserDisplay,
    getCurrentUserRole,
    logoutUser
} from './auth.js';

// State variables
let allMembers = [];
let allPrayers = [];
let allVisitations = [];
let allCounseling = [];
let allFollowups = [];
let allHospital = [];
let allTestimonies = [];
let allIncomingRequests = [];
let currentUserData = null;

// DOM Elements
const loadingState = document.getElementById('loadingState');
const pastoralContent = document.getElementById('pastoralContent');

// Initialize
export async function initPastoralPage() {
    try {
        // Protect page - requires authentication
        const userData = await protectPage('pastoral');
        
        if (!userData) {
            return;
        }
        
        currentUserData = userData;
        
        // Update user display
        updateUserDisplay(userData);
        
        // Load data
        await loadMembers();
        await loadPrayerRequests();
        await loadVisitations();
        await loadCounseling();
        await loadFollowups();
        await loadHospitalVisits();
        await loadTestimonies();
        await loadIncomingRequests();
        
        setupEventListeners();
        updateStats();
        
        // Setup logout listener
        setupLogoutListener();
        
        loadingState.classList.add('hidden');
        pastoralContent.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error initializing pastoral page:', error);
        showToast('Error loading pastoral page', 'error');
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

// Load members
async function loadMembers() {
    try {
        const snapshot = await getDocs(collection(db, "members"));
        allMembers = [];
        snapshot.forEach(doc => {
            allMembers.push({ id: doc.id, ...doc.data() });
        });
        
        const memberSelects = ['prayerMember', 'visitationMember', 'counselingMember', 'testimonyMember', 'followupMemberSelect'];
        memberSelects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '<option value="">Select Member</option>' + 
                    allMembers.map(m => `<option value="${m.id}">${escapeHtml(m.fullName)}</option>`).join('');
            }
        });
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

// Load incoming requests from member portal
async function loadIncomingRequests() {
    try {
        // Try to get requests with ordering first
        try {
            const q = query(collection(db, "pastoral_requests"), orderBy("createdAt", "desc"));
            const snapshot = await getDocs(q);
            allIncomingRequests = [];
            snapshot.forEach(doc => {
                allIncomingRequests.push({ id: doc.id, ...doc.data() });
            });
        } catch (orderError) {
            // If ordering fails (missing index), get without order
            console.warn('Ordering failed, fetching without order:', orderError);
            const snapshot = await getDocs(collection(db, "pastoral_requests"));
            allIncomingRequests = [];
            snapshot.forEach(doc => {
                allIncomingRequests.push({ id: doc.id, ...doc.data() });
            });
            // Sort manually by createdAt
            allIncomingRequests.sort((a, b) => {
                const dateA = a.createdAt?.toDate?.() || new Date(0);
                const dateB = b.createdAt?.toDate?.() || new Date(0);
                return dateB - dateA;
            });
        }
        
        updateIncomingStats();
        renderIncomingRequests();
        updateTabBadge();
    } catch (error) {
        console.error('Error loading incoming requests:', error);
        // Show error in the list
        const container = document.getElementById('incomingRequestsList');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-8 text-red-500">
                    <i class="fas fa-exclamation-circle text-2xl mb-2 block"></i>
                    Error loading requests. Please refresh.
                    <br>
                    <button onclick="location.reload()" class="mt-2 bg-[#6a1b9a] text-white px-4 py-2 rounded-lg text-sm">
                        <i class="fas fa-sync-alt mr-2"></i> Retry
                    </button>
                </div>
            `;
        }
    }
}

// Update incoming request statistics
function updateIncomingStats() {
    const pendingPrayers = allIncomingRequests.filter(r => r.type === 'prayer_request' && r.status === 'pending').length;
    const pendingCounseling = allIncomingRequests.filter(r => r.type === 'counselling_request' && r.status === 'pending').length;
    const pendingVisits = allIncomingRequests.filter(r => r.type === 'visit_request' && r.status === 'pending').length;
    const totalPending = pendingPrayers + pendingCounseling + pendingVisits;
    
    const prayerCountEl = document.getElementById('pendingPrayerCount');
    const counselingCountEl = document.getElementById('pendingCounselingCount');
    const visitCountEl = document.getElementById('pendingVisitCount');
    const totalCountEl = document.getElementById('totalPendingCount');
    
    if (prayerCountEl) prayerCountEl.textContent = pendingPrayers;
    if (counselingCountEl) counselingCountEl.textContent = pendingCounseling;
    if (visitCountEl) visitCountEl.textContent = pendingVisits;
    if (totalCountEl) totalCountEl.textContent = totalPending;
}

// Render incoming requests
function renderIncomingRequests() {
    const container = document.getElementById('incomingRequestsList');
    if (!container) return;
    
    const filter = document.getElementById('incomingFilter')?.value || 'all';
    
    let filtered = [...allIncomingRequests];
    if (filter !== 'all') {
        filtered = filtered.filter(r => r.type === filter);
    }
    
    // Show pending first, then completed/responded
    filtered.sort((a, b) => {
        if (a.status === 'pending' && b.status !== 'pending') return -1;
        if (a.status !== 'pending' && b.status === 'pending') return 1;
        return 0;
    });
    
    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <i class="fas fa-inbox text-4xl block mx-auto mb-2 opacity-30"></i>
                No requests from members yet
            </div>
        `;
        return;
    }
    
    container.innerHTML = filtered.map(req => {
        const requestTypeLabels = {
            prayer_request: { icon: 'fa-pray', color: 'blue', label: 'Prayer Request' },
            counselling_request: { icon: 'fa-comments', color: 'purple', label: 'Counselling Request' },
            visit_request: { icon: 'fa-door-open', color: 'green', label: 'Visit Request' },
            urgent_request: { icon: 'fa-exclamation-triangle', color: 'red', label: 'Urgent Request' }
        };
        const typeInfo = requestTypeLabels[req.type] || { icon: 'fa-inbox', color: 'gray', label: req.type };
        
        const isPending = req.status === 'pending' || req.status === 'urgent';
        const isUrgent = req.type === 'urgent_request';
        
        const statusText = req.status === 'urgent' ? 'Urgent' : 
                          req.status === 'pending' ? 'Pending' : 
                          req.status === 'responded' ? 'Responded' : 
                          req.status === 'scheduled' ? 'Scheduled' : req.status;
        
        const statusClass = req.status === 'urgent' ? 'badge-urgent' :
                           req.status === 'pending' ? 'badge-pending' :
                           req.status === 'responded' ? 'badge-responded' :
                           req.status === 'scheduled' ? 'badge-scheduled' : 'badge-pending';
        
        const description = req.request || req.message || req.reason || 'No details provided';
        
        return `
            <div class="request-card p-4 rounded-lg border-l-4 border-${typeInfo.color}-500 ${isPending ? 'bg-white shadow-sm' : 'bg-gray-50'}">
                <div class="flex justify-between items-start flex-wrap gap-2">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 bg-${typeInfo.color}-100 rounded-lg flex items-center justify-center">
                            <i class="fas ${typeInfo.icon} text-${typeInfo.color}-600 text-sm"></i>
                        </div>
                        <div>
                            <p class="font-medium text-gray-800">${escapeHtml(req.fullName || 'Unknown')}</p>
                            <p class="text-xs text-gray-400">${typeInfo.label} • ${formatDate(req.createdAt)}</p>
                            ${isUrgent ? '<span class="text-xs text-red-600 font-bold ml-2"><i class="fas fa-exclamation-circle"></i> URGENT</span>' : ''}
                        </div>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="badge ${statusClass}">${statusText}</span>
                        ${isPending ? `
                            <button onclick="window.markRequestResponded('${req.id}')" class="bg-green-600 text-white px-3 py-1 rounded-lg text-xs hover:bg-green-700 transition">
                                <i class="fas fa-check-circle mr-1"></i> Mark Responded
                            </button>
                        ` : ''}
                        <button onclick="window.deleteIncomingRequest('${req.id}')" class="text-red-500 text-xs hover:text-red-700 transition" title="Delete">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </div>
                </div>
                <div class="mt-2 pl-10">
                    <p class="text-sm text-gray-600">${escapeHtml(description)}</p>
                    ${req.type === 'prayer_request' && req.followup && req.followup !== 'no' ? 
                        `<p class="text-xs text-blue-500 mt-1"><i class="fas fa-phone"></i> Follow-up requested: ${escapeHtml(req.followup)}</p>` : ''}
                    ${req.type === 'prayer_request' ? 
                        `<p class="text-xs text-gray-400 mt-1"><i class="fas fa-globe"></i> Visibility: ${escapeHtml(req.visibility || 'private')}</p>` : ''}
                    ${req.type === 'counselling_request' ? `
                        <div class="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                            ${req.contactMethod ? `<span><i class="fas fa-phone"></i> Contact: ${escapeHtml(req.contactMethod)}</span>` : ''}
                            ${req.preferredDate ? `<span><i class="fas fa-calendar"></i> Preferred: ${escapeHtml(req.preferredDate)}</span>` : ''}
                        </div>
                    ` : ''}
                    ${req.type === 'visit_request' ? `
                        <div class="mt-1 text-xs text-gray-500">
                            ${req.address ? `<span><i class="fas fa-map-pin"></i> ${escapeHtml(req.address)}</span>` : ''}
                            ${req.preferredDate ? `<span class="ml-3"><i class="fas fa-calendar"></i> ${escapeHtml(req.preferredDate)}</span>` : ''}
                        </div>
                    ` : ''}
                    <div class="mt-2 flex items-center gap-3 text-xs text-gray-400">
                        <span><i class="fas fa-phone"></i> ${escapeHtml(req.phone || 'No phone')}</span>
                        ${req.email ? `<span><i class="fas fa-envelope"></i> ${escapeHtml(req.email)}</span>` : ''}
                        <span><i class="fas fa-clock"></i> ${formatTime(req.createdAt)}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Format time
function formatTime(timestamp) {
    if (!timestamp) return '—';
    if (timestamp.toDate) {
        return timestamp.toDate().toLocaleTimeString();
    }
    return new Date(timestamp).toLocaleTimeString();
}

// Update tab badge
function updateTabBadge() {
    const pendingCount = allIncomingRequests.filter(r => r.status === 'pending' || r.status === 'urgent').length;
    const badge = document.getElementById('incomingBadge');
    if (badge) {
        if (pendingCount > 0) {
            badge.textContent = pendingCount;
            badge.classList.remove('hidden');
            badge.classList.add('badge-pulse');
        } else {
            badge.classList.add('hidden');
        }
    }
    
    // Also update stats cards
    const activePrayers = allPrayers.filter(p => p.status === 'active').length + 
                         allIncomingRequests.filter(r => r.type === 'prayer_request' && r.status === 'pending').length;
    const answeredPrayers = allPrayers.filter(p => p.status === 'answered').length;
    
    document.getElementById('activePrayers').textContent = activePrayers;
    document.getElementById('answeredPrayers').textContent = answeredPrayers;
}

// Mark request as responded
window.markRequestResponded = async (id) => {
    try {
        await updateDoc(doc(db, "pastoral_requests", id), { 
            status: 'responded', 
            respondedAt: Timestamp.now(),
            respondedBy: 'admin'
        });
        showToast('Request marked as responded ✅', 'success');
        await loadIncomingRequests();
        updateStats();
    } catch (error) {
        console.error('Error updating request:', error);
        showToast('Error updating request', 'error');
    }
};

// Delete incoming request
window.deleteIncomingRequest = async (id) => {
    if (confirm('Are you sure you want to delete this request?')) {
        try {
            await deleteDoc(doc(db, "pastoral_requests", id));
            showToast('Request deleted', 'success');
            await loadIncomingRequests();
            updateStats();
        } catch (error) {
            console.error('Error deleting request:', error);
            showToast('Error deleting request', 'error');
        }
    }
};

// Load prayer requests (existing ones from admin)
async function loadPrayerRequests() {
    try {
        const q = query(collection(db, "prayer_requests"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        allPrayers = [];
        snapshot.forEach(doc => {
            allPrayers.push({ id: doc.id, ...doc.data() });
        });
        renderPrayerRequests();
    } catch (error) {
        console.error('Error loading prayers:', error);
    }
}

// Load visitations
async function loadVisitations() {
    try {
        const q = query(collection(db, "visitations"), orderBy("visitDate", "desc"));
        const snapshot = await getDocs(q);
        allVisitations = [];
        snapshot.forEach(doc => {
            allVisitations.push({ id: doc.id, ...doc.data() });
        });
        renderVisitations();
    } catch (error) {
        console.error('Error loading visitations:', error);
    }
}

// Load counseling sessions
async function loadCounseling() {
    try {
        const q = query(collection(db, "counseling"), orderBy("sessionDate", "desc"));
        const snapshot = await getDocs(q);
        allCounseling = [];
        snapshot.forEach(doc => {
            allCounseling.push({ id: doc.id, ...doc.data() });
        });
        renderCounseling();
    } catch (error) {
        console.error('Error loading counseling:', error);
    }
}

// Load follow-ups
async function loadFollowups() {
    try {
        const q = query(collection(db, "followups"), orderBy("dueDate", "asc"));
        const snapshot = await getDocs(q);
        allFollowups = [];
        snapshot.forEach(doc => {
            allFollowups.push({ id: doc.id, ...doc.data() });
        });
        renderFollowups();
    } catch (error) {
        console.error('Error loading followups:', error);
    }
}

// Load hospital visits
async function loadHospitalVisits() {
    try {
        const q = query(collection(db, "hospital_visits"), orderBy("visitDate", "desc"));
        const snapshot = await getDocs(q);
        allHospital = [];
        snapshot.forEach(doc => {
            allHospital.push({ id: doc.id, ...doc.data() });
        });
        renderHospitalVisits();
    } catch (error) {
        console.error('Error loading hospital visits:', error);
    }
}

// Load testimonies
async function loadTestimonies() {
    try {
        const q = query(collection(db, "testimonies"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        allTestimonies = [];
        snapshot.forEach(doc => {
            allTestimonies.push({ id: doc.id, ...doc.data() });
        });
        renderTestimonies();
    } catch (error) {
        console.error('Error loading testimonies:', error);
    }
}

// Update statistics
function updateStats() {
    const activePrayers = allPrayers.filter(p => p.status === 'active').length + 
                         allIncomingRequests.filter(r => r.type === 'prayer_request' && r.status === 'pending').length;
    const answeredPrayers = allPrayers.filter(p => p.status === 'answered').length;
    
    document.getElementById('activePrayers').textContent = activePrayers;
    document.getElementById('answeredPrayers').textContent = answeredPrayers;
    
    document.getElementById('visitsThisMonth').textContent = allVisitations.filter(v => {
        if (!v.visitDate) return false;
        const visitDate = typeof v.visitDate === 'string' ? new Date(v.visitDate) : v.visitDate.toDate();
        const now = new Date();
        return visitDate.getMonth() === now.getMonth() && visitDate.getFullYear() === now.getFullYear();
    }).length;
    
    document.getElementById('counselingSessions').textContent = allCounseling.length + 
        allIncomingRequests.filter(r => r.type === 'counselling_request' && r.status === 'pending').length;
    
    document.getElementById('followupsDue').textContent = allFollowups.filter(f => f.status === 'pending' && new Date(f.dueDate) < new Date()).length;
}

// Render functions with loading states
function renderPrayerRequests() {
    const container = document.getElementById('prayerRequestsList');
    if (!container) return;
    
    // Combine admin prayer requests with incoming prayer requests
    const combinedPrayers = [
        ...allPrayers.map(p => ({ ...p, source: 'admin' })),
        ...allIncomingRequests
            .filter(r => r.type === 'prayer_request')
            .map(r => ({ 
                id: r.id, 
                memberId: null, 
                request: r.request, 
                memberName: r.fullName,
                visibility: r.visibility || 'private',
                status: r.status === 'pending' ? 'active' : r.status,
                createdAt: r.createdAt,
                source: 'member'
            }))
    ];
    
    if (combinedPrayers.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400">No prayer requests yet</div>';
        return;
    }
    
    container.innerHTML = combinedPrayers.map(prayer => {
        const member = allMembers.find(m => m.id === prayer.memberId);
        const name = member?.fullName || prayer.memberName || 'Unknown';
        const isAnswered = prayer.status === 'answered';
        const isFromMember = prayer.source === 'member';
        
        return `
            <div class="prayer-card bg-gray-50 rounded-lg p-4 border-l-4 ${isAnswered ? 'border-green-500' : 'border-blue-500'}">
                <div class="flex justify-between items-start">
                    <div>
                        <p class="font-medium text-gray-800">${escapeHtml(name)}</p>
                        <p class="text-xs text-gray-400">${formatDate(prayer.createdAt)} • ${escapeHtml(prayer.visibility || 'private')}</p>
                        ${isFromMember ? '<span class="text-xs text-purple-600 ml-2"><i class="fas fa-globe"></i> From Member Portal</span>' : ''}
                    </div>
                    <div class="flex gap-2">
                        ${!isAnswered ? `
                            <button onclick="window.markPrayerAnswered('${prayer.id}')" class="text-green-600 text-xs hover:text-green-800">Mark Answered</button>
                        ` : ''}
                        <button onclick="window.deletePrayer('${prayer.id}')" class="text-red-500 text-xs hover:text-red-700">Delete</button>
                    </div>
                </div>
                <p class="mt-2 text-gray-600">${escapeHtml(prayer.request)}</p>
                ${isAnswered ? '<div class="mt-2 text-xs text-green-600"><i class="fas fa-check-circle"></i> Answered Prayer</div>' : '<div class="mt-2 text-xs text-blue-500"><i class="fas fa-praying-hands"></i> Praying</div>'}
            </div>
        `;
    }).join('');
}

function renderVisitations() {
    const container = document.getElementById('visitationsList');
    if (!container) return;
    
    if (allVisitations.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400">No visitations recorded</div>';
        return;
    }
    
    container.innerHTML = allVisitations.slice(0, 15).map(visit => {
        const member = allMembers.find(m => m.id === visit.memberId);
        const visitTypes = { home: '🏠 Home', hospital: '🏥 Hospital', prison: '🔒 Prison', sick: '🤒 Sick/Shut-in', new_baby: '👶 New Baby', bereavement: '🕊️ Bereavement' };
        return `
            <div class="p-3 bg-gray-50 rounded-lg">
                <div class="flex justify-between items-start">
                    <div><p class="font-medium">${escapeHtml(member?.fullName || 'Unknown')}</p><p class="text-xs text-gray-400">${visitTypes[visit.visitType] || visit.visitType}</p></div>
                    <span class="text-xs text-gray-400">${formatDateInput(visit.visitDate)}</span>
                </div>
                ${visit.notes ? `<p class="text-sm text-gray-600 mt-1">${escapeHtml(visit.notes.substring(0, 100))}</p>` : ''}
                ${visit.nextFollowup ? `<div class="mt-2 text-xs text-orange-500"><i class="fas fa-calendar"></i> Next follow-up: ${formatDateInput(visit.nextFollowup)}</div>` : ''}
                <div class="mt-2 flex justify-end"><button onclick="window.deleteVisitation('${visit.id}')" class="text-red-500 text-xs">Delete</button></div>
            </div>
        `;
    }).join('');
}

function renderCounseling() {
    const container = document.getElementById('counselingList');
    if (!container) return;
    
    // Combine admin counseling with incoming counseling requests
    const combinedCounseling = [
        ...allCounseling.map(c => ({ ...c, source: 'admin' })),
        ...allIncomingRequests
            .filter(r => r.type === 'counselling_request')
            .map(r => ({ 
                id: r.id,
                memberId: null,
                memberName: r.fullName,
                sessionType: r.contactMethod || 'Individual',
                sessionDate: r.preferredDate || new Date().toISOString().split('T')[0],
                topics: r.message,
                recommendations: 'Awaiting pastoral response',
                source: 'member'
            }))
    ];
    
    if (combinedCounseling.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400">No counseling sessions recorded</div>';
        return;
    }
    
    container.innerHTML = combinedCounseling.slice(0, 15).map(session => {
        const member = allMembers.find(m => m.id === session.memberId);
        const name = member?.fullName || session.memberName || 'Unknown';
        const isFromMember = session.source === 'member';
        
        return `
            <div class="p-3 bg-gray-50 rounded-lg">
                <div class="flex justify-between items-start">
                    <div><p class="font-medium">${escapeHtml(name)}</p>
                        <p class="text-xs text-gray-400">${escapeHtml(session.sessionType)} • ${formatDateInput(session.sessionDate)}</p>
                        ${isFromMember ? '<span class="text-xs text-purple-600 ml-2"><i class="fas fa-globe"></i> From Member Portal</span>' : ''}
                    </div>
                </div>
                ${session.topics ? `<p class="text-sm text-gray-600 mt-1"><strong>Topics:</strong> ${escapeHtml(session.topics.substring(0, 80))}</p>` : ''}
                ${session.recommendations ? `<p class="text-xs text-purple-600 mt-1"><i class="fas fa-lightbulb"></i> Next steps: ${escapeHtml(session.recommendations)}</p>` : ''}
                <div class="mt-2 flex justify-end"><button onclick="window.deleteCounseling('${session.id}')" class="text-red-500 text-xs">Delete</button></div>
            </div>
        `;
    }).join('');
}

function renderFollowups() {
    const container = document.getElementById('followupsList');
    if (!container) return;
    
    const filter = document.getElementById('followupFilter')?.value || 'all';
    
    let filtered = [...allFollowups];
    if (filter === 'pending') filtered = filtered.filter(f => f.status === 'pending');
    if (filter === 'completed') filtered = filtered.filter(f => f.status === 'completed');
    if (filter === 'overdue') filtered = filtered.filter(f => f.status === 'pending' && new Date(f.dueDate) < new Date());
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400">No follow-up tasks</div>';
        return;
    }
    
    container.innerHTML = filtered.map(task => {
        const member = allMembers.find(m => m.id === task.memberId);
        const isOverdue = task.status === 'pending' && new Date(task.dueDate) < new Date();
        const followupTypes = { prayer: '🙏 Prayer', visit: '🚪 Visit', call: '📞 Phone Call', counseling: '💬 Counseling' };
        return `
            <div class="followup-item flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div><p class="font-medium">${escapeHtml(member?.fullName || 'Unknown')}</p><p class="text-xs text-gray-500">${followupTypes[task.type] || task.type} • Due: ${formatDateInput(task.dueDate)}</p>${task.notes ? `<p class="text-xs text-gray-400 mt-1">${escapeHtml(task.notes.substring(0, 60))}</p>` : ''}</div>
                <div class="flex gap-2">
                    <button onclick="window.completeFollowup('${task.id}')" class="text-green-600 text-xs hover:text-green-800">Complete</button>
                    <button onclick="window.deleteFollowup('${task.id}')" class="text-red-500 text-xs hover:text-red-700">Delete</button>
                </div>
            </div>
        `;
    }).join('');
}

function renderHospitalVisits() {
    const container = document.getElementById('hospitalList');
    if (!container) return;
    
    if (allHospital.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400">No hospital visits recorded</div>';
        return;
    }
    
    container.innerHTML = allHospital.slice(0, 15).map(visit => `
        <div class="p-3 bg-gray-50 rounded-lg">
            <div class="flex justify-between items-start">
                <div><p class="font-medium">${escapeHtml(visit.patientName)}</p><p class="text-xs text-gray-400">${escapeHtml(visit.hospitalName)} • ${formatDateInput(visit.visitDate)}</p></div>
            </div>
            ${visit.condition ? `<p class="text-sm text-gray-600 mt-1">Condition: ${escapeHtml(visit.condition)}</p>` : ''}
            ${visit.prayerPoints ? `<p class="text-xs text-blue-600 mt-1"><i class="fas fa-pray"></i> Prayer: ${escapeHtml(visit.prayerPoints)}</p>` : ''}
            <div class="mt-2 flex justify-end"><button onclick="window.deleteHospitalVisit('${visit.id}')" class="text-red-500 text-xs">Delete</button></div>
        </div>
    `).join('');
}

function renderTestimonies() {
    const container = document.getElementById('testimoniesList');
    if (!container) return;
    
    if (allTestimonies.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400">No testimonies shared yet</div>';
        return;
    }
    
    container.innerHTML = allTestimonies.map(testimony => {
        const member = allMembers.find(m => m.id === testimony.memberId);
        return `
            <div class="p-3 bg-yellow-50 rounded-lg border-l-4 border-yellow-500">
                <div class="flex justify-between items-start">
                    <div><p class="font-medium">${escapeHtml(testimony.title)}</p><p class="text-xs text-gray-400">— ${escapeHtml(member?.fullName || 'Unknown')} • ${formatDate(testimony.createdAt)}</p></div>
                </div>
                <p class="text-sm text-gray-600 mt-2">${escapeHtml(testimony.content)}</p>
                <div class="mt-2 flex justify-end"><button onclick="window.deleteTestimony('${testimony.id}')" class="text-red-500 text-xs">Delete</button></div>
            </div>
        `;
    }).join('');
}

// Add functions with loading states (keep existing)
async function addPrayerRequest(memberId, request, visibility) {
    const btn = document.getElementById('submitPrayerBtn');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<span class="btn-spinner"></span><span class="btn-text">Submitting...</span>';
        btn.classList.add('btn-loading');
        btn.disabled = true;
        
        await addDoc(collection(db, "prayer_requests"), {
            memberId, request, visibility, status: 'active', createdAt: Timestamp.now()
        });
        showToast('Prayer request submitted', 'success');
        await loadPrayerRequests();
        updateStats();
        
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        return true;
    } catch (error) {
        showToast('Error submitting request', 'error');
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        return false;
    }
}

async function addVisitation(memberId, visitType, visitDate, notes, nextFollowup) {
    const btn = document.getElementById('submitVisitationBtn');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<span class="btn-spinner"></span><span class="btn-text">Logging...</span>';
        btn.classList.add('btn-loading');
        btn.disabled = true;
        
        await addDoc(collection(db, "visitations"), {
            memberId, visitType, visitDate, notes, nextFollowup, createdAt: Timestamp.now()
        });
        showToast('Visit logged', 'success');
        await loadVisitations();
        updateStats();
        
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        return true;
    } catch (error) {
        showToast('Error logging visit', 'error');
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        return false;
    }
}

async function addCounseling(memberId, sessionType, sessionDate, topics, recommendations) {
    const btn = document.getElementById('submitCounselingBtn');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<span class="btn-spinner"></span><span class="btn-text">Logging...</span>';
        btn.classList.add('btn-loading');
        btn.disabled = true;
        
        await addDoc(collection(db, "counseling"), {
            memberId, sessionType, sessionDate, topics, recommendations, createdAt: Timestamp.now()
        });
        showToast('Counseling session logged', 'success');
        await loadCounseling();
        updateStats();
        
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        return true;
    } catch (error) {
        showToast('Error logging session', 'error');
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        return false;
    }
}

async function addFollowup(memberId, type, notes, dueDate) {
    try {
        await addDoc(collection(db, "followups"), {
            memberId, type, notes, dueDate, status: 'pending', createdAt: Timestamp.now()
        });
        showToast('Follow-up task added', 'success');
        await loadFollowups();
        updateStats();
        return true;
    } catch (error) {
        showToast('Error adding task', 'error');
        return false;
    }
}

async function addHospitalVisit(patientName, hospitalName, ward, condition, prayerPoints) {
    const btn = document.getElementById('submitHospitalBtn');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<span class="btn-spinner"></span><span class="btn-text">Logging...</span>';
        btn.classList.add('btn-loading');
        btn.disabled = true;
        
        await addDoc(collection(db, "hospital_visits"), {
            patientName, hospitalName, ward, condition, prayerPoints, visitDate: new Date().toISOString().split('T')[0], createdAt: Timestamp.now()
        });
        showToast('Hospital visit logged', 'success');
        await loadHospitalVisits();
        
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        return true;
    } catch (error) {
        showToast('Error logging hospital visit', 'error');
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        return false;
    }
}

async function addTestimony(memberId, title, content, shareWithChurch) {
    const btn = document.getElementById('submitTestimonyBtn');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<span class="btn-spinner"></span><span class="btn-text">Sharing...</span>';
        btn.classList.add('btn-loading');
        btn.disabled = true;
        
        await addDoc(collection(db, "testimonies"), {
            memberId, title, content, shareWithChurch, status: shareWithChurch ? 'published' : 'private', createdAt: Timestamp.now()
        });
        showToast('Testimony shared', 'success');
        await loadTestimonies();
        
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        return true;
    } catch (error) {
        showToast('Error sharing testimony', 'error');
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        return false;
    }
}

// Delete functions
window.markPrayerAnswered = async (id) => {
    try {
        // Check if it's from pastoral_requests or prayer_requests
        const isFromMember = allIncomingRequests.some(r => r.id === id);
        if (isFromMember) {
            await updateDoc(doc(db, "pastoral_requests", id), { 
                status: 'responded', 
                answeredAt: Timestamp.now(),
                respondedBy: 'admin'
            });
        } else {
            await updateDoc(doc(db, "prayer_requests", id), { 
                status: 'answered', 
                answeredAt: Timestamp.now() 
            });
        }
        showToast('Prayer marked as answered ✅', 'success');
        await loadPrayerRequests();
        await loadIncomingRequests();
        updateStats();
    } catch (error) {
        console.error('Error marking prayer answered:', error);
        showToast('Error updating prayer', 'error');
    }
};

window.deletePrayer = async (id) => { 
    try {
        // Check if it's from pastoral_requests or prayer_requests
        const isFromMember = allIncomingRequests.some(r => r.id === id);
        if (isFromMember) {
            await deleteDoc(doc(db, "pastoral_requests", id));
        } else {
            await deleteDoc(doc(db, "prayer_requests", id));
        }
        showToast('Prayer request deleted', 'success');
        await loadPrayerRequests();
        await loadIncomingRequests();
        updateStats();
    } catch (error) {
        console.error('Error deleting prayer:', error);
        showToast('Error deleting prayer', 'error');
    }
};

window.deleteVisitation = async (id) => { 
    await deleteDoc(doc(db, "visitations", id)); 
    showToast('Visit deleted', 'success'); 
    await loadVisitations(); 
    updateStats(); 
};

window.deleteCounseling = async (id) => { 
    await deleteDoc(doc(db, "counseling", id)); 
    showToast('Session deleted', 'success'); 
    await loadCounseling(); 
    updateStats(); 
};

window.completeFollowup = async (id) => { 
    await updateDoc(doc(db, "followups", id), { status: 'completed', completedAt: Timestamp.now() }); 
    showToast('Task completed ✅', 'success'); 
    await loadFollowups(); 
    updateStats(); 
};

window.deleteFollowup = async (id) => { 
    await deleteDoc(doc(db, "followups", id)); 
    showToast('Task deleted', 'success'); 
    await loadFollowups(); 
    updateStats(); 
};

window.deleteHospitalVisit = async (id) => { 
    await deleteDoc(doc(db, "hospital_visits", id)); 
    showToast('Hospital visit deleted', 'success'); 
    await loadHospitalVisits(); 
};

window.deleteTestimony = async (id) => { 
    await deleteDoc(doc(db, "testimonies", id)); 
    showToast('Testimony deleted', 'success'); 
    await loadTestimonies(); 
};

// Setup event listeners
function setupEventListeners() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active', 'text-[#6a1b9a]', 'font-semibold'));
            btn.classList.add('tab-active', 'text-[#6a1b9a]', 'font-semibold');
            document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
            document.getElementById(`tab-${tabId}`).classList.remove('hidden');
        });
    });
    
    // Incoming requests filter
    document.getElementById('incomingFilter')?.addEventListener('change', () => renderIncomingRequests());
    document.getElementById('refreshIncoming')?.addEventListener('click', () => loadIncomingRequests());
    
    document.getElementById('prayerForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addPrayerRequest(
            document.getElementById('prayerMember').value,
            document.getElementById('prayerRequest').value,
            document.getElementById('prayerVisibility').value
        );
        e.target.reset();
    });
    
    document.getElementById('visitationForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addVisitation(
            document.getElementById('visitationMember').value,
            document.getElementById('visitType').value,
            document.getElementById('visitDate').value,
            document.getElementById('visitNotes').value,
            document.getElementById('nextFollowup').value
        );
        e.target.reset();
    });
    
    document.getElementById('counselingForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addCounseling(
            document.getElementById('counselingMember').value,
            document.getElementById('counselingType').value,
            document.getElementById('counselingDate').value,
            document.getElementById('counselingTopics').value,
            document.getElementById('counselingRecommendations').value
        );
        e.target.reset();
    });
    
    document.getElementById('hospitalForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addHospitalVisit(
            document.getElementById('patientName').value,
            document.getElementById('hospitalName').value,
            document.getElementById('hospitalWard').value,
            document.getElementById('hospitalCondition').value,
            document.getElementById('hospitalPrayer').value
        );
        e.target.reset();
    });
    
    document.getElementById('testimonyForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addTestimony(
            document.getElementById('testimonyMember').value,
            document.getElementById('testimonyTitle').value,
            document.getElementById('testimonyContent').value,
            document.getElementById('shareWithChurch').checked
        );
        e.target.reset();
    });
    
    document.getElementById('refreshPrayers')?.addEventListener('click', () => {
        loadPrayerRequests();
        loadIncomingRequests();
    });
    document.getElementById('followupFilter')?.addEventListener('change', () => renderFollowups());
    
    document.getElementById('addFollowupBtn')?.addEventListener('click', () => document.getElementById('followupModal').classList.remove('hidden'));
    document.getElementById('saveFollowup')?.addEventListener('click', async () => {
        await addFollowup(
            document.getElementById('followupMemberSelect').value,
            document.getElementById('followupType').value,
            document.getElementById('followupNotes').value,
            document.getElementById('followupDueDate').value
        );
        document.getElementById('followupModal').classList.add('hidden');
        document.getElementById('followupNotes').value = '';
    });
    document.getElementById('closeFollowupModal')?.addEventListener('click', () => document.getElementById('followupModal').classList.add('hidden'));
}

// Helper functions
function escapeHtml(str) { 
    if (!str) return ''; 
    return String(str).replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;'); 
}

function formatDate(timestamp) { 
    if (!timestamp) return '—'; 
    if (timestamp.toDate) return timestamp.toDate().toLocaleDateString(); 
    return new Date(timestamp).toLocaleDateString(); 
}

function formatDateInput(dateStr) { 
    if (!dateStr) return '—'; 
    return new Date(dateStr).toLocaleDateString(); 
}

// Initialize
document.addEventListener('DOMContentLoaded', initPastoralPage);

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