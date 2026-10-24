// ============================================
// PWA Setup with Push Notifications
// ============================================

// ⚠️ IMPORTANT: These keys MUST match your Cloudflare Worker keys
const VAPID_PUBLIC_KEY = 'BHYtRT8H4Hp6wRnArYtIif3kLO-CQBnRVWx4AhOuliDYwC6LKr2EgLHXvxvt87KBzRqZiU5xj8VyXhuJT-iJYOc';
const VAPID_PRIVATE_KEY = 'MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQg1d_kZ3w_ppE4fiyUG41_iwIGERdoIxohk0bpvasHcS-hRANCAAR2LUU_B-B6esEZwK2LSIn95CzvgkAZ0VVseAITrpYg2MAuiyq9hICx178b7fOygc0amYlOcY_Fcl4biU_oiWDn';
const VAPID_SUBJECT = 'mailto:rgcinternational001@gmail.com';

// Cloudflare Worker URL (NO trailing slash)
const WORKER_URL = 'https://rgci-push-worker.rgcinternational001.workers.dev';

// Check if service worker is supported
if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
        registerServiceWorker();
    });
}

// ============================================
// REGISTER SERVICE WORKER
// ============================================

async function registerServiceWorker() {
    try {
        var registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
        });
        
        console.log('✅ Service Worker registered successfully!');
        console.log('Scope:', registration.scope);
        
        // Check for updates
        registration.addEventListener('updatefound', function() {
            var newWorker = registration.installing;
            console.log('🔄 Service Worker update found!');
            
            newWorker.addEventListener('statechange', function() {
                console.log('Service Worker state:', newWorker.state);
                if (newWorker.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                        showUpdateNotification();
                    }
                }
            });
        });
        
        // Wait for service worker to be ready
        await navigator.serviceWorker.ready;
        
        // Setup push notifications
        await setupPushNotifications(registration);
        
        // Setup periodic background sync
        setupPeriodicSync();
        
    } catch (error) {
        console.error('❌ Service Worker registration failed:', error);
    }
}

// ============================================
// SETUP PUSH NOTIFICATIONS
// ============================================

async function setupPushNotifications(registration) {
    if (!('PushManager' in window)) {
        console.log('⚠️ Push notifications not supported in this browser');
        updateNotificationUI(false, 'not-supported');
        return;
    }
    
    try {
        // Check permission
        var permission = Notification.permission;
        
        // If permission not granted, ask for it
        if (permission !== 'granted') {
            permission = await Notification.requestPermission();
        }
        
        if (permission === 'granted') {
            console.log('✅ Notification permission granted');
            
            // Check for existing subscription
            var subscription = await registration.pushManager.getSubscription();
            
            if (subscription) {
                console.log('✅ Existing push subscription found');
                console.log('Endpoint:', subscription.endpoint);
                await saveSubscription(subscription);
                updateNotificationUI(true);
                return;
            }
            
            // Create new subscription
            try {
                console.log('📤 Creating push subscription...');
                console.log('VAPID key length:', VAPID_PUBLIC_KEY.length);
                
                var applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
                console.log('✅ Key converted, length:', applicationServerKey.length);
                
                // Verify key length is 65 bytes for P-256
                if (applicationServerKey.length !== 65) {
                    console.error('❌ Invalid key length:', applicationServerKey.length, '(expected 65)');
                    showToast('Invalid VAPID key configuration', 'error');
                    updateNotificationUI(false, 'error');
                    return;
                }
                
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: applicationServerKey
                });
                
                console.log('✅ Push subscription created successfully');
                console.log('Endpoint:', subscription.endpoint);
                
                await saveSubscription(subscription);
                showToast('🔔 Notifications enabled!', 'success');
                updateNotificationUI(true);
                
            } catch (subscribeError) {
                console.error('❌ Push subscription error:', subscribeError);
                console.error('Error details:', {
                    name: subscribeError.name,
                    message: subscribeError.message
                });
                
                if (subscribeError.message && subscribeError.message.includes('applicationServerKey')) {
                    showToast('Invalid VAPID key. Please check configuration.', 'error');
                    updateNotificationUI(false, 'error');
                } else {
                    showToast('Failed to enable notifications: ' + subscribeError.message, 'error');
                    updateNotificationUI(false, 'error');
                }
            }
            
        } else if (permission === 'denied') {
            console.log('❌ Notification permission denied');
            showToast('Please enable notifications in browser settings', 'error');
            updateNotificationUI(false, 'denied');
        } else {
            console.log('⏳ Notification permission pending');
            updateNotificationUI(false, 'pending');
        }
        
    } catch (error) {
        console.error('❌ Push setup error:', error);
        updateNotificationUI(false, 'error');
    }
}

