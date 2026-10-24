import { db, collection, addDoc, getDocs, query, orderBy, where, Timestamp, doc, updateDoc, deleteDoc } from './firebase-config.js';
import { showToast } from './auth.js';

let allRequests = [];
let devotionals = [];

async function loadRequests() {
    try {
        const q = query(collection(db, "pastoral_requests"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        allRequests = [];
        snapshot.forEach(doc => allRequests.push({ id: doc.id, ...doc.data() }));
        
        updateStats();
        renderPrayerRequests();
        renderCounselingRequests();
        renderVisitRequests();
        renderCompletedRequests();
    } catch (error) { console.error('Error loading requests:', error); }
}

function updateStats() {
    const prayers = allRequests.filter(r => r.type === 'prayer_request' && r.status === 'pending').length;
    const counseling = allRequests.filter(r => r.type === 'counseling_request' && r.status === 'pending').length;
    const visits = allRequests.filter(r => r.type === 'visit_request' && r.status === 'pending').length;
    const totalThisMonth = allRequests.filter(r => {
        if (!r.createdAt || !r.createdAt.toDate) return false;
        const d = r.createdAt.toDate();
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    
    document.getElementById('pendingPrayers').textContent = prayers;
    document.getElementById('pendingCounseling').textContent = counseling;
    document.getElementById('pendingVisits').textContent = visits;
    document.getElementById('totalRequests').textContent = totalThisMonth;
    
    const newRequests = allRequests.filter(r => r.status === 'pending').length;
    const badge = document.getElementById('newRequestsBadge');
    if (newRequests > 0) { badge.textContent = newRequests; badge.classList.remove('hidden'); }
    else badge.classList.add('hidden');
}

function renderPrayerRequests() {
    const container = document.getElementById('prayerRequestsList');
    const prayers = allRequests.filter(r => r.type === 'prayer_request' && r.status === 'pending').slice(0, 15);
    if (prayers.length === 0) { container.innerHTML = '<div class="text-center py-6 text-gray-400">No pending prayer requests</div>'; return; }
    container.innerHTML = prayers.map(req => `
        <div class="request-card p-3 bg-gray-50 rounded-lg border-l-4 border-blue-500">
            <div class="flex justify-between items-start"><div><p class="font-medium">${escapeHtml(req.fullName)}</p><p class="text-xs text-gray-400">${formatDate(req.createdAt)} • ${escapeHtml(req.followup || 'No follow-up')}</p></div>
            <div class="flex gap-2"><button onclick="markCompleted('${req.id}')" class="text-green-600 text-xs">✓ Mark Done</button><button onclick="deleteRequest('${req.id}')" class="text-red-500 text-xs">🗑</button></div></div>
            <p class="text-sm text-gray-600 mt-1">${escapeHtml(req.request)}</p>
            <div class="mt-2"><span class="text-xs text-blue-500"><i class="fas fa-phone"></i> ${escapeHtml(req.phone)}</span></div>
        </div>
    `).join('');
}

function renderCounselingRequests() {
    const container = document.getElementById('counselingRequestsList');
    const requests = allRequests.filter(r => r.type === 'counseling_request' && r.status === 'pending').slice(0, 15);
    if (requests.length === 0) { container.innerHTML = '<div class="text-center py-6 text-gray-400">No pending counseling requests</div>'; return; }
    container.innerHTML = requests.map(req => `
        <div class="request-card p-3 bg-gray-50 rounded-lg border-l-4 border-purple-500">
            <div class="flex justify-between items-start"><div><p class="font-medium">${escapeHtml(req.fullName)}</p><p class="text-xs text-gray-400">${formatDate(req.createdAt)} • ${escapeHtml(req.sessionType)}</p></div>
            <button onclick="markCompleted('${req.id}')" class="text-green-600 text-xs">✓ Mark Done</button></div>
            <p class="text-sm text-gray-600 mt-1">${escapeHtml(req.message?.substring(0, 100))}</p>
            <div class="mt-2 text-xs text-gray-500"><i class="fas fa-calendar"></i> Preferred: ${escapeHtml(req.preferredDate || 'Not specified')}</div>
        </div>
    `).join('');
}

function renderVisitRequests() {
    const container = document.getElementById('visitRequestsList');
    const requests = allRequests.filter(r => r.type === 'visit_request' && r.status === 'pending').slice(0, 15);
    if (requests.length === 0) { container.innerHTML = '<div class="text-center py-6 text-gray-400">No pending visit requests</div>'; return; }
    container.innerHTML = requests.map(req => `
        <div class="request-card p-3 bg-gray-50 rounded-lg border-l-4 border-green-500">
            <div class="flex justify-between items-start"><div><p class="font-medium">${escapeHtml(req.fullName)}</p><p class="text-xs text-gray-400">${formatDate(req.createdAt)} • ${escapeHtml(req.visitType)}</p></div>
            <button onclick="markCompleted('${req.id}')" class="text-green-600 text-xs">✓ Mark Done</button></div>
            <p class="text-sm text-gray-600 mt-1">📍 ${escapeHtml(req.address?.substring(0, 80))}</p>
            <div class="mt-2 text-xs text-gray-500"><i class="fas fa-phone"></i> ${escapeHtml(req.phone)}</div>
        </div>
    `).join('');
}

function renderCompletedRequests() {
    const container = document.getElementById('completedRequestsList');
    const completed = allRequests.filter(r => r.status === 'completed' || r.status === 'responded').slice(0, 20);
    if (completed.length === 0) { container.innerHTML = '<div class="text-center py-6 text-gray-400">No completed requests</div>'; return; }
    container.innerHTML = completed.map(req => `
        <div class="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
            <div><p class="font-medium">${escapeHtml(req.fullName)}</p><p class="text-xs text-gray-400">${req.type.replace('_request', '').toUpperCase()} • ${formatDate(req.createdAt)}</p></div>
            <span class="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Completed</span>
        </div>
    `).join('');
}

window.markCompleted = async (id) => {
    await updateDoc(doc(db, "pastoral_requests", id), { status: 'completed', completedAt: Timestamp.now() });
    showToast('Request marked as completed', 'success');
    await loadRequests();
};

window.deleteRequest = async (id) => {
    if (confirm('Delete this request?')) { await deleteDoc(doc(db, "pastoral_requests", id)); showToast('Deleted', 'success'); await loadRequests(); }
};

// Devotional functions
async function loadDevotionals() {
    try {
        const q = query(collection(db, "devotionals"), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        devotionals = [];
        snapshot.forEach(doc => devotionals.push({ id: doc.id, ...doc.data() }));
        renderDevotionals();
    } catch (error) { console.error('Error loading devotionals:', error); }
}

function renderDevotionals() {
    const container = document.getElementById('devotionalsList');
    if (devotionals.length === 0) { container.innerHTML = '<div class="text-center py-6 text-gray-400">No devotionals created yet</div>'; return; }
    container.innerHTML = devotionals.map(dev => `
        <div class="p-3 bg-gray-50 rounded-lg">
            <div class="flex justify-between items-start"><div><p class="font-medium">${escapeHtml(dev.title)}</p><p class="text-xs text-gray-400">${dev.date || 'No date'}</p></div>
            <button onclick="deleteDevotional('${dev.id}')" class="text-red-500 text-xs">Delete</button></div>
            <p class="text-xs text-gray-500 mt-1">${escapeHtml(dev.verse)}</p>
        </div>
    `).join('');
}

window.deleteDevotional = async (id) => {
    if (confirm('Delete this devotional?')) { await deleteDoc(doc(db, "devotionals", id)); showToast('Deleted', 'success'); await loadDevotionals(); }
};

// Load testimonies
async function loadTestimonies() {
    try {
        const q = query(collection(db, "testimonies"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const pending = [];
        snapshot.forEach(doc => { if (doc.data().status !== 'published') pending.push({ id: doc.id, ...doc.data() }); });
        renderPendingTestimonies(pending);
    } catch (error) { console.error('Error loading testimonies:', error); }
}

function renderPendingTestimonies(testimonies) {
    const container = document.getElementById('pendingTestimoniesList');
    if (testimonies.length === 0) { container.innerHTML = '<div class="text-center py-6 text-gray-400">No pending testimonies</div>'; return; }
    container.innerHTML = testimonies.map(t => `
        <div class="p-3 bg-gray-50 rounded-lg flex justify-between items-center">
            <div><p class="font-medium">${escapeHtml(t.title)}</p><p class="text-xs text-gray-400">${escapeHtml(t.content?.substring(0, 80))}...</p></div>
            <div class="flex gap-2"><button onclick="publishTestimony('${t.id}')" class="text-green-600 text-xs">✓ Publish</button><button onclick="deleteTestimony('${t.id}')" class="text-red-500 text-xs">🗑</button></div>
        </div>
    `).join('');
}

window.publishTestimony = async (id) => {
    await updateDoc(doc(db, "testimonies", id), { status: 'published', publishedAt: Timestamp.now() });
    showToast('Testimony published', 'success');
    await loadTestimonies();
};
window.deleteTestimony = async (id) => { await deleteDoc(doc(db, "testimonies", id)); showToast('Deleted', 'success'); await loadTestimonies(); };

// Create devotional
document.getElementById('devotionalForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const devotionalData = {
        title: document.getElementById('devotionalTitle').value,
        verse: document.getElementById('devotionalVerse').value,
        content: document.getElementById('devotionalContent').value,
        prayer: document.getElementById('devotionalPrayer').value,
        category: document.getElementById('devotionalCategory').value,
        date: new Date().toLocaleDateString(),
        createdAt: Timestamp.now()
    };
    await addDoc(collection(db, "devotionals"), devotionalData);
    showToast('Devotional published!', 'success');
    e.target.reset();
    await loadDevotionals();
});

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active', 'text-[#6a1b9a]', 'font-semibold'));
        btn.classList.add('tab-active', 'text-[#6a1b9a]', 'font-semibold');
        document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
        document.getElementById(`tab-${tabId}`).classList.remove('hidden');
        if (tabId === 'devotionals') loadDevotionals();
        if (tabId === 'testimonies') loadTestimonies();
    });
});

function escapeHtml(str) { if (!str) return ''; return String(str).replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;'); }
function formatDate(timestamp) { if (!timestamp) return '—'; if (timestamp.toDate) return timestamp.toDate().toLocaleDateString(); return new Date(timestamp).toLocaleDateString(); }

document.addEventListener('DOMContentLoaded', () => { loadRequests(); loadDevotionals(); loadTestimonies(); });