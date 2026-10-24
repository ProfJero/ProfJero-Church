import { db, collection, addDoc, getDocs, query, orderBy, where, Timestamp, doc, deleteDoc, updateDoc, getDoc, limit, startAfter } from './firebase-config.js';
import { 
    showToast, 
    protectPage, 
    updateUserDisplay,
    getCurrentUserRole,
    logoutUser
} from './auth.js';

// State variables
let allMembers = [];
let allAttendance = [];
let currentHistoryPage = 1;
const historyItemsPerPage = 20;
let attendanceChart = null;
let isSessionActive = true;
let selectedMemberId = null;
let batchSelectedMembers = new Set();
let attendanceStats = { today: 0, week: 0, month: 0, avg: 0 };
let lastDoc = null;
let hasMoreHistory = true;
let currentUserData = null;

// DOM Elements
const loadingState = document.getElementById('loadingState');
const attendanceContent = document.getElementById('attendanceContent');

// Initialize
export async function initAttendancePage() {
    try {
        // Protect page - requires authentication
        const userData = await protectPage('attendance');
        
        if (!userData) {
            return;
        }
        
        currentUserData = userData;
        
        // Update user display
        updateUserDisplay(userData);
        
        // Load data
        await loadMembers();
        await loadAttendance();
        setupEventListeners();
        updateStats();
        renderTodayCheckins();
        updateDateDisplay();
        
        // Load session state from localStorage
        loadSessionState();
        
        // Setup logout listener
        setupLogoutListener();
        
        // Hide loading, show content
        loadingState.classList.add('hidden');
        attendanceContent.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error initializing attendance page:', error);
        showToast('Error loading attendance page', 'error');
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

// Load session state from localStorage
function loadSessionState() {
    const savedSession = localStorage.getItem('attendanceSessionActive');
    if (savedSession !== null) {
        isSessionActive = savedSession === 'true';
        updateSessionUI();
    }
}

// Load members with search capability
async function loadMembers() {
    try {
        const snapshot = await getDocs(collection(db, "members"));
        allMembers = [];
        snapshot.forEach(doc => {
            allMembers.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort members by name
        allMembers.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
        
        // Populate member selects
        const memberSelects = ['qrMemberSelect'];
        memberSelects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                select.innerHTML = '<option value="">Select Member</option>' + 
                    allMembers.map(m => `<option value="${m.id}">${escapeHtml(m.fullName)} - ${escapeHtml(m.phone || '')}</option>`).join('');
            }
        });
    } catch (error) {
        console.error('Error loading members:', error);
        showToast('Error loading members', 'error');
    }
}

// Load attendance records with pagination
async function loadAttendance(resetPagination = true) {
    try {
        if (resetPagination) {
            lastDoc = null;
            hasMoreHistory = true;
        }
        
        let q;
        if (lastDoc) {
            q = query(collection(db, "attendance"), orderBy("checkInTime", "desc"), startAfter(lastDoc), limit(50));
        } else {
            q = query(collection(db, "attendance"), orderBy("checkInTime", "desc"), limit(50));
        }
        
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
            hasMoreHistory = false;
            if (resetPagination) {
                allAttendance = [];
            }
            return;
        }
        
        const newRecords = [];
        snapshot.forEach(doc => {
            newRecords.push({ id: doc.id, ...doc.data() });
        });
        
        if (resetPagination) {
            allAttendance = newRecords;
        } else {
            allAttendance = [...allAttendance, ...newRecords];
        }
        
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        hasMoreHistory = newRecords.length === 50;
        
    } catch (error) {
        console.error('Error loading attendance:', error);
    }
}

// Search members by name or phone
function searchMembers(query) {
    if (!query || query.trim() === '') return [];
    const searchTerm = query.toLowerCase().trim();
    return allMembers.filter(m => {
        const name = (m.fullName || '').toLowerCase();
        const phone = (m.phone || '').toLowerCase();
        return name.includes(searchTerm) || phone.includes(searchTerm);
    }).slice(0, 10);
}

// Update date display
function updateDateDisplay() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    document.getElementById('currentDateDisplay').textContent = dateStr;
    document.getElementById('todayDateDisplay').textContent = now.toISOString().split('T')[0];
}

