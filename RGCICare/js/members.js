import { db, collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, updateDoc, Timestamp } from './firebase-config.js';
import { 
    protectPage, 
    showToast, 
    getCurrentUserRole, 
    updateUserDisplay,
    getCurrentUserProfile,
    hasPagePermission,
    logoutUser
} from './auth.js';

// State variables
let allMembers = [];
let currentPage = 1;
const itemsPerPage = 20;
let currentFilter = '';
let currentSearch = '';
let currentUserData = null;

// DOM Elements
const membersListDiv = document.getElementById('membersList');
const totalMembersSpan = document.getElementById('totalMembers');
const totalMenSpan = document.getElementById('totalMen');
const totalWomenSpan = document.getElementById('totalWomen');
const totalFellowshipsSpan = document.getElementById('totalFellowships');
const memberCountBadge = document.getElementById('memberCountBadge');
const searchInput = document.getElementById('searchInput');
const filterFellowship = document.getElementById('filterFellowship');
const paginationDiv = document.getElementById('pagination');
const singleFormContainer = document.getElementById('singleFormContainer');
const bulkImportContainer = document.getElementById('bulkImportContainer');
const csvData = document.getElementById('csvData');
const csvPreview = document.getElementById('csvPreview');
const csvFile = document.getElementById('csvFile');
const importProgress = document.getElementById('importProgress');