// ============================================
// UPDATE NOTIFICATION UI - IMPROVED
// ============================================

function updateNotificationUI(enabled, status) {
    var toggleBtn = document.getElementById('notificationToggle');
    var statusEl = document.getElementById('notificationStatus');
    var statusIndicator = document.getElementById('notificationStatusIndicator');
    var banner = document.getElementById('notificationBanner');
    
    if (!toggleBtn || !statusEl) return;
    
    // Update button
    if (enabled) {
        toggleBtn.className = 'px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300 bg-green-500 hover:bg-green-600 hover:shadow-lg hover:shadow-green-500/30 active:scale-95 whitespace-nowrap text-white';
        statusEl.innerHTML = '<i class="fas fa-check mr-1.5"></i>Enabled';
        
        // Show status indicator
        if (statusIndicator) {
            statusIndicator.classList.remove('hidden');
        }
        
        // Update banner style
        if (banner) {
            banner.querySelector('.bg-gradient-to-r').className = 'bg-gradient-to-r from-green-50 via-green-50/50 to-transparent backdrop-blur-sm rounded-2xl p-4 border border-green-200 shadow-lg shadow-green-500/5';
        }
        
    } else {
        var statusText = 'Enable';
        var icon = 'fa-bell';
        var buttonClass = 'bg-secondary hover:bg-primary';
        
        if (status === 'denied') {
            statusText = 'Blocked';
            icon = 'fa-ban';
            buttonClass = 'bg-red-500 hover:bg-red-600';
        } else if (status === 'not-supported') {
            statusText = 'Not Supported';
            icon = 'fa-exclamation-triangle';
            buttonClass = 'bg-gray-500 hover:bg-gray-600 cursor-not-allowed';
        } else if (status === 'error') {
            statusText = 'Retry';
            icon = 'fa-sync-alt';
            buttonClass = 'bg-yellow-500 hover:bg-yellow-600';
        } else {
            statusText = 'Enable';
            icon = 'fa-bell';
            buttonClass = 'bg-secondary hover:bg-primary';
        }
        
        toggleBtn.className = 'px-4 py-2 rounded-xl font-semibold text-sm transition-all duration-300 ' + buttonClass + ' hover:shadow-lg hover:shadow-secondary/30 active:scale-95 whitespace-nowrap text-white';
        statusEl.innerHTML = '<i class="fas ' + icon + ' mr-1.5"></i>' + statusText;
        
        // Hide status indicator
        if (statusIndicator) {
            statusIndicator.classList.add('hidden');
        }
        
        // Reset banner style
        if (banner && status !== 'denied' && status !== 'not-supported') {
            banner.querySelector('.bg-gradient-to-r').className = 'bg-gradient-to-r from-secondary/10 via-secondary/5 to-transparent backdrop-blur-sm rounded-2xl p-4 border border-secondary/20 shadow-lg shadow-secondary/5';
        }
    }
}

// ============================================
// SAVE SUBSCRIPTION TO WORKER
// ============================================

