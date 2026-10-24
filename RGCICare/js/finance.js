import { db, collection, addDoc, getDocs, query, orderBy, where, Timestamp, doc, deleteDoc, updateDoc } from './firebase-config.js';
import { 
    showToast, 
    protectPage, 
    updateUserDisplay,
    getCurrentUserRole,
    logoutUser
} from './auth.js';

// State variables
let allOfferings = [];
let allExpenses = [];
let allMembers = [];
let chart1 = null;
let chart2 = null;
let currentUserData = null;

// DOM Elements
const loadingState = document.getElementById('loadingState');
const financeContent = document.getElementById('financeContent');

// Initialize
export async function initFinancePage() {
    try {
        // Protect page - requires authentication
        const userData = await protectPage('finance');
        
        if (!userData) {
            return;
        }
        
        currentUserData = userData;
        
        // Update user display
        updateUserDisplay(userData);
        
        // Load data
        await loadMembers();
        await loadOfferings();
        await loadExpenses();
        
        setupEventListeners();
        updateStatsAndCharts();
        
        // Setup logout listener
        setupLogoutListener();
        
        loadingState.classList.add('hidden');
        financeContent.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error initializing finance page:', error);
        showToast('Error loading finance page', 'error');
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

// Load members for dropdown
async function loadMembers() {
    try {
        const snapshot = await getDocs(collection(db, "members"));
        allMembers = [];
        snapshot.forEach(doc => {
            allMembers.push({ id: doc.id, ...doc.data() });
        });
        
        const memberSelect = document.getElementById('offeringMember');
        if (memberSelect) {
            memberSelect.innerHTML = '<option value="">Select Member</option>' + 
                allMembers.map(m => `<option value="${m.id}">${escapeHtml(m.fullName)}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

// Load offerings
async function loadOfferings() {
    try {
        const q = query(collection(db, "offerings"), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        allOfferings = [];
        snapshot.forEach(doc => {
            allOfferings.push({ id: doc.id, ...doc.data() });
        });
        renderRecentOfferings();
        updateOfferingsSummary();
    } catch (error) {
        console.error('Error loading offerings:', error);
    }
}

// Load expenses
async function loadExpenses() {
    try {
        const q = query(collection(db, "expenses"), orderBy("date", "desc"));
        const snapshot = await getDocs(q);
        allExpenses = [];
        snapshot.forEach(doc => {
            allExpenses.push({ id: doc.id, ...doc.data() });
        });
        renderRecentExpenses();
        updateExpensesSummary();
    } catch (error) {
        console.error('Error loading expenses:', error);
    }
}

// Update stats and charts
function updateStatsAndCharts() {
    const totalIncome = allOfferings.reduce((sum, o) => sum + (o.amount || 0), 0);
    const totalExpenses = allExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netBalance = totalIncome - totalExpenses;
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyIncome = allOfferings.filter(o => {
        if (!o.date || !o.date.toDate) return false;
        const d = o.date.toDate();
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).reduce((sum, o) => sum + (o.amount || 0), 0);
    
    document.getElementById('totalIncome').textContent = `GH₵ ${totalIncome.toFixed(2)}`;
    document.getElementById('totalExpenses').textContent = `GH₵ ${totalExpenses.toFixed(2)}`;
    document.getElementById('netBalance').textContent = `GH₵ ${netBalance.toFixed(2)}`;
    document.getElementById('monthlyIncome').textContent = `GH₵ ${monthlyIncome.toFixed(2)}`;
    
    updateCharts(totalIncome, totalExpenses);
    renderRecentTransactions();
}

// Update charts
function updateCharts(totalIncome, totalExpenses) {
    const ctx1 = document.getElementById('incomeExpenseChart')?.getContext('2d');
    const ctx2 = document.getElementById('monthlyTrendChart')?.getContext('2d');
    
    if (ctx1) {
        if (chart1) chart1.destroy();
        chart1 = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: ['Income', 'Expenses'],
                datasets: [{
                    data: [totalIncome, totalExpenses],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
    
    if (ctx2) {
        const monthlyData = getMonthlyData();
        if (chart2) chart2.destroy();
        chart2 = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: monthlyData.labels,
                datasets: [
                    { label: 'Income', data: monthlyData.income, borderColor: '#10b981', backgroundColor: 'transparent', tension: 0.4 },
                    { label: 'Expenses', data: monthlyData.expenses, borderColor: '#ef4444', backgroundColor: 'transparent', tension: 0.4 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: true }
        });
    }
}

function getMonthlyData() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const incomeData = new Array(12).fill(0);
    const expenseData = new Array(12).fill(0);
    
    allOfferings.forEach(o => {
        if (o.date && o.date.toDate) {
            const month = o.date.toDate().getMonth();
            incomeData[month] += (o.amount || 0);
        }
    });
    
    allExpenses.forEach(e => {
        if (e.date && e.date.toDate) {
            const month = e.date.toDate().getMonth();
            expenseData[month] += (e.amount || 0);
        }
    });
    
    return { labels: months, income: incomeData, expenses: expenseData };
}

// Render recent transactions
function renderRecentTransactions() {
    const container = document.getElementById('recentTransactions');
    const allTransactions = [
        ...allOfferings.map(o => ({ ...o, type: 'income', category: o.transactionType })),
        ...allExpenses.map(e => ({ ...e, type: 'expense', category: e.category }))
    ].sort((a, b) => {
        const dateA = a.date?.toDate ? a.date.toDate() : new Date(0);
        const dateB = b.date?.toDate ? b.date.toDate() : new Date(0);
        return dateB - dateA;
    }).slice(0, 10);
    
    if (allTransactions.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400">No transactions yet</div>';
        return;
    }
    
    container.innerHTML = allTransactions.map(t => `
        <div class="flex justify-between items-center p-3 hover:bg-gray-50 transition">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 ${t.type === 'income' ? 'bg-emerald-100' : 'bg-red-100'} rounded-lg flex items-center justify-center">
                    <i class="fas ${t.type === 'income' ? 'fa-arrow-down text-emerald-600' : 'fa-arrow-up text-red-600'}"></i>
                </div>
                <div>
                    <p class="font-medium text-gray-800">${escapeHtml(t.memberName || t.description || t.category)}</p>
                    <p class="text-xs text-gray-400">${formatDate(t.date)} • ${escapeHtml(t.type === 'income' ? t.transactionType : t.category)}</p>
                </div>
            </div>
            <div class="text-right">
                <p class="font-bold ${t.type === 'income' ? 'text-emerald-600' : 'text-red-600'}">${t.type === 'income' ? '+' : '-'} GH₵ ${(t.amount || 0).toFixed(2)}</p>
            </div>
        </div>
    `).join('');
}

// Render recent offerings
function renderRecentOfferings() {
    const container = document.getElementById('recentOfferingsList');
    if (allOfferings.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400">No offerings recorded yet</div>';
        return;
    }
    
    container.innerHTML = allOfferings.slice(0, 10).map(o => `
        <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <div>
                <p class="font-medium text-gray-800">${escapeHtml(o.memberName || 'Unknown')}</p>
                <p class="text-xs text-gray-500">${escapeHtml(o.transactionType)} • ${formatDate(o.date)}</p>
            </div>
            <div class="text-right">
                <p class="font-bold text-emerald-600">GH₵ ${(o.amount || 0).toFixed(2)}</p>
                <p class="text-xs text-gray-400">${escapeHtml(o.paymentMethod || 'cash')}</p>
            </div>
        </div>
    `).join('');
}

// Update offerings summary by type
function updateOfferingsSummary() {
    const sums = { tithe: 0, offering: 0, special: 0, building: 0, missions: 0 };
    allOfferings.forEach(o => {
        const type = o.transactionType?.toLowerCase() || '';
        if (sums[type] !== undefined) sums[type] += (o.amount || 0);
    });
    
    document.getElementById('sumTithe').textContent = `GH₵ ${sums.tithe.toFixed(2)}`;
    document.getElementById('sumOffering').textContent = `GH₵ ${sums.offering.toFixed(2)}`;
    document.getElementById('sumSpecial').textContent = `GH₵ ${sums.special.toFixed(2)}`;
    document.getElementById('sumBuilding').textContent = `GH₵ ${sums.building.toFixed(2)}`;
    document.getElementById('sumMissions').textContent = `GH₵ ${sums.missions.toFixed(2)}`;
}

// Render recent expenses
function renderRecentExpenses() {
    const container = document.getElementById('recentExpensesList');
    if (allExpenses.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400">No expenses recorded yet</div>';
        return;
    }
    
    container.innerHTML = allExpenses.slice(0, 10).map(e => `
        <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <div>
                <p class="font-medium text-gray-800">${escapeHtml(e.description)}</p>
                <p class="text-xs text-gray-500">${escapeHtml(e.category)} • ${formatDate(e.date)}</p>
            </div>
            <div class="text-right">
                <p class="font-bold text-red-600">GH₵ ${(e.amount || 0).toFixed(2)}</p>
                <p class="text-xs text-gray-400">${escapeHtml(e.paidTo || '-')}</p>
            </div>
        </div>
    `).join('');
}

// Update expenses summary
function updateExpensesSummary() {
    const sums = { utilities: 0, salaries: 0, maintenance: 0, programs: 0 };
    allExpenses.forEach(e => {
        const cat = e.category?.toLowerCase() || '';
        if (cat === 'utilities') sums.utilities += (e.amount || 0);
        else if (cat === 'salaries') sums.salaries += (e.amount || 0);
        else if (cat === 'maintenance') sums.maintenance += (e.amount || 0);
        else if (cat === 'programs') sums.programs += (e.amount || 0);
    });
    
    document.getElementById('sumUtilities').textContent = `GH₵ ${sums.utilities.toFixed(2)}`;
    document.getElementById('sumSalaries').textContent = `GH₵ ${sums.salaries.toFixed(2)}`;
    document.getElementById('sumMaintenance').textContent = `GH₵ ${sums.maintenance.toFixed(2)}`;
    document.getElementById('sumPrograms').textContent = `GH₵ ${sums.programs.toFixed(2)}`;
}

// Add offering with loading state
async function addOffering(data) {
    const btn = document.getElementById('recordOfferingBtn');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<span class="btn-spinner"></span><span class="btn-text">Recording...</span>';
        btn.classList.add('btn-loading');
        btn.disabled = true;
        
        await addDoc(collection(db, "offerings"), {
            ...data,
            date: Timestamp.now(),
            createdAt: Timestamp.now()
        });
        showToast('Offering recorded successfully!', 'success');
        await loadOfferings();
        await loadExpenses();
        updateStatsAndCharts();
        
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        return true;
    } catch (error) {
        console.error('Error adding offering:', error);
        showToast('Error recording offering', 'error');
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        return false;
    }
}

// Add expense with loading state
async function addExpense(data) {
    const btn = document.getElementById('recordExpenseBtn');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<span class="btn-spinner"></span><span class="btn-text">Recording...</span>';
        btn.classList.add('btn-loading');
        btn.disabled = true;
        
        await addDoc(collection(db, "expenses"), {
            ...data,
            date: Timestamp.now(),
            createdAt: Timestamp.now()
        });
        showToast('Expense recorded successfully!', 'success');
        await loadExpenses();
        await loadOfferings();
        updateStatsAndCharts();
        
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        return true;
    } catch (error) {
        console.error('Error adding expense:', error);
        showToast('Error recording expense', 'error');
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        return false;
    }
}

// Generate report with loading state
function generateReport() {
    const btn = document.getElementById('generateReportBtn');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<span class="btn-spinner"></span><span class="btn-text">Generating...</span>';
        btn.classList.add('btn-loading');
        btn.disabled = true;
        
        const reportType = document.getElementById('reportType').value;
        const startDate = document.getElementById('reportStartDate').value;
        const endDate = document.getElementById('reportEndDate').value;
        const output = document.getElementById('reportOutput');
        
        let start = startDate ? new Date(startDate) : new Date(2000, 0, 1);
        let end = endDate ? new Date(endDate) : new Date();
        
        const filteredIncome = allOfferings.filter(o => {
            if (!o.date || !o.date.toDate) return false;
            const d = o.date.toDate();
            return d >= start && d <= end;
        });
        
        const filteredExpenses = allExpenses.filter(e => {
            if (!e.date || !e.date.toDate) return false;
            const d = e.date.toDate();
            return d >= start && d <= end;
        });
        
        const totalIncome = filteredIncome.reduce((s, i) => s + (i.amount || 0), 0);
        const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
        
        if (reportType === 'income') {
            output.innerHTML = `
                <h3 class="font-bold text-lg mb-3">Income Statement</h3>
                <p class="text-sm text-gray-500 mb-4">Period: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}</p>
                <table class="min-w-full"><thead><tr class="border-b"><th class="text-left py-2">Type</th><th class="text-right py-2">Amount</th></tr></thead><tbody>
                ${filteredIncome.reduce((acc, i) => {
                    const existing = acc.find(a => a.type === i.transactionType);
                    if (existing) existing.amount += (i.amount || 0);
                    else acc.push({ type: i.transactionType, amount: i.amount || 0 });
                    return acc;
                }, []).map(g => `<tr class="border-b"><td class="py-2">${escapeHtml(g.type)}</td><td class="text-right">GH₵ ${g.amount.toFixed(2)}</td></tr>`).join('')}
                <tr class="border-t font-bold"><td class="py-2">Total Income</td><td class="text-right">GH₵ ${totalIncome.toFixed(2)}</td></tr>
                </tbody></table>
            `;
        } else if (reportType === 'expense') {
            output.innerHTML = `
                <h3 class="font-bold text-lg mb-3">Expense Report</h3>
                <p class="text-sm text-gray-500 mb-4">Period: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}</p>
                <table class="min-w-full"><thead><tr class="border-b"><th class="text-left py-2">Category</th><th class="text-right py-2">Amount</th></tr></thead><tbody>
                ${filteredExpenses.reduce((acc, e) => {
                    const existing = acc.find(a => a.category === e.category);
                    if (existing) existing.amount += (e.amount || 0);
                    else acc.push({ category: e.category, amount: e.amount || 0 });
                    return acc;
                }, []).map(g => `<tr class="border-b"><td class="py-2">${escapeHtml(g.category)}</td><td class="text-right">GH₵ ${g.amount.toFixed(2)}</td></tr>`).join('')}
                <tr class="border-t font-bold"><td class="py-2">Total Expenses</td><td class="text-right">GH₵ ${totalExpenses.toFixed(2)}</td></tr>
                </tbody></table>
            `;
        } else if (reportType === 'balance') {
            output.innerHTML = `
                <h3 class="font-bold text-lg mb-3">Balance Sheet</h3>
                <p class="text-sm text-gray-500 mb-4">As of ${end.toLocaleDateString()}</p>
                <div class="grid grid-cols-2 gap-4"><div class="bg-green-50 p-4 rounded-lg"><p class="text-gray-500">Total Income</p><p class="text-2xl font-bold text-green-600">GH₵ ${totalIncome.toFixed(2)}</p></div><div class="bg-red-50 p-4 rounded-lg"><p class="text-gray-500">Total Expenses</p><p class="text-2xl font-bold text-red-600">GH₵ ${totalExpenses.toFixed(2)}</p></div></div>
                <div class="mt-4 p-4 bg-purple-50 rounded-lg"><p class="text-gray-500">Net Balance</p><p class="text-3xl font-bold text-purple-600">GH₵ ${(totalIncome - totalExpenses).toFixed(2)}</p></div>
            `;
        } else if (reportType === 'member') {
            output.innerHTML = `
                <h3 class="font-bold text-lg mb-3">Member Giving Report</h3>
                <p class="text-sm text-gray-500 mb-4">Period: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}</p>
                <table class="min-w-full"><thead><tr class="border-b"><th class="text-left py-2">Member</th><th class="text-right py-2">Total Given</th></tr></thead><tbody>
                ${filteredIncome.reduce((acc, i) => {
                    const existing = acc.find(a => a.member === i.memberName);
                    if (existing) existing.amount += (i.amount || 0);
                    else acc.push({ member: i.memberName || 'Unknown', amount: i.amount || 0 });
                    return acc;
                }, []).sort((a, b) => b.amount - a.amount).map(g => `<tr class="border-b"><td class="py-2">${escapeHtml(g.member)}</td><td class="text-right">GH₵ ${g.amount.toFixed(2)}</td></tr>`).join('')}
                </tbody></table>
            `;
        }
        
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        
    } catch (error) {
        console.error('Error generating report:', error);
        showToast('Error generating report', 'error');
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
    }
}

// Export to CSV
function exportToCSV() {
    const reportType = document.getElementById('reportType').value;
    const startDate = document.getElementById('reportStartDate').value;
    const endDate = document.getElementById('reportEndDate').value;
    
    let start = startDate ? new Date(startDate) : new Date(2000, 0, 1);
    let end = endDate ? new Date(endDate) : new Date();
    
    const filteredIncome = allOfferings.filter(o => {
        if (!o.date || !o.date.toDate) return false;
        const d = o.date.toDate();
        return d >= start && d <= end;
    });
    
    const headers = ['Date', 'Type', 'Member', 'Amount', 'Payment Method', 'Notes'];
    const rows = filteredIncome.map(o => [
        formatDate(o.date),
        o.transactionType,
        o.memberName || '',
        o.amount || 0,
        o.paymentMethod || '',
        o.notes || ''
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial_report_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export complete!', 'success');
}

// Setup event listeners
function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active', 'text-[#6a1b9a]', 'font-semibold'));
            btn.classList.add('tab-active', 'text-[#6a1b9a]', 'font-semibold');
            document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
            document.getElementById(`tab-${tabId}`).classList.remove('hidden');
        });
    });
    
    // Offering form
    document.getElementById('offeringForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const memberId = document.getElementById('offeringMember').value;
        const member = allMembers.find(m => m.id === memberId);
        
        const offeringData = {
            transactionType: document.getElementById('transactionType').value,
            memberId: memberId,
            memberName: member?.fullName || 'Unknown',
            amount: parseFloat(document.getElementById('offeringAmount').value),
            paymentMethod: document.getElementById('paymentMethod').value,
            notes: document.getElementById('offeringNotes').value
        };
        
        if (!offeringData.amount || offeringData.amount <= 0) {
            showToast('Please enter a valid amount', 'error');
            return;
        }
        
        await addOffering(offeringData);
        e.target.reset();
    });
    
    // Expense form
    document.getElementById('expenseForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const expenseData = {
            category: document.getElementById('expenseCategory').value,
            description: document.getElementById('expenseDescription').value,
            amount: parseFloat(document.getElementById('expenseAmount').value),
            paidTo: document.getElementById('expensePaidTo').value,
            paymentMethod: document.getElementById('expensePaymentMethod').value
        };
        
        if (!expenseData.category || !expenseData.description || !expenseData.amount || expenseData.amount <= 0) {
            showToast('Please fill in all required fields', 'error');
            return;
        }
        
        await addExpense(expenseData);
        e.target.reset();
    });
    
    // Report generation
    document.getElementById('generateReportBtn')?.addEventListener('click', generateReport);
    document.getElementById('exportReportBtn')?.addEventListener('click', exportToCSV);
    document.getElementById('printReportBtn')?.addEventListener('click', () => {
        const reportOutput = document.getElementById('reportOutput');
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html><head><title>Financial Report</title>
            <style>body{font-family:Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:left}</style>
            </head><body>${reportOutput.innerHTML}</body></html>
        `);
        printWindow.document.close();
        printWindow.print();
    });
    
    // View all transactions
    document.getElementById('viewAllTransactions')?.addEventListener('click', () => {
        document.querySelector('.tab-btn[data-tab="offerings"]').click();
    });
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

// Initialize
document.addEventListener('DOMContentLoaded', initFinancePage);

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