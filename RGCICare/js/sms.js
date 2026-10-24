import { db, collection, addDoc, getDocs, query, orderBy, where, Timestamp, doc, deleteDoc, updateDoc, limit } from './firebase-config.js';
import { 
    showToast, 
    protectPage, 
    updateUserDisplay,
    getCurrentUserRole,
    logoutUser
} from './auth.js';

// ============================================
// ARKESEL SMS INTEGRATION - Cloudflare Worker
// ============================================

// Cloudflare Worker URL
const WORKER_URL = 'https://rgci-sms-api.rgcinternational001.workers.dev/api/sms';

// SMS Settings
let smsSettings = {
    senderId: 'RGCI',
    useCase: 'transactional',
    callbackUrl: '',
    apiConfigured: false,
};

// State variables
let allMembers = [];
let allMessages = [];
let allTemplates = [];
let allScheduled = [];
let currentHistoryPage = 1;
const historyItemsPerPage = 20;
let currentUserData = null;
let smsBalance = 0;

// DOM Elements
const loadingState = document.getElementById('loadingState');
const smsContent = document.getElementById('smsContent');

// ============================================
// INITIALIZATION
// ============================================

export async function initSMSPage() {
    try {
        const userData = await protectPage('sms');
        
        if (!userData) {
            return;
        }
        
        currentUserData = userData;
        
        updateUserDisplay(userData);
        
        loadSmsSettings();
        
        await loadMembers();
        await loadMessages();
        await loadTemplates();
        await loadScheduledMessages();
        
        await checkSmsBalance();
        
        setupEventListeners();
        updateStats();
        setupLogoutListener();
        
        loadingState.classList.add('hidden');
        smsContent.classList.remove('hidden');
        
        // Update preview on load
        updatePreview();
        
    } catch (error) {
        console.error('Error initializing SMS page:', error);
        showToast('Error loading SMS page', 'error');
    }
}

// ============================================
// LOGOUT LISTENER
// ============================================

function setupLogoutListener() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            await logoutUser();
        });
    }
}

// ============================================
// INSERT VARIABLE FUNCTION
// ============================================

window.insertVariable = function(variable) {
    const textarea = document.getElementById('messageContent');
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    textarea.value = text.substring(0, start) + variable + text.substring(end);
    textarea.focus();
    textarea.selectionStart = textarea.selectionEnd = start + variable.length;
    const event = new Event('input', { bubbles: true });
    textarea.dispatchEvent(event);
    updatePreview();
};

// ============================================
// SMS SETTINGS FUNCTIONS
// ============================================

function loadSmsSettings() {
    const saved = localStorage.getItem('smsSettings');
    if (saved) {
        try {
            smsSettings = JSON.parse(saved);
            const senderIdEl = document.getElementById('senderId');
            const useCaseEl = document.getElementById('useCase');
            const callbackUrlEl = document.getElementById('callbackUrl');
            if (senderIdEl) senderIdEl.value = smsSettings.senderId || 'RGCI';
            if (useCaseEl) useCaseEl.value = smsSettings.useCase || 'transactional';
            if (callbackUrlEl) callbackUrlEl.value = smsSettings.callbackUrl || '';
        } catch (e) {
            console.error('Error loading SMS settings:', e);
        }
    }
}

function saveSmsSettings() {
    const senderIdEl = document.getElementById('senderId');
    const useCaseEl = document.getElementById('useCase');
    const callbackUrlEl = document.getElementById('callbackUrl');
    
    smsSettings.senderId = senderIdEl?.value || 'RGCI';
    smsSettings.useCase = useCaseEl?.value || 'transactional';
    smsSettings.callbackUrl = callbackUrlEl?.value || '';
    localStorage.setItem('smsSettings', JSON.stringify(smsSettings));
    showToast('Settings saved successfully!', 'success');
}

// ============================================
// ARKESEL API FUNCTIONS
// ============================================

async function checkSmsBalance() {
    try {
        const response = await fetch(`${WORKER_URL}/balance`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        });
        
        const data = await response.json();
        
        if (data.success) {
            smsBalance = data.balance || 0;
            
            const balanceEl = document.getElementById('creditsLeft');
            if (balanceEl) {
                balanceEl.textContent = smsBalance;
            }
            
            const balanceDisplay = document.getElementById('balanceDisplay');
            if (balanceDisplay) {
                balanceDisplay.innerHTML = `Balance: <strong>${smsBalance}</strong> credits`;
            }
            
            const statusEl = document.getElementById('connectionStatus');
            if (statusEl) {
                statusEl.innerHTML = `
                    <span class="w-3 h-3 bg-green-500 rounded-full inline-block"></span>
                    <span class="text-sm font-medium">Connected</span>
                `;
            }
            
            return smsBalance;
        } else {
            console.error('Balance check failed:', data.error);
            const statusEl = document.getElementById('connectionStatus');
            if (statusEl) {
                statusEl.innerHTML = `
                    <span class="w-3 h-3 bg-red-500 rounded-full inline-block"></span>
                    <span class="text-sm font-medium">Error</span>
                `;
            }
            return 0;
        }
    } catch (error) {
        console.error('Balance check error:', error);
        const statusEl = document.getElementById('connectionStatus');
        if (statusEl) {
            statusEl.innerHTML = `
                <span class="w-3 h-3 bg-yellow-500 rounded-full inline-block"></span>
                <span class="text-sm font-medium">Offline</span>
            `;
        }
        return 0;
    }
}

