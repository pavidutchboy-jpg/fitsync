/* ============================================
   FITSYNC — app.js
   Replace SCRIPT_URL with your deployed
   Google Apps Script Web App URL.
   ============================================ */

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxmPI4nArGUYFkuGb3s-ZtiNplqcJzuYTgdOnD_mMKhUiDajm105powjFO93nokZM1c/exec";

// ── State ──────────────────────────────────
let currentUser = "Me";
let selectedMood = null;
let selectedWorkoutType = null;
let barChartInst = null;
let lineChartInst = null;

// ── Init ───────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Splash
  setTimeout(() => {
    document.getElementById('splash').classList.add('fade-out');
    setTimeout(() => {
      document.getElementById('splash').style.display = 'none';
      document.getElementById('app').classList.remove('hidden');
    }, 500);
  }, 1200);

  setDateChips();
  setupUserToggle();
  setupTabs();
  setupToggles();
  setupWorkout();
  setupMood();
  setupRangeBtns();
  registerSW();
});

// ── Date helpers ───────────────────────────
function today() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
}
function setDateChips() {
  const d = new Date().toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
  document.querySelectorAll('.date-chip').forEach(el => el.textContent = d);
}
function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month:'short', day:'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
}

// ── User toggle ────────────────────────────
function setupUserToggle() {
  document.querySelectorAll('.user-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.user-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentUser = btn.dataset.user;
    });
  });
}

// ── Tabs ───────────────────────────────────
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById('tab-' + tab.dataset.tab);
      panel.classList.add('active');

      if (tab.dataset.tab === 'today') loadToday();
      if (tab.dataset.tab === 'progress') loadProgress();
      if (tab.dataset.tab === 'history') loadHistory();
    });
  });
}

// ── Toggle cards ───────────────────────────
function setupToggles() {
  const proteinToggle = document.getElementById('protein-toggle');
  const creatineToggle = document.getElementById('creatine-toggle');
  const workoutToggle = document.getElementById('workout-toggle');

  proteinToggle.addEventListener('change', () => {
    const card = document.getElementById('card-protein');
    const gramsCard = document.getElementById('protein-grams-card');
    card.classList.toggle('is-active', proteinToggle.checked);
    gramsCard.style.display = proteinToggle.checked ? 'flex' : 'none';
  });

  creatineToggle.addEventListener('change', () => {
    document.getElementById('card-creatine').classList.toggle('is-active', creatineToggle.checked);
  });

  workoutToggle.addEventListener('change', () => {
    const card = workoutToggle.closest('.card');
    card.classList.toggle('is-active', workoutToggle.checked);
    document.getElementById('workout-detail').style.display = workoutToggle.checked ? 'block' : 'none';
  });
}

// ── Workout type ───────────────────────────
function setupWorkout() {
  document.querySelectorAll('.wtype-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.wtype-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedWorkoutType = btn.dataset.type;
    });
  });
}

// ── Mood ───────────────────────────────────
function setupMood() {
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMood = parseInt(btn.dataset.mood);
    });
  });
}

// ── Amount adjust ──────────────────────────
function adjust(id, delta) {
  const el = document.getElementById(id);
  const val = parseInt(el.value) + delta;
  el.value = Math.max(0, Math.min(500, val));
}

// ── Submit ─────────────────────────────────
async function submitLog() {
  const btn = document.getElementById('submit-btn');
  const statusEl = document.getElementById('submit-status');
  const proteinChecked = document.getElementById('protein-toggle').checked;
  const creatineChecked = document.getElementById('creatine-toggle').checked;
  const workoutChecked = document.getElementById('workout-toggle').checked;

  const payload = {
    name: currentUser,
    protein: proteinChecked ? parseInt(document.getElementById('protein-amount').value) : 0,
    creatine: creatineChecked ? 1 : 0,
    workout: workoutChecked ? (selectedWorkoutType || 'Yes') : '',
    mood: selectedMood || '',
    notes: document.getElementById('workout-notes').value.trim(),
    date: today()
  };

  btn.disabled = true;
  document.getElementById('submit-text').textContent = 'Saving...';
  statusEl.className = 'status-msg hidden';

  // Save locally always
  saveLocal(payload);

  if (SCRIPT_URL === "YOUR_SCRIPT_URL_HERE") {
    // Demo mode — no backend
    await new Promise(r => setTimeout(r, 600));
    showStatus('✓ Saved locally (add your Script URL for cloud sync)', 'success');
  } else {
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(payload)
      });
      showStatus('✓ Synced to Google Sheets!', 'success');
    } catch (err) {
      showStatus('⚠ Saved locally — sync failed. Check your Script URL.', 'error');
    }
  }

  btn.disabled = false;
  document.getElementById('submit-text').textContent = 'Save Entry';
}