async function saveSubscription(subscription) {
    try {
        var subscriptionData = {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime,
            keys: {
                p256dh: subscription.toJSON().keys.p256dh,
                auth: subscription.toJSON().keys.auth
            }
        };
        
        console.log('📤 Sending subscription to worker...');
        console.log('📤 Worker URL:', WORKER_URL + '/api/save-subscription');
        
        var response = await fetch(WORKER_URL + '/api/save-subscription', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(subscriptionData)
        });
        
        if (!response.ok) {
            var errorText = await response.text();
            console.error('Server response error:', errorText);
            throw new Error('Failed to save subscription: ' + response.status);
        }
        
        var result = await response.json();
        console.log('✅ Push subscription saved to server:', result);
        
    } catch (error) {
        console.error('❌ Save subscription error:', error);
        storeSubscriptionLocally(subscription);
        showToast('Could not save subscription. Will retry later.', 'info');
    }
}

function storeSubscriptionLocally(subscription) {
    try {
        var subscriptionData = {
            endpoint: subscription.endpoint,
            keys: {
                p256dh: subscription.toJSON().keys.p256dh,
                auth: subscription.toJSON().keys.auth
            }
        };
        localStorage.setItem('pushSubscription', JSON.stringify(subscriptionData));
        console.log('📦 Push subscription stored locally');
    } catch (error) {
        console.error('❌ Local storage error:', error);
    }
}

// ============================================
// UNSUBSCRIBE FROM PUSH
// ============================================

async function unsubscribeFromPush() {
    try {
        var registration = await navigator.serviceWorker.ready;
        var subscription = await registration.pushManager.getSubscription();
        
        if (subscription) {
            await subscription.unsubscribe();
            
            await fetch(WORKER_URL + '/api/remove-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ endpoint: subscription.endpoint })
            });
            
            localStorage.removeItem('pushSubscription');
            
            console.log('✅ Unsubscribed from push notifications');
            showToast('Notifications disabled', 'info');
            updateNotificationUI(false);
            return true;
        }
        
        console.log('ℹ️ No active subscription found');
        updateNotificationUI(false);
        return false;
        
    } catch (error) {
        console.error('❌ Unsubscribe error:', error);
        showToast('Failed to unsubscribe', 'error');
        return false;
    }
}

// ============================================
// TOGGLE NOTIFICATIONS (for button)
// ============================================

async function toggleNotifications() {
    var registration = await navigator.serviceWorker.ready;
    var subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
        await unsubscribeFromPush();
    } else {
        await setupPushNotifications(registration);
    }
}

// ============================================
// CHECK PERIODIC SYNC SUPPORT
// ============================================

async function setupPeriodicSync() {
    if ('periodicSync' in navigator.serviceWorker) {
        try {
            var status = await navigator.permissions.query({
                name: 'periodic-background-sync'
            });
            
            if (status.state === 'granted') {
                var registration = await navigator.serviceWorker.ready;
                await registration.periodicSync.register('update-content', {
                    minInterval: 24 * 60 * 60 * 1000
                });
                console.log('✅ Periodic background sync registered');
            }
        } catch (error) {
            console.log('ℹ️ Periodic sync not supported:', error);
        }
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function urlBase64ToUint8Array(base64String) {
    try {
        base64String = base64String.trim();
        
        var padding = '='.repeat((4 - base64String.length % 4) % 4);
        var base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        
        var rawData = window.atob(base64);
        var outputArray = new Uint8Array(rawData.length);
        
        for (var i = 0; i < rawData.length; i++) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    } catch (error) {
        console.error('❌ Failed to convert VAPID key:', error);
        console.error('Key:', base64String);
        throw new Error('Invalid VAPID public key format');
    }
}

// ============================================
// CHECK WORKER HEALTH
// ============================================

async function checkWorkerHealth() {
    try {
        console.log('📤 Checking worker health at:', WORKER_URL + '/api/test');
        var response = await fetch(WORKER_URL + '/api/test');
        var data = await response.json();
        console.log('✅ Worker health check:', data);
        return data;
    } catch (error) {
        console.error('❌ Worker health check failed:', error);
        return null;
    }
}

window.addEventListener('load', function() {
    setTimeout(checkWorkerHealth, 2000);
});

// ============================================
// PWA INSTALLATION
// ============================================

var deferredPrompt;

window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    showInstallButton();
});