// Initialize
export async function initMembersPage() {
    try {
        // Protect page - requires authentication
        const userData = await protectPage('members');
        
        if (!userData) {
            return;
        }
        
        currentUserData = userData;
        
        // Update user display
        updateUserDisplay(userData);
        
        // Load members
        await loadMembers();
        
        // Setup event listeners
        setupEventListeners();
        
        // Hide loading, show content
        document.getElementById('loadingState').classList.add('hidden');
        document.getElementById('membersContent').classList.remove('hidden');
        
        // Setup logout listener
        setupLogoutListener();
        
    } catch (error) {
        console.error('Error initializing members page:', error);
        showToast('Error loading members page', 'error');
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

// Load all members from Firestore
async function loadMembers() {
    try {
        const q = query(collection(db, "members"), orderBy("fullName", "asc"));
        const snapshot = await getDocs(q);
        allMembers = [];
        snapshot.forEach(doc => {
            allMembers.push({ id: doc.id, ...doc.data() });
        });
        
        updateStats();
        filterAndRender();
    } catch (error) {
        console.error('Error loading members:', error);
        membersListDiv.innerHTML = '<div class="text-center py-8 text-red-500">Error loading members. Please refresh.</div>';
    }
}

// Update statistics
function updateStats() {
    totalMembersSpan.textContent = allMembers.length;
    memberCountBadge.textContent = `${allMembers.length} total`;
    
    const menCount = allMembers.filter(m => m.gender === 'Male').length;
    const womenCount = allMembers.filter(m => m.gender === 'Female').length;
    totalMenSpan.textContent = menCount;
    totalWomenSpan.textContent = womenCount;
    
    const uniqueFellowships = new Set(allMembers.map(m => m.fellowship).filter(f => f));
    totalFellowshipsSpan.textContent = uniqueFellowships.size;
}

// Filter and render with pagination
function filterAndRender() {
    let filtered = [...allMembers];
    
    // Apply search
    if (currentSearch) {
        const searchLower = currentSearch.toLowerCase();
        filtered = filtered.filter(m => 
            m.fullName?.toLowerCase().includes(searchLower) ||
            m.phone?.includes(searchLower) ||
            m.email?.toLowerCase().includes(searchLower) ||
            m.area?.toLowerCase().includes(searchLower)
        );
    }
    
    // Apply fellowship filter
    if (currentFilter) {
        filtered = filtered.filter(m => m.fellowship === currentFilter);
    }
    
    // Pagination
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const start = (currentPage - 1) * itemsPerPage;
    const paginatedMembers = filtered.slice(start, start + itemsPerPage);
    
    renderMembersTable(paginatedMembers);
    renderPagination(totalPages, filtered.length);
}

// Render members table
function renderMembersTable(members) {
    if (members.length === 0) {
        membersListDiv.innerHTML = `
            <div class="text-center py-12 text-gray-400">
                <i class="fas fa-users text-5xl mb-3 opacity-50"></i>
                <p>No members found. Add your first member using the form above.</p>
            </div>
        `;
        return;
    }
    
    membersListDiv.innerHTML = `
        <div class="overflow-x-auto">
            <table class="min-w-full">
                <thead class="bg-gradient-to-r from-[#6a1b9a] to-[#9c4dcc] text-white rounded-lg">
                    <tr>
                        <th class="px-4 py-3 text-left text-sm">Member</th>
                        <th class="px-4 py-3 text-left text-sm">Contact</th>
                        <th class="px-4 py-3 text-left text-sm">Fellowship</th>
                        <th class="px-4 py-3 text-left text-sm">Location</th>
                        <th class="px-4 py-3 text-left text-sm">Registered</th>
                        <th class="px-4 py-3 text-center text-sm">Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${members.map(member => `
                        <tr class="border-b hover:bg-gray-50">
                            <td class="px-4 py-3">
                                <div class="font-medium text-gray-800">${escapeHtml(member.fullName)}</div>
                                <div class="text-xs text-gray-400">${escapeHtml(member.gender || 'Not set')} • ${escapeHtml(member.occupation || '')}</div>
                            </td>
                            <td class="px-4 py-3">
                                <div class="text-sm">${escapeHtml(member.phone || '—')}</div>
                                <div class="text-xs text-gray-400">${escapeHtml(member.email || '—')}</div>
                            </td>
                            <td class="px-4 py-3"><span class="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-700">${escapeHtml(member.fellowship || 'General')}</span></td>
                            <td class="px-4 py-3 text-sm">${escapeHtml(member.area || '—')}</td>
                            <td class="px-4 py-3 text-sm">${member.registeredDate ? new Date(member.registeredDate).toLocaleDateString() : '—'}</td>
                            <td class="px-4 py-3 text-center">
                                <button onclick="window.viewMember('${member.id}')" class="text-blue-600 hover:text-blue-800 mx-1 transition" title="View"><i class="fas fa-eye"></i></button>
                                <button onclick="window.editMember('${member.id}')" class="text-green-600 hover:text-green-800 mx-1 transition" title="Edit"><i class="fas fa-edit"></i></button>
                                <button onclick="window.deleteMember('${member.id}')" class="text-red-600 hover:text-red-800 mx-1 transition" title="Delete"><i class="fas fa-trash-alt"></i></button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// Render pagination
function renderPagination(totalPages, totalItems) {
    if (totalPages <= 1) {
        paginationDiv.classList.add('hidden');
        return;
    }
    
    paginationDiv.classList.remove('hidden');
    let buttons = '';
    
    // Previous button
    buttons += `<button onclick="window.goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} 
        class="px-3 py-1 rounded-lg ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}">
        Previous
    </button>`;
    
    // Page numbers
    for (let i = 1; i <= Math.min(totalPages, 5); i++) {
        buttons += `<button onclick="window.goToPage(${i})" 
            class="px-3 py-1 rounded-lg ${currentPage === i ? 'bg-[#6a1b9a] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}">
            ${i}
        </button>`;
    }
    
    if (totalPages > 5) {
        buttons += `<span class="px-2 text-gray-400">...</span>`;
        buttons += `<button onclick="window.goToPage(${totalPages})" 
            class="px-3 py-1 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200">
            ${totalPages}
        </button>`;
    }
    
    // Next button
    buttons += `<button onclick="window.goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}
        class="px-3 py-1 rounded-lg ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-purple-100 text-purple-700 hover:bg-purple-200'}">
        Next
    </button>`;
    
    paginationDiv.innerHTML = buttons + `<span class="ml-3 text-sm text-gray-500">${totalItems} total members</span>`;
}

// Add single member with loading state
async function addSingleMember(memberData) {
    const btn = document.getElementById('registerMemberBtn');
    const originalText = btn.innerHTML;
    
    try {
        // Show loading state
        btn.innerHTML = '<span class="btn-spinner"></span><span class="btn-text">Registering...</span>';
        btn.classList.add('btn-loading');
        btn.disabled = true;
        
        await addDoc(collection(db, "members"), {
            ...memberData,
            registeredDate: new Date().toISOString(),
            createdAt: Timestamp.now(),
            isActive: true
        });
        
        showToast('Member registered successfully! ✅', 'success');
        await loadMembers();
        
        // Reset button
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        
        return true;
    } catch (error) {
        console.error('Error adding member:', error);
        showToast('Error registering member', 'error');
        
        // Reset button
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        
        return false;
    }
}

// Bulk import members
async function bulkImportMembers(membersArray) {
    const btn = document.getElementById('processBulkImport');
    const originalText = btn.innerHTML;
    
    let successCount = 0;
    let errorCount = 0;
    
    try {
        // Show loading state
        btn.innerHTML = '<span class="btn-spinner"></span><span class="btn-text">Importing...</span>';
        btn.classList.add('btn-loading');
        btn.disabled = true;
        
        importProgress.classList.remove('hidden');
        importProgress.textContent = `Importing... 0/${membersArray.length}`;
        
        for (let i = 0; i < membersArray.length; i++) {
            const member = membersArray[i];
            try {
                await addDoc(collection(db, "members"), {
                    fullName: member.fullName,
                    email: member.email || '',
                    phone: member.phone,
                    gender: member.gender || '',
                    fellowship: member.fellowship || '',
                    area: member.area || '',
                    occupation: member.occupation || '',
                    address: member.address || '',
                    registeredDate: new Date().toISOString(),
                    createdAt: Timestamp.now(),
                    isActive: true
                });
                successCount++;
                importProgress.textContent = `Importing... ${i + 1}/${membersArray.length}`;
            } catch (error) {
                errorCount++;
                console.error(`Error importing member ${member.fullName}:`, error);
            }
        }
        
        importProgress.classList.add('hidden');
        showToast(`Import complete! ${successCount} added, ${errorCount} failed.`, successCount > 0 ? 'success' : 'error');
        
        if (successCount > 0) {
            await loadMembers();
        }
        
        // Reset button
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        
        return { successCount, errorCount };
    } catch (error) {
        console.error('Bulk import error:', error);
        showToast('Error during bulk import', 'error');
        
        // Reset button
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        importProgress.classList.add('hidden');
        
        return { successCount, errorCount };
    }
}

// Parse CSV string to array
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const requiredFields = ['fullname', 'phone'];
    
    const members = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const member = {};
        headers.forEach((header, index) => {
            member[header] = values[index] ? values[index].trim() : '';
        });
        
        // Validate required fields
        if (member.fullname && member.phone) {
            members.push(member);
        }
    }
    return members;
}

// Parse CSV line (handles quoted values)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

// Preview CSV data
function previewCSVData() {
    const csvText = csvData.value;
    if (!csvText.trim()) {
        csvPreview.innerHTML = '<p class="text-gray-400 text-center">No data loaded yet.</p>';
        return;
    }
    
    const members = parseCSV(csvText);
    if (members.length === 0) {
        csvPreview.innerHTML = '<p class="text-red-500 text-center">Invalid CSV format. Please check headers.</p>';
        return;
    }
    
    let html = '<table class="min-w-full text-xs"><thead><tr class="bg-gray-200">';
    const headers = Object.keys(members[0]);
    headers.forEach(h => { html += `<th class="px-2 py-1 text-left">${h}</th>`; });
    html += '</tr></thead><tbody>';
    
    members.slice(0, 5).forEach(m => {
        html += '<tr>';
        headers.forEach(h => { html += `<td class="px-2 py-1 border">${escapeHtml(m[h] || '—')}</td>`; });
        html += '</tr>';
    });
    
    if (members.length > 5) {
        html += `<tr><td colspan="${headers.length}" class="px-2 py-2 text-gray-400 text-center">+ ${members.length - 5} more members</td></tr>`;
    }
    
    html += '</tbody></table>';
    html += `<p class="mt-2 text-sm font-semibold text-emerald-600">Total: ${members.length} members ready to import</p>`;
    csvPreview.innerHTML = html;
    
    return members;
}

// Handle file upload
function handleFileUpload(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        csvData.value = e.target.result;
        previewCSVData();
    };
    reader.readAsText(file);
}

