// ============================================
// RGCI Member Care - Service Worker with Rich Push
// ============================================

const CACHE_NAME = 'myRGCI-v2.0.0';
const OFFLINE_URL = '/offline.html';

// Assets to cache
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/events.html',
  '/profile.html',
  '/offline.html',
  '/manifest.json'
];

// ============================================
// INSTALL EVENT
// ============================================

self.addEventListener('install', function(event) {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[Service Worker] Caching app assets...');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(function() {
        console.log('[Service Worker] Cache complete');
        return self.skipWaiting();
      })
      .catch(function(error) {
        console.error('[Service Worker] Cache error:', error);
        return self.skipWaiting();
      })
  );
});

// ============================================
// ACTIVATE EVENT
// ============================================

self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then(function(cacheNames) {
        return Promise.all(
          cacheNames.map(function(cacheName) {
            if (cacheName !== CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(function() {
        console.log('[Service Worker] Claiming clients...');
        return self.clients.claim();
      })
  );
});

// ============================================
// FETCH EVENT
// ============================================

self.addEventListener('fetch', function(event) {
  var request = event.request;
  var url = new URL(request.url);
  
  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    // For CDN resources, try network first
    if (url.hostname.includes('cdn.') || 
        url.hostname.includes('fonts.') || 
        url.hostname.includes('gstatic.com')) {
      event.respondWith(
        fetch(request).catch(function() {
          return caches.match(request);
        })
      );
      return;
    }
    return;
  }
  
  // Network-first for HTML pages
  if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(function(response) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(function() {
          return caches.match(request)
            .then(function(cachedResponse) {
              return cachedResponse || caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }
  
  // Cache-first for all other assets
  event.respondWith(
    caches.match(request)
      .then(function(cachedResponse) {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request)
          .then(function(response) {
            var responseClone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(request, responseClone);
            });
            return response;
          })
          .catch(function() {
            if (request.headers.get('accept') && request.headers.get('accept').includes('text/html')) {
              return caches.match(OFFLINE_URL);
            }
          });
      })
  );
});

// ============================================
// PUSH EVENT - RECEIVE RICH NOTIFICATION
// ============================================

self.addEventListener('push', function(event) {
  console.log('[Service Worker] 📨 Push event received!');
  
  // Default notification data
  var notificationData = {
    title: 'RGCI Member Care',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/index.html',
      type: 'notification'
    },
    // Rich notification settings
    requireInteraction: true,
    silent: false,
    tag: 'rgci-notification',
    renotify: true,
    actions: [
      {
        action: 'open',
        title: '📖 View Details'
      },
      {
        action: 'dismiss',
        title: '✕ Dismiss'
      }
    ]
  };
  
  // Parse the notification data
  if (event.data) {
    try {
      var payload = event.data.json();
      console.log('[Service Worker] 📝 Payload received:', payload);
      
      // Deep merge with default data
      notificationData = deepMerge(notificationData, payload);
      
      // Handle different notification types for customization
      if (payload.data && payload.data.type) {
        var notificationType = payload.data.type;
        console.log('[Service Worker] 📌 Notification type:', notificationType);
        
        // Customize based on type
        switch(notificationType) {
          case 'devotion':
            notificationData = customizeDevotionNotification(notificationData, payload);
            break;
          case 'event':
            notificationData = customizeEventNotification(notificationData, payload);
            break;
          case 'event_reminder':
            notificationData = customizeEventReminderNotification(notificationData, payload);
            break;
          case 'prayer_update':
            notificationData = customizePrayerNotification(notificationData, payload);
            break;
          case 'counselling_update':
            notificationData = customizeCounsellingNotification(notificationData, payload);
            break;
          case 'visit_update':
            notificationData = customizeVisitNotification(notificationData, payload);
            break;
          default:
            // Use default styling
            notificationData.title = payload.title || 'RGCI Member Care';
            notificationData.body = payload.body || 'You have a new notification';
        }
      }
      
    } catch (e) {
      // If not JSON, use as text
      console.log('[Service Worker] Text payload:', event.data.text());
      notificationData.body = event.data.text();
    }
  } else {
    console.log('[Service Worker] No data in push event');
  }
  
  console.log('[Service Worker] 📤 Final notification:', notificationData);
  
  // Show the rich notification
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon || '/icons/icon-192x192.png',
      badge: notificationData.badge || '/icons/icon-72x72.png',
      vibrate: notificationData.vibrate || [200, 100, 200],
      data: notificationData.data || { url: '/index.html' },
      actions: notificationData.actions || [
        {
          action: 'open',
          title: '📖 View Details'
        },
        {
          action: 'dismiss',
          title: '✕ Dismiss'
        }
      ],
      requireInteraction: notificationData.requireInteraction !== undefined ? notificationData.requireInteraction : true,
      silent: notificationData.silent || false,
      tag: notificationData.tag || 'rgci-notification-' + Date.now(),
      renotify: notificationData.renotify !== undefined ? notificationData.renotify : true,
      // Additional rich notification options
      image: notificationData.image || null,
      timestamp: notificationData.timestamp || Date.now(),
      // These are supported by some browsers
      title: notificationData.title,
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge
    })
    .then(function() {
      console.log('[Service Worker] ✅ Rich notification shown successfully!');
    })
    .catch(function(error) {
      console.error('[Service Worker] ❌ Failed to show notification:', error);
    })
  );
});

// ============================================
// CUSTOMIZE NOTIFICATION FUNCTIONS
// ============================================

function customizeDevotionNotification(data, payload) {
  return {
    ...data,
    title: '📖 ' + (payload.title || 'New Devotion Available'),
    body: payload.body || 'Read today\'s devotion',
    icon: '/icons/notification-devotion.png',
    tag: 'devotion-' + (payload.data?.id || Date.now()),
    data: {
      ...data.data,
      url: '/index.html?tab=devotion',
      type: 'devotion',
      id: payload.data?.id || ''
    },
    actions: [
      {
        action: 'open',
        title: '📖 Read Now'
      },
      {
        action: 'dismiss',
        title: '✕ Dismiss'
      }
    ]
  };
}

function customizeEventNotification(data, payload) {
  return {
    ...data,
    title: '📅 ' + (payload.title || 'New Event'),
    body: payload.body || 'Check out the upcoming event',
    icon: '/icons/notification-event.png',
    tag: 'event-' + (payload.data?.id || Date.now()),
    data: {
      ...data.data,
      url: '/events.html',
      type: 'event',
      id: payload.data?.id || ''
    },
    actions: [
      {
        action: 'open',
        title: '📅 View Event'
      },
      {
        action: 'dismiss',
        title: '✕ Dismiss'
      }
    ]
  };
}

function customizeEventReminderNotification(data, payload) {
  return {
    ...data,
    title: '⏰ ' + (payload.title || 'Event Reminder'),
    body: payload.body || 'Don\'t miss the upcoming event!',
    icon: '/icons/notification-reminder.png',
    tag: 'reminder-' + (payload.data?.id || Date.now()),
    data: {
      ...data.data,
      url: '/events.html',
      type: 'event_reminder',
      id: payload.data?.id || ''
    },
    actions: [
      {
        action: 'open',
        title: '⏰ View Event'
      },
      {
        action: 'dismiss',
        title: '✕ Dismiss'
      }
    ]
  };
}

function customizePrayerNotification(data, payload) {
  return {
    ...data,
    title: '🙏 ' + (payload.title || 'Prayer Update'),
    body: payload.body || 'Your prayer request has been updated',
    icon: '/icons/notification-prayer.png',
    tag: 'prayer-' + (payload.data?.id || Date.now()),
    data: {
      ...data.data,
      url: '/index.html',
      type: 'prayer_update',
      id: payload.data?.id || ''
    },
    actions: [
      {
        action: 'open',
        title: '🙏 View Prayer'
      },
      {
        action: 'dismiss',
        title: '✕ Dismiss'
      }
    ]
  };
}

function customizeCounsellingNotification(data, payload) {
  return {
    ...data,
    title: '💬 ' + (payload.title || 'Counselling Update'),
    body: payload.body || 'Your counselling request has been updated',
    icon: '/icons/notification-counselling.png',
    tag: 'counselling-' + (payload.data?.id || Date.now()),
    data: {
      ...data.data,
      url: '/index.html',
      type: 'counselling_update',
      id: payload.data?.id || ''
    },
    actions: [
      {
        action: 'open',
        title: '💬 View Request'
      },
      {
        action: 'dismiss',
        title: '✕ Dismiss'
      }
    ]
  };
}

function customizeVisitNotification(data, payload) {
  return {
    ...data,
    title: '🏠 ' + (payload.title || 'Visit Request Update'),
    body: payload.body || 'Your visit request has been updated',
    icon: '/icons/notification-visit.png',
    tag: 'visit-' + (payload.data?.id || Date.now()),
    data: {
      ...data.data,
      url: '/index.html',
      type: 'visit_update',
      id: payload.data?.id || ''
    },
    actions: [
      {
        action: 'open',
        title: '🏠 View Request'
      },
      {
        action: 'dismiss',
        title: '✕ Dismiss'
      }
    ]
  };
}

// ============================================
// DEEP MERGE UTILITY
// ============================================

function deepMerge(target, source) {
  var result = Object.assign({}, target);
  
  for (var key in source) {
    if (source.hasOwnProperty(key)) {
      if (typeof source[key] === 'object' && source[key] !== null && !Array.isArray(source[key])) {
        if (typeof target[key] === 'object' && target[key] !== null) {
          result[key] = deepMerge(target[key], source[key]);
        } else {
          result[key] = deepMerge({}, source[key]);
        }
      } else {
        result[key] = source[key];
      }
    }
  }
  
  return result;
}

// ============================================
// NOTIFICATION CLICK EVENT
// ============================================

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] 👆 Notification clicked:', event);
  
  // Close the notification
  event.notification.close();
  
  // Handle different actions
  if (event.action === 'dismiss') {
    console.log('[Service Worker] Dismissed notification');
    return;
  }
  
  // Get the URL from notification data
  var url = event.notification.data && event.notification.data.url 
    ? event.notification.data.url 
    : '/index.html';
  
  // Get the notification type for analytics
  var notificationType = event.notification.data && event.notification.data.type 
    ? event.notification.data.type 
    : 'unknown';
  
  console.log('[Service Worker] Opening URL:', url);
  console.log('[Service Worker] Notification type:', notificationType);
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        console.log('[Service Worker] Client list:', clientList.length);
        
        // Check if there's already a window/tab open
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if (client.url === url && 'focus' in client) {
            console.log('[Service Worker] Focusing existing client');
            return client.focus();
          }
        }
        
        // Open a new window/tab
        if (clients.openWindow) {
          console.log('[Service Worker] Opening new window');
          return clients.openWindow(url);
        }
      })
  );
});

// ============================================
// SYNC EVENT (Background Sync)
// ============================================

self.addEventListener('sync', function(event) {
  console.log('[Service Worker] Sync event:', event);
  
  if (event.tag === 'sync-requests') {
    event.waitUntil(syncOfflineRequests());
  }
});

function syncOfflineRequests() {
  return caches.open('offline-requests')
    .then(function(cache) {
      return cache.keys();
    })
    .then(function(requests) {
      return Promise.all(
        requests.map(function(request) {
          return fetch(request)
            .then(function(response) {
              if (response.ok) {
                return cache.delete(request);
              }
            })
            .catch(function() {
              // Keep the request for later
            });
        })
      );
    })
    .catch(function(error) {
      console.error('[Service Worker] Sync error:', error);
    });
}

// ============================================
// MESSAGE EVENT (for debugging & updates)
// ============================================

self.addEventListener('message', function(event) {
  console.log('[Service Worker] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_SUBSCRIPTION') {
    // Respond with subscription status
    event.ports[0].postMessage({
      type: 'SUBSCRIPTION_STATUS',
      data: {
        active: !!self.registration.pushManager
      }
    });
  }
});

// ============================================
// PERIODIC BACKGROUND SYNC
// ============================================

self.addEventListener('periodicsync', function(event) {
  console.log('[Service Worker] Periodic sync:', event);
  
  if (event.tag === 'update-content') {
    event.waitUntil(updateContent());
  }
});

function updateContent() {
  console.log('[Service Worker] Updating content...');
  // This can be used to fetch new content in the background
  // For now, just log it
  return Promise.resolve();
}

console.log('[Service Worker] ✅ Service Worker loaded and ready!');