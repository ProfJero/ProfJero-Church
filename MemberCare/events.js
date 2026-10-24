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

let currentFilter = 'all';
let currentUser = null;
let allEvents = [];
let myEvents = [];
let selectedDate = null;
let isOnline = navigator.onLine;
let isInitialized = false;

// ============================================
// DOM ELEMENTS
// ============================================

const eventsGrid = document.getElementById('eventsGrid');
const pastEventsList = document.getElementById('pastEventsList');
const myEventsList = document.getElementById('myEventsList');
const calendarGrid = document.getElementById('calendarGrid');
const calendarEvents = document.getElementById('calendarEvents');

// ============================================
// DEFAULT IMAGES
// ============================================

const DEFAULT_IMAGES = {
    featured: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDV2oPmRg-podHhF2B9ILGUzbUFACrHO2DfWwoNafUL57a9DlXwSIhTRKxjKu2WKP2wKiEjYE6ZfWYGnmIFSZp4335iOR7rYtcknhQXU3q0HtAOXhTspfN_Jqz2LWK_Me5bNY2l51FXoqQWCLVZvcWnelFaBY8GMUYAVTSKoe_TWN0-BbPN74NB4cNqnFb2Y7u19PGNW4XtR9O3aDoxBEKv9FRwaTE3Y8WuKOXHBG9B_bNikMiph8fT',
    event: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCe4YS63z6wwcizd7n-lD2tIMPNp6Luxfn8XD3lyR3Y_FvXPaM4ciALEzyvOHvGh3Hh57rqRo9lxZjNwK9bjdFUVeZ4NC9XuZvcYaG5vG1hztd8YVfTqIy82tTxf8R_TvLEX8Lo8NH1muZTLWM_jLI6hPuX4PiYFyFrqEusSzFEPOlpYuBUUUGeqB4U__xD_mURsM1SWAlDqa1whgkgGHVNLJl0vM7pcNXt-1F8WSSvc09GFDfMqkNu',
    past: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD9vAkXf3qCedoUs5NiJ1N18kmIWKXjv_vOpPSiCUkMMwdLdRhl7pezK-nUb-ZfAJerzM2CGPz_q5sPGbeVWxTIxIos7gJGTNnVHawQ4ZYPn8ElkYui5JVYSs8iyT14zdl1HqCDqcfGYPrNVM0nslPL9WzosLi4QYY7pNJPhp8tTFZPx7tQW7VrAvY3Zvw3TT6JekGIZFylfothZ4jL2JNAkoYS_UeC5SqPY8L9iHaSLqdILcx3uKcJ'
};

// ============================================
// NETWORK STATUS
// ============================================