async function sendSmsViaArkesel(recipients, message, senderId, scheduledDate = null, useCase = null) {
    try {
        const recipientArray = Array.isArray(recipients) ? recipients : [recipients];
        const validRecipients = recipientArray.filter(p => p && p.trim());
        
        if (validRecipients.length === 0) {
            return { success: false, error: 'No valid phone numbers provided' };
        }
        
        const payload = {
            recipients: validRecipients,
            message: message,
            sender: senderId || smsSettings.senderId || 'RGCI',
            use_case: useCase || smsSettings.useCase || 'transactional',
        };
        
        if (scheduledDate) {
            payload.scheduled_date = scheduledDate;
        }
        
        if (smsSettings.callbackUrl) {
            payload.callback_url = smsSettings.callbackUrl;
        }
        
        const endpoint = scheduledDate ? `${WORKER_URL}/schedule` : `${WORKER_URL}/send`;
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });
        
        const data = await response.json();
        
        if (data.success) {
            await checkSmsBalance();
            
            return { 
                success: true, 
                data: data.data, 
                recipientCount: data.recipientCount || validRecipients.length,
                messageId: data.data?.data?.[0]?.id || null,
                response: data,
            };
        } else {
            return { 
                success: false, 
                error: data.error?.message || data.message || 'Failed to send SMS',
                code: data.error?.code || 'UNKNOWN_ERROR',
            };
        }
    } catch (error) {
        console.error('Send SMS error:', error);
        return { success: false, error: 'Failed to connect to SMS service' };
    }
}

async function sendTestSms() {
    const testNumber = prompt('Enter a phone number to send test SMS to (e.g., 0241234567):', '0241234567');
    if (!testNumber) return;
    
    const testMessage = prompt('Enter test message:', 'This is a test SMS from RGCI Church Management System.');
    if (!testMessage) return;
    
    const result = await sendSmsViaArkesel([testNumber], testMessage);
    
    if (result.success) {
        showToast(`Test SMS sent successfully to ${testNumber}! 📱`, 'success');
    } else {
        showToast(`Failed to send test SMS: ${result.error}`, 'error');
    }
}

// ============================================
// LOAD FUNCTIONS
// ============================================

async function loadMembers() {
    try {
        const snapshot = await getDocs(collection(db, "members"));
        allMembers = [];
        snapshot.forEach(doc => {
            allMembers.push({ id: doc.id, ...doc.data() });
        });
        
        const individualSelect = document.getElementById('individualMembers');
        if (individualSelect) {
            individualSelect.innerHTML = allMembers.map(m => 
                `<option value="${m.id}">${escapeHtml(m.fullName)} - ${escapeHtml(m.phone || 'No phone')}</option>`
            ).join('');
        }
        
        updateRecipientCount();
    } catch (error) {
        console.error('Error loading members:', error);
    }
}

async function loadMessages() {
    try {
        const q = query(collection(db, "communications"), orderBy("sentAt", "desc"));
        const snapshot = await getDocs(q);
        allMessages = [];
        snapshot.forEach(doc => {
            allMessages.push({ id: doc.id, ...doc.data() });
        });
        renderMessageHistory();
        updateStats();
    } catch (error) {
        console.error('Error loading messages:', error);
    }
}

async function loadTemplates() {
    try {
        const snapshot = await getDocs(collection(db, "sms_templates"));
        allTemplates = [];
        snapshot.forEach(doc => {
            allTemplates.push({ id: doc.id, ...doc.data() });
        });
        renderTemplates();
    } catch (error) {
        console.error('Error loading templates:', error);
    }
}

async function loadScheduledMessages() {
    try {
        const q = query(collection(db, "scheduled_messages"), orderBy("scheduledFor", "asc"));
        const snapshot = await getDocs(q);
        allScheduled = [];
        snapshot.forEach(doc => {
            allScheduled.push({ id: doc.id, ...doc.data() });
        });
        renderScheduledMessages();
        updateStats();
    } catch (error) {
        console.error('Error loading scheduled messages:', error);
    }
}

// ============================================
// STATISTICS FUNCTIONS
// ============================================