// Update statistics
function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = allAttendance.filter(a => a.date === today);
    document.getElementById('todayCount').textContent = todayAttendance.length;
    document.getElementById('todayCheckinCount').textContent = todayAttendance.length;
    
    // This week calculation (Sunday to Saturday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - dayOfWeek);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    
    const weekAttendance = allAttendance.filter(a => a.date && a.date >= weekStartStr);
    document.getElementById('weekCount').textContent = weekAttendance.length;
    
    // This month
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthAttendance = allAttendance.filter(a => {
        if (!a.checkInTime || !a.checkInTime.toDate) return false;
        const d = a.checkInTime.toDate();
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    document.getElementById('monthCount').textContent = monthAttendance.length;
    
    // Calculate average attendance (last 4 weeks)
    const avg = Math.round(weekAttendance.length / 4) || 0;
    document.getElementById('avgAttendance').textContent = avg;
    
    // Store stats for later use
    attendanceStats = { today: todayAttendance.length, week: weekAttendance.length, month: monthAttendance.length, avg };
}

// Render today's check-ins
function renderTodayCheckins() {
    const container = document.getElementById('todayCheckinsList');
    const today = new Date().toISOString().split('T')[0];
    const todayAttendance = allAttendance.filter(a => a.date === today).slice(0, 20);
    
    if (todayAttendance.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400">No check-ins today</div>';
        return;
    }
    
    container.innerHTML = todayAttendance.map(att => {
        const statusClass = att.status === 'late' ? 'status-late' : att.status === 'absent' ? 'status-absent' : 'status-present';
        const statusLabel = att.status ? att.status.charAt(0).toUpperCase() + att.status.slice(1) : 'Present';
        return `
            <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                    <p class="font-medium text-gray-800">${escapeHtml(att.memberName || 'Unknown')}</p>
                    <p class="text-xs text-gray-500">${formatDateTime(att.checkInTime)} • ${escapeHtml(att.serviceType || 'Sunday Service')}</p>
                </div>
                <div class="flex items-center gap-2">
                    <span class="attendance-status ${statusClass}">${statusLabel}</span>
                    <button onclick="window.deleteAttendance('${att.id}')" class="text-red-500 hover:text-red-700">
                        <i class="fas fa-trash-alt text-sm"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Check-in member with loading state
async function checkInMember(memberId, serviceType, notes, status = 'present') {
    const btn = document.querySelector('#manualCheckinForm button[type="submit"]');
    const originalText = btn ? btn.innerHTML : '';
    
    if (!isSessionActive) {
        showToast('Attendance session is currently inactive. Please activate it first.', 'error');
        return false;
    }
    
    // Check if member already checked in today
    const today = new Date().toISOString().split('T')[0];
    const alreadyCheckedIn = allAttendance.some(a => a.memberId === memberId && a.date === today);
    if (alreadyCheckedIn) {
        const member = allMembers.find(m => m.id === memberId);
        showToast(`${member ? member.fullName : 'Member'} already checked in today ✅`, 'warning');
        return false;
    }
    
    const member = allMembers.find(m => m.id === memberId);
    if (!member) {
        showToast('Member not found', 'error');
        return false;
    }
    
    try {
        // Show loading state
        if (btn) {
            btn.innerHTML = '<span class="btn-spinner"></span><span class="btn-text">Checking in...</span>';
            btn.classList.add('btn-loading');
            btn.disabled = true;
        }
        
        await addDoc(collection(db, "attendance"), {
            memberId: memberId,
            memberName: member.fullName,
            memberPhone: member.phone,
            serviceType: serviceType || 'Sunday Service',
            notes: notes || '',
            status: status || 'present',
            checkInTime: Timestamp.now(),
            date: new Date().toISOString().split('T')[0]
        });
        
        showToast(`${member.fullName} checked in successfully! ✅`, 'success');
        await loadAttendance(true);
        updateStats();
        renderTodayCheckins();
        renderAttendanceHistory();
        
        // Reset button
        if (btn) {
            btn.innerHTML = originalText;
            btn.classList.remove('btn-loading');
            btn.disabled = false;
        }
        
        return true;
    } catch (error) {
        console.error('Error checking in:', error);
        showToast('Check-in failed', 'error');
        
        // Reset button
        if (btn) {
            btn.innerHTML = originalText;
            btn.classList.remove('btn-loading');
            btn.disabled = false;
        }
        
        return false;
    }
}

// Delete attendance record
window.deleteAttendance = async (id) => {
    if (confirm('Are you sure you want to delete this attendance record?')) {
        try {
            await deleteDoc(doc(db, "attendance", id));
            showToast('Record deleted', 'success');
            await loadAttendance(true);
            updateStats();
            renderTodayCheckins();
            renderAttendanceHistory();
            renderAbsentMembers();
        } catch (error) {
            showToast('Error deleting record', 'error');
        }
    }
};

// Render attendance history with pagination
function renderAttendanceHistory() {
    const container = document.getElementById('attendanceHistoryList');
    const startDate = document.getElementById('historyStartDate')?.value;
    const endDate = document.getElementById('historyEndDate')?.value;
    
    let filtered = [...allAttendance];
    
    if (startDate) {
        filtered = filtered.filter(a => a.date >= startDate);
    }
    if (endDate) {
        filtered = filtered.filter(a => a.date <= endDate);
    }
    
    const start = (currentHistoryPage - 1) * historyItemsPerPage;
    const paginated = filtered.slice(start, start + historyItemsPerPage);
    const totalPages = Math.ceil(filtered.length / historyItemsPerPage);
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400">No attendance records found</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="px-4 py-2 text-left text-sm">Member</th>
                        <th class="px-4 py-2 text-left text-sm">Service</th>
                        <th class="px-4 py-2 text-left text-sm">Date & Time</th>
                        <th class="px-4 py-2 text-left text-sm">Status</th>
                        <th class="px-4 py-2 text-center text-sm">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${paginated.map(att => {
                        const statusClass = att.status === 'late' ? 'status-late' : att.status === 'absent' ? 'status-absent' : 'status-present';
                        const statusLabel = att.status ? att.status.charAt(0).toUpperCase() + att.status.slice(1) : 'Present';
                        return `
                            <tr class="border-b hover:bg-gray-50">
                                <td class="px-4 py-2 font-medium text-sm">${escapeHtml(att.memberName || 'Unknown')}</td>
                                <td class="px-4 py-2 text-sm">${escapeHtml(att.serviceType || 'Sunday Service')}</td>
                                <td class="px-4 py-2 text-sm">${formatDateTime(att.checkInTime)}</td>
                                <td class="px-4 py-2"><span class="attendance-status ${statusClass}">${statusLabel}</span></td>
                                <td class="px-4 py-2 text-center">
                                    <button onclick="window.deleteAttendance('${att.id}')" class="text-red-500 hover:text-red-700">
                                        <i class="fas fa-trash-alt"></i>
                                    </button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    
    // Pagination
    const paginationDiv = document.getElementById('historyPagination');
    if (totalPages > 1) {
        paginationDiv.classList.remove('hidden');
        let buttons = '';
        for (let i = 1; i <= Math.min(totalPages, 10); i++) {
            buttons += `<button onclick="window.goToHistoryPage(${i})" class="px-3 py-1 rounded-lg ${currentHistoryPage === i ? 'bg-[#6a1b9a] text-white' : 'bg-gray-100 hover:bg-gray-200'}">${i}</button>`;
        }
        paginationDiv.innerHTML = buttons;
    } else {
        paginationDiv.classList.add('hidden');
    }
}

window.goToHistoryPage = (page) => {
    currentHistoryPage = page;
    renderAttendanceHistory();
};

// Generate QR code
function generateQRCode(memberId, memberName) {
    const qrContainer = document.getElementById('qrCodeContainer');
    qrContainer.innerHTML = '';
    const qrData = JSON.stringify({ type: 'attendance', memberId: memberId, timestamp: Date.now() });
    new QRCode(qrContainer, {
        text: qrData,
        width: 200,
        height: 200,
        colorDark: '#6a1b9a',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.H
    });
    document.getElementById('qrCodeResult').classList.remove('hidden');
    document.getElementById('qrMemberName').textContent = memberName;
    
    // Download functionality
    document.getElementById('downloadQrBtn').onclick = () => {
        const canvas = qrContainer.querySelector('canvas');
        if (canvas) {
            const link = document.createElement('a');
            link.download = `qr_${memberName.replace(/\s/g, '_')}.png`;
            link.href = canvas.toDataURL();
            link.click();
        }
    };
}

// Generate bulk QR codes
function generateBulkQRs(fellowship) {
    let members = allMembers;
    if (fellowship) {
        members = allMembers.filter(m => m.fellowship === fellowship);
    }
    
    if (members.length === 0) {
        showToast('No members found for this fellowship', 'error');
        return;
    }
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>RGCI QR Codes - ${fellowship || 'All Members'}</title>
                <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .qr-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
                    .qr-card { text-align: center; border: 1px solid #ddd; border-radius: 8px; padding: 15px; page-break-inside: avoid; }
                    .qr-card p { margin-top: 10px; font-size: 12px; }
                    @media print { .qr-grid { grid-template-columns: repeat(3, 1fr); } }
                </style>
            </head>
            <body>
                <h2>Restoration Grace Chapel International</h2>
                <h3>Member QR Codes - ${fellowship || 'All Members'}</h3>
                <p>Generated: ${new Date().toLocaleString()}</p>
                <div class="qr-grid" id="qrGrid"></div>
                <script>
                    const members = ${JSON.stringify(members)};
                    const grid = document.getElementById('qrGrid');
                    members.forEach(member => {
                        const card = document.createElement('div');
                        card.className = 'qr-card';
                        const qrDiv = document.createElement('div');
                        qrDiv.id = 'qr_' + member.id;
                        const qrData = JSON.stringify({ type: 'attendance', memberId: member.id });
                        new QRCode(qrDiv, { text: qrData, width: 150, height: 150 });
                        const name = document.createElement('p');
                        name.innerHTML = '<strong>' + (member.fullName || '') + '</strong><br>' + (member.phone || '');
                        card.appendChild(qrDiv);
                        card.appendChild(name);
                        grid.appendChild(card);
                    });
                <\/script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

// Render absent members with fellowship filter
function renderAbsentMembers() {
    const container = document.getElementById('absentMembersList');
    const fellowshipFilter = document.getElementById('absentFellowshipFilter')?.value || '';
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    
    const attendedThisMonth = new Set();
    allAttendance.forEach(att => {
        if (att.checkInTime && att.checkInTime.toDate) {
            const d = att.checkInTime.toDate();
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                attendedThisMonth.add(att.memberId);
            }
        }
    });
    
    let absentMembers = allMembers.filter(m => !attendedThisMonth.has(m.id));
    
    // Apply fellowship filter
    if (fellowshipFilter) {
        absentMembers = absentMembers.filter(m => m.fellowship === fellowshipFilter);
    }
    
    if (absentMembers.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-green-600">🎉 All members have attended this month!</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full">
                <thead class="bg-gray-100">
                    <tr>
                        <th class="px-4 py-2 text-left text-sm">Member Name</th>
                        <th class="px-4 py-2 text-left text-sm">Phone</th>
                        <th class="px-4 py-2 text-left text-sm">Fellowship</th>
                        <th class="px-4 py-2 text-left text-sm">Last Attendance</th>
                    </tr>
                </thead>
                <tbody>
                    ${absentMembers.map(m => {
                        const lastAttendance = allAttendance.find(a => a.memberId === m.id);
                        return `
                            <tr class="border-b">
                                <td class="px-4 py-2 font-medium text-sm">${escapeHtml(m.fullName)}</td>
                                <td class="px-4 py-2 text-sm">${escapeHtml(m.phone || '—')}</td>
                                <td class="px-4 py-2 text-sm">${escapeHtml(m.fellowship || 'General')}</td>
                                <td class="px-4 py-2 text-sm">${lastAttendance ? formatDateTime(lastAttendance.checkInTime) : 'Never'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Generate attendance report
async function generateAttendanceReport() {
    const btn = document.getElementById('generateAttReportBtn');
    const originalText = btn.innerHTML;
    
    try {
        // Show loading state
        btn.innerHTML = '<span class="btn-spinner"></span><span class="btn-text">Generating...</span>';
        btn.classList.add('btn-loading');
        btn.disabled = true;
        
        const reportType = document.getElementById('attReportType').value;
        const month = document.getElementById('attReportMonth').value;
        const output = document.getElementById('attReportOutput');
        
        let filtered = [...allAttendance];
        
        if (month && reportType !== 'member' && reportType !== 'service') {
            const [year, monthNum] = month.split('-');
            filtered = filtered.filter(att => {
                if (!att.checkInTime || !att.checkInTime.toDate) return false;
                const d = att.checkInTime.toDate();
                return d.getFullYear() === parseInt(year) && d.getMonth() === parseInt(monthNum) - 1;
            });
        }
        
        if (reportType === 'daily') {
            const dailyCounts = {};
            filtered.forEach(att => {
                if (att.date) dailyCounts[att.date] = (dailyCounts[att.date] || 0) + 1;
            });
            const sorted = Object.entries(dailyCounts).sort((a, b) => b[0].localeCompare(a[0]));
            
            output.innerHTML = `
                <h3 class="font-bold mb-3">Daily Attendance Summary</h3>
                <table class="min-w-full"><thead><tr class="border-b"><th class="text-left py-2">Date</th><th class="text-right py-2">Count</th></tr></thead><tbody>
                    ${sorted.map(([date, count]) => `<tr><td class="py-2">${date}</td><td class="text-right font-bold">${count}</td></tr>`).join('')}
                </tbody></table>
            `;
            
            const labels = Object.keys(dailyCounts).slice(-7);
            const data = Object.values(dailyCounts).slice(-7);
            updateAttendanceChart(data, labels);
        } else if (reportType === 'weekly') {
            const weeklyCounts = {};
            filtered.forEach(att => {
                if (att.checkInTime && att.checkInTime.toDate) {
                    const d = att.checkInTime.toDate();
                    const weekNum = Math.ceil(d.getDate() / 7);
                    const week = `${d.getFullYear()}-W${weekNum}`;
                    weeklyCounts[week] = (weeklyCounts[week] || 0) + 1;
                }
            });
            output.innerHTML = `
                <h3 class="font-bold mb-3">Weekly Attendance Summary</h3>
                <table class="min-w-full"><thead><tr class="border-b"><th class="text-left py-2">Week</th><th class="text-right py-2">Count</th></tr></thead><tbody>
                    ${Object.entries(weeklyCounts).sort((a, b) => a[0].localeCompare(b[0])).map(([week, count]) => `<tr><td class="py-2">${week}</td><td class="text-right font-bold">${count}</td></tr>`).join('')}
                </tbody></table>
            `;
        } else if (reportType === 'monthly') {
            const monthlyCounts = {};
            filtered.forEach(att => {
                if (att.checkInTime && att.checkInTime.toDate) {
                    const d = att.checkInTime.toDate();
                    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    monthlyCounts[monthKey] = (monthlyCounts[monthKey] || 0) + 1;
                }
            });
            output.innerHTML = `
                <h3 class="font-bold mb-3">Monthly Attendance Summary</h3>
                <table class="min-w-full"><thead><tr class="border-b"><th class="text-left py-2">Month</th><th class="text-right py-2">Count</th></tr></thead><tbody>
                    ${Object.entries(monthlyCounts).sort((a, b) => a[0].localeCompare(b[0])).map(([monthKey, count]) => `<tr><td class="py-2">${monthKey}</td><td class="text-right font-bold">${count}</td></tr>`).join('')}
                </tbody></table>
            `;
        } else if (reportType === 'member') {
            const memberCounts = {};
            filtered.forEach(att => {
                const name = att.memberName || 'Unknown';
                memberCounts[name] = (memberCounts[name] || 0) + 1;
            });
            const sorted = Object.entries(memberCounts).sort((a, b) => b[1] - a[1]);
            output.innerHTML = `
                <h3 class="font-bold mb-3">Member Attendance Summary</h3>
                <table class="min-w-full"><thead><tr class="border-b"><th class="text-left py-2">Member</th><th class="text-right py-2">Attendance Count</th></tr></thead><tbody>
                    ${sorted.map(([name, count]) => `<tr><td class="py-2">${escapeHtml(name)}</td><td class="text-right font-bold">${count}</td></tr>`).join('')}
                </tbody></table>
            `;
        } else if (reportType === 'service') {
            const serviceCounts = {};
            filtered.forEach(att => {
                const service = att.serviceType || 'Sunday Service';
                serviceCounts[service] = (serviceCounts[service] || 0) + 1;
            });
            const sorted = Object.entries(serviceCounts).sort((a, b) => b[1] - a[1]);
            output.innerHTML = `
                <h3 class="font-bold mb-3">Service Type Summary</h3>
                <table class="min-w-full"><thead><tr class="border-b"><th class="text-left py-2">Service Type</th><th class="text-right py-2">Count</th></tr></thead><tbody>
                    ${sorted.map(([service, count]) => `<tr><td class="py-2">${escapeHtml(service)}</td><td class="text-right font-bold">${count}</td></tr>`).join('')}
                </tbody></table>
            `;
        }
        
        // Reset button
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        
    } catch (error) {
        console.error('Error generating report:', error);
        showToast('Error generating report', 'error');
        
        // Reset button
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
    }
}

function updateAttendanceChart(data, labels) {
    const ctx = document.getElementById('attendanceChart')?.getContext('2d');
    if (!ctx) return;
    if (attendanceChart) attendanceChart.destroy();
    
    const colors = ['#6a1b9a', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'];
    attendanceChart = new Chart(ctx, {
        type: 'bar',
        data: { 
            labels: labels || ['Data'], 
            datasets: [{ 
                label: 'Attendance', 
                data: data || [0], 
                backgroundColor: colors.slice(0, (data || [0]).length),
                borderColor: '#6a1b9a',
                borderWidth: 1,
                borderRadius: 4
            }] 
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}

// Update session UI
function updateSessionUI() {
    const btn = document.getElementById('toggleSessionBtn');
    const banner = document.getElementById('sessionBanner');
    const statusText = document.getElementById('sessionStatusText');
    
    if (isSessionActive) {
        btn.className = 'session-active px-4 py-1 rounded-lg text-sm font-semibold transition-all';
        btn.innerHTML = '<i class="fas fa-power-off mr-1"></i> Active';
        banner.className = 'mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg flex items-center justify-between';
        statusText.textContent = 'Active';
        document.getElementById('checkinSubmitBtn').disabled = false;
    } else {
        btn.className = 'session-inactive px-4 py-1 rounded-lg text-sm font-semibold transition-all';
        btn.innerHTML = '<i class="fas fa-power-off mr-1"></i> Inactive';
        banner.className = 'mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg flex items-center justify-between';
        statusText.textContent = 'Inactive';
        document.getElementById('checkinSubmitBtn').disabled = true;
    }
    
    localStorage.setItem('attendanceSessionActive', String(isSessionActive));
}

// Setup event listeners
function setupEventListeners() {
    // Session toggle
    document.getElementById('toggleSessionBtn')?.addEventListener('click', () => {
        isSessionActive = !isSessionActive;
        updateSessionUI();
        showToast(`Attendance session ${isSessionActive ? 'activated' : 'deactivated'}`, 'info');
    });
    
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active', 'text-[#6a1b9a]', 'font-semibold'));
            btn.classList.add('tab-active', 'text-[#6a1b9a]', 'font-semibold');
            document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
            document.getElementById(`tab-${tabId}`).classList.remove('hidden');
            if (tabId === 'absent') renderAbsentMembers();
            if (tabId === 'history') renderAttendanceHistory();
            if (tabId === 'reports') {
                // Set default month
                const now = new Date();
                const monthInput = document.getElementById('attReportMonth');
                if (monthInput && !monthInput.value) {
                    monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                }
            }
        });
    });
    
    // Member search input
    const searchInput = document.getElementById('memberSearchInput');
    const searchResults = document.getElementById('searchResultsDropdown');
    
    searchInput?.addEventListener('input', (e) => {
        const query = e.target.value;
        if (query.trim().length < 2) {
            searchResults.classList.add('hidden');
            return;
        }
        const results = searchMembers(query);
        if (results.length === 0) {
            searchResults.innerHTML = `<div class="p-2 text-gray-500 text-sm">No members found</div>`;
            searchResults.classList.remove('hidden');
            return;
        }
        searchResults.innerHTML = results.map(m => `
            <div class="search-result-item" data-id="${m.id}" data-name="${escapeHtml(m.fullName)}" data-phone="${escapeHtml(m.phone || '')}">
                <div class="font-medium">${escapeHtml(m.fullName)}</div>
                <div class="text-xs text-gray-500">${escapeHtml(m.phone || 'No phone')} • ${escapeHtml(m.fellowship || 'General')}</div>
            </div>
        `).join('');
        searchResults.classList.remove('hidden');
        
        // Add click handlers to results
        searchResults.querySelectorAll('.search-result-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                const name = el.dataset.name;
                selectMember(id, name);
                searchResults.classList.add('hidden');
                searchInput.value = name;
            });
        });
    });
    
    // Hide search results on click outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-member-input')) {
            searchResults?.classList.add('hidden');
        }
    });
    
    // Select member function
    window.selectMember = (id, name) => {
        selectedMemberId = id;
        document.getElementById('selectedMemberId').value = id;
        document.getElementById('selectedMemberName').textContent = name;
        document.getElementById('selectedMemberDisplay').classList.remove('hidden');
        document.getElementById('memberSearchInput').value = name;
        document.getElementById('checkinSubmitBtn').disabled = !isSessionActive;
    };
    
    window.clearSelectedMember = () => {
        selectedMemberId = null;
        document.getElementById('selectedMemberId').value = '';
        document.getElementById('selectedMemberDisplay').classList.add('hidden');
        document.getElementById('memberSearchInput').value = '';
        document.getElementById('checkinSubmitBtn').disabled = true;
    };
    
    // Manual check-in form
    document.getElementById('manualCheckinForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedMemberId) {
            showToast('Please search and select a member', 'error');
            return;
        }
        if (!isSessionActive) {
            showToast('Attendance session is inactive. Please activate it first.', 'error');
            return;
        }
        const serviceType = document.getElementById('serviceType').value;
        const notes = document.getElementById('checkinNotes').value;
        const status = document.getElementById('attendanceStatus').value;
        await checkInMember(selectedMemberId, serviceType, notes, status);
        e.target.reset();
        clearSelectedMember();
    });
    
    // Quick search
    document.getElementById('quickSearchBtn')?.addEventListener('click', async () => {
        const query = document.getElementById('quickSearchInput').value.trim();
        if (!query) { showToast('Enter a name or phone number', 'error'); return; }
        
        const results = searchMembers(query);
        const resultDiv = document.getElementById('quickSearchResult');
        
        if (results.length === 0) {
            resultDiv.innerHTML = `<div class="p-3 bg-red-50 rounded-lg text-red-600">No members found for "${escapeHtml(query)}"</div>`;
            resultDiv.classList.remove('hidden');
            return;
        }
        
        if (results.length === 1) {
            const member = results[0];
            resultDiv.innerHTML = `
                <div class="p-3 bg-green-50 rounded-lg flex justify-between items-center">
                    <div><p class="font-medium">${escapeHtml(member.fullName)}</p><p class="text-xs text-gray-500">${escapeHtml(member.phone)}</p></div>
                    <button onclick="window.checkInMemberById('${member.id}')" class="bg-green-600 text-white px-3 py-1 rounded-lg text-sm">Check-in</button>
                </div>
            `;
            resultDiv.classList.remove('hidden');
        } else {
            resultDiv.innerHTML = `
                <div class="p-3 bg-gray-50 rounded-lg">
                    <p class="text-sm font-medium mb-2">${results.length} members found:</p>
                    ${results.map(m => `
                        <div class="flex justify-between items-center py-1 border-b last:border-0">
                            <span class="text-sm">${escapeHtml(m.fullName)}</span>
                            <button onclick="window.checkInMemberById('${m.id}')" class="bg-green-600 text-white px-2 py-0.5 rounded text-xs">Check-in</button>
                        </div>
                    `).join('')}
                </div>
            `;
            resultDiv.classList.remove('hidden');
        }
    });
    
    window.checkInMemberById = async (memberId) => {
        await checkInMember(memberId, 'Sunday Service', '');
        document.getElementById('quickSearchInput').value = '';
        document.getElementById('quickSearchResult').classList.add('hidden');
    };
    
    // Quick check-in all present
    document.getElementById('quickCheckinAllBtn')?.addEventListener('click', async () => {
        if (!isSessionActive) {
            showToast('Attendance session is inactive. Please activate it first.', 'error');
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        const alreadyCheckedIn = new Set(allAttendance.filter(a => a.date === today).map(a => a.memberId));
        const notCheckedIn = allMembers.filter(m => !alreadyCheckedIn.has(m.id));
        
        if (notCheckedIn.length === 0) {
            showToast('All members have already checked in today! 🎉', 'success');
            return;
        }
        
        if (notCheckedIn.length > 50) {
            if (!confirm(`This will check in ${notCheckedIn.length} members. Continue?`)) return;
        }
        
        let successCount = 0;
        let failCount = 0;
        
        for (const member of notCheckedIn) {
            try {
                await addDoc(collection(db, "attendance"), {
                    memberId: member.id,
                    memberName: member.fullName,
                    memberPhone: member.phone,
                    serviceType: 'Sunday Service',
                    status: 'present',
                    notes: 'Batch check-in',
                    checkInTime: Timestamp.now(),
                    date: today
                });
                successCount++;
            } catch (error) {
                failCount++;
                console.error('Error in batch check-in:', error);
            }
        }
        
        showToast(`Batch check-in complete: ${successCount} checked in, ${failCount} failed`, successCount > 0 ? 'success' : 'error');
        await loadAttendance(true);
        updateStats();
        renderTodayCheckins();
    });
    
    // Mark all absent
    document.getElementById('quickMarkAbsentBtn')?.addEventListener('click', async () => {
        if (!isSessionActive) {
            showToast('Attendance session is inactive. Please activate it first.', 'error');
            return;
        }
        const today = new Date().toISOString().split('T')[0];
        const alreadyCheckedIn = new Set(allAttendance.filter(a => a.date === today).map(a => a.memberId));
        const notCheckedIn = allMembers.filter(m => !alreadyCheckedIn.has(m.id));
        
        if (notCheckedIn.length === 0) {
            showToast('All members are already accounted for!', 'success');
            return;
        }
        
        if (!confirm(`Mark ${notCheckedIn.length} members as absent?`)) return;
        
        let successCount = 0;
        for (const member of notCheckedIn) {
            try {
                await addDoc(collection(db, "attendance"), {
                    memberId: member.id,
                    memberName: member.fullName,
                    memberPhone: member.phone,
                    serviceType: 'Sunday Service',
                    status: 'absent',
                    notes: 'Marked absent',
                    checkInTime: Timestamp.now(),
                    date: today
                });
                successCount++;
            } catch (error) {
                console.error('Error marking absent:', error);
            }
        }
        
        showToast(`${successCount} members marked as absent`, 'success');
        await loadAttendance(true);
        updateStats();
        renderTodayCheckins();
    });
    
    // Batch check-in functionality
    const batchSearchInput = document.getElementById('batchSearchInput');
    const batchSearchResults = document.getElementById('batchSearchResults');
    
    batchSearchInput?.addEventListener('input', (e) => {
        const query = e.target.value;
        if (query.trim().length < 2) {
            batchSearchResults.classList.add('hidden');
            return;
        }
        const results = searchMembers(query).filter(m => !batchSelectedMembers.has(m.id));
        if (results.length === 0) {
            batchSearchResults.innerHTML = `<div class="p-2 text-gray-500 text-sm">No new members found</div>`;
            batchSearchResults.classList.remove('hidden');
            return;
        }
        batchSearchResults.innerHTML = results.map(m => `
            <div class="search-result-item" data-id="${m.id}" data-name="${escapeHtml(m.fullName)}">
                <div class="font-medium">${escapeHtml(m.fullName)}</div>
                <div class="text-xs text-gray-500">${escapeHtml(m.phone || 'No phone')}</div>
            </div>
        `).join('');
        batchSearchResults.classList.remove('hidden');
        
        batchSearchResults.querySelectorAll('.search-result-item').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.id;
                const name = el.dataset.name;
                batchSelectedMembers.add(id);
                updateBatchUI();
                batchSearchResults.classList.add('hidden');
                batchSearchInput.value = '';
            });
        });
    });
    
    // Update batch UI
    function updateBatchUI() {
        const container = document.getElementById('batchSelectedMembers');
        const countEl = document.getElementById('batchSelectedCount');
        countEl.textContent = batchSelectedMembers.size;
        
        if (batchSelectedMembers.size === 0) {
            container.innerHTML = '<span class="text-gray-400 text-sm">No members selected</span>';
            return;
        }
        
        const selected = allMembers.filter(m => batchSelectedMembers.has(m.id));
        container.innerHTML = selected.map(m => `
            <span class="member-tag">
                ${escapeHtml(m.fullName)}
                <span class="remove-btn" onclick="window.removeFromBatch('${m.id}')">×</span>
            </span>
        `).join('');
    }
    
    window.removeFromBatch = (id) => {
        batchSelectedMembers.delete(id);
        updateBatchUI();
    };
    
    document.getElementById('clearBatchBtn')?.addEventListener('click', () => {
        batchSelectedMembers.clear();
        updateBatchUI();
    });
    
    document.getElementById('batchSelectAllBtn')?.addEventListener('click', () => {
        if (batchSelectedMembers.size === allMembers.length) {
            batchSelectedMembers.clear();
        } else {
            allMembers.forEach(m => batchSelectedMembers.add(m.id));
        }
        updateBatchUI();
    });
    
    document.getElementById('batchCheckinBtn')?.addEventListener('click', async () => {
        const btn = document.getElementById('batchCheckinBtn');
        const originalText = btn.innerHTML;
        
        if (!isSessionActive) {
            showToast('Attendance session is inactive. Please activate it first.', 'error');
            return;
        }
        if (batchSelectedMembers.size === 0) {
            showToast('No members selected', 'error');
            return;
        }
        
        try {
            // Show loading state
            btn.innerHTML = '<span class="btn-spinner"></span><span class="btn-text">Checking in...</span>';
            btn.classList.add('btn-loading');
            btn.disabled = true;
            
            const serviceType = document.getElementById('batchServiceType').value;
            const today = new Date().toISOString().split('T')[0];
            const alreadyCheckedIn = new Set(allAttendance.filter(a => a.date === today).map(a => a.memberId));
            const toCheckIn = [...batchSelectedMembers].filter(id => !alreadyCheckedIn.has(id));
            
            if (toCheckIn.length === 0) {
                showToast('All selected members already checked in today', 'warning');
                btn.innerHTML = originalText;
                btn.classList.remove('btn-loading');
                btn.disabled = false;
                return;
            }
            
            let successCount = 0;
            let failCount = 0;
            
            for (const memberId of toCheckIn) {
                const member = allMembers.find(m => m.id === memberId);
                if (!member) continue;
                try {
                    await addDoc(collection(db, "attendance"), {
                        memberId: member.id,
                        memberName: member.fullName,
                        memberPhone: member.phone,
                        serviceType: serviceType || 'Sunday Service',
                        status: 'present',
                        notes: 'Batch check-in',
                        checkInTime: Timestamp.now(),
                        date: today
                    });
                    successCount++;
                } catch (error) {
                    failCount++;
                    console.error('Batch check-in error:', error);
                }
            }
            
            showToast(`Batch check-in: ${successCount} checked in, ${failCount} failed`, successCount > 0 ? 'success' : 'error');
            batchSelectedMembers.clear();
            updateBatchUI();
            await loadAttendance(true);
            updateStats();
            renderTodayCheckins();
            
            // Reset button
            btn.innerHTML = originalText;
            btn.classList.remove('btn-loading');
            btn.disabled = false;
            
        } catch (error) {
            console.error('Batch check-in error:', error);
            showToast('Error during batch check-in', 'error');
            
            // Reset button
            btn.innerHTML = originalText;
            btn.classList.remove('btn-loading');
            btn.disabled = false;
        }
    });
    
    // QR generation
    document.getElementById('generateQrBtn')?.addEventListener('click', () => {
        const btn = document.getElementById('generateQrBtn');
        const originalText = btn.innerHTML;
        
        const memberId = document.getElementById('qrMemberSelect').value;
        if (!memberId) { showToast('Select a member', 'error'); return; }
        const member = allMembers.find(m => m.id === memberId);
        if (member) {
            generateQRCode(memberId, member.fullName);
        }
    });
    
    document.getElementById('generateBulkQrBtn')?.addEventListener('click', () => {
        const fellowship = document.getElementById('bulkQrFellowship').value;
        generateBulkQRs(fellowship);
    });
    
    // History filters
    document.getElementById('filterHistoryBtn')?.addEventListener('click', () => {
        currentHistoryPage = 1;
        renderAttendanceHistory();
    });
    
    document.getElementById('clearHistoryFilterBtn')?.addEventListener('click', () => {
        document.getElementById('historyStartDate').value = '';
        document.getElementById('historyEndDate').value = '';
        currentHistoryPage = 1;
        renderAttendanceHistory();
    });
    
    // Reports
    document.getElementById('generateAttReportBtn')?.addEventListener('click', generateAttendanceReport);
    
    // Absent members filter
    document.getElementById('applyAbsentFilter')?.addEventListener('click', renderAbsentMembers);
    
    // Absent members actions
    document.getElementById('sendReminderBtn')?.addEventListener('click', () => {
        const absentMembers = getAbsentMembers();
        if (absentMembers.length === 0) {
            showToast('No absent members to remind', 'info');
            return;
        }
        showToast(`Reminder SMS will be sent to ${absentMembers.length} absent members (coming soon)`, 'info');
    });
    
    document.getElementById('exportAbsentBtn')?.addEventListener('click', () => {
        const absentMembers = getAbsentMembers();
        if (absentMembers.length === 0) {
            showToast('No absent members to export', 'info');
            return;
        }
        exportAbsentMembers(absentMembers);
    });
}

function getAbsentMembers() {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const attendedThisMonth = new Set();
    allAttendance.forEach(att => {
        if (att.checkInTime && att.checkInTime.toDate) {
            const d = att.checkInTime.toDate();
            if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                attendedThisMonth.add(att.memberId);
            }
        }
    });
    const fellowshipFilter = document.getElementById('absentFellowshipFilter')?.value || '';
    let absent = allMembers.filter(m => !attendedThisMonth.has(m.id));
    if (fellowshipFilter) {
        absent = absent.filter(m => m.fellowship === fellowshipFilter);
    }
    return absent;
}

function exportAbsentMembers(members) {
    // Create CSV
    let csv = 'Name,Phone,Fellowship,Last Attendance\n';
    members.forEach(m => {
        const lastAttendance = allAttendance.find(a => a.memberId === m.id);
        csv += `"${m.fullName || ''}","${m.phone || ''}","${m.fellowship || 'General'}","${lastAttendance ? formatDateTime(lastAttendance.checkInTime) : 'Never'}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `absent_members_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${members.length} absent members`, 'success');
}

// Helper functions
function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
}

function formatDateTime(timestamp) {
    if (!timestamp) return '—';
    if (timestamp.toDate) return timestamp.toDate().toLocaleString();
    return new Date(timestamp).toLocaleString();
}

// Initialize
document.addEventListener('DOMContentLoaded', initAttendancePage);

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