window.addEventListener('online', () => {
    isOnline = true;
    console.log('Back online');
    showToast('Back online!', 'success');
    loadEvents();
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
// GET EVENT IMAGE
// ============================================

function getEventImage(event) {
    // If event has an image URL, use it
    if (event.image && event.image.trim() !== '') {
        return event.image;
    }
    // If event is featured, use featured default
    if (event.featured) {
        return DEFAULT_IMAGES.featured;
    }
    // If event is past, use past default
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eventDate = new Date(event.startDate);
    eventDate.setHours(0, 0, 0, 0);
    if (eventDate < today) {
        return DEFAULT_IMAGES.past;
    }
    // Default event image
    return DEFAULT_IMAGES.event;
}

// ============================================
// LOAD EVENTS FROM FIRESTORE
// ============================================

async function loadEvents() {
    try {
        // Try to load from cache first
        const cachedEvents = localStorage.getItem('cachedEvents');
        if (cachedEvents) {
            try {
                const parsed = JSON.parse(cachedEvents);
                if (parsed && parsed.length > 0) {
                    allEvents = parsed;
                    renderAllEvents();
                    console.log('📦 Using cached events');
                }
            } catch (e) {
                console.error('Error parsing cached events:', e);
            }
        }
        
        if (!isOnline) {
            showToast('Offline - showing cached events', 'info');
            return;
        }
        
        // Load from Firestore
        const snapshot = await db.collection('events')
            .where('status', '==', 'published')
            .orderBy('startDate', 'desc')
            .get();
        
        if (!snapshot.empty) {
            allEvents = [];
            snapshot.forEach(doc => {
                allEvents.push({ id: doc.id, ...doc.data() });
            });
            
            // Cache the results
            localStorage.setItem('cachedEvents', JSON.stringify(allEvents));
            console.log('✅ Events loaded from Firestore');
        } else {
            // No events found, keep cached data if available
            if (allEvents.length === 0) {
                allEvents = [];
                showToast('No events available', 'info');
            }
        }
        
        renderAllEvents();
        
    } catch (error) {
        console.error('Error loading events:', error);
        // Use cached data if available
        const cachedEvents = localStorage.getItem('cachedEvents');
        if (cachedEvents) {
            try {
                allEvents = JSON.parse(cachedEvents);
                if (allEvents.length > 0) {
                    renderAllEvents();
                    showToast('Using cached events', 'info');
                }
            } catch (e) {
                allEvents = [];
                renderAllEvents();
            }
        } else {
            allEvents = [];
            renderAllEvents();
            showToast('Error loading events. Please refresh.', 'error');
        }
    }
}

// ============================================
// RENDER ALL EVENTS
// ============================================

function renderAllEvents() {
    // Load saved events from localStorage
    loadSavedEvents();
    
    renderFeaturedEvent();
    renderEvents(currentFilter);
    renderPastEvents();
    renderMyEvents();
    renderCalendar();
    updateReminder();
    updateNotificationBadge();
}

// ============================================
// LOAD SAVED EVENTS FROM LOCALSTORAGE
// ============================================

function loadSavedEvents() {
    const saved = localStorage.getItem('savedEvents');
    if (saved) {
        try {
            const savedIds = JSON.parse(saved);
            myEvents = allEvents.filter(e => savedIds.includes(e.id));
        } catch (e) {
            console.error('Error parsing saved events:', e);
            myEvents = [];
        }
    } else {
        myEvents = [];
    }
}

// ============================================
// SAVE EVENTS TO LOCALSTORAGE
// ============================================

function saveEventsToStorage() {
    const eventIds = myEvents.map(e => e.id);
    localStorage.setItem('savedEvents', JSON.stringify(eventIds));
}

// ============================================
// RENDER FEATURED EVENT
// ============================================

function renderFeaturedEvent() {
    const featured = allEvents.find(e => e.featured === true);
    const container = document.getElementById('featuredEventContainer');
    
    if (!featured) {
        if (container) container.classList.add('hidden');
        return;
    }
    
    if (container) container.classList.remove('hidden');
    
    // Use the event's image or default
    const imageUrl = getEventImage(featured);
    document.getElementById('featuredImage').style.backgroundImage = `url('${imageUrl}')`;
    document.getElementById('featuredTitle').textContent = featured.title;
    document.getElementById('featuredSubtitle').textContent = featured.description || featured.category || '';
    document.getElementById('featuredDate').textContent = formatDateString(featured.startDate);
    document.getElementById('featuredLocation').textContent = featured.location || 'RGCI';
    
    const isSaved = myEvents.some(e => e.id === featured.id);
    document.getElementById('featuredBookmarkBtn').innerHTML = `<i class="${isSaved ? 'fas' : 'far'} fa-bookmark text-white"></i>`;
    document.getElementById('featuredBookmarkBtn').onclick = () => toggleSaveEvent(featured.id);
    document.getElementById('featuredViewBtn').onclick = () => viewEventDetails(featured.id);
}

// ============================================
// RENDER EVENTS GRID
// ============================================

function renderEvents(filter = 'all') {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let filteredEvents = allEvents.filter(e => {
        const eventDate = new Date(e.startDate);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today;
    });
    
    if (filter !== 'all') {
        filteredEvents = filteredEvents.filter(e => e.category === filter);
    }
    
    // Sort by date (closest first)
    filteredEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    
    if (filteredEvents.length === 0) {
        eventsGrid.innerHTML = `
            <div class="text-center py-8 text-gray-400 w-full">
                <i class="fas fa-calendar-times text-4xl block mx-auto mb-2 opacity-30"></i>
                No events found for this category.
            </div>
        `;
        return;
    }
    
    const categoryColors = {
        worship: 'bg-primary/60 text-white',
        conference: 'bg-secondary/60 text-white',
        youth: 'bg-tertiary-fixed-dim/80 text-primary',
        campus: 'bg-secondary/60 text-white',
        teaching: 'bg-tertiary-fixed-dim/80 text-primary'
    };
    
    eventsGrid.innerHTML = filteredEvents.map(event => {
        const colorClass = categoryColors[event.category] || 'bg-primary/60 text-white';
        const isSaved = myEvents.some(e => e.id === event.id);
        const imageUrl = getEventImage(event);
        
        return `
            <div class="min-w-[240px] bg-white rounded-2xl overflow-hidden shadow-[0px_4px_20px_rgba(0,0,0,0.04)] border border-surface-variant/30 event-card group">
                <div class="h-32 bg-cover bg-center relative" style="background-image: url('${imageUrl}')">
                    <span class="absolute top-2 left-2 ${colorClass} text-[10px] px-2 py-0.5 rounded-full font-bold backdrop-blur-md">
                        ${event.category ? event.category.charAt(0).toUpperCase() + event.category.slice(1) : 'Event'}
                    </span>
                    <button onclick="toggleSaveEvent('${event.id}')" class="absolute top-2 right-2 bg-white/20 backdrop-blur-md p-1.5 rounded-full hover:bg-white/30 transition-colors">
                        <i class="${isSaved ? 'fas' : 'far'} fa-bookmark text-white text-sm"></i>
                    </button>
                </div>
                <div class="p-4 space-y-3">
                    <h4 class="font-headline-sm text-[15px] leading-tight group-hover:text-secondary transition-colors">${event.title}</h4>
                    <div class="space-y-1.5">
                        <div class="flex items-center gap-2 text-on-surface-variant font-label-md text-[11px]">
                            <i class="fas fa-calendar-alt text-[12px]"></i>
                            ${formatDateString(event.startDate)}
                        </div>
                        <div class="flex items-center gap-2 text-on-surface-variant font-label-md text-[11px]">
                            <i class="fas fa-clock text-[12px]"></i>
                            ${event.time || 'TBD'}
                        </div>
                        <div class="flex items-center gap-2 text-on-surface-variant font-label-md text-[11px]">
                            <i class="fas fa-location-dot text-[12px]"></i>
                            ${event.location || 'RGCI'}
                        </div>
                    </div>
                    <button onclick="viewEventDetails('${event.id}')" class="w-full py-2.5 rounded-xl border border-outline-variant text-secondary font-label-md hover:bg-secondary/5 transition-all active:scale-95">
                        View Details
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// RENDER PAST EVENTS
// ============================================

function renderPastEvents() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const pastEvents = allEvents.filter(e => {
        const eventDate = new Date(e.startDate);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate < today;
    }).sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    
    if (pastEvents.length === 0) {
        pastEventsList.innerHTML = `
            <div class="text-center py-8 text-gray-400 w-full">
                <i class="fas fa-history text-4xl block mx-auto mb-2 opacity-30"></i>
                No past events yet.
            </div>
        `;
        return;
    }
    
    pastEventsList.innerHTML = pastEvents.slice(0, 5).map(event => {
        const imageUrl = getEventImage(event);
        return `
            <div class="min-w-[180px] bg-white p-3 rounded-3xl shadow-sm border border-surface-variant/20 event-card">
                <div class="h-28 rounded-2xl overflow-hidden mb-3">
                    <img class="w-full h-full object-cover" src="${imageUrl}" alt="${event.title}"/>
                </div>
                <h6 class="text-[13px] font-bold text-primary">${event.title}</h6>
                <p class="text-[10px] text-outline mb-2">${formatDateString(event.startDate)}</p>
                <button onclick="viewEventDetails('${event.id}')" class="text-secondary text-[11px] font-bold flex items-center gap-1">
                    View Recap <i class="fas fa-chevron-right text-[10px]"></i>
                </button>
            </div>
        `;
    }).join('');
}

// ============================================
// RENDER CALENDAR
// ============================================

function renderCalendar() {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const today = now.getDate();
    
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();
    
    // Get events for each day
    const eventsByDate = {};
    allEvents.forEach(event => {
        if (event.startDate) {
            const date = event.startDate;
            if (!eventsByDate[date]) {
                eventsByDate[date] = [];
            }
            eventsByDate[date].push(event);
        }
    });
    
    let html = '';
    const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    dayNames.forEach(day => {
        html += `<div class="text-[10px] font-bold text-outline-variant uppercase text-center">${day}</div>`;
    });
    
    // Adjust for Monday start
    let startOffset = firstDay === 0 ? 6 : firstDay - 1;
    
    // Previous month days
    for (let i = startOffset - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        html += `<div class="text-center text-gray-300 text-sm py-1">${day}</div>`;
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const hasEvent = eventsByDate[dateStr] && eventsByDate[dateStr].length > 0;
        const isToday = day === today;
        const isSelected = dateStr === selectedDate;
        
        html += `
            <div class="flex flex-col items-center gap-1 cursor-pointer group" onclick="selectDate('${dateStr}')">
                <span class="w-9 h-9 flex items-center justify-center font-bold text-on-surface-variant text-sm 
                    ${isSelected ? 'bg-secondary text-on-secondary rounded-xl shadow-md shadow-secondary/20' : ''}
                    ${isToday && !isSelected ? 'ring-2 ring-secondary/30 rounded-xl' : ''}
                    ${hasEvent && !isSelected ? 'text-secondary font-bold' : ''}
                    group-hover:bg-secondary/10 rounded-xl transition-all">
                    ${day}
                </span>
                ${hasEvent ? '<div class="w-1 h-1 bg-secondary rounded-full"></div>' : ''}
            </div>
        `;
    }
    
    // Next month days
    const totalDays = startOffset + daysInMonth;
    const remainingDays = (7 - (totalDays % 7)) % 7;
    for (let day = 1; day <= remainingDays; day++) {
        html += `<div class="text-center text-gray-300 text-sm py-1">${day}</div>`;
    }
    
    calendarGrid.innerHTML = html;
    
    // Select today by default
    if (!selectedDate) {
        const todayStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(today).padStart(2, '0')}`;
        selectDate(todayStr);
    }
}

// ============================================
// SELECT DATE ON CALENDAR
// ============================================

window.selectDate = function(dateStr) {
    selectedDate = dateStr;
    renderCalendar();
    renderCalendarEvents(dateStr);
};

// ============================================
// RENDER CALENDAR EVENTS
// ============================================

function renderCalendarEvents(dateStr) {
    const events = allEvents.filter(e => e.startDate === dateStr);
    
    if (events.length === 0) {
        calendarEvents.innerHTML = `
            <p class="text-sm text-gray-400 text-center py-4">No events on this day</p>
        `;
        return;
    }
    
    calendarEvents.innerHTML = events.map(event => {
        const imageUrl = getEventImage(event);
        return `
            <div class="flex gap-3 group cursor-pointer" onclick="viewEventDetails('${event.id}')">
                <div class="w-12 h-12 rounded-xl bg-surface-container overflow-hidden shrink-0">
                    <img class="w-full h-full object-cover" src="${imageUrl}" alt="${event.title}"/>
                </div>
                <div class="flex-grow">
                    <div class="flex justify-between items-start">
                        <h5 class="text-sm font-bold text-primary">${event.title}</h5>
                        <span class="bg-tertiary-fixed/40 text-[9px] px-2 py-0.5 rounded font-bold text-on-tertiary-container">${event.category || 'Event'}</span>
                    </div>
                    <p class="text-[11px] text-on-surface-variant">${event.time || 'TBD'}</p>
                    <p class="text-[11px] text-outline">${event.location || 'RGCI'}</p>
                </div>
            </div>
        `;
    }).join('');
}

// ============================================
// RENDER MY EVENTS
// ============================================

function renderMyEvents() {
    if (myEvents.length === 0) {
        myEventsList.innerHTML = `
            <div class="text-center py-4 text-gray-400 text-sm">
                <i class="fas fa-bookmark text-2xl block mx-auto mb-2 opacity-30"></i>
                No saved events yet.
            </div>
        `;
        return;
    }
    
    myEventsList.innerHTML = myEvents.slice(0, 3).map(event => {
        const isUpcoming = new Date(event.startDate) >= new Date();
        const status = isUpcoming ? 'Upcoming' : 'Past';
        const statusColor = isUpcoming ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600';
        const imageUrl = getEventImage(event);
        
        return `
            <div class="flex items-center gap-3 cursor-pointer" onclick="viewEventDetails('${event.id}')">
                <img class="w-14 h-14 rounded-2xl object-cover" src="${imageUrl}" alt="${event.title}"/>
                <div class="flex-grow">
                    <h6 class="text-[13px] font-bold text-primary">${event.title}</h6>
                    <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span class="text-[9px] ${statusColor} px-1.5 py-0.5 rounded font-bold">${status}</span>
                        <span class="text-[10px] text-outline">${formatDateString(event.startDate)}</span>
                    </div>
                </div>
                <button onclick="event.stopPropagation(); toggleSaveEvent('${event.id}')" class="p-2 hover:bg-surface-variant/50 rounded-full">
                    <i class="fas fa-bookmark text-secondary text-sm"></i>
                </button>
            </div>
        `;
    }).join('');
}

// ============================================
// UPDATE REMINDER CARD
// ============================================

function updateReminder() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcomingEvents = allEvents.filter(e => {
        const eventDate = new Date(e.startDate);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today;
    }).sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    
    if (upcomingEvents.length === 0) {
        document.getElementById('reminderTitle').textContent = 'No upcoming events';
        document.getElementById('reminderDate').textContent = 'Check back later';
        document.getElementById('reminderViewBtn').style.display = 'none';
        return;
    }
    
    const nextEvent = upcomingEvents[0];
    document.getElementById('reminderTitle').textContent = nextEvent.title;
    document.getElementById('reminderDate').textContent = `${formatDateString(nextEvent.startDate)} • ${nextEvent.time || 'TBD'}`;
    document.getElementById('reminderViewBtn').style.display = 'block';
    document.getElementById('reminderViewBtn').onclick = () => viewEventDetails(nextEvent.id);
}

// ============================================
// UPDATE NOTIFICATION BADGE
// ============================================

function updateNotificationBadge() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const upcomingCount = allEvents.filter(e => {
        const eventDate = new Date(e.startDate);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate >= today;
    }).length;
    
    const badge = document.getElementById('notificationBadge');
    if (badge) {
        if (upcomingCount > 0) {
            badge.classList.remove('hidden');
            badge.textContent = upcomingCount;
        } else {
            badge.classList.add('hidden');
        }
    }
}

// ============================================
// TOGGLE SAVE EVENT
// ============================================

window.toggleSaveEvent = function(eventId) {
    const event = allEvents.find(e => e.id === eventId);
    if (!event) {
        showToast('Event not found', 'error');
        return;
    }
    
    const index = myEvents.findIndex(e => e.id === eventId);
    if (index > -1) {
        myEvents.splice(index, 1);
        showToast(`Removed "${event.title}" from saved events`, 'info');
    } else {
        myEvents.push(event);
        showToast(`Added "${event.title}" to saved events`, 'success');
    }
    
    saveEventsToStorage();
    renderFeaturedEvent();
    renderEvents(currentFilter);
    renderMyEvents();
};

// ============================================
// VIEW EVENT DETAILS
// ============================================

window.viewEventDetails = function(eventId) {
    const event = allEvents.find(e => e.id === eventId);
    if (!event) {
        showToast('Event not found', 'error');
        return;
    }
    
    const isSaved = myEvents.some(e => e.id === event.id);
    const isUpcoming = new Date(event.startDate) >= new Date();
    const imageUrl = getEventImage(event);
    
    const modal = document.getElementById('eventDetailModal');
    const content = document.getElementById('eventDetailContent');
    
    content.innerHTML = `
        <div class="space-y-4">
            ${event.image ? `<img src="${imageUrl}" alt="${event.title}" class="w-full h-48 object-cover rounded-xl">` : ''}
            <div>
                <div class="flex items-center gap-2 flex-wrap">
                    <h2 class="text-xl font-bold text-primary">${event.title}</h2>
                    <span class="text-xs px-2 py-1 rounded-full ${isUpcoming ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}">
                        ${isUpcoming ? 'Upcoming' : 'Past'}
                    </span>
                    ${event.featured ? '<span class="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700"><i class="fas fa-star mr-1"></i>Featured</span>' : ''}
                </div>
                <p class="text-sm text-gray-500 mt-1">${event.category ? event.category.charAt(0).toUpperCase() + event.category.slice(1) : 'Event'}</p>
            </div>
            
            <div class="grid grid-cols-2 gap-3 text-sm">
                <div class="bg-gray-50 p-3 rounded-xl">
                    <p class="text-gray-400 text-xs">Date</p>
                    <p class="font-medium">${formatDateString(event.startDate)}${event.endDate ? ' - ' + formatDateString(event.endDate) : ''}</p>
                </div>
                <div class="bg-gray-50 p-3 rounded-xl">
                    <p class="text-gray-400 text-xs">Time</p>
                    <p class="font-medium">${event.time || 'TBD'}</p>
                </div>
                <div class="bg-gray-50 p-3 rounded-xl col-span-2">
                    <p class="text-gray-400 text-xs">Location</p>
                    <p class="font-medium">${event.location || 'RGCI Main Auditorium'}</p>
                </div>
            </div>
            
            ${event.description ? `
                <div>
                    <p class="text-gray-400 text-xs">Description</p>
                    <p class="text-gray-700 mt-1">${event.description}</p>
                </div>
            ` : ''}
            
            <div class="flex gap-3">
                <button onclick="toggleSaveEvent('${event.id}'); closeEventModal()" class="flex-1 ${isSaved ? 'bg-secondary' : 'bg-gray-100'} text-${isSaved ? 'white' : 'gray-700'} py-3 rounded-xl font-semibold hover:opacity-90 transition">
                    <i class="fas ${isSaved ? 'fa-bookmark' : 'fa-bookmark'} mr-2"></i>
                    ${isSaved ? 'Saved' : 'Save Event'}
                </button>
                <button onclick="closeEventModal()" class="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition">
                    Close
                </button>
            </div>
        </div>
    `;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
};

// ============================================
// CLOSE EVENT MODAL
// ============================================

window.closeEventModal = function() {
    const modal = document.getElementById('eventDetailModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';
    }
};

// ============================================
// SETUP CATEGORY FILTERS
// ============================================

function setupFilters() {
    const filters = document.querySelectorAll('.filter-btn');
    filters.forEach(btn => {
        btn.addEventListener('click', () => {
            filters.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderEvents(currentFilter);
        });
    });
}

// ============================================
// SETUP EVENT LISTENERS
// ============================================

function setupEventListeners() {
    // Notification button
    const notificationBtn = document.getElementById('notificationBtn');
    if (notificationBtn) {
        notificationBtn.addEventListener('click', () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const upcoming = allEvents.filter(e => {
                const eventDate = new Date(e.startDate);
                eventDate.setHours(0, 0, 0, 0);
                return eventDate >= today;
            }).length;
            
            const saved = myEvents.length;
            
            let message = '';
            if (upcoming > 0) {
                message += `${upcoming} upcoming event(s)`;
            }
            if (saved > 0) {
                message += `${message ? ' • ' : ''}${saved} saved event(s)`;
            }
            if (!message) {
                message = 'No notifications';
            }
            showToast(message, 'info');
        });
    }
    
    // Search button
    const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            showToast('Search events by typing in the search bar', 'info');
        });
    }
    
    // View all my events
    const viewAllMyEvents = document.getElementById('viewAllMyEvents');
    if (viewAllMyEvents) {
        viewAllMyEvents.addEventListener('click', () => {
            if (myEvents.length === 0) {
                showToast('No saved events yet', 'info');
                return;
            }
            const count = myEvents.length;
            showToast(`You have ${count} saved event(s)`, 'info');
        });
    }
    
    // Close modal on overlay click
    const modalOverlay = document.querySelector('#eventDetailModal .modal-overlay');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', closeEventModal);
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatDateString(dateStr) {
    if (!dateStr) return 'TBD';
    try {
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
        return dateStr;
    }
}