function updateStats() {
    const totalSentEl = document.getElementById('totalSent');
    if (totalSentEl) totalSentEl.textContent = allMessages.length;
    
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyMessages = allMessages.filter(m => {
        if (!m.sentAt || !m.sentAt.toDate) return false;
        const d = m.sentAt.toDate();
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
    const monthlySentEl = document.getElementById('monthlySent');
    if (monthlySentEl) monthlySentEl.textContent = monthlyMessages.length;
    
    const subscribers = allMembers.filter(m => m.phone && m.phone.trim()).length;
    const activeSubscribersEl = document.getElementById('activeSubscribers');
    if (activeSubscribersEl) activeSubscribersEl.textContent = subscribers;
    
    const scheduledCountEl = document.getElementById('scheduledCount');
    if (scheduledCountEl) scheduledCountEl.textContent = allScheduled.length;
}

function updateRecipientCount() {
    const recipientType = document.getElementById('recipientType').value;
    let count = 0;
    
    if (recipientType === 'all') {
        count = allMembers.filter(m => m.phone).length;
    } else if (recipientType === 'fellowship') {
        const fellowship = document.getElementById('fellowshipFilter').value;
        if (fellowship) {
            count = allMembers.filter(m => m.fellowship === fellowship && m.phone).length;
        }
    } else if (recipientType === 'individual') {
        const selected = Array.from(document.getElementById('individualMembers').selectedOptions);
        count = selected.length;
    } else if (recipientType === 'leaders') {
        count = allMembers.filter(m => ['Pastor', 'Elder', 'Deacon'].includes(m.role) && m.phone).length;
    } else if (recipientType === 'visitors') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        count = allMembers.filter(m => m.registeredDate && new Date(m.registeredDate) > thirtyDaysAgo && m.phone).length;
    }
    
    const countEl = document.getElementById('recipientCountNum');
    if (countEl) countEl.textContent = count;
}

// ============================================
// RECIPIENT FUNCTIONS
// ============================================

function getRecipients() {
    const recipientType = document.getElementById('recipientType').value;
    let recipients = [];
    
    if (recipientType === 'all') {
        recipients = allMembers.filter(m => m.phone).map(m => ({ 
            id: m.id, 
            name: m.fullName, 
            phone: m.phone,
            email: m.email || '',
            fellowship: m.fellowship || '',
            area: m.area || '',
            occupation: m.occupation || ''
        }));
    } else if (recipientType === 'fellowship') {
        const fellowship = document.getElementById('fellowshipFilter').value;
        if (fellowship) {
            recipients = allMembers.filter(m => m.fellowship === fellowship && m.phone).map(m => ({ 
                id: m.id, 
                name: m.fullName, 
                phone: m.phone,
                email: m.email || '',
                fellowship: m.fellowship || '',
                area: m.area || '',
                occupation: m.occupation || ''
            }));
        }
    } else if (recipientType === 'individual') {
        const selected = Array.from(document.getElementById('individualMembers').selectedOptions);
        recipients = selected.map(opt => {
            const member = allMembers.find(m => m.id === opt.value);
            return member ? { 
                id: member.id, 
                name: member.fullName, 
                phone: member.phone,
                email: member.email || '',
                fellowship: member.fellowship || '',
                area: member.area || '',
                occupation: member.occupation || ''
            } : null;
        }).filter(r => r && r.phone);
    } else if (recipientType === 'leaders') {
        recipients = allMembers.filter(m => ['Pastor', 'Elder', 'Deacon'].includes(m.role) && m.phone).map(m => ({ 
            id: m.id, 
            name: m.fullName, 
            phone: m.phone,
            email: m.email || '',
            fellowship: m.fellowship || '',
            area: m.area || '',
            occupation: m.occupation || ''
        }));
    } else if (recipientType === 'visitors') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        recipients = allMembers.filter(m => m.registeredDate && new Date(m.registeredDate) > thirtyDaysAgo && m.phone).map(m => ({ 
            id: m.id, 
            name: m.fullName, 
            phone: m.phone,
            email: m.email || '',
            fellowship: m.fellowship || '',
            area: m.area || '',
            occupation: m.occupation || ''
        }));
    }
    
    return recipients;
}

// ============================================
// SEND MESSAGE FUNCTIONS
// ============================================