function showStatus(msg, type) {
  const el = document.getElementById('submit-status');
  el.textContent = msg;
  el.className = 'status-msg ' + type;
  setTimeout(() => el.classList.add('hidden'), 4000);
}

// ── Local storage ──────────────────────────
function saveLocal(entry) {
  const logs = getLocalLogs();
  logs.unshift({ ...entry, ts: new Date().toISOString() });
  localStorage.setItem('fitsync_logs', JSON.stringify(logs.slice(0, 500)));
}

function getLocalLogs() {
  try { return JSON.parse(localStorage.getItem('fitsync_logs') || '[]'); }
  catch { return []; }
}

function getLogsForRange(days) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return getLocalLogs().filter(l => new Date(l.ts) >= cutoff);
}

// ── TODAY TAB ─────────────────────────────
function loadToday() {
  const grid = document.getElementById('today-grid');
  const todayStr = today();
  const todayLogs = getLocalLogs().filter(l => l.date === todayStr);

  if (todayLogs.length === 0) {
    grid.innerHTML = `<div class="no-entry">No entries yet today. Go log something! 💪</div>`;
    return;
  }

  const users = ['Me', 'Wife'];
  let html = '';

  users.forEach(user => {
    const userLogs = todayLogs.filter(l => l.name === user);
    if (userLogs.length === 0) return;
    const latest = userLogs[0];
    html += `
      <div class="today-person-section">
        <div class="today-person-label">${user}</div>
        <div class="today-entry">
          <div class="today-entry-top">
            <span class="today-entry-name">${latest.name === 'Me' ? 'You' : latest.name}</span>
            <span class="today-entry-time">${formatTime(latest.ts)}</span>
          </div>
          <div class="today-badges">
            ${latest.protein > 0 ? `<span class="badge done">🥤 ${latest.protein}g protein</span>` : `<span class="badge skip">🥤 No shake</span>`}
            ${latest.creatine ? `<span class="badge done">💊 Creatine ✓</span>` : `<span class="badge skip">💊 No creatine</span>`}
            ${latest.workout ? `<span class="badge workout">🏋️ ${latest.workout}</span>` : `<span class="badge skip">🏋️ No workout</span>`}
            ${latest.mood ? `<span class="badge done">${moodEmoji(latest.mood)} Energy ${latest.mood}/5</span>` : ''}
          </div>
        </div>
      </div>`;
  });

  grid.innerHTML = html || `<div class="no-entry">No entries yet today.</div>`;
}

function moodEmoji(m) {
  return ['','😴','😐','😊','😤','🔥'][m] || '✦';
}

// ── PROGRESS TAB ──────────────────────────
let currentRange = 7;

function setupRangeBtns() {
  document.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = parseInt(btn.dataset.range);
      if (document.getElementById('tab-progress').classList.contains('active')) {
        loadProgress();
      }
    });
  });
}

function loadProgress() {
  const logs = getLogsForRange(currentRange);
  renderStreak(logs);
  renderBarChart(logs);
  renderLineChart(logs);
  renderHabitRings(logs);
}

function renderStreak(logs) {
  // Count consecutive days with any entry
  const daySet = new Set(logs.map(l => l.date));
  let streak = 0;
  const d = new Date();
  while (true) {
    const ds = d.toLocaleDateString('en-CA');
    if (daySet.has(ds)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
    if (streak > 365) break;
  }
  document.getElementById('streak-num').textContent = streak;
}

function renderBarChart(logs) {
  const ctx = document.getElementById('barChart').getContext('2d');
  if (barChartInst) barChartInst.destroy();

  const days = getLast(currentRange);
  const daySet = new Set(logs.map(l => l.date));
  const labels = days.map(d => new Date(d).toLocaleDateString('en-US', { weekday:'short' }));
  const data = days.map(d => daySet.has(d) ? 1 : 0);
  const workoutDays = new Set(logs.filter(l => l.workout).map(l => l.date));

  barChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Logged',
        data,
        backgroundColor: days.map(d => workoutDays.has(d) ? '#7b6fff' : '#c8f135'),
        borderRadius: 6,
        barThickness: 20
      }]
    },
    options: chartOpts('Activity (green = logged, purple = workout)')
  });
}