// Setup event listeners
function setupEventListeners() {
    // Single form
    document.getElementById('showSingleFormBtn').addEventListener('click', () => {
        singleFormContainer.classList.remove('hidden');
        bulkImportContainer.classList.add('hidden');
    });
    
    document.getElementById('hideSingleForm').addEventListener('click', () => {
        singleFormContainer.classList.add('hidden');
    });
    
    document.getElementById('showBulkImportBtn').addEventListener('click', () => {
        bulkImportContainer.classList.remove('hidden');
        singleFormContainer.classList.add('hidden');
    });
    
    document.getElementById('hideBulkImport').addEventListener('click', () => {
        bulkImportContainer.classList.add('hidden');
    });
    
    // Single member form submit
    document.getElementById('singleMemberForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const memberData = {
            fullName: document.getElementById('fullName').value.trim(),
            email: document.getElementById('email').value.trim(),
            phone: document.getElementById('phone').value.trim(),
            gender: document.getElementById('gender').value,
            fellowship: document.getElementById('fellowship').value,
            area: document.getElementById('area').value,
            occupation: document.getElementById('occupation').value,
            address: document.getElementById('address').value
        };
        
        if (!memberData.fullName || !memberData.phone) {
            showToast('Please fill in all required fields (*)', 'error');
            return;
        }
        
        await addSingleMember(memberData);
        e.target.reset();
        singleFormContainer.classList.add('hidden');
    });
    
    // CSV data input preview
    csvData.addEventListener('input', () => previewCSVData());
    
    // File upload
    csvFile.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFileUpload(e.target.files[0]);
    });
    
    // Download template
    document.getElementById('downloadTemplateBtn').addEventListener('click', () => {
        const template = 'fullName,email,phone,gender,fellowship,area,occupation,address\nJohn Doe,john@example.com,0241234567,Male,Men\'s Fellowship,East Legon,Engineer,123 Main St\nJane Smith,jane@example.com,0241234568,Female,Women\'s Fellowship,Adenta,Teacher,456 High St';
        const blob = new Blob([template], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'members_template.csv';
        a.click();
        URL.revokeObjectURL(url);
    });
    
    // Process bulk import
    document.getElementById('processBulkImport').addEventListener('click', async () => {
        const members = parseCSV(csvData.value);
        if (members.length === 0) {
            showToast('No valid members found in CSV data', 'error');
            return;
        }
        
        if (confirm(`Import ${members.length} members? This may take a moment.`)) {
            await bulkImportMembers(members);
            bulkImportContainer.classList.add('hidden');
            csvData.value = '';
            csvFile.value = '';
            csvPreview.innerHTML = '<p class="text-gray-400 text-center">No data loaded yet.</p>';
        }
    });
    
    // Search and filter
    searchInput.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        currentPage = 1;
        filterAndRender();
    });
    
    filterFellowship.addEventListener('change', (e) => {
        currentFilter = e.target.value;
        currentPage = 1;
        filterAndRender();
    });
    
    // Export
    document.getElementById('exportBtn').addEventListener('click', () => {
        exportToCSV();
    });
    
    // Print
    document.getElementById('printBtn').addEventListener('click', () => {
        window.print();
    });
}