async function sendMessage(recipients, subject, content, type, scheduledFor = null) {
    const btn = document.getElementById('sendNowBtn');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<span class="btn-spinner"></span><span class="btn-text">Sending...</span>';
        btn.classList.add('btn-loading');
        btn.disabled = true;
        
        const hasVariables = content.includes('{{') && content.includes('}}');
        const phoneNumbers = recipients.map(r => r.phone).filter(p => p && p.trim());
        
        if (phoneNumbers.length === 0) {
            showToast('No valid phone numbers found', 'error');
            btn.innerHTML = originalText;
            btn.classList.remove('btn-loading');
            btn.disabled = false;
            return;
        }
        
        let formattedSchedule = null;
        if (scheduledFor) {
            const date = new Date(scheduledFor);
            formattedSchedule = `${String(date.getDate()).padStart(2, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        }
        
        let result;
        let savedMessages = [];
        
        if (hasVariables) {
            let successCount = 0;
            let failCount = 0;
            let messageIds = [];
            
            showToast(`Sending ${phoneNumbers.length} personalized messages...`, 'info');
            
            for (let i = 0; i < recipients.length; i++) {
                const recipient = recipients[i];
                if (!recipient.phone || !recipient.phone.trim()) continue;
                
                const personalizedContent = processContent(content, {
                    name: recipient.name || 'Beloved',
                    phone: recipient.phone || '',
                    email: recipient.email || '',
                    id: recipient.id || '',
                    fellowship: recipient.fellowship || 'General',
                    area: recipient.area || '',
                    occupation: recipient.occupation || ''
                });
                
                // Save each personalized message to Firestore
                const messageData = {
                    recipients: [recipient],
                    recipientCount: 1,
                    content: personalizedContent,
                    type: type || 'announcement',
                    status: scheduledFor ? 'scheduled' : 'sent',
                    sentAt: scheduledFor ? null : Timestamp.now(),
                    scheduledFor: scheduledFor ? Timestamp.fromDate(new Date(scheduledFor)) : null,
                    provider: 'ProfJero SMS',
                    personalized: true,
                    recipientName: recipient.name,
                    recipientPhone: recipient.phone,
                };
                
                try {
                    const docRef = await addDoc(collection(db, "communications"), messageData);
                    savedMessages.push({ id: docRef.id, ...messageData });
                } catch (firestoreError) {
                    console.warn('Could not save to Firestore:', firestoreError);
                }
                
                // Send via Arkesel
                const singleResult = await sendSmsViaArkesel(
                    [recipient.phone],
                    personalizedContent,
                    null,
                    formattedSchedule,
                    null
                );
                
                if (singleResult.success) {
                    successCount++;
                    if (singleResult.messageId) {
                        messageIds.push(singleResult.messageId);
                    }
                } else {
                    failCount++;
                    console.error(`Failed to send to ${recipient.phone}:`, singleResult.error);
                }
                
                if ((i + 1) % 5 === 0 || i === recipients.length - 1) {
                    btn.innerHTML = `<span class="btn-spinner"></span><span class="btn-text">Sending ${i + 1}/${phoneNumbers.length}...</span>`;
                }
            }
            
            result = {
                success: successCount > 0,
                recipientCount: successCount,
                data: { successCount, failCount, messageIds },
                messageId: messageIds[0] || null,
            };
            
            if (successCount > 0) {
                showToast(`✅ ${successCount} messages sent successfully${failCount > 0 ? `, ${failCount} failed` : ''}`, successCount > failCount ? 'success' : 'error');
            } else {
                showToast(`❌ All ${failCount} messages failed to send`, 'error');
            }
            
        } else {
            // Send as bulk message
            result = await sendSmsViaArkesel(
                phoneNumbers,
                content,
                null,
                formattedSchedule,
                null
            );
            
            // Save bulk message to Firestore
            const messageData = {
                recipients: recipients,
                recipientCount: result.recipientCount || phoneNumbers.length,
                content: content,
                type: type || 'announcement',
                status: scheduledFor ? 'scheduled' : 'sent',
                sentAt: scheduledFor ? null : Timestamp.now(),
                scheduledFor: scheduledFor ? Timestamp.fromDate(new Date(scheduledFor)) : null,
                provider: 'ProfJero SMS',
                messageId: result.messageId,
                arkeselResponse: result.data,
                personalized: false,
            };
            
            try {
                if (scheduledFor) {
                    await addDoc(collection(db, "scheduled_messages"), messageData);
                } else {
                    await addDoc(collection(db, "communications"), messageData);
                }
            } catch (firestoreError) {
                console.warn('Could not save to Firestore:', firestoreError);
            }
            
            if (result.success) {
                showToast(`✅ Message sent to ${result.recipientCount} recipients!`, 'success');
            } else {
                showToast(`❌ Failed to send: ${result.error}`, 'error');
            }
        }
        
        // Reload data to reflect changes
        await loadMessages();
        await loadScheduledMessages();
        updateStats();
        await checkSmsBalance();
        
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        
        document.getElementById('composeForm').reset();
        updatePreview();
        
    } catch (error) {
        console.error('Error sending message:', error);
        showToast('Error sending message', 'error');
        
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
    }
}

// ============================================
// RENDER FUNCTIONS
// ============================================

function processContent(content, recipient) {
    let processed = content;
    
    // Replace all variables
    const variables = {
        '{{name}}': recipient.name || 'Beloved',
        '{{phone}}': recipient.phone || '',
        '{{email}}': recipient.email || '',
        '{{id}}': recipient.id || '',
        '{{fellowship}}': recipient.fellowship || 'General',
        '{{area}}': recipient.area || '',
        '{{occupation}}': recipient.occupation || '',
        '{{church}}': 'Restoration Grace Chapel',
        '{{pastor}}': 'Rev. Eric Esuman',
        '{{date}}': new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        }),
        '{{service_time}}': 'Sunday 9:00 AM & Wednesday 6:00 PM'
    };
    
    for (const [key, value] of Object.entries(variables)) {
        processed = processed.replace(new RegExp(key, 'g'), value);
    }
    
    return processed;
}

function renderTemplates() {
    const container = document.getElementById('templatesList');
    if (!container) return;
    
    if (allTemplates.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400 col-span-full">No templates yet. Create your first template!</div>';
        return;
    }
    
    container.innerHTML = allTemplates.map(t => `
        <div class="border rounded-xl p-4 hover:shadow-md transition message-template" onclick="window.useTemplate('${t.id}')">
            <div class="flex justify-between items-start mb-2">
                <h3 class="font-bold text-gray-800">${escapeHtml(t.name)}</h3>
                <span class="text-xs px-2 py-1 rounded-full ${getCategoryColor(t.category)}">${escapeHtml(t.category)}</span>
            </div>
            <p class="text-sm text-gray-600 line-clamp-2">${escapeHtml(t.content.substring(0, 100))}${t.content.length > 100 ? '...' : ''}</p>
            <div class="flex justify-end gap-2 mt-3">
                <button onclick="window.deleteTemplate('${t.id}')" class="text-red-500 text-xs hover:text-red-700">Delete</button>
            </div>
        </div>
    `).join('');
}

function getCategoryColor(category) {
    const colors = {
        announcement: 'bg-blue-100 text-blue-700',
        reminder: 'bg-yellow-100 text-yellow-700',
        birthday: 'bg-pink-100 text-pink-700',
        event: 'bg-purple-100 text-purple-700',
        prayer: 'bg-indigo-100 text-indigo-700',
        thanksgiving: 'bg-green-100 text-green-700'
    };
    return colors[category] || 'bg-gray-100 text-gray-700';
}

function renderScheduledMessages() {
    const container = document.getElementById('scheduledMessagesList');
    if (!container) return;
    
    if (allScheduled.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400">No scheduled messages</div>';
        return;
    }
    
    container.innerHTML = allScheduled.map(s => `
        <div class="flex justify-between items-center p-3 bg-gray-50 rounded-lg schedule-item">
            <div>
                <p class="font-medium text-gray-800">${escapeHtml(s.content.substring(0, 50))}...</p>
                <p class="text-xs text-gray-500">To: ${s.recipientCount} recipients • ${escapeHtml(s.type)}</p>
                ${s.personalized ? '<span class="text-xs text-blue-500 ml-2">(Personalized)</span>' : ''}
            </div>
            <div class="text-right">
                <p class="text-sm text-orange-600">${formatDateTime(s.scheduledFor)}</p>
                <button onclick="window.cancelScheduled('${s.id}')" class="text-red-500 text-xs hover:text-red-700 mt-1">Cancel</button>
            </div>
        </div>
    `).join('');
}

function renderMessageHistory() {
    const container = document.getElementById('messageHistoryList');
    if (!container) return;
    
    const startDate = document.getElementById('historyStartDate')?.value;
    const endDate = document.getElementById('historyEndDate')?.value;
    
    let filtered = [...allMessages];
    
    if (startDate) {
        filtered = filtered.filter(m => {
            if (!m.sentAt || !m.sentAt.toDate) return false;
            return m.sentAt.toDate() >= new Date(startDate);
        });
    }
    if (endDate) {
        filtered = filtered.filter(m => {
            if (!m.sentAt || !m.sentAt.toDate) return false;
            return m.sentAt.toDate() <= new Date(endDate);
        });
    }
    
    const start = (currentHistoryPage - 1) * historyItemsPerPage;
    const paginated = filtered.slice(start, start + historyItemsPerPage);
    const totalPages = Math.ceil(filtered.length / historyItemsPerPage);
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center py-8 text-gray-400">No messages sent yet</div>';
        const paginationDiv = document.getElementById('historyPagination');
        if (paginationDiv) paginationDiv.classList.add('hidden');
        return;
    }
    
    container.innerHTML = paginated.map(m => `
        <div class="p-3 bg-gray-50 rounded-lg">
            <div class="flex justify-between items-start">
                <div>
                    <span class="text-xs px-2 py-0.5 rounded-full ${getCategoryColor(m.type)}">${escapeHtml(m.type)}</span>
                    <span class="text-xs text-gray-400 ml-2">To: ${m.recipientCount} recipients</span>
                    ${m.personalized ? '<span class="text-xs text-blue-500 ml-2">(Personalized)</span>' : ''}
                </div>
                <span class="text-xs text-gray-400">${formatDateTime(m.sentAt)}</span>
            </div>
            <p class="text-sm text-gray-700 mt-2">${escapeHtml(m.content)}</p>
            ${m.recipientName ? `<p class="text-xs text-gray-400 mt-1">To: ${escapeHtml(m.recipientName)}</p>` : ''}
            ${m.messageId ? `<p class="text-xs text-gray-400 mt-1">ID: ${escapeHtml(m.messageId)}</p>` : ''}
        </div>
    `).join('');
    
    const paginationDiv = document.getElementById('historyPagination');
    if (paginationDiv) {
        if (totalPages > 1) {
            paginationDiv.classList.remove('hidden');
            let buttons = '';
            for (let i = 1; i <= Math.min(totalPages, 5); i++) {
                buttons += `<button onclick="window.goToHistoryPage(${i})" class="px-3 py-1 rounded-lg ${currentHistoryPage === i ? 'bg-[#6a1b9a] text-white' : 'bg-gray-100 hover:bg-gray-200'}">${i}</button>`;
            }
            paginationDiv.innerHTML = buttons;
        } else {
            paginationDiv.classList.add('hidden');
        }
    }
}

window.goToHistoryPage = (page) => {
    currentHistoryPage = page;
    renderMessageHistory();
};

// ============================================
// TEMPLATE FUNCTIONS
// ============================================

async function saveTemplate(name, content, category) {
    const btn = document.getElementById('saveTemplate');
    const originalText = btn.innerHTML;
    
    try {
        btn.innerHTML = '<span class="btn-spinner"></span><span class="btn-text">Saving...</span>';
        btn.classList.add('btn-loading');
        btn.disabled = true;
        
        await addDoc(collection(db, "sms_templates"), {
            name: name,
            content: content,
            category: category,
            createdAt: Timestamp.now()
        });
        showToast('Template saved successfully!', 'success');
        await loadTemplates();
        
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        return true;
    } catch (error) {
        showToast('Error saving template', 'error');
        btn.innerHTML = originalText;
        btn.classList.remove('btn-loading');
        btn.disabled = false;
        return false;
    }
}

window.deleteTemplate = async (id) => {
    if (confirm('Delete this template?')) {
        try {
            await deleteDoc(doc(db, "sms_templates", id));
            showToast('Template deleted', 'success');
            await loadTemplates();
        } catch (error) {
            showToast('Error deleting template', 'error');
        }
    }
};

window.cancelScheduled = async (id) => {
    if (confirm('Cancel this scheduled message?')) {
        try {
            await deleteDoc(doc(db, "scheduled_messages", id));
            showToast('Scheduled message cancelled', 'success');
            await loadScheduledMessages();
            updateStats();
        } catch (error) {
            showToast('Error cancelling', 'error');
        }
    }
};

window.useTemplate = (id) => {
    const template = allTemplates.find(t => t.id === id);
    if (template) {
        document.getElementById('messageContent').value = template.content;
        document.getElementById('messageType').value = template.category;
        showToast(`Template "${template.name}" loaded`, 'success');
        // Switch to compose tab
        document.querySelector('.tab-btn[data-tab="compose"]').click();
        // Update preview
        updatePreview();
    }
};

// ============================================
// PREVIEW FUNCTIONS
// ============================================

function updatePreview() {
    const content = document.getElementById('messageContent')?.value || '';
    const previewDiv = document.getElementById('messagePreview');
    if (!previewDiv) return;
    
    if (!content.trim()) {
        previewDiv.innerHTML = 'Your message preview will appear here...';
    } else {
        const sampleRecipient = { 
            name: '[Member Name]', 
            fellowship: '[Fellowship]',
            church: 'Restoration Grace Chapel',
            phone: '024XXXXXXX',
            email: 'member@email.com'
        };
        const processed = processContent(content, sampleRecipient);
        previewDiv.innerHTML = processed;
    }
    
    const charCount = content.length;
    const counter = document.getElementById('charCounter');
    if (counter) {
        counter.textContent = `${charCount}/160 characters`;
        counter.classList.remove('warning', 'danger');
        if (charCount > 140) counter.classList.add('warning');
        if (charCount > 160) counter.classList.add('danger');
    }
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

function exportHistoryToCSV() {
    const headers = ['Date', 'Type', 'Recipients', 'Content', 'Provider', 'Personalized'];
    const rows = allMessages.map(m => [
        formatDateTime(m.sentAt),
        m.type,
        m.recipientCount,
        `"${(m.content || '').replace(/"/g, '""')}"`,
        m.provider || 'manual',
        m.personalized ? 'Yes' : 'No'
    ]);
    
    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sms_history_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export complete!', 'success');
}