function showInstallButton() {
    var installBtn = document.getElementById('installAppBtn');
    if (installBtn) return;
    
    installBtn = document.createElement('button');
    installBtn.id = 'installAppBtn';
    installBtn.className = 'fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 bg-tertiary-fixed-dim text-primary px-6 py-3 rounded-2xl shadow-lg flex items-center gap-3 animate-slide-up';
    installBtn.innerHTML = `
        <i class="fas fa-download"></i>
        <span class="font-semibold">Install App</span>
        <i class="fas fa-chevron-right text-sm"></i>
    `;
    installBtn.onclick = installApp;
    document.body.appendChild(installBtn);
}

async function installApp() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    var result = await deferredPrompt.userChoice;
    console.log('User response to install prompt:', result.outcome);
    deferredPrompt = null;
    var installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.remove();
}

window.addEventListener('appinstalled', function() {
    console.log('✅ App installed successfully!');
    var installBtn = document.getElementById('installAppBtn');
    if (installBtn) installBtn.remove();
});

// ============================================
// UPDATE APP
// ============================================

async function updateApp() {
    try {
        var registration = await navigator.serviceWorker.ready;
        await registration.update();
        window.location.reload();
    } catch (error) {
        console.error('Update error:', error);
    }
}

function showUpdateNotification() {
    var toast = document.createElement('div');
    toast.className = 'fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50 bg-secondary text-white px-6 py-3 rounded-2xl shadow-lg shadow-secondary/30 flex items-center gap-3 animate-slide-up';
    toast.innerHTML = `
        <i class="fas fa-cloud-download-alt"></i>
        <span>New update available!</span>
        <button onclick="updateApp()" class="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg text-sm font-semibold transition">
            Update Now
        </button>
    `;
    document.body.appendChild(toast);
}

// ============================================
// TOAST HELPER
// ============================================

function showToast(message, type) {
    if (typeof type === 'undefined') type = 'info';
    var container = document.getElementById('toastContainer');
    if (!container) return;
    
    container.classList.remove('hidden');
    
    var colors = {
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
    container._timeout = setTimeout(function() {
        container.classList.add('hidden');
    }, 5000);
}

// ============================================
// DOM READY - Initialize UI
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Setup notification toggle button
    var toggleBtn = document.getElementById('notificationToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleNotifications);
    }
    
    // Setup dismiss button
    var dismissBtn = document.getElementById('notificationDismiss');
    if (dismissBtn) {
        dismissBtn.addEventListener('click', function() {
            var banner = document.getElementById('notificationBanner');
            if (banner) {
                banner.style.display = 'none';
                // Store dismissal in localStorage
                localStorage.setItem('notificationBannerDismissed', 'true');
            }
        });
    }
    
    // Check if banner was dismissed
    if (localStorage.getItem('notificationBannerDismissed') === 'true') {
        var banner = document.getElementById('notificationBanner');
        if (banner) {
            banner.style.display = 'none';
        }
    }
    
    // Check initial notification status
    setTimeout(async function() {
        try {
            var registration = await navigator.serviceWorker.ready;
            var subscription = await registration.pushManager.getSubscription();
            updateNotificationUI(!!subscription);
        } catch (e) {
            console.log('Service worker not ready yet');
        }
    }, 3000);
});

// ============================================
// EXPORT PWA FUNCTIONS
// ============================================

window.__pwa = {
    registerServiceWorker: registerServiceWorker,
    unsubscribeFromPush: unsubscribeFromPush,
    setupPushNotifications: setupPushNotifications,
    saveSubscription: saveSubscription,
    checkWorkerHealth: checkWorkerHealth,
    updateApp: updateApp,
    installApp: installApp,
    toggleNotifications: toggleNotifications,
    updateNotificationUI: updateNotificationUI,
    WORKER_URL: WORKER_URL,
    VAPID_PUBLIC_KEY: VAPID_PUBLIC_KEY
};

console.log('📋 PWA features exported to window.__pwa');
console.log('📋 Worker URL:', WORKER_URL);
console.log('📋 VAPID Public Key (first 20 chars):', VAPID_PUBLIC_KEY.substring(0, 20) + '...');
console.log('📋 Use window.__pwa.toggleNotifications() to toggle notifications');