// Export to CSV
function exportToCSV() {
    const headers = ['Full Name', 'Email', 'Phone', 'Gender', 'Fellowship', 'Area', 'Occupation', 'Address', 'Registered Date'];
    const rows = allMembers.map(m => [
        m.fullName,
        m.email || '',
        m.phone,
        m.gender || '',
        m.fellowship || '',
        m.area || '',
        m.occupation || '',
        m.address || '',
        m.registeredDate ? new Date(m.registeredDate).toLocaleDateString() : ''
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rgci_members_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export complete! ✅', 'success');
}

// Global functions for inline buttons
window.deleteMember = async (id) => {
    if (confirm('Are you sure you want to delete this member? This action cannot be undone.')) {
        try {
            await deleteDoc(doc(db, "members", id));
            showToast('Member deleted successfully', 'success');
            await loadMembers();
        } catch (error) {
            showToast('Error deleting member', 'error');
        }
    }
};

window.viewMember = (id) => {
    const member = allMembers.find(m => m.id === id);
    if (member) {
        alert(`Member Details:\n\nName: ${member.fullName}\nPhone: ${member.phone}\nEmail: ${member.email || 'N/A'}\nFellowship: ${member.fellowship || 'General'}\nArea: ${member.area || 'N/A'}\nOccupation: ${member.occupation || 'N/A'}`);
    }
};

window.editMember = (id) => {
    showToast('Edit feature coming soon', 'info');
};

window.goToPage = (page) => {
    currentPage = page;
    filterAndRender();
};

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initMembersPage);

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