function renderLineChart(logs) {
  const ctx = document.getElementById('lineChart').getContext('2d');
  if (lineChartInst) lineChartInst.destroy();

  const days = getLast(currentRange);
  const labels = days.map(d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' }));

  const proteinByDay = {};
  logs.forEach(l => {
    if (!proteinByDay[l.date]) proteinByDay[l.date] = 0;
    proteinByDay[l.date] += (l.protein || 0);
  });

  const data = days.map(d => proteinByDay[d] || null);

  lineChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Protein (g)',
        data,
        borderColor: '#c8f135',
        backgroundColor: 'rgba(200,241,53,0.08)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointBackgroundColor: '#c8f135',
        pointRadius: 4,
        spanGaps: false
      }]
    },
    options: chartOpts('Protein')
  });
}

function renderHabitRings(logs) {
  const total = new Set(logs.map(l => l.date)).size || 1;
  const proteinDays = new Set(logs.filter(l => l.protein > 0).map(l => l.date)).size;
  const creatineDays = new Set(logs.filter(l => l.creatine).map(l => l.date)).size;
  const workoutDays = new Set(logs.filter(l => l.workout).map(l => l.date)).size;

  const habits = [
    { label: 'Shake', val: proteinDays, color: '#c8f135' },
    { label: 'Creatine', val: creatineDays, color: '#c8f135' },
    { label: 'Workout', val: workoutDays, color: '#7b6fff' },
  ];

  const container = document.getElementById('habit-rings');
  container.innerHTML = habits.map(h => {
    const pct = Math.round((h.val / total) * 100);
    const deg = (pct / 100) * 360;
    return `<div class="habit-ring-item">
      <div class="habit-ring-circle" data-pct="${pct}%" style="
        background: conic-gradient(${h.color} ${deg}deg, var(--surface2) ${deg}deg);
      "></div>
      <div class="habit-ring-label">${h.label}</div>
    </div>`;
  }).join('');
}

function getLast(n) {
  const days = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d);
    dd.setDate(d.getDate() - i);
    days.push(dd.toLocaleDateString('en-CA'));
  }
  return days;
}

function chartOpts(label) {
  return {
    responsive: true, maintainAspectRatio: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1c1c26',
        titleColor: '#f0f0f5', bodyColor: '#6b6b80',
        borderColor: 'rgba(255,255,255,0.07)', borderWidth: 1
      }
    },
    scales: {
      x: { ticks: { color: '#6b6b80', font: { size: 11 } }, grid: { display: false } },
      y: { ticks: { color: '#6b6b80', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } }
    }
  };
}

// ── HISTORY TAB ───────────────────────────
async function loadHistory() {
  const container = document.getElementById('history-list');
  const localLogs = getLocalLogs();

  // Optionally fetch from Google Sheets too
  let remoteLogs = [];
  if (SCRIPT_URL !== "YOUR_SCRIPT_URL_HERE") {
    try {
      const res = await fetch(SCRIPT_URL + '?action=get');
      const raw = await res.json();
      // raw is array of rows [ts, name, protein, creatine, workout, mood, notes, date]
      remoteLogs = raw.slice(1).map(r => ({
        ts: r[0], name: r[1], protein: r[2], creatine: r[3],
        workout: r[4], mood: r[5], notes: r[6], date: r[7]
      })).filter(r => r.name);
    } catch (e) {}
  }

  // Merge: prefer local for display
  const logs = localLogs.length > 0 ? localLogs : remoteLogs;

  if (logs.length === 0) {
    container.innerHTML = `<div class="loading-state">No history yet. Start logging!</div>`;
    return;
  }

  container.innerHTML = logs.slice(0, 50).map(l => `
    <div class="history-item">
      <div class="history-dot ${l.name === 'Wife' ? 'wife' : ''}"></div>
      <div class="history-body">
        <div class="history-meta">
          <span class="history-name">${l.name}</span>
          <span class="history-time">${formatTime(l.ts)}</span>
        </div>
        <div class="history-badges">
          ${l.protein > 0 ? `<span class="badge done">🥤 ${l.protein}g</span>` : ''}
          ${l.creatine ? `<span class="badge done">💊</span>` : ''}
          ${l.workout ? `<span class="badge workout">🏋️ ${l.workout}</span>` : ''}
          ${l.mood ? `<span class="badge done">${moodEmoji(l.mood)}</span>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

// ── SERVICE WORKER ─────────────────────────
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}
