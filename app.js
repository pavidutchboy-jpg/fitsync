/* ============================================
   FITSYNC — app.js
   Replace SCRIPT_URL with your deployed
   Google Apps Script Web App URL.
   ============================================ */

const SCRIPT_URL = "YOUR_SCRIPT_URL_HERE";

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
  setupWeightCard();
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
      // Refresh weight card for new user
      const lastEntry = getWeightLogs(currentUser).slice(-1)[0];
      if (lastEntry) {
        document.getElementById('weight-input').value = lastEntry.weight;
        document.getElementById('weight-last-logged').textContent =
          `Last: ${lastEntry.weight}${weightUnit} on ${new Date(lastEntry.date + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' })}`;
      } else {
        document.getElementById('weight-last-logged').textContent = 'Optional — log today\'s weight';
      }
      const goal = getWeightGoal(currentUser);
      document.getElementById('goal-weight-input').value = goal || '';
      loadWeightGoalProgress();
      loadBMIForUser();
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
      if (tab.dataset.tab === 'tasks') tasksInit();
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
  persistWeightIfLogged();

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
  logs.unshift({ ...entry, ts: new Date().toISOString(), id: Math.random().toString(36).slice(2,10) + Date.now().toString(36) });
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
  renderWeightChart();
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
    <div class="history-item" id="hitem-${l.id || ''}">
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
      ${l.id ? `<button class="ticon-btn tdel" onclick="askLogDelete('${l.id}')" title="Delete">✕</button>` : ''}
    </div>
  `).join('');
}

let logDeleteId = null;

function askLogDelete(id) {
  logDeleteId = id;
  document.getElementById('tconfirm-sub').textContent = 'This log entry will be permanently removed.';
  document.getElementById('tconfirm-overlay').classList.add('open');
  // Override confirm button to call log delete
  document.getElementById('tconfirm-overlay').dataset.mode = 'log';
}

function deleteLogEntry(id) {
  const logs = getLocalLogs().filter(l => l.id !== id);
  localStorage.setItem('fitsync_logs', JSON.stringify(logs));
  loadHistory();
  appToast('Entry deleted');
}

// ── SERVICE WORKER ─────────────────────────
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

// ════════════════════════════════════════════
// TASKS
// ════════════════════════════════════════════

let tasks = [];
let taskTab = 'active';
let taskFilter = 'all';
let taskEditId = null;
let taskDeleteId = null;
let taskPriority = 'med';
let taskReminderOn = false;

function tasksInit() {
  try { tasks = JSON.parse(localStorage.getItem('fitsync_tasks') || '[]'); }
  catch { tasks = []; }
  renderTasks();
  updateTaskStats();
}

function saveTasks() { localStorage.setItem('fitsync_tasks', JSON.stringify(tasks)); }

// ── sub-tab & filter ───────────────────────
function switchTaskTab(t) {
  taskTab = t;
  document.querySelectorAll('.task-subtab').forEach(b => b.classList.toggle('active', b.dataset.ttab === t));
  document.getElementById('task-filters').style.display = t === 'active' ? 'flex' : 'none';
  document.getElementById('task-add-row').style.display = t === 'active' ? 'block' : 'none';
  renderTasks();
}

function setTaskFilter(f) {
  taskFilter = f;
  document.querySelectorAll('.tfilter').forEach(b => b.classList.toggle('active', b.dataset.f === f));
  renderTasks();
}

// ── render ─────────────────────────────────
function renderTasks() {
  const list = document.getElementById('tasks-list');
  if (!list) return;
  const todayStr = todayISO();
  const pOrd = { high:0, med:1, low:2 };

  if (taskTab === 'active') {
    let items = tasks.filter(t => !t.done);
    if (taskFilter === 'high')    items = items.filter(t => t.priority === 'high');
    else if (taskFilter === 'med') items = items.filter(t => t.priority === 'med');
    else if (taskFilter === 'low') items = items.filter(t => t.priority === 'low');
    else if (taskFilter === 'overdue') items = items.filter(t => t.due && t.due < todayStr);

    items.sort((a,b) => {
      const ao = a.due && a.due < todayStr ? -1 : 0;
      const bo = b.due && b.due < todayStr ? -1 : 0;
      if (ao !== bo) return ao - bo;
      if (pOrd[a.priority] !== pOrd[b.priority]) return pOrd[a.priority] - pOrd[b.priority];
      if (a.due && b.due) return a.due.localeCompare(b.due);
      if (a.due) return -1; if (b.due) return 1;
      return b.createdAt - a.createdAt;
    });

    if (!items.length) {
      list.innerHTML = `<div class="loading-state" style="border:1px dashed var(--border);border-radius:var(--radius)">
        No tasks here.<br>Hit + New Task to add one 💪</div>`;
      return;
    }
    list.innerHTML = items.map(t => taskCardHTML(t, todayStr)).join('');

  } else {
    const done = tasks.filter(t => t.done).sort((a,b) => b.doneAt - a.doneAt);
    if (!done.length) {
      list.innerHTML = `<div class="loading-state">No completed tasks yet.</div>`;
      return;
    }
    const groups = {};
    done.forEach(t => {
      const d = new Date(t.doneAt).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
      if (!groups[d]) groups[d] = [];
      groups[d].push(t);
    });
    list.innerHTML = Object.entries(groups).map(([date, items]) =>
      `<div class="tsection-label">${date}</div>` + items.map(t => taskCardHTML(t, todayStr)).join('')
    ).join('');
  }
}

function taskCardHTML(t, todayStr) {
  const overdue = !t.done && t.due && t.due < todayStr;
  const isToday = t.due === todayStr;
  const doneClass = t.done ? 'task-done' : '';
  const overdueClass = overdue ? 'task-overdue' : '';

  let datePill = '';
  if (t.due) {
    const diff = Math.round((new Date(t.due) - new Date(todayStr)) / 86400000);
    let label = diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday'
      : diff < 0 ? `${Math.abs(diff)}d overdue`
      : new Date(t.due + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' });
    if (t.dueTime) label += ' ' + t.dueTime;
    const cls = overdue ? 'overdue' : isToday ? 'due-today' : '';
    datePill = `<span class="tpill date ${cls}">📅 ${label}</span>`;
  }
  const bellPill = t.reminder && !t.done ? `<span class="tpill bell">🔔</span>` : '';
  const doneTime = t.done ? `<div class="task-done-time">Completed ${taskRelTime(t.doneAt)}</div>` : '';
  const notesHtml = t.notes ? `<div class="task-notes-text">${tEsc(t.notes)}</div>` : '';

  return `<div class="task-card ${doneClass} ${overdueClass}">
    <button class="tcheck-btn" onclick="toggleTask('${t.id}')">${t.done ? '✓' : ''}</button>
    <div class="task-body">
      <div class="task-title-text">${tEsc(t.title)}</div>
      <div class="task-pills">
        <span class="tpill ${t.priority}">${t.priority}</span>
        ${datePill}${bellPill}
      </div>
      ${notesHtml}${doneTime}
    </div>
    <div class="task-actions">
      ${!t.done ? `<button class="ticon-btn" onclick="openTaskEdit('${t.id}')">✎</button>` : ''}
      <button class="ticon-btn tdel" onclick="askTaskDelete('${t.id}')">✕</button>
    </div>
  </div>`;
}

function updateTaskStats() {
  const active = tasks.filter(t => !t.done);
  const todayStr = todayISO();
  const overdue = active.filter(t => t.due && t.due < todayStr).length;
  document.getElementById('ts-active').textContent = `${active.length} active`;
  const urgentEl = document.getElementById('ts-urgent');
  if (overdue > 0) {
    urgentEl.textContent = `${overdue} overdue`;
    urgentEl.classList.add('urgent');
    urgentEl.style.display = 'inline-flex';
  } else {
    urgentEl.style.display = 'none';
  }
}

// ── CRUD ───────────────────────────────────
function openTaskModal() {
  taskEditId = null; taskPriority = 'med'; taskReminderOn = false;
  document.getElementById('tmodal-title').textContent = 'New Task';
  document.getElementById('tf-title').value = '';
  document.getElementById('tf-notes').value = '';
  document.getElementById('tf-due').value = '';
  document.getElementById('tf-due-time').value = '';
  document.querySelectorAll('.tp-btn').forEach(b => b.classList.toggle('sel', b.dataset.p === 'med'));
  updateTaskReminderUI();
  document.getElementById('tmodal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('tf-title').focus(), 300);
}

function openTaskEdit(id) {
  const t = tasks.find(x => x.id === id); if (!t) return;
  taskEditId = id; taskPriority = t.priority; taskReminderOn = !!t.reminder;
  document.getElementById('tmodal-title').textContent = 'Edit Task';
  document.getElementById('tf-title').value = t.title;
  document.getElementById('tf-notes').value = t.notes || '';
  document.getElementById('tf-due').value = t.due || '';
  document.getElementById('tf-due-time').value = t.dueTime || '';
  document.querySelectorAll('.tp-btn').forEach(b => b.classList.toggle('sel', b.dataset.p === t.priority));
  updateTaskReminderUI();
  document.getElementById('tmodal-overlay').classList.add('open');
}

function closeTaskModal() { document.getElementById('tmodal-overlay').classList.remove('open'); }
function tOverlayClick(e) { if (e.target === document.getElementById('tmodal-overlay')) closeTaskModal(); }

function selTaskPriority(p) {
  taskPriority = p;
  document.querySelectorAll('.tp-btn').forEach(b => b.classList.toggle('sel', b.dataset.p === p));
}

function toggleTaskReminder() {
  taskReminderOn = !taskReminderOn;
  updateTaskReminderUI();
}
function updateTaskReminderUI() {
  document.getElementById('treminder-track').classList.toggle('on', taskReminderOn);
  document.getElementById('treminder-text').textContent = taskReminderOn
    ? 'On — notification when due' : 'Off';
}

function saveTask() {
  const title = document.getElementById('tf-title').value.trim();
  if (!title) {
    const el = document.getElementById('tf-title');
    el.style.borderColor = 'var(--danger)';
    el.focus();
    setTimeout(() => el.style.borderColor = '', 1200);
    return;
  }
  const due = document.getElementById('tf-due').value;
  const dueTime = document.getElementById('tf-due-time').value;
  const notes = document.getElementById('tf-notes').value.trim();

  if (taskEditId) {
    const idx = tasks.findIndex(t => t.id === taskEditId);
    if (idx !== -1) tasks[idx] = { ...tasks[idx], title, notes, priority: taskPriority, due, dueTime, reminder: taskReminderOn };
    appToast('Task updated');
  } else {
    tasks.unshift({ id: tUID(), title, notes, priority: taskPriority, due, dueTime, reminder: taskReminderOn, done: false, createdAt: Date.now(), doneAt: null });
    appToast('Task added ✓');
  }
  saveTasks(); renderTasks(); updateTaskStats(); closeTaskModal();
  scheduleTaskReminders();
}

function toggleTask(id) {
  const t = tasks.find(x => x.id === id); if (!t) return;
  t.done = !t.done; t.doneAt = t.done ? Date.now() : null;
  saveTasks(); renderTasks(); updateTaskStats();
  if (t.done) appToast('Marked complete ✓');
}

function askTaskDelete(id) {
  taskDeleteId = id;
  const t = tasks.find(x => x.id === id);
  document.getElementById('tconfirm-sub').textContent = t
    ? `"${t.title.slice(0,40)}${t.title.length > 40 ? '...' : ''}"` : '';
  document.getElementById('tconfirm-overlay').classList.add('open');
}
function closeTConfirm() {
  document.getElementById('tconfirm-overlay').classList.remove('open');
  document.getElementById('tconfirm-overlay').dataset.mode = '';
  taskDeleteId = null;
}
function confirmTaskDelete() {
  const mode = document.getElementById('tconfirm-overlay').dataset.mode;
  if (mode === 'log') {
    if (logDeleteId) deleteLogEntry(logDeleteId);
    logDeleteId = null;
  } else {
    if (!taskDeleteId) return;
    tasks = tasks.filter(t => t.id !== taskDeleteId);
    saveTasks(); renderTasks(); updateTaskStats();
    appToast('Task deleted');
  }
  closeTConfirm();
}

// ── Reminders ──────────────────────────────
function scheduleTaskReminders() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') Notification.requestPermission();
  const now = Date.now();
  tasks.filter(t => !t.done && t.reminder && t.due).forEach(t => {
    const ds = t.due + (t.dueTime ? `T${t.dueTime}:00` : 'T09:00:00');
    const delay = new Date(ds).getTime() - now;
    if (delay > 0 && delay < 86400000 * 2) {
      setTimeout(() => {
        if (Notification.permission === 'granted') {
          new Notification('⚡ FitSync — Task Due', { body: t.title, tag: t.id });
        }
      }, delay);
    }
  });
}

// ── Utils ──────────────────────────────────
function todayISO() { return new Date().toLocaleDateString('en-CA'); }
function tUID() { return Math.random().toString(36).slice(2,10) + Date.now().toString(36); }
function tEsc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function taskRelTime(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(ts).toLocaleDateString('en-US', { month:'short', day:'numeric' });
}
function appToast(msg) {
  const el = document.getElementById('app-toast'); if (!el) return;
  el.textContent = msg; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2200);
}

// Init tasks when tab is first opened (wired in setupTabs below)

// ════════════════════════════════════════════
// WEIGHT TRACKING
// ════════════════════════════════════════════

let weightUnit = 'kg';
let weightChartUser = 'Me';
let weightChartInst = null;

function setupWeightCard() {
  const toggle = document.getElementById('weight-toggle');
  toggle.addEventListener('change', () => {
    const detail = document.getElementById('weight-detail');
    detail.style.display = toggle.checked ? 'block' : 'none';
    document.getElementById('card-weight').classList.toggle('is-active', toggle.checked);
    if (toggle.checked) loadWeightGoalProgress();
    if (toggle.checked) loadBMIForUser();
  });

  // Pre-fill last logged weight for current user
  const lastEntry = getWeightLogs(currentUser).slice(-1)[0];
  if (lastEntry) {
    document.getElementById('weight-input').value = lastEntry.weight;
    document.getElementById('weight-last-logged').textContent =
      `Last: ${lastEntry.weight}${weightUnit} on ${new Date(lastEntry.date + 'T12:00:00').toLocaleDateString('en-US', { month:'short', day:'numeric' })}`;
  }

  // Pre-fill goal
  const goal = getWeightGoal(currentUser);
  if (goal) document.getElementById('goal-weight-input').value = goal;
}

function setWeightUnit(u) {
  weightUnit = u;
  document.getElementById('wunit-kg').classList.toggle('active', u === 'kg');
  document.getElementById('wunit-lbs').classList.toggle('active', u === 'lbs');
  document.getElementById('goal-weight-unit').textContent = u;
  // Convert displayed value
  const input = document.getElementById('weight-input');
  const val = parseFloat(input.value);
  if (!isNaN(val)) {
    input.value = u === 'lbs' ? Math.round(val * 2.20462 * 10) / 10 : Math.round(val / 2.20462 * 10) / 10;
  }
}

function saveGoalWeight() {
  const val = parseFloat(document.getElementById('goal-weight-input').value);
  if (isNaN(val) || val <= 0) return;
  const goals = JSON.parse(localStorage.getItem('fitsync_weight_goals') || '{}');
  goals[currentUser] = val;
  localStorage.setItem('fitsync_weight_goals', JSON.stringify(goals));
  appToast('Goal weight saved ✓');
  loadWeightGoalProgress();
}

function getWeightGoal(user) {
  try { return JSON.parse(localStorage.getItem('fitsync_weight_goals') || '{}')[user] || null; }
  catch { return null; }
}

function getWeightLogs(user) {
  try {
    const all = JSON.parse(localStorage.getItem('fitsync_weight_logs') || '{}');
    return (all[user] || []).sort((a, b) => a.date.localeCompare(b.date));
  } catch { return []; }
}

function saveWeightLog(user, weight, date) {
  const all = JSON.parse(localStorage.getItem('fitsync_weight_logs') || '{}');
  if (!all[user]) all[user] = [];
  // Replace if same date, else append
  const idx = all[user].findIndex(e => e.date === date);
  if (idx !== -1) all[user][idx].weight = weight;
  else all[user].push({ date, weight });
  localStorage.setItem('fitsync_weight_logs', JSON.stringify(all));
}

function loadWeightGoalProgress() {
  const weightInput = parseFloat(document.getElementById('weight-input').value);
  const goal = getWeightGoal(currentUser);
  const logs = getWeightLogs(currentUser);
  const progressEl = document.getElementById('weight-goal-progress');

  if (!goal || logs.length === 0) { progressEl.style.display = 'none'; return; }

  const startWeight = logs[0].weight;
  const current = weightInput || logs[logs.length - 1].weight;
  const totalDiff = Math.abs(goal - startWeight);
  const done = Math.abs(current - startWeight);
  const pct = totalDiff === 0 ? 100 : Math.min(100, Math.round((done / totalDiff) * 100));
  const remaining = Math.abs(goal - current).toFixed(1);
  const losing = goal < startWeight;

  document.getElementById('wgp-start-label').textContent = `Start: ${startWeight}${weightUnit}`;
  document.getElementById('wgp-goal-label').textContent = `Goal: ${goal}${weightUnit}`;
  document.getElementById('wgp-fill').style.width = pct + '%';

  let status = '';
  if (Math.abs(goal - current) < 0.5) status = '🎉 Goal reached!';
  else status = `${remaining}${weightUnit} to go · ${pct}% there`;
  document.getElementById('wgp-status').textContent = status;
  progressEl.style.display = 'block';
}

// Called from submitLog to include weight
function getWeightLogValue() {
  const toggle = document.getElementById('weight-toggle');
  if (!toggle.checked) return null;
  const val = parseFloat(document.getElementById('weight-input').value);
  return isNaN(val) ? null : val;
}

function persistWeightIfLogged() {
  const val = getWeightLogValue();
  if (val !== null) saveWeightLog(currentUser, val, today());
}

// ── BMI ────────────────────────────────────
function getHeight(user) {
  try { return JSON.parse(localStorage.getItem('fitsync_heights') || '{}')[user] || null; }
  catch { return null; }
}

function saveHeight() {
  const val = parseFloat(document.getElementById('height-input').value);
  if (isNaN(val) || val < 50 || val > 280) {
    document.getElementById('height-input').style.borderColor = 'var(--danger)';
    setTimeout(() => document.getElementById('height-input').style.borderColor = '', 1200);
    return;
  }
  const heights = JSON.parse(localStorage.getItem('fitsync_heights') || '{}');
  heights[currentUser] = val;
  localStorage.setItem('fitsync_heights', JSON.stringify(heights));
  appToast('Height saved ✓');
  recalcBMI();
}

function recalcBMI() {
  const weightVal = parseFloat(document.getElementById('weight-input').value);
  const heightVal = parseFloat(document.getElementById('height-input').value);
  if (isNaN(weightVal) || isNaN(heightVal) || heightVal < 50) {
    document.getElementById('bmi-result').style.display = 'none';
    return;
  }

  // Always calculate in kg/cm — convert if lbs
  const weightKg = weightUnit === 'lbs' ? weightVal / 2.20462 : weightVal;
  const heightM = heightVal / 100;
  const bmi = weightKg / (heightM * heightM);
  const bmiRounded = Math.round(bmi * 10) / 10;

  let cat, catClass;
  if (bmi < 18.5)      { cat = 'Underweight'; catClass = 'underweight'; }
  else if (bmi < 25)   { cat = 'Normal';      catClass = 'normal'; }
  else if (bmi < 30)   { cat = 'Overweight';  catClass = 'overweight'; }
  else                 { cat = 'Obese';        catClass = 'obese'; }

  document.getElementById('bmi-score').textContent = bmiRounded;
  const catEl = document.getElementById('bmi-category');
  catEl.textContent = cat;
  catEl.className = 'bmi-category ' + catClass;

  // Position marker: BMI scale 14–40 mapped to 0–100%
  const pct = Math.min(100, Math.max(0, ((bmi - 14) / 26) * 100));
  document.getElementById('bmi-marker').style.left = pct + '%';

  document.getElementById('bmi-result').style.display = 'block';
}

function loadBMIForUser() {
  const h = getHeight(currentUser);
  if (h) {
    document.getElementById('height-input').value = h;
    recalcBMI();
  } else {
    document.getElementById('height-input').value = '';
    document.getElementById('bmi-result').style.display = 'none';
  }
}

// ── Weight chart (Progress tab) ────────────
function setWeightChartUser(u) {
  weightChartUser = u;
  document.querySelectorAll('.wuser-btn').forEach(b => b.classList.toggle('active', b.dataset.wu === u));
  renderWeightChart();
}

function renderWeightChart() {
  const ctx = document.getElementById('weightChart');
  if (!ctx) return;
  if (weightChartInst) { weightChartInst.destroy(); weightChartInst = null; }

  const logs = getWeightLogs(weightChartUser);
  const range = currentRange || 30;
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - range);
  const filtered = logs.filter(e => new Date(e.date + 'T12:00:00') >= cutoff);

  const statsEl = document.getElementById('weight-chart-stats');

  if (filtered.length === 0) {
    ctx.parentElement.querySelector('canvas').style.display = 'none';
    statsEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px;width:100%">No weight entries yet for ${weightChartUser}</div>`;
    return;
  }
  ctx.style.display = 'block';

  const labels = filtered.map(e => {
    const d = new Date(e.date + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
  });
  const data = filtered.map(e => e.weight);
  const goal = getWeightGoal(weightChartUser);

  const datasets = [{
    label: 'Weight',
    data,
    borderColor: '#c8f135',
    backgroundColor: 'rgba(200,241,53,0.07)',
    borderWidth: 2,
    tension: 0.35,
    fill: true,
    pointBackgroundColor: '#c8f135',
    pointRadius: filtered.length < 15 ? 4 : 2,
    spanGaps: false
  }];

  if (goal) {
    datasets.push({
      label: 'Goal',
      data: Array(filtered.length).fill(goal),
      borderColor: 'rgba(123,111,255,0.5)',
      borderDash: [5, 5],
      borderWidth: 1.5,
      pointRadius: 0,
      fill: false,
      tension: 0
    });
  }

  weightChartInst = new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true, maintainAspectRatio: true,
      plugins: {
        legend: { display: goal ? true : false, labels: { color: '#6b6b80', font: { size: 11 }, boxWidth: 12 } },
        tooltip: { backgroundColor: '#1c1c26', titleColor: '#f0f0f5', bodyColor: '#6b6b80', borderColor: 'rgba(255,255,255,0.07)', borderWidth: 1 }
      },
      scales: {
        x: { ticks: { color: '#6b6b80', font: { size: 11 }, maxTicksLimit: 7 }, grid: { display: false } },
        y: { ticks: { color: '#6b6b80', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });

  // Stats row
  const first = data[0], last = data[data.length - 1];
  const change = (last - first).toFixed(1);
  const min = Math.min(...data).toFixed(1);
  const max = Math.max(...data).toFixed(1);
  const changeClass = change > 0 ? 'positive' : change < 0 ? 'negative' : '';
  const changeSign = change > 0 ? '+' : '';
  statsEl.innerHTML = `
    <div class="wcs-item"><span class="wcs-val">${last}</span><span class="wcs-label">Current</span></div>
    <div class="wcs-item"><span class="wcs-val ${changeClass}">${changeSign}${change}</span><span class="wcs-label">Change</span></div>
    <div class="wcs-item"><span class="wcs-val">${min}</span><span class="wcs-label">Low</span></div>
    <div class="wcs-item"><span class="wcs-val">${max}</span><span class="wcs-label">High</span></div>
    ${goal ? `<div class="wcs-item"><span class="wcs-val">${Math.abs(goal - last).toFixed(1)}</span><span class="wcs-label">To Goal</span></div>` : ''}
  `;
}