// ============================================
// SETUP EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active', 'text-[#6a1b9a]', 'font-semibold'));
            btn.classList.add('tab-active', 'text-[#6a1b9a]', 'font-semibold');
            document.querySelectorAll('.tab-content').forEach(content => content.classList.add('hidden'));
            const targetTab = document.getElementById(`tab-${tabId}`);
            if (targetTab) targetTab.classList.remove('hidden');
            if (tabId === 'history') renderMessageHistory();
            if (tabId === 'scheduled') loadScheduledMessages();
            if (tabId === 'settings') {
                checkSmsBalance();
                loadSmsSettings();
            }
            if (tabId === 'templates') renderTemplates();
        });
    });
    
    // Recipient type change
    const recipientType = document.getElementById('recipientType');
    if (recipientType) {
        recipientType.addEventListener('change', () => {
            const type = recipientType.value;
            document.getElementById('fellowshipSelect').classList.add('hidden');
            document.getElementById('individualSelect').classList.add('hidden');
            
            if (type === 'fellowship') {
                document.getElementById('fellowshipSelect').classList.remove('hidden');
            } else if (type === 'individual') {
                document.getElementById('individualSelect').classList.remove('hidden');
            }
            
            updateRecipientCount();
        });
    }
    
    const fellowshipFilter = document.getElementById('fellowshipFilter');
    if (fellowshipFilter) {
        fellowshipFilter.addEventListener('change', updateRecipientCount);
    }
    
    const individualMembers = document.getElementById('individualMembers');
    if (individualMembers) {
        individualMembers.addEventListener('change', updateRecipientCount);
    }
    
    // Message content preview
    const messageContent = document.getElementById('messageContent');
    if (messageContent) {
        messageContent.addEventListener('input', updatePreview);
    }
    
    // Compose form
    const composeForm = document.getElementById('composeForm');
    if (composeForm) {
        composeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const recipients = getRecipients();
            const content = document.getElementById('messageContent').value;
            const type = document.getElementById('messageType').value;
            
            if (recipients.length === 0) {
                showToast('No recipients selected', 'error');
                return;
            }
            if (!content.trim()) {
                showToast('Message content is required', 'error');
                return;
            }
            
            if (confirm(`Send to ${recipients.length} recipients?`)) {
                await sendMessage(recipients, null, content, type);
                document.getElementById('composeForm').reset();
                updatePreview();
            }
        });
    }
    
    // Schedule button - opens the modal
    const scheduleBtn = document.getElementById('scheduleBtn');
    if (scheduleBtn) {
        scheduleBtn.addEventListener('click', () => {
            const content = document.getElementById('messageContent').value;
            if (!content.trim()) {
                showToast('Please write a message before scheduling', 'error');
                return;
            }
            const recipients = getRecipients();
            if (recipients.length === 0) {
                showToast('No recipients selected', 'error');
                return;
            }
            document.getElementById('scheduleModal').classList.remove('hidden');
        });
    }
    
    // Schedule Modal - Confirm
    const confirmSchedule = document.getElementById('confirmSchedule');
    if (confirmSchedule) {
        confirmSchedule.addEventListener('click', async () => {
            const dateTime = document.getElementById('scheduleDateTime').value;
            if (!dateTime) {
                showToast('Please select date and time', 'error');
                return;
            }
            
            const recipients = getRecipients();
            const content = document.getElementById('messageContent').value;
            const type = document.getElementById('messageType').value;
            
            if (recipients.length === 0) {
                showToast('No recipients selected', 'error');
                return;
            }
            if (!content.trim()) {
                showToast('Message content is required', 'error');
                return;
            }
            
            await sendMessage(recipients, null, content, type, dateTime);
            document.getElementById('scheduleModal').classList.add('hidden');
            document.getElementById('composeForm').reset();
            updatePreview();
        });
    }
    
    // Show Schedule Modal button (from scheduled tab)
    const showScheduleModalBtn = document.getElementById('showScheduleModal');
    if (showScheduleModalBtn) {
        showScheduleModalBtn.addEventListener('click', () => {
            // Switch to compose tab first
            const composeTab = document.querySelector('.tab-btn[data-tab="compose"]');
            if (composeTab) composeTab.click();
            // Then open schedule modal after a short delay
            setTimeout(() => {
                const content = document.getElementById('messageContent').value;
                if (!content.trim()) {
                    showToast('Please write a message first', 'error');
                    return;
                }
                const recipients = getRecipients();
                if (recipients.length === 0) {
                    showToast('No recipients selected', 'error');
                    return;
                }
                document.getElementById('scheduleModal').classList.remove('hidden');
            }, 100);
        });
    }
    
    // Save template button
    const saveTemplateBtn = document.getElementById('saveTemplateBtn');
    if (saveTemplateBtn) {
        saveTemplateBtn.addEventListener('click', () => {
            const content = document.getElementById('messageContent').value;
            if (!content.trim()) {
                showToast('No message content to save', 'error');
                return;
            }
            document.getElementById('templateContent').value = content;
            document.getElementById('templateModal').classList.remove('hidden');
        });
    }
    
    const saveTemplate = document.getElementById('saveTemplate');
    if (saveTemplate) {
        saveTemplate.addEventListener('click', async () => {
            const name = document.getElementById('templateName').value;
            const content = document.getElementById('templateContent').value;
            const category = document.getElementById('templateCategory').value;
            
            if (!name) {
                showToast('Template name required', 'error');
                return;
            }
            if (!content.trim()) {
                showToast('Template content required', 'error');
                return;
            }
            
            await saveTemplate(name, content, category);
            document.getElementById('templateModal').classList.add('hidden');
            document.getElementById('templateName').value = '';
            document.getElementById('templateContent').value = '';
        });
    }
    
    // Modal close buttons
    const closeTemplateModal = document.getElementById('closeTemplateModal');
    if (closeTemplateModal) {
        closeTemplateModal.addEventListener('click', () => {
            document.getElementById('templateModal').classList.add('hidden');
        });
    }
    
    const closeScheduleModal = document.getElementById('closeScheduleModal');
    if (closeScheduleModal) {
        closeScheduleModal.addEventListener('click', () => {
            document.getElementById('scheduleModal').classList.add('hidden');
        });
    }
    
    const newTemplateBtn = document.getElementById('newTemplateBtn');
    if (newTemplateBtn) {
        newTemplateBtn.addEventListener('click', () => {
            document.getElementById('templateModal').classList.remove('hidden');
            document.getElementById('templateName').value = '';
            document.getElementById('templateContent').value = '';
            document.getElementById('templateCategory').value = 'announcement';
        });
    }
    
    // History filters
    const filterHistoryBtn = document.getElementById('filterHistoryBtn');
    if (filterHistoryBtn) {
        filterHistoryBtn.addEventListener('click', () => {
            currentHistoryPage = 1;
            renderMessageHistory();
        });
    }
    
    const exportHistoryBtn = document.getElementById('exportHistoryBtn');
    if (exportHistoryBtn) {
        exportHistoryBtn.addEventListener('click', exportHistoryToCSV);
    }
    
    // Settings buttons
    const refreshBalanceBtn = document.getElementById('refreshBalanceBtn');
    if (refreshBalanceBtn) {
        refreshBalanceBtn.addEventListener('click', checkSmsBalance);
    }
    
    const checkBalanceBtn = document.getElementById('checkBalanceBtn');
    if (checkBalanceBtn) {
        checkBalanceBtn.addEventListener('click', checkSmsBalance);
    }
    
    const testSmsBtn = document.getElementById('testSmsBtn');
    if (testSmsBtn) {
        testSmsBtn.addEventListener('click', sendTestSms);
    }
    
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSmsSettings);
    }
    
    // Automated settings
    function saveAutoSetting(key, value) {
        localStorage.setItem(key, value);
    }
    
    // Birthday auto
    const birthdayAuto = document.getElementById('birthdayAuto');
    if (birthdayAuto) {
        birthdayAuto.addEventListener('change', (e) => {
            saveAutoSetting('birthdayAuto', e.target.checked);
            showToast(e.target.checked ? 'Birthday reminders enabled' : 'Birthday reminders disabled', 'success');
        });
        birthdayAuto.checked = localStorage.getItem('birthdayAuto') === 'true';
    }
    
    // Anniversary auto
    const anniversaryAuto = document.getElementById('anniversaryAuto');
    if (anniversaryAuto) {
        anniversaryAuto.addEventListener('change', (e) => {
            saveAutoSetting('anniversaryAuto', e.target.checked);
            showToast(e.target.checked ? 'Anniversary reminders enabled' : 'Anniversary reminders disabled', 'success');
        });
        anniversaryAuto.checked = localStorage.getItem('anniversaryAuto') === 'true';
    }
    
    // Absent reminder auto
    const absentReminderAuto = document.getElementById('absentReminderAuto');
    if (absentReminderAuto) {
        absentReminderAuto.addEventListener('change', (e) => {
            saveAutoSetting('absentReminderAuto', e.target.checked);
            showToast(e.target.checked ? 'Absent member reminders enabled' : 'Absent member reminders disabled', 'success');
        });
        absentReminderAuto.checked = localStorage.getItem('absentReminderAuto') === 'true';
    }
    
    // Save birthday settings
    const saveBirthdaySettings = document.getElementById('saveBirthdaySettings');
    if (saveBirthdaySettings) {
        saveBirthdaySettings.addEventListener('click', () => {
            const template = document.getElementById('birthdayTemplate').value;
            const time = document.getElementById('birthdayTime').value;
            localStorage.setItem('birthdayTemplate', template);
            localStorage.setItem('birthdayTime', time);
            showToast('Birthday settings saved!', 'success');
        });
    }
    
    // Save anniversary settings
    const saveAnniversarySettings = document.getElementById('saveAnniversarySettings');
    if (saveAnniversarySettings) {
        saveAnniversarySettings.addEventListener('click', () => {
            const template = document.getElementById('anniversaryTemplate').value;
            localStorage.setItem('anniversaryTemplate', template);
            showToast('Anniversary settings saved!', 'success');
        });
    }
    
    // Save absent settings
    const saveAbsentSettings = document.getElementById('saveAbsentSettings');
    if (saveAbsentSettings) {
        saveAbsentSettings.addEventListener('click', () => {
            const template = document.getElementById('absentReminderTemplate').value;
            localStorage.setItem('absentReminderTemplate', template);
            showToast('Absent reminder settings saved!', 'success');
        });
    }
    
    // Load saved automated settings
    const savedBirthdayTemplate = localStorage.getItem('birthdayTemplate');
    if (savedBirthdayTemplate) {
        const el = document.getElementById('birthdayTemplate');
        if (el) el.value = savedBirthdayTemplate;
    }
    
    const savedAnniversaryTemplate = localStorage.getItem('anniversaryTemplate');
    if (savedAnniversaryTemplate) {
        const el = document.getElementById('anniversaryTemplate');
        if (el) el.value = savedAnniversaryTemplate;
    }
    
    const savedAbsentTemplate = localStorage.getItem('absentReminderTemplate');
    if (savedAbsentTemplate) {
        const el = document.getElementById('absentReminderTemplate');
        if (el) el.value = savedAbsentTemplate;
    }
    
    // Click outside modals to close
    document.querySelectorAll('.fixed.inset-0.bg-black').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
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

function formatDateTime(timestamp) {
    if (!timestamp) return '—';
    if (timestamp.toDate) return timestamp.toDate().toLocaleString();
    return new Date(timestamp).toLocaleString();
}

// ============================================
// INITIALIZE
// ============================================

// Make functions available globally for onclick handlers
window.goToHistoryPage = goToHistoryPage;
window.deleteTemplate = deleteTemplate;
window.cancelScheduled = cancelScheduled;
window.useTemplate = useTemplate;
window.insertVariable = insertVariable;
window.logoutUser = logoutUser;
window.sendTestSms = sendTestSms;
window.checkSmsBalance = checkSmsBalance;

console.log('📱 SMS Engine initialized');

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initSMSPage);

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