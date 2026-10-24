// Seeds the LOCAL EMULATOR with realistic demo data. Refuses to touch real projects.
// Usage: npm run emulators   (in one terminal)   then   npm run seed
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST ||= '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
const projectId = process.env.SEED_PROJECT || 'demo-cwc';
if (!projectId.startsWith('demo-')) throw new Error('Seeding is only allowed against demo-* emulator projects.');

initializeApp({ projectId });
const db = getFirestore();
const auth = getAuth();

let seed = 20261024;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rand() * a.length)];
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => { const d = new Date(); d.setHours(10, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const ts = (d) => Timestamp.fromDate(d);
const keywords = (...v) => { const out = new Set(); for (const s of v) for (const w of String(s || '').toLowerCase().split(/[\s,.-]+/).filter(Boolean)) for (let i = 2; i <= Math.min(w.length, 12); i++) out.add(w.slice(0, i)); return [...out]; };

const MALE = ['Kwame', 'Kofi', 'Kwabena', 'Yaw', 'Kojo', 'Kwaku', 'Kwesi', 'Fiifi', 'Nana', 'Selorm', 'Eyram', 'Mawuli', 'Elikem', 'Daniel', 'Samuel', 'Emmanuel', 'Joseph', 'Isaac', 'Michael', 'Prince', 'Richard', 'Ebenezer', 'Godwin', 'Bernard'];
const FEMALE = ['Ama', 'Akosua', 'Abena', 'Efua', 'Adwoa', 'Akua', 'Yaa', 'Esi', 'Afia', 'Dela', 'Enyonam', 'Mansa', 'Naa', 'Dzifa', 'Grace', 'Gifty', 'Mercy', 'Comfort', 'Patience', 'Josephine', 'Priscilla', 'Rita', 'Linda', 'Deborah'];
const SURNAMES = ['Mensah', 'Owusu', 'Boateng', 'Asante', 'Agyeman', 'Osei', 'Appiah', 'Addo', 'Tetteh', 'Quaye', 'Ofori', 'Amoah', 'Darko', 'Antwi', 'Sarpong', 'Adjei', 'Ampofo', 'Danso', 'Acheampong', 'Badu', 'Frimpong', 'Gyamfi', 'Kumi', 'Nkansah', 'Opoku', 'Larbi', 'Lamptey', 'Ankrah', 'Agbeko', 'Kpodo'];
const PREFIX = ['24', '54', '55', '59', '20', '50', '26', '27', '57', '53'];
const AREAS = ['Adenta', 'Madina', 'East Legon', 'Tema Comm. 25', 'Spintex', 'Dansoman', 'Kasoa', 'Achimota', 'Dome', 'Haatso', 'Lapaz', 'Teshie'];
const JOBS = ['Teacher', 'Nurse', 'Trader', 'Accountant', 'Engineer', 'Student', 'Banker', 'Civil Servant', 'Entrepreneur', 'Pharmacist', 'Driver', 'Seamstress', 'IT Specialist', 'Lecturer'];
const REGIONS = ['Greater Accra', 'Ashanti', 'Central', 'Eastern', 'Volta', 'Western', 'Northern', 'Bono'];

const GROUPS = [
  ['Voices of Worship (Choir)', 'ministry', 'Thursday', '18:30'],
  ['Ushering & Protocol', 'department', 'Saturday', '16:00'],
  ['Youth Ministry', 'ministry', 'Friday', '18:30'],
  ["Women's Fellowship", 'fellowship', 'Saturday', '15:00'],
  ["Men's Fellowship", 'fellowship', 'Saturday', '07:00'],
  ["Children's Ministry", 'ministry', 'Sunday', '09:00'],
  ['Media & Tech', 'department', 'Wednesday', '17:30'],
  ['Prayer Warriors', 'ministry', 'Tuesday', '05:30'],
  ['Evangelism Team', 'ministry', 'Saturday', '09:00'],
  ['Welfare Committee', 'committee', 'Monthly', '17:00'],
  ['Adenta Home Cell', 'cell', 'Wednesday', '19:00'],
  ['Madina Home Cell', 'cell', 'Wednesday', '19:00'],
  ['East Legon Home Cell', 'cell', 'Thursday', '19:00'],
  ['Tema Home Cell', 'cell', 'Thursday', '19:00'],
];

async function commitAll(writes) {
  for (let i = 0; i < writes.length; i += 400) {
    const b = db.batch();
    for (const [ref, data] of writes.slice(i, i + 400)) b.set(ref, data);
    await b.commit();
  }
}

async function main() {
  console.log('Seeding demo data into', projectId);
  const W = [];

  // ---- settings
  W.push([db.doc('settings/bootstrap'), { by: 'seed', at: FieldValue.serverTimestamp() }]);
  W.push([db.doc('settings/church'), {
    name: 'Christian Worship Centre', shortName: 'CWC', tagline: 'Worship • Word • World',
    address: 'Off Adenta–Dodowa Road, Adenta, Accra', gpsAddress: 'GD-123-4567', phone: '233302123456', email: 'info@cwc.example',
    serviceTimes: 'Sundays 7:30 AM & 10:00 AM • Wednesdays 6:30 PM',
    serviceTypes: ['Sunday First Service', 'Sunday Second Service', 'Midweek Service', 'Prayer Meeting', 'Youth Service', 'Special Service'],
    givingCategories: ['Tithe', 'Offering', 'Thanksgiving', 'Seed', 'Building Fund', 'Welfare', 'Missions', 'Pledge Redemption', 'Harvest', 'Other'],
    expenseCategories: ['Utilities', 'Rent', 'Salaries & Allowances', 'Maintenance', 'Outreach & Missions', 'Welfare Support', 'Equipment', 'Transport', 'Hospitality', 'Office & Admin', 'Other'],
    eventCategories: ['Service', 'Conference', 'Crusade', 'Youth', 'Women', 'Men', 'Children', 'Prayer', 'Outreach', 'Fellowship', 'Other'],
    paymentAccounts: [
      { label: 'MTN Mobile Money', kind: 'momo', name: 'Christian Worship Centre', number: '0244000111', extra: 'Merchant ID 445566 • Dial *170#' },
      { label: 'Telecel Cash', kind: 'momo', name: 'Christian Worship Centre', number: '0204000222' },
      { label: 'GCB Bank', kind: 'bank', name: 'Christian Worship Centre', number: '1011130045678', extra: 'Adenta Branch' },
    ],
    smsSenderId: 'CWC', smsSignature: '- CWC',
    welcomeSms: 'Dear {first_name|Beloved}, thank you for worshipping with us at Christian Worship Centre. We are glad you came and look forward to seeing you again. God bless you!',
    birthdaySms: 'Happy birthday {first_name|Beloved}! Christian Worship Centre celebrates you today. May the Lord bless you and keep you. Num 6:24',
    autoBirthdaySms: false, autoWelcomeSms: false,
  }]);

  // ---- groups
  const groupIds = GROUPS.map((g, i) => `grp-${i + 1}`);
  // ---- members
  const members = [];
  const statuses = ['member', 'member', 'member', 'member', 'worker', 'worker', 'leader', 'first_timer', 'visitor', 'new_convert', 'inactive'];
  for (let i = 0; i < 180; i++) {
    const gender = rand() < 0.56 ? 'female' : 'male';
    const firstName = pick(gender === 'female' ? FEMALE : MALE);
    const lastName = pick(SURNAMES);
    const ageYears = int(8, 72);
    const dob = new Date(); dob.setFullYear(dob.getFullYear() - ageYears); dob.setMonth(int(0, 11)); dob.setDate(int(1, 28));
    if (i < 4) { dob.setMonth(new Date().getMonth()); dob.setDate(new Date().getDate() + i); } // birthdays this week
    const status = i < 6 ? 'first_timer' : pick(statuses);
    const joined = daysAgo(status === 'first_timer' ? int(1, 20) : int(30, 2400));
    const gids = new Set();
    if (status !== 'visitor' && status !== 'first_timer') {
      gids.add(groupIds[10 + int(0, 3)]);
      if (rand() < 0.6) gids.add(groupIds[int(0, 9)]);
      if (ageYears < 30 && ageYears >= 13) gids.add(groupIds[2]);
      if (ageYears < 13) gids.add(groupIds[5]);
    }
    const phone = `233${pick(PREFIX)}${String(int(1000000, 9999999))}`;
    const m = {
      id: `mem-${String(i + 1).padStart(3, '0')}`,
      firstName, lastName, otherNames: '', fullName: `${firstName} ${lastName}`, title: gender === 'female' ? (ageYears > 30 ? 'Mrs.' : 'Sis.') : 'Bro.',
      gender, dob: iso(dob), birthMonthDay: `${pad(dob.getMonth() + 1)}-${pad(dob.getDate())}`,
      phone, email: rand() < 0.5 ? `${firstName}.${lastName}${i}@example.com`.toLowerCase() : '',
      address: `${pick(AREAS)}, Accra`, gpsAddress: `GA-${int(100, 999)}-${int(1000, 9999)}`, hometown: pick(['Kumasi', 'Cape Coast', 'Ho', 'Koforidua', 'Takoradi', 'Tamale', 'Sunyani', 'Accra']),
      region: pick(REGIONS), occupation: ageYears < 18 ? 'Student' : pick(JOBS),
      maritalStatus: ageYears > 28 ? pick(['married', 'married', 'single', 'widowed']) : 'single',
      membershipStatus: status, joinDate: iso(joined), baptismDate: rand() < 0.6 ? iso(daysAgo(int(60, 3000))) : '',
      groupIds: [...gids], householdId: null, householdRole: '', photoUrl: '',
      emergencyName: rand() < 0.5 ? `${pick(FEMALE)} ${lastName}` : '', emergencyPhone: rand() < 0.5 ? `233${pick(PREFIX)}${int(1000000, 9999999)}` : '', emergencyRelation: 'Relative',
      notes: '', tags: rand() < 0.15 ? ['instrumentalist'] : [], uid: null, howHeard: status === 'first_timer' ? pick(['Friend', 'Social media', 'Walked in', 'Crusade']) : '',
      smsOptOut: false, keywords: [],
      createdAt: ts(joined), updatedAt: ts(joined),
    };
    m.keywords = keywords(m.fullName, m.phone.slice(-9), m.email);
    members.push(m);
  }
  // a few households
  for (let h = 0; h < 12; h++) {
    const hid = `hh-${h + 1}`;
    const head = members[20 + h * 3];
    W.push([db.doc(`households/${hid}`), { name: `${head.lastName} household`, createdAt: FieldValue.serverTimestamp() }]);
    [0, 1, 2].forEach((k, idx) => { const m = members[20 + h * 3 + k]; m.householdId = hid; m.householdRole = ['head', 'spouse', 'child'][idx]; m.lastName = head.lastName; m.fullName = `${m.firstName} ${head.lastName}`; m.keywords = keywords(m.fullName, m.phone.slice(-9)); });
  }
  GROUPS.forEach(([name, type, day, time], i) => {
    const inGroup = members.filter((m) => m.groupIds.includes(groupIds[i]));
    const leader = inGroup[0];
    W.push([db.doc(`groups/${groupIds[i]}`), {
      name, type, description: `${name} of Christian Worship Centre.`, leaderIds: leader ? [leader.id] : [], leaderNames: leader ? [leader.fullName] : [],
      meetingDay: day, meetingTime: time, location: type === 'cell' ? name.replace(' Home Cell', '') : 'Church auditorium', memberCount: inGroup.length, createdAt: FieldValue.serverTimestamp(),
    }]);
  });
  for (const m of members) { const { id, ...data } = m; W.push([db.doc(`members/${id}`), data]); }

  // ---- auth users for each role (emulator only; password: password123)
  const staffAccounts = [
    ['admin@cwc.test', 'Rev. Daniel Asante', 'super_admin'],
    ['office@cwc.test', 'Grace Owusu', 'admin'],
    ['pastor@cwc.test', 'Pastor Samuel Boateng', 'pastor'],
    ['treasurer@cwc.test', 'Comfort Agyeman', 'treasurer'],
    ['secretary@cwc.test', 'Linda Tetteh', 'secretary'],
    ['usher@cwc.test', 'Kojo Appiah', 'staff'],
  ];
  const memberAccounts = [['member@cwc.test', members[7]], ['0241234567', members[8]]];
  const userDocs = [];
  for (const [email, name, role] of staffAccounts) {
    const u = await upsertAuth(email, name);
    userDocs.push([u.uid, { uid: u.uid, email, fullName: name, phone: `2332${int(40000000, 59999999)}`, role, isActive: true, memberId: null, createdAt: FieldValue.serverTimestamp() }]);
  }
  for (const [login, m] of memberAccounts) {
    const email = login.includes('@') ? login : `233${login.slice(1)}@phone.cwc.app`;
    const u = await upsertAuth(email, m.fullName);
    m.uid = u.uid;
    W.push([db.doc(`members/${m.id}`), (({ id, ...d }) => ({ ...d, uid: u.uid }))(m)]);
    userDocs.push([u.uid, { uid: u.uid, email: login.includes('@') ? login : '', fullName: m.fullName, phone: m.phone, role: 'member', isActive: true, memberId: m.id, createdAt: FieldValue.serverTimestamp() }]);
  }
  for (const [id, d] of userDocs) W.push([db.doc(`users/${id}`), d]);
  const pastorUid = userDocs[2][0];
  const memberUid = userDocs[6][0];
  const member = memberAccounts[0][1];

  // ---- services & attendance (last 10 weeks)
  const active = members.filter((m) => !['inactive', 'visitor'].includes(m.membershipStatus));
  for (let w = 0; w < 10; w++) {
    const sunday = daysAgo(((new Date().getDay() + 7) % 7) + w * 7);
    for (const [type, share] of [['Sunday First Service', 0.38], ['Sunday Second Service', 0.42]]) {
      const id = `svc-${iso(sunday)}-${type.includes('First') ? 1 : 2}`;
      const present = active.filter(() => rand() < share + 0.02 * (10 - w) / 10 * 3);
      const men = int(30, 60), women = int(55, 95), children = int(20, 45), visitors = int(2, 9);
      W.push([db.doc(`services/${id}`), {
        title: type, type, date: iso(sunday), startTime: type.includes('First') ? '07:30' : '10:00', isOpen: false,
        headcount: { men, women, children, visitors }, checkins: present.length, firstTimers: int(0, 5),
        preacher: pick(['Rev. Daniel Asante', 'Pastor Samuel Boateng', 'Guest Minister']), theme: pick(['Walking in Faith', 'The Power of Praise', 'Grace Upon Grace', 'Built to Last', 'Rivers of Living Water']),
        createdAt: ts(sunday),
      }]);
      for (const m of present) W.push([db.doc(`attendance/${id}_${m.id}`), { serviceId: id, serviceType: type, date: iso(sunday), memberId: m.id, memberName: m.fullName, method: pick(['manual', 'manual', 'qr', 'self']), checkedInAt: ts(sunday) }]);
    }
    const wed = daysAgo(((new Date().getDay() + 4) % 7) + w * 7);
    W.push([db.doc(`services/svc-${iso(wed)}-mid`), { title: 'Midweek Service', type: 'Midweek Service', date: iso(wed), startTime: '18:30', isOpen: false, headcount: { men: int(15, 30), women: int(25, 50), children: int(0, 10), visitors: int(0, 3) }, checkins: 0, firstTimers: 0, createdAt: ts(wed) }]);
  }
  W.push([db.doc('services/svc-today-open'), { title: 'Sunday Second Service', type: 'Sunday Second Service', date: iso(new Date()), startTime: '10:00', isOpen: true, headcount: { men: 0, women: 0, children: 0, visitors: 0 }, checkins: 0, firstTimers: 0, createdAt: FieldValue.serverTimestamp() }]);

  // ---- giving (6 months)
  const givers = active.filter(() => rand() < 0.55);
  let receipt = 1000;
  for (let d = 180; d >= 0; d--) {
    const day = daysAgo(d);
    if (day.getDay() !== 0) continue;
    for (const m of givers) {
      if (rand() < 0.45) {
        receipt++;
        W.push([db.collection('gifts').doc(), { category: rand() < 0.75 ? 'Tithe' : pick(['Thanksgiving', 'Seed', 'Building Fund', 'Welfare']), amount: pick([20, 50, 50, 100, 100, 150, 200, 250, 300, 500, 1000]), method: pick(['cash', 'momo', 'momo', 'momo', 'bank']), memberId: m.id, memberName: m.fullName, date: iso(day), receiptNo: `CWC-${iso(day).slice(2, 7).replace('-', '')}-${receipt}`, reference: '', recordedByName: 'Comfort Agyeman', createdAt: ts(day) }]);
      }
    }
    for (const cat of ['Offering', 'Offering', 'Missions']) {
      receipt++;
      W.push([db.collection('gifts').doc(), { category: cat, amount: int(800, 4200), method: 'cash', memberId: null, memberName: cat === 'Offering' ? 'Sunday offering (loose)' : 'Missions offering', date: iso(day), receiptNo: `CWC-${iso(day).slice(2, 7).replace('-', '')}-${receipt}`, recordedByName: 'Comfort Agyeman', createdAt: ts(day) }]);
    }
  }
  const expenseCats = [['Utilities', 900, 1800], ['Rent', 4500, 4500], ['Salaries & Allowances', 6000, 9000], ['Maintenance', 300, 2500], ['Outreach & Missions', 500, 3000], ['Welfare Support', 400, 2000], ['Hospitality', 200, 900], ['Transport', 150, 700]];
  for (let mth = 0; mth < 6; mth++) {
    for (const [cat, lo, hi] of expenseCats) {
      if (rand() < 0.8 || cat === 'Rent') {
        const day = daysAgo(mth * 30 + int(1, 27));
        W.push([db.collection('expenses').doc(), { category: cat, amount: int(lo, hi), payee: pick(['ECG', 'Ghana Water', 'Landlord', 'Staff', 'Vendor', 'Uber/Bolt', 'Melcom']), method: pick(['cash', 'momo', 'bank']), date: iso(day), description: `${cat} — ${day.toLocaleString('en', { month: 'long' })}`, recordedByName: 'Comfort Agyeman', createdAt: ts(day) }]);
      }
    }
  }
  W.push([db.doc('campaigns/camp-building'), { name: 'Sanctuary Building Project', description: 'Completing the new 1,200-seat auditorium.', goal: 500000, startDate: iso(daysAgo(150)), endDate: iso(daysAgo(-200)), isActive: true, createdAt: ts(daysAgo(150)) }]);
  W.push([db.doc('campaigns/camp-harvest'), { name: 'Harvest Thanksgiving 2026', description: 'Annual harvest and thanksgiving.', goal: 120000, startDate: iso(daysAgo(30)), endDate: iso(daysAgo(-30)), isActive: true, createdAt: ts(daysAgo(30)) }]);
  for (const m of givers.slice(0, 40)) {
    const amount = pick([500, 1000, 2000, 5000]);
    const paid = Math.min(amount, pick([0, 0.25, 0.5, 0.75, 1]) * amount);
    W.push([db.collection('pledges').doc(), { campaignId: 'camp-building', campaignName: 'Sanctuary Building Project', memberId: m.id, memberName: m.fullName, phone: m.phone, amount, paid, dueDate: iso(daysAgo(-120)), createdAt: ts(daysAgo(int(10, 140))) }]);
  }

  // ---- events
  const events = [
    ['Holy Ghost Convention 2026', 'Conference', 12, 'Three nights of worship, word and the move of the Spirit.', true],
    ['Youth Splash & Talent Night', 'Youth', 5, 'Games, music and a word for the next generation.', true],
    ["Women's Breakfast Meeting", 'Women', 19, 'An inspiring morning of fellowship for women.', true],
    ['Community Health Outreach', 'Outreach', 26, 'Free health screening for the Adenta community.', true],
    ['Couples Dinner Night', 'Fellowship', 33, 'An evening to celebrate marriages.', true],
    ['All-Night Prayer', 'Prayer', -6, 'A night of intercession for the nation.', true],
    ['Leadership Retreat (draft)', 'Other', 45, 'Planning retreat for ministry leaders.', false],
  ];
  events.forEach(([title, category, inDays, description, published], i) => {
    const start = daysAgo(-inDays); start.setHours(i % 2 ? 18 : 9, 0, 0, 0);
    const end = new Date(start.getTime() + 3 * 3600e3);
    const local = (d) => `${iso(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    W.push([db.doc(`events/evt-${i + 1}`), { title, category, description, startAt: local(start), endAt: local(end), location: 'CWC Auditorium, Adenta', imageUrl: '', status: published ? 'published' : 'draft', rsvpEnabled: true, capacity: i === 4 ? 80 : null, rsvpCount: int(3, 60), createdAt: ts(daysAgo(20)) }]);
  });

  // ---- devotionals
  const devs = [
    ['Strength for Today', 'Isaiah 40:31', 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.'],
    ['The Lord Is My Shepherd', 'Psalm 23:1', 'The LORD is my shepherd; I shall not want.'],
    ['Grace That Is Sufficient', '2 Corinthians 12:9', 'My grace is sufficient for thee: for my strength is made perfect in weakness.'],
    ['Peace Beyond Understanding', 'Philippians 4:7', 'And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus.'],
    ['New Every Morning', 'Lamentations 3:22-23', 'It is of the LORD’s mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness.'],
    ['Be Strong and Courageous', 'Joshua 1:9', 'Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.'],
    ['Light of the World', 'Matthew 5:14', 'Ye are the light of the world. A city that is set on an hill cannot be hid.'],
    ['Cast Your Cares', '1 Peter 5:7', 'Casting all your care upon him; for he careth for you.'],
  ];
  devs.forEach(([title, scripture, text], i) => {
    W.push([db.doc(`devotionals/dev-${i + 1}`), {
      title, scripture, scriptureText: text, date: iso(daysAgo(i)), status: 'published', author: i % 2 ? 'Pastor Samuel Boateng' : 'Rev. Daniel Asante', imageUrl: '',
      body: `Every season of life brings its own demands. Some days we feel ready for anything; other days, even small tasks feel heavy. Today's scripture reminds us that our strength was never meant to come from ourselves alone.\n\nWhen we wait on the Lord — in prayer, in His Word and in worship — we are not standing still. We are being renewed. Like an eagle that rises on the wind instead of flapping against it, we learn to lean on a strength greater than our own.\n\nWhatever is in front of you today, bring it to Him first. Invite Him into your plans, your work and your relationships. He is faithful to carry what you cannot.`,
      prayer: 'Lord, I bring my day to You. Renew my strength, order my steps and help me to walk in Your peace. In Jesus’ name, Amen.',
      confession: 'I am strengthened with might by His Spirit in my inner man.',
      createdAt: ts(daysAgo(i)),
    }]);
  });
  W.push([db.doc('devotionals/dev-tomorrow'), { title: 'Scheduled for tomorrow', scripture: 'Romans 8:28', scriptureText: '', date: iso(daysAgo(-1)), status: 'published', body: 'Coming soon', createdAt: FieldValue.serverTimestamp() }]);

  // ---- sermons
  [['Walking in Faith', 'Hebrews 11:1-6', 'Faith Foundations'], ['The Power of Praise', 'Acts 16:25-26', 'Kingdom Living'], ['Grace Upon Grace', 'John 1:16', 'Faith Foundations'], ['Built to Last', 'Matthew 7:24-27', 'Kingdom Living'], ['Rivers of Living Water', 'John 7:38', 'The Holy Spirit']].forEach(([title, scripture, series], i) => {
    W.push([db.doc(`sermons/ser-${i + 1}`), { title, scripture, series, preacher: i % 2 ? 'Pastor Samuel Boateng' : 'Rev. Daniel Asante', date: iso(daysAgo(i * 7 + ((new Date().getDay() + 7) % 7))), summary: `A message on ${title.toLowerCase()} from ${scripture}, calling the church to deeper trust and obedience.`, videoUrl: '', audioUrl: '', thumbnailUrl: '', status: 'published', createdAt: ts(daysAgo(i * 7)) }]);
  });

  // ---- announcements
  W.push([db.collection('announcements').doc(), { title: 'Water baptism this month', body: 'Water baptism holds on the last Sunday of the month. Register with the church office or your cell leader.', pinned: true, status: 'published', createdAt: ts(daysAgo(2)) }]);
  W.push([db.collection('announcements').doc(), { title: 'Choir auditions', body: 'Voices of Worship is welcoming new members. Auditions after second service.', pinned: false, status: 'published', createdAt: ts(daysAgo(4)) }]);

  // ---- care
  const care = [
    ['prayer', 'Prayer for my job interview on Friday', 'public', 'new'],
    ['prayer', 'Healing for my mother in Korle Bu', 'public', 'in_progress'],
    ['counselling', 'Pre-marital counselling', 'private', 'scheduled'],
    ['visit', 'Home visitation — new baby', 'private', 'new'],
    ['thanksgiving', 'Thank God for safe delivery', 'public', 'completed'],
    ['urgent', 'Bereavement — lost my father', 'private', 'new'],
  ];
  care.forEach(([type, subject, visibility, status], i) => {
    const m = i === 0 ? member : members[30 + i];
    W.push([db.doc(`care_requests/care-${i + 1}`), { type, uid: i === 0 ? memberUid : null, memberId: m.id, name: m.fullName, phone: visibility === 'public' ? '' : m.phone, subject, details: `${subject}. Please stand with me in prayer.`, visibility, anonymous: false, status, assignedTo: status === 'new' ? null : pastorUid, assignedName: status === 'new' ? '' : 'Pastor Samuel Boateng', responses: status === 'in_progress' ? [{ text: 'We are praying with you. A pastor will call you this week.', by: 'Pastor Samuel Boateng', at: Date.now() - 86400e3 }] : [], prayedCount: int(0, 25), createdAt: ts(daysAgo(i)), updatedAt: ts(daysAgo(i)) }]);
  });
  W.push([db.collection('care_logs').doc(), { memberId: members[40].id, memberName: members[40].fullName, type: 'hospital', date: iso(daysAgo(3)), summary: 'Visited at Ridge Hospital after surgery. Prayed with the family.', nextStep: 'Follow-up call on Friday', confidential: false, byName: 'Pastor Samuel Boateng', createdAt: ts(daysAgo(3)) }]);
  W.push([db.collection('testimonies').doc(), { uid: null, name: 'Akosua Mensah', title: 'Healed and restored', body: 'After months of illness the Lord restored my health completely. I am grateful to the church family for standing with me.', status: 'published', createdAt: ts(daysAgo(6)) }]);
  W.push([db.collection('testimonies').doc(), { uid: null, name: 'Kwame Osei', title: 'New job after 2 years', body: 'God answered our prayers — I resumed work this week!', status: 'pending', createdAt: ts(daysAgo(1)) }]);

  // ---- follow-ups
  members.filter((m) => m.membershipStatus === 'first_timer').forEach((m, i) => {
    W.push([db.collection('followups').doc(), { memberId: m.id, name: m.fullName, phone: m.phone, kind: 'first_timer', stage: ['new', 'new', 'contacted', 'visited', 'integrated', 'contacted'][i % 6], assignedTo: null, assignedName: i % 2 ? 'Kojo Appiah' : '', dueDate: iso(daysAgo(-int(0, 6))), notes: i % 2 ? [{ text: 'Called — will attend next Sunday.', by: 'Kojo Appiah', at: Date.now() - 2 * 86400e3 }] : [], createdAt: ts(daysAgo(int(1, 12))), updatedAt: ts(daysAgo(1)) }]);
  });
  members.filter((m) => m.membershipStatus === 'inactive').slice(0, 4).forEach((m) => {
    W.push([db.collection('followups').doc(), { memberId: m.id, name: m.fullName, phone: m.phone, kind: 'absentee', stage: 'new', assignedTo: null, assignedName: '', dueDate: iso(daysAgo(-3)), notes: [], createdAt: ts(daysAgo(2)), updatedAt: ts(daysAgo(2)) }]);
  });

  // ---- messaging
  [['Sunday reminder', 'Hello {first_name|Beloved}, join us this Sunday at 7:30am or 10am at Christian Worship Centre. Come expecting! - CWC', 'Reminder'], ['Birthday wishes', 'Happy birthday {first_name|Beloved}! CWC celebrates you. May this new year bring you favour and fulfilment. Num 6:24 - CWC', 'Birthday'], ['First timer welcome', 'Dear {first_name|Beloved}, thank you for worshipping with us at CWC. We are glad you came and look forward to seeing you again!', 'Welcome'], ['Absentee check-in', 'Hi {first_name|Beloved}, we missed you at church recently. We are praying for you and hope to see you soon. - CWC', 'Follow-up']].forEach(([name, body, category]) => W.push([db.collection('sms_templates').doc(), { name, body, category, createdAt: FieldValue.serverTimestamp() }]));
  W.push([db.doc('sms_messages/seed-sms-1'), { senderId: 'CWC', message: 'Hello {first_name|Beloved}, join us this Sunday at 7:30am or 10am. Come expecting! - CWC', audience: 'All active members', recipients: 152, personalized: true, status: 'completed', unitsReserved: 152, unitsCharged: 150, delivered: 148, failed: 2, createdByName: 'Linda Tetteh', createdAt: ts(daysAgo(3)) }]);
  W.push([db.doc('sms_messages/seed-sms-2'), { senderId: 'CWC', message: 'Holy Ghost Convention starts on the 5th. Invite a friend! - CWC', audience: 'Everyone', recipients: 176, personalized: false, status: 'scheduled', scheduledAt: new Date(Date.now() + 3 * 86400e3).toISOString(), campaignId: 'auto000123', createdByName: 'Linda Tetteh', createdAt: ts(daysAgo(1)) }]);
  W.push([db.collection('notifications').doc(), { title: 'New devotional: Strength for Today', body: 'Isaiah 40:31 — start your day in the Word.', url: '/devotionals/dev-1', audience: 'all', kind: 'devotional', createdAt: ts(daysAgo(0)) }]);
  W.push([db.collection('notifications').doc(), { title: 'Holy Ghost Convention 2026', body: 'Three nights of worship and the Word. RSVP now.', url: '/events/evt-1', audience: 'all', kind: 'event', createdAt: ts(daysAgo(2)) }]);
  W.push([db.collection('notifications').doc(), { title: 'Your prayer request was received', body: 'A pastor is praying with you.', url: '/care/care-1', audience: memberUid, kind: 'care', createdAt: ts(daysAgo(0)) }]);

  await commitAll(W);
  console.log(`Seeded ${W.length} documents. Sign in with admin@cwc.test / password123 (or member@cwc.test, 0241234567).`);
}

async function upsertAuth(email, displayName) {
  try {
    return await auth.getUserByEmail(email);
  } catch {
    return auth.createUser({ email, password: 'password123', displayName });
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