// ============================================
// INITIALIZE PAGE
// ============================================

function initPage() {
    if (isInitialized) return;
    isInitialized = true;
    
    console.log('🚀 Initializing RGCI Events Page...');
    console.log('📁 Project:', firebaseConfig.projectId);
    
    // Check authentication
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            console.log('✅ User authenticated:', user.uid);
            
            try {
                const userDoc = await db.collection('users').doc(user.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    console.log('✅ User data loaded');
                }
            } catch (error) {
                console.error('Error loading user data:', error);
            }
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
        
        // Load events
        await loadEvents();
        setupFilters();
        setupEventListeners();
        
        console.log('✅ RGCI Events page initialized successfully! 🎉');
    });
}

// ============================================
// STICKY HEADER EFFECT
// ============================================

window.addEventListener('scroll', () => {
    const header = document.querySelector('header');
    if (header) {
        if (window.scrollY > 10) {
            header.classList.add('shadow-md');
            header.classList.remove('bg-background/85');
            header.classList.add('bg-background/95');
        } else {
            header.classList.remove('shadow-md');
            header.classList.add('bg-background/85');
            header.classList.remove('bg-background/95');
        }
    }
});

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

// Check if app is installed and running standalone
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                     window.navigator.standalone === true;

if (isStandalone) {
    console.log('📱 App is installed and running in standalone mode');
    // You can add special logic for installed app here
}

// ============================================
// INITIALIZE
// ============================================

document.addEventListener('DOMContentLoaded', initPage);

// ============================================
// EXPORT FOR DEBUGGING
// ============================================

window.__eventsApp = {
    db,
    auth,
    allEvents,
    myEvents,
    currentUser,
    currentFilter,
    selectedDate,
    isOnline,
    loadEvents,
    renderEvents,
    toggleSaveEvent,
    viewEventDetails,
    closeEventModal,
    selectDate,
    getEventImage
};

console.log('📋 Events app state exported to window.__eventsApp for debugging');