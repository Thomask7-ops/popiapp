/* Main application — views, router, actions */
window.App = (() => {
  const PAL = [
    '#e63946','#457b9d','#2a9d8f','#e9c46a','#f4a261',
    '#264653','#8338ec','#06d6a0','#fb5607','#3a86ff',
    '#ffbe0b','#4cc9f0','#7209b7','#f72585','#4895ef',
    '#560bad','#b5179e','#023e8a','#80b918','#d62828','#6a4c93'
  ];
  const SLOT_TIMES = [
    '13:30','14:00','14:30','15:00','15:30','16:00','16:30',
    '17:00','17:30','18:00','18:30','19:00','19:30','20:00',
    '20:30','21:00','21:30','22:00'
  ];
  const DAYS  = ['Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];
  const LEVELS = ['A1','A2','B1','B2','C1','C2'];
  const LEVEL_NEXT = {A1:'A2',A2:'B1',B1:'B2',B2:'C1',C1:'C2',C2:null};
  const MONTH_NAMES = ['Ιανουάριος','Φεβρουάριος','Μάρτιος','Απρίλιος','Μάιος','Ιούνιος',
                       'Ιούλιος','Αύγουστος','Σεπτέμβριος','Οκτώβριος','Νοέμβριος','Δεκέμβριος'];
  const MONTH_GEN   = ['Ιανουαρίου','Φεβρουαρίου','Μαρτίου','Απριλίου','Μαΐου','Ιουνίου',
                       'Ιουλίου','Αυγούστου','Σεπτεμβρίου','Οκτωβρίου','Νοεμβρίου','Δεκεμβρίου'];
  const WDAY_NAMES  = ['Κυριακή','Δευτέρα','Τρίτη','Τετάρτη','Πέμπτη','Παρασκευή','Σάββατο'];

  /* ── State ── */
  const S = {
    user: null, year: null, yearData: null,
    years: [], students: [], studentsMap: {},
    slots: [], route: 'dashboard', param: null
  };

  /* ── Tiny helpers ── */
  const el  = id  => document.getElementById(id);
  const qs  = sel => document.querySelector(sel);
  const today = () => new Date().toISOString().slice(0, 10);

  function fmt(ds) {
    if (!ds) return '';
    const [y, m, d] = ds.split('-');
    return `${d}/${m}/${y}`;
  }
  function escH(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0,2).toUpperCase();
  }
  function studentColorById(id) {
    const idx = S.students.findIndex(s => s.id === id);
    return PAL[Math.max(0, idx) % PAL.length];
  }
  function levelChip(lv) {
    return `<span class="level-chip level-${lv||'A1'}">${lv||'?'}</span>`;
  }
  function toast(msg, isErr) {
    const t = el('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = 'toast' + (isErr ? ' toast-err' : '');
    t.hidden = false;
    clearTimeout(t._tid);
    t._tid = setTimeout(() => { t.hidden = true; }, 3200);
  }

  /* ── Router ── */
  function navigate(route, param) {
    S.route = route; S.param = param || null;
    window.location.hash = param ? `#${route}/${param}` : `#${route}`;
    render();
  }

  function updateNav() {
    document.querySelectorAll('.nav-item[data-route]').forEach(item => {
      const r = item.dataset.route;
      const active = r === S.route || (r === 'calendar' && S.route === 'day');
      item.classList.toggle('active', active);
    });
  }

  async function render() {
    updateNav();
    const view = el('view');
    if (!view) return;
    view.innerHTML = '<div class="loading">Φόρτωση…</div>';
    try {
      switch (S.route) {
        case 'dashboard': view.innerHTML = await viewDashboard();           break;
        case 'students':  view.innerHTML = await viewStudents();            break;
        case 'student':   view.innerHTML = await viewStudentCard(S.param);  break;
        case 'schedule':  view.innerHTML = await viewSchedule();            break;
        case 'calendar':  view.innerHTML = await viewCalendarMonth(S.param);break;
        case 'day':       view.innerHTML = await viewCalendarDay(S.param);  break;
        case 'payments':  view.innerHTML = await viewPayments();            break;
        case 'settings':  view.innerHTML = await viewSettings();            break;
        default:          view.innerHTML = await viewDashboard();
      }
    } catch(e) {
      console.error(e);
      view.innerHTML = `<div class="error-msg">Σφάλμα: ${escH(e.message)}</div>`;
    }
  }

  /* ══════════════════════════════════════════
     VIEWS
  ══════════════════════════════════════════ */

  /* ── Dashboard ── */
  async function viewDashboard() {
    const todayStr = today();
    const lessons  = await DB.getLessonsForDate(todayStr);
    const hols     = S.yearData ? Holidays.forYear(parseInt(S.yearData.startDate)) : [];
    const todayHol = hols.find(h => h.date === todayStr);
    const ndays    = Holidays.nameday(todayStr);
    const d = new Date();

    let html = `<div class="dashboard">
      <div class="dash-date">
        <h2>${WDAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_GEN[d.getMonth()]} ${d.getFullYear()}</h2>
        ${todayHol ? `<div class="badge badge-warn">${escH(todayHol.name)}</div>` : ''}
        ${ndays.length ? `<div class="nameday-bar">🎉 Εορτάζουν: ${escH(ndays.join(', '))}</div>` : ''}
      </div>`;

    const sorted = [...lessons].sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));
    if (!sorted.length) {
      html += '<div class="empty-state">Δεν υπάρχουν μαθήματα σήμερα</div>';
    } else {
      html += `<h3 class="section-title">Σημερινά μαθήματα (${sorted.length})</h3><div class="lesson-list">`;
      for (const l of sorted) {
        const st = S.studentsMap[l.studentId] || {};
        const col = studentColorById(l.studentId);
        html += lessonRow(l, st, col);
      }
      html += '</div>';
    }

    if (S.yearData) {
      const all = await DB.getLessonsForRange(S.yearData.startDate, S.yearData.endDate, S.year);
      const done = all.filter(l => l.completed).length;
      const pct  = all.length ? Math.round(done / all.length * 100) : 0;
      html += `<div class="stats-row">
        <div class="stat-box"><div class="stat-val">${S.students.length}</div><div class="stat-lbl">Μαθητές</div></div>
        <div class="stat-box"><div class="stat-val">${done}/${all.length}</div><div class="stat-lbl">Μαθήματα</div></div>
        <div class="stat-box"><div class="stat-val">${pct}%</div><div class="stat-lbl">Πρόοδος</div></div>
      </div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>`;
    }

    html += `<button class="btn btn-secondary mt-2" onclick="App.navigate('day','${todayStr}')">Ημερήσια Προβολή →</button>`;
    html += '</div>';
    return html;
  }

  function lessonRow(l, st, col) {
    const done = l.completed;
    return `<div class="lesson-item${done?' done':''}" style="--sc-bg:${col}20;--sc-border:${col}">
      <div class="lesson-dot" style="background:${col}" onclick="App.navigate('student','${l.studentId}')">${initials(st.name||'?')}</div>
      <div class="lesson-info">
        <span class="lesson-name">${escH(st.name||'Άγνωστος')}</span>
        <span class="lesson-time">${escH(l.startTime||'')} · ${l.duration||0}ω${l.isExtra?' ⭐':''}</span>
      </div>
      <div class="lesson-actions">
        ${done
          ? `<button class="btn btn-sm btn-ghost" onclick="App.uncomplete('${l.id}')">✓ Αναίρεση</button>`
          : `<button class="btn btn-sm btn-primary" onclick="App.complete('${l.id}')">✓ Έγινε</button>`
        }
      </div>
    </div>`;
  }

  /* ── Students List ── */
  async function viewStudents() {
    const students = await (S.year ? DB.getStudents(S.year) : DB.getAllStudents());
    S.students = students;
    students.forEach(s => { S.studentsMap[s.id] = s; });

    let html = `<div class="page-header">
      <h2>Μαθητές${S.year ? ' · ' + S.year : ''}</h2>
      <button class="btn btn-primary" onclick="App.openStudentModal()">+ Νέος</button>
    </div>`;

    if (!students.length) {
      return html + '<div class="empty-state">Δεν υπάρχουν μαθητές για αυτή τη χρονιά.</div>';
    }

    html += '<div class="student-grid">';
    students.forEach((st, i) => {
      const col = PAL[i % PAL.length];
      html += `<div class="student-card" onclick="App.navigate('student','${st.id}')" style="--sc-bg:${col}18;--sc-border:${col}">
        <div class="student-avatar" style="background:${col}">${initials(st.name)}</div>
        <div class="student-info">
          <div class="student-name">${escH(st.name)}</div>
          <div class="student-meta">${levelChip(st.level)} <span>${st.sessionsPerWeek||0}×/εβδ · ${st.hoursPerSession||0}ω</span></div>
        </div>
        <button class="btn btn-sm btn-ghost edit-btn" onclick="event.stopPropagation();App.openStudentModal('${st.id}')">✏️</button>
      </div>`;
    });
    html += '</div>';
    return html;
  }

  /* ── Student Card ── */
  async function viewStudentCard(studentId) {
    if (!studentId) return '<div class="error-msg">Δεν βρέθηκε μαθητής</div>';
    const [student, stats] = await Promise.all([
      DB.getStudent(studentId),
      S.year ? DB.studentStats(studentId, S.year)
             : Promise.resolve({lessons:[],payments:[],completed:[],hoursCompleted:0,totalPlanned:0,moneyPaid:0,totalLessons:0})
    ]);
    if (!student) return '<div class="error-msg">Δεν βρέθηκε μαθητής</div>';

    const idx  = S.students.findIndex(s => s.id === studentId);
    const col  = PAL[Math.max(0, idx) % PAL.length];
    const ph   = student.pricePerHour || 0;
    const moneyTotal = stats.totalPlanned * ph;
    const moneyRem   = Math.max(0, moneyTotal - stats.moneyPaid);
    const hoursRem   = Math.max(0, stats.totalPlanned - stats.hoursCompleted);

    let html = `<div class="student-detail">
      <div class="detail-header" style="background:${col}15;border-left:4px solid ${col}">
        <div class="detail-avatar" style="background:${col}">${initials(student.name)}</div>
        <div>
          <h2>${escH(student.name)}</h2>
          ${levelChip(student.level)}
        </div>
        <button class="btn btn-sm btn-ghost ml-auto" onclick="App.openStudentModal('${student.id}')">✏️</button>
      </div>

      <div class="stats-row">
        <div class="stat-box"><div class="stat-val">${stats.hoursCompleted.toFixed(1)}</div><div class="stat-lbl">Ώρες (ολοκλ.)</div></div>
        <div class="stat-box"><div class="stat-val">${hoursRem.toFixed(1)}</div><div class="stat-lbl">Ώρες (απομ.)</div></div>
        <div class="stat-box"><div class="stat-val">${stats.moneyPaid}€</div><div class="stat-lbl">Πληρωμένα</div></div>
        <div class="stat-box"><div class="stat-val">${moneyRem.toFixed(0)}€</div><div class="stat-lbl">Υπόλοιπο</div></div>
      </div>

      <div class="card mt-2">
        <div class="card-label">Στοιχεία</div>
        <table class="detail-table">
          <tr><td>Επίπεδο</td><td>${levelChip(student.level)}</td></tr>
          <tr><td>Ώρες/μάθημα</td><td>${student.hoursPerSession||0}</td></tr>
          <tr><td>Μαθήματα/εβδ.</td><td>${student.sessionsPerWeek||0}</td></tr>
          <tr><td>Τιμή/ώρα</td><td>${ph}€</td></tr>
          <tr><td>Τιμή/μάθημα</td><td>${(ph*(student.hoursPerSession||0)).toFixed(2)}€</td></tr>
          <tr><td>Εκτ. ώρες χρονιάς</td><td>${stats.totalPlanned.toFixed(1)}</td></tr>
          <tr><td>Εκτ. κόστος χρονιάς</td><td>${moneyTotal.toFixed(0)}€</td></tr>
        </table>
      </div>

      <div class="tab-bar mt-2">
        <button class="tab-btn active" onclick="App.switchTab(this,'tab-lessons')">Μαθήματα (${stats.lessons.length})</button>
        <button class="tab-btn" onclick="App.switchTab(this,'tab-payments')">Πληρωμές (${stats.payments.length})</button>
      </div>

      <div id="tab-lessons" class="tab-content">
        <div class="section-header">
          <span>${stats.completed.length}/${stats.lessons.length} ολοκληρωμένα</span>
          <button class="btn btn-sm btn-secondary" onclick="App.openExtraLesson('${studentId}')">+ Επιπλέον</button>
        </div>`;

    const byDate = [...stats.lessons].sort((a,b) => b.date.localeCompare(a.date));
    for (const l of byDate.slice(0, 60)) {
      const done = l.completed;
      html += `<div class="list-item${done?' done':''}">
        <span class="list-date">${fmt(l.date)}</span>
        <span>${l.startTime||''} · ${l.duration||0}ω${l.isExtra?' ⭐':''}</span>
        <div class="list-actions">
          ${done
            ? `<button class="btn btn-sm btn-ghost" onclick="App.uncomplete('${l.id}');App.navigate('student','${studentId}')">✓</button>`
            : `<button class="btn btn-sm btn-primary" onclick="App.complete('${l.id}');App.navigate('student','${studentId}')">✓</button>`
          }
          <button class="btn btn-sm btn-danger" onclick="App.deleteLesson('${l.id}','${studentId}')">🗑</button>
        </div>
      </div>`;
    }
    if (byDate.length > 60) html += `<div class="hint">Εμφανίζονται τα 60 πιο πρόσφατα</div>`;
    html += `</div>

      <div id="tab-payments" class="tab-content" hidden>
        <div class="section-header">
          <span>Σύνολο: ${stats.moneyPaid}€</span>
          <button class="btn btn-sm btn-primary" onclick="App.openAddPayment('${studentId}')">+ Πληρωμή</button>
        </div>`;

    for (const p of stats.payments) {
      html += `<div class="list-item">
        <span class="list-date">${fmt(p.date)}</span>
        <span>${p.amount}€${p.note ? ' · ' + escH(p.note) : ''}</span>
        <button class="btn btn-sm btn-danger" onclick="App.deletePayment('${p.id}','${studentId}')">🗑</button>
      </div>`;
    }
    html += `</div></div>`;
    return html;
  }

  /* ── Schedule ── */
  async function viewSchedule() {
    const slots = await DB.getSlots(S.year || '');
    S.slots = slots;

    // Build lookup: 'day-slotIdx' -> slot
    const grid = {};
    for (const slot of slots) {
      for (let i = 0; i < (slot.slotsCount||1); i++) {
        grid[`${slot.day}-${slot.startSlot+i}`] = slot;
      }
    }

    let html = `<div class="page-header">
      <h2>Εβδομαδιαίο Πρόγραμμα</h2>
      <div class="btn-group">
        <button class="btn btn-sm btn-ghost" onclick="App.clearSchedule()">Καθαρισμός</button>
        <button class="btn btn-sm btn-secondary" onclick="App.generateLessons()">⚡ Δημιουργία Μαθημάτων</button>
      </div>
    </div>
    <div class="sched-wrap"><table class="sched-table"><thead><tr><th class="time-col">Ώρα</th>`;
    DAYS.forEach(d => { html += `<th>${d}</th>`; });
    html += `</tr></thead><tbody>`;

    for (let ti = 0; ti < SLOT_TIMES.length; ti++) {
      html += `<tr><td class="time-label">${SLOT_TIMES[ti]}</td>`;
      for (let di = 0; di < 6; di++) {
        const slot = grid[`${di}-${ti}`];
        if (slot) {
          const st  = S.studentsMap[slot.studentId] || {};
          const col = studentColorById(slot.studentId);
          const isStart = slot.startSlot === ti;
          html += `<td class="td-session${isStart?' td-start':' td-cont'}" style="--sc-bg:${col}28;--sc-border:${col}">`;
          if (isStart) {
            html += `<div class="session-cell" onclick="App.openSlotPicker(${di},${ti})">
              <div class="session-avatar" style="background:${col}">${initials(st.name||'?')}</div>
              <span class="session-name">${escH(st.name||'?')}</span>
              <button class="del-slot" onclick="event.stopPropagation();App.deleteSlot('${slot.id}')">✕</button>
            </div>`;
          }
          html += `</td>`;
        } else {
          html += `<td class="td-empty" onclick="App.openSlotPicker(${di},${ti})"><div class="empty-cell">+</div></td>`;
        }
      }
      html += '</tr>';
    }
    html += `</tbody></table></div>

    <div id="slot-modal" class="modal-overlay" hidden data-static="1">
      <div class="modal-box">
        <h3>Ανάθεση Μαθητή</h3>
        <div id="slot-day-time" class="hint mb-1"></div>
        <label>Μαθητής</label>
        <select id="slot-student">
          <option value="">— Επιλέξτε —</option>
          ${S.students.map(st => `<option value="${st.id}">${escH(st.name)}</option>`).join('')}
        </select>
        <label>Διάρκεια</label>
        <select id="slot-duration">
          <option value="1">0.5ω (30λ)</option>
          <option value="2" selected>1ω (60λ)</option>
          <option value="3">1.5ω (90λ)</option>
          <option value="4">2ω (120λ)</option>
        </select>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="App.closeModal('slot-modal')">Ακύρωση</button>
          <button class="btn btn-primary" onclick="App.saveSlot()">Αποθήκευση</button>
        </div>
      </div>
    </div>`;
    return html;
  }

  /* ── Calendar Month ── */
  async function viewCalendarMonth(dateParam) {
    const ref   = dateParam ? new Date(dateParam + '-01') : new Date();
    const year  = ref.getFullYear();
    const month = ref.getMonth();
    const first = new Date(year, month, 1);
    const last  = new Date(year, month + 1, 0);
    const pad   = n => String(n).padStart(2,'0');
    const startDate = `${year}-${pad(month+1)}-01`;
    const endDate   = `${year}-${pad(month+1)}-${pad(last.getDate())}`;

    const [lessons, hols] = await Promise.all([
      S.year ? DB.getLessonsForRange(startDate, endDate, S.year) : Promise.resolve([]),
      Promise.resolve(Holidays.forYear(year))
    ]);

    const byDate = {};
    for (const l of lessons) {
      (byDate[l.date] = byDate[l.date] || []).push(l);
    }

    const prevM = month === 0 ? `${year-1}-12` : `${year}-${pad(month)}`;
    const nextM = month === 11 ? `${year+1}-01` : `${year}-${pad(month+2)}`;

    let html = `<div class="cal-nav">
      <button class="btn btn-ghost" onclick="App.navigate('calendar','${prevM}')">◀</button>
      <h2>${MONTH_NAMES[month]} ${year}</h2>
      <button class="btn btn-ghost" onclick="App.navigate('calendar','${nextM}')">▶</button>
    </div>
    <div class="cal-grid">
      <div class="cal-head">Δευ</div><div class="cal-head">Τρι</div>
      <div class="cal-head">Τετ</div><div class="cal-head">Πεμ</div>
      <div class="cal-head">Παρ</div><div class="cal-head">Σαβ</div>
      <div class="cal-head">Κυρ</div>`;

    let dow = first.getDay(); // 0=Sun
    dow = dow === 0 ? 6 : dow - 1; // Mon=0
    for (let i = 0; i < dow; i++) html += '<div class="cal-cell cal-empty"></div>';

    const todayStr = today();
    for (let d = 1; d <= last.getDate(); d++) {
      const ds   = `${year}-${pad(month+1)}-${pad(d)}`;
      const dls  = byDate[ds] || [];
      const hol  = hols.find(h => h.date === ds);
      const nds  = Holidays.nameday(ds);
      const cls  = ['cal-cell', ds===todayStr?'cal-today':'', hol?'cal-holiday':''].filter(Boolean).join(' ');

      html += `<div class="${cls}" onclick="App.navigate('day','${ds}')">
        <div class="cal-date">${d}</div>`;
      if (hol) html += `<div class="cal-hol-name">${escH(hol.name.slice(0,16))}</div>`;
      if (nds.length) html += `<div class="cal-nameday">🎉${escH(nds.slice(0,2).join(','))}</div>`;
      if (dls.length) {
        const done = dls.filter(l => l.completed).length;
        html += `<div class="cal-dots">`;
        dls.slice(0,5).forEach(l => {
          html += `<span class="cal-dot${l.completed?' done':''}" style="background:${studentColorById(l.studentId)}"></span>`;
        });
        if (dls.length > 5) html += `<span class="cal-more">+${dls.length-5}</span>`;
        html += `</div><div class="cal-count">${done}/${dls.length}</div>`;
      }
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  /* ── Calendar Day ── */
  async function viewCalendarDay(dateStr) {
    if (!dateStr) dateStr = today();
    const [lessons, hols] = await Promise.all([
      DB.getLessonsForDate(dateStr),
      Promise.resolve(Holidays.forYear(parseInt(dateStr)))
    ]);
    const hol  = hols.find(h => h.date === dateStr);
    const nds  = Holidays.nameday(dateStr);
    const d    = new Date(dateStr + 'T12:00:00');
    const sorted = [...lessons].sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));

    function adjDay(ds, n) {
      const dd = new Date(ds + 'T12:00:00');
      dd.setDate(dd.getDate() + n);
      if (dd.getDay() === 0) dd.setDate(dd.getDate() + n);
      return dd.toISOString().slice(0,10);
    }

    let html = `<div class="day-nav">
      <button class="btn btn-ghost" onclick="App.navigate('day','${adjDay(dateStr,-1)}')">◀</button>
      <div class="day-title">
        <h2>${WDAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_GEN[d.getMonth()]}</h2>
        ${hol ? `<div class="badge badge-warn">${escH(hol.name)}</div>` : ''}
        ${nds.length ? `<div class="nameday-bar">🎉 ${escH(nds.join(', '))}</div>` : ''}
      </div>
      <button class="btn btn-ghost" onclick="App.navigate('day','${adjDay(dateStr,1)}')">▶</button>
    </div>
    <button class="btn btn-ghost mb-1" onclick="App.navigate('calendar','${dateStr.slice(0,7)}')">← Ημερολόγιο</button>
    <div class="section-header">
      <span>${sorted.length} μαθήματα · ${sorted.filter(l=>l.completed).length} ολοκληρωμένα</span>
      <button class="btn btn-sm btn-secondary" onclick="App.openExtraLessonDate('${dateStr}')">+ Επιπλέον</button>
    </div>`;

    if (!sorted.length) {
      html += `<div class="empty-state">Δεν υπάρχουν μαθήματα${hol?' (αργία)':''}</div>`;
    } else {
      html += '<div class="lesson-list">';
      for (const l of sorted) {
        const st  = S.studentsMap[l.studentId] || {};
        const col = studentColorById(l.studentId);
        html += lessonRow(l, st, col);
      }
      html += '</div>';
    }
    return html;
  }

  /* ── Payments ── */
  async function viewPayments() {
    const payments = S.year ? await DB.getPayments(null, S.year) : [];
    const total    = payments.reduce((a,p) => a + (p.amount||0), 0);
    const sorted   = [...payments].sort((a,b) => b.date.localeCompare(a.date));

    let html = `<div class="page-header">
      <h2>Πληρωμές · ${S.year||''}</h2>
      <span class="badge">${total}€</span>
    </div>`;

    if (!sorted.length) return html + '<div class="empty-state">Δεν υπάρχουν πληρωμές</div>';

    html += '<div class="payment-list">';
    for (const p of sorted) {
      const st  = S.studentsMap[p.studentId] || {};
      const col = studentColorById(p.studentId);
      html += `<div class="list-item">
        <div class="lesson-dot sm" style="background:${col};cursor:pointer" onclick="App.navigate('student','${p.studentId}')">${initials(st.name||'?')}</div>
        <div class="lesson-info">
          <span class="lesson-name">${escH(st.name||'?')}</span>
          <span class="lesson-time">${fmt(p.date)}${p.note?' · '+escH(p.note):''}</span>
        </div>
        <div class="pay-amount">${p.amount}€</div>
        <button class="btn btn-sm btn-danger" onclick="App.deletePayment('${p.id}','')">🗑</button>
      </div>`;
    }
    html += '</div>';
    return html;
  }

  /* ── Settings ── */
  async function viewSettings() {
    const years = await DB.getYears();
    S.years = years;

    let html = `<h2 class="page-title">Ρυθμίσεις</h2>

    <div class="card">
      <div class="card-label">Ακαδημαϊκή Χρονιά</div>
      <select id="year-select" onchange="App.setYear(this.value)">
        ${years.map(y => `<option value="${y.id}"${y.id===S.year?' selected':''}>${escH(y.name||y.id)}</option>`).join('')}
      </select>
      <button class="btn btn-sm btn-secondary mt-1" onclick="App.openYearModal()">+ Νέα Χρονιά</button>
      ${S.yearData ? `<button class="btn btn-sm btn-ghost mt-1" onclick="App.openYearModal('${S.year}')">✏️ Επεξεργασία</button>` : ''}
    </div>`;

    if (S.yearData) {
      html += `<div class="card">
        <div class="card-label">${escH(S.yearData.name||S.year)}</div>
        <table class="detail-table">
          <tr><td>Έναρξη</td><td>${fmt(S.yearData.startDate)}</td></tr>
          <tr><td>Λήξη</td><td>${fmt(S.yearData.endDate)}</td></tr>
        </table>
      </div>`;
    }

    if (Auth.isAdmin) {
      html += `<div class="card">
        <div class="card-label">Εξέλιξη Επιπέδων</div>
        <p class="hint">Στο τέλος της χρονιάς όλοι οι μαθητές προχωρούν ένα επίπεδο CEFR.</p>
        <button class="btn btn-secondary" onclick="App.advanceLevels()">🎓 Προχώρηση Επιπέδων</button>
      </div>
      <div class="card">
        <div class="card-label">Χρήστες</div>
        <button class="btn btn-secondary" onclick="App.openCreateTeacher()">+ Νέος Εκπαιδευτής</button>
      </div>
      <div class="card">
        <div class="card-label">Εξαγωγή Δεδομένων</div>
        <button class="btn btn-secondary" onclick="App.exportYear()">📊 Εξαγωγή Χρονιάς (CSV)</button>
      </div>`;
    }

    html += `<div class="card">
      <button class="btn btn-danger" onclick="App.logout()">Αποσύνδεση</button>
    </div>

    <!-- Year modal -->
    <div id="year-modal" class="modal-overlay" hidden data-static="1">
      <div class="modal-box">
        <h3 id="year-modal-title">Νέα Χρονιά</h3>
        <label>Κωδικός (π.χ. 2026-27)</label>
        <input type="text" id="year-id-inp" placeholder="2026-27">
        <label>Ονομασία</label>
        <input type="text" id="year-name-inp" placeholder="Σχολική Χρονιά 2026-27">
        <label>Ημ. Έναρξης</label>
        <input type="date" id="year-start-inp">
        <label>Ημ. Λήξης</label>
        <input type="date" id="year-end-inp">
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="App.closeModal('year-modal')">Ακύρωση</button>
          <button class="btn btn-primary" onclick="App.saveYear()">Αποθήκευση</button>
        </div>
      </div>
    </div>

    <!-- Teacher modal -->
    <div id="teacher-modal" class="modal-overlay" hidden data-static="1">
      <div class="modal-box">
        <h3>Νέος Εκπαιδευτής</h3>
        <label>Όνομα</label>
        <input type="text" id="teacher-name-inp">
        <label>Email</label>
        <input type="email" id="teacher-email-inp">
        <label>Κωδικός</label>
        <input type="password" id="teacher-pass-inp">
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="App.closeModal('teacher-modal')">Ακύρωση</button>
          <button class="btn btn-primary" onclick="App.createTeacher()">Δημιουργία</button>
        </div>
      </div>
    </div>`;
    return html;
  }

  /* ══════════════════════════════════════════
     ACTIONS
  ══════════════════════════════════════════ */

  /* Lesson complete / uncomplete */
  async function completeAction(id) {
    await DB.completeLesson(id, today());
    toast('✓ Μάθημα ολοκληρώθηκε');
    render();
  }
  async function uncompleteAction(id) {
    await DB.uncompleteLesson(id);
    toast('Αναίρεση ολοκλήρωσης');
    render();
  }
  async function deleteLessonAction(id, studentId) {
    if (!confirm('Διαγραφή μαθήματος;')) return;
    await DB.deleteLesson(id);
    toast('Διαγράφηκε');
    if (studentId) navigate('student', studentId); else render();
  }

  /* Slot picker */
  let _slotDay = 0, _slotTime = 0;
  function openSlotPicker(day, ti) {
    _slotDay = day; _slotTime = ti;
    const m = el('slot-modal');
    if (!m) return;
    el('slot-day-time').textContent = `${DAYS[day]} ${SLOT_TIMES[ti]}`;
    el('slot-student').value = '';
    el('slot-duration').value = '2';
    m.hidden = false;
  }
  async function saveSlotAction() {
    const sid = el('slot-student').value;
    const dur = parseInt(el('slot-duration').value);
    if (!sid) { toast('Επιλέξτε μαθητή', true); return; }
    await DB.saveSlot({ yearId: S.year, studentId: sid, day: _slotDay, startSlot: _slotTime, slotsCount: dur });
    closeModal('slot-modal');
    toast('Αποθηκεύτηκε');
    navigate('schedule');
  }
  async function deleteSlotAction(id) {
    if (!confirm('Διαγραφή από πρόγραμμα;')) return;
    await DB.deleteSlot(id);
    navigate('schedule');
  }
  async function clearScheduleAction() {
    if (!confirm('Καθαρισμός ολόκληρου του προγράμματος;')) return;
    await DB.deleteAllSlots(S.year);
    toast('Πρόγραμμα καθαρίστηκε');
    navigate('schedule');
  }
  async function generateLessonsAction() {
    if (!S.year || !S.yearData) { toast('Επιλέξτε χρονιά πρώτα', true); return; }
    if (!confirm('Δημιουργία μαθημάτων από το πρόγραμμα;\nΤα ήδη υπάρχοντα δεν θα αλλαχτούν.')) return;
    const slots = await DB.getSlots(S.year);
    const hols  = Holidays.forYear(parseInt(S.yearData.startDate.slice(0,4)));
    toast('Δημιουργία μαθημάτων…');
    try {
      const count = await DB.generateLessons(S.year, slots, hols);
      toast(`✓ Δημιουργήθηκαν ${count} μαθήματα`);
    } catch(e) {
      toast('Σφάλμα: ' + e.message, true);
    }
  }

  /* Student modal */
  let _editStudentId = null;
  function openStudentModal(id) {
    _editStudentId = id || null;
    closeModal('student-modal');
    const html = `<div id="student-modal" class="modal-overlay">
      <div class="modal-box">
        <h3>${id ? 'Επεξεργασία Μαθητή' : 'Νέος Μαθητής'}</h3>
        <label>Όνομα</label>
        <input type="text" id="st-name" placeholder="Όνομα">
        <label>Επίπεδο CEFR</label>
        <select id="st-level">${LEVELS.map(l => `<option value="${l}">${l}</option>`).join('')}</select>
        <label>Ώρες/μάθημα</label>
        <input type="number" id="st-hours" value="1" min="0.5" step="0.5">
        <label>Μαθήματα/εβδομάδα</label>
        <input type="number" id="st-sessions" value="2" min="1">
        <label>Τιμή/ώρα (€)</label>
        <input type="number" id="st-price" value="15" min="0">
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="App.closeModal('student-modal')">Ακύρωση</button>
          ${id ? `<button class="btn btn-danger" onclick="App.confirmDeleteStudent('${id}')">Διαγραφή</button>` : ''}
          <button class="btn btn-primary" onclick="App.saveStudent()">Αποθήκευση</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
    if (id) {
      DB.getStudent(id).then(st => {
        if (!st) return;
        el('st-name').value    = st.name || '';
        el('st-level').value   = st.level || 'A1';
        el('st-hours').value   = st.hoursPerSession || 1;
        el('st-sessions').value = st.sessionsPerWeek || 2;
        el('st-price').value   = st.pricePerHour || 15;
      });
    }
  }
  async function saveStudentAction() {
    const name = (el('st-name').value || '').trim();
    if (!name) { toast('Εισάγετε όνομα', true); return; }
    const data = {
      name,
      level: el('st-level').value,
      hoursPerSession:  parseFloat(el('st-hours').value)   || 1,
      sessionsPerWeek:  parseInt(el('st-sessions').value)   || 1,
      pricePerHour:     parseFloat(el('st-price').value)    || 0,
      activeYears: S.year ? [S.year] : []
    };
    if (_editStudentId) {
      const existing = await DB.getStudent(_editStudentId);
      if (existing?.activeYears) {
        data.activeYears = existing.activeYears;
        if (S.year && !data.activeYears.includes(S.year)) data.activeYears.push(S.year);
      }
    }
    await DB.saveStudent(_editStudentId || null, data);
    closeModal('student-modal');
    toast('Αποθηκεύτηκε');
    S.students = await DB.getStudents(S.year);
    S.students.forEach(s => { S.studentsMap[s.id] = s; });
    navigate('students');
  }
  async function confirmDeleteStudentAction(id) {
    if (!confirm('Διαγραφή μαθητή; Αυτή η ενέργεια δεν μπορεί να αναιρεθεί.')) return;
    await DB.deleteStudent(id);
    closeModal('student-modal');
    toast('Διαγράφηκε');
    navigate('students');
  }

  /* Payment modal */
  let _payStudentId = null;
  function openAddPayment(studentId) {
    _payStudentId = studentId;
    closeModal('payment-modal');
    const html = `<div id="payment-modal" class="modal-overlay">
      <div class="modal-box">
        <h3>Νέα Πληρωμή</h3>
        <label>Ποσό (€)</label>
        <input type="number" id="pay-amount" min="0" step="0.01" placeholder="0">
        <label>Ημερομηνία</label>
        <input type="date" id="pay-date" value="${today()}">
        <label>Σημείωση (προαιρ.)</label>
        <input type="text" id="pay-note" placeholder="">
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="App.closeModal('payment-modal')">Ακύρωση</button>
          <button class="btn btn-primary" onclick="App.savePayment()">Αποθήκευση</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }
  async function savePaymentAction() {
    const amount = parseFloat(el('pay-amount').value);
    const date   = el('pay-date').value;
    const note   = (el('pay-note').value || '').trim();
    if (!amount || !date) { toast('Συμπληρώστε ποσό και ημερομηνία', true); return; }
    await DB.savePayment({ studentId: _payStudentId, yearId: S.year, amount, date, note });
    closeModal('payment-modal');
    toast('Πληρωμή καταχωρήθηκε');
    navigate('student', _payStudentId);
  }
  async function deletePaymentAction(id, studentId) {
    if (!confirm('Διαγραφή πληρωμής;')) return;
    await DB.deletePayment(id);
    toast('Διαγράφηκε');
    if (studentId) navigate('student', studentId); else navigate('payments');
  }

  /* Extra lesson modal */
  let _extraStudentId = null, _extraDate = null;
  function openExtraLesson(studentId) {
    _extraStudentId = studentId; _extraDate = null; _showExtraModal();
  }
  function openExtraLessonDate(date) {
    _extraStudentId = null; _extraDate = date; _showExtraModal();
  }
  function _showExtraModal() {
    closeModal('extra-modal');
    const html = `<div id="extra-modal" class="modal-overlay">
      <div class="modal-box">
        <h3>Επιπλέον Μάθημα</h3>
        ${!_extraStudentId ? `<label>Μαθητής</label>
        <select id="extra-student">
          <option value="">— Επιλέξτε —</option>
          ${S.students.map(s => `<option value="${s.id}">${escH(s.name)}</option>`).join('')}
        </select>` : ''}
        <label>Ημερομηνία</label>
        <input type="date" id="extra-date" value="${_extraDate || today()}">
        <label>Ώρα έναρξης</label>
        <select id="extra-time">${SLOT_TIMES.map(t => `<option value="${t}">${t}</option>`).join('')}</select>
        <label>Διάρκεια</label>
        <select id="extra-dur">
          <option value="0.5">0.5ω</option>
          <option value="1" selected>1ω</option>
          <option value="1.5">1.5ω</option>
          <option value="2">2ω</option>
        </select>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="App.closeModal('extra-modal')">Ακύρωση</button>
          <button class="btn btn-primary" onclick="App.saveExtraLesson()">Αποθήκευση</button>
        </div>
      </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
  }
  async function saveExtraLessonAction() {
    const sid  = _extraStudentId || (el('extra-student') ? el('extra-student').value : '');
    const date = el('extra-date').value;
    const time = el('extra-time').value;
    const dur  = parseFloat(el('extra-dur').value);
    if (!sid || !date) { toast('Συμπληρώστε μαθητή και ημερομηνία', true); return; }
    await DB.saveLesson(null, { studentId: sid, yearId: S.year, date, startTime: time, duration: dur, completed: false, completedAt: null, isExtra: true });
    closeModal('extra-modal');
    toast('Επιπλέον μάθημα αποθηκεύτηκε');
    if (_extraStudentId) navigate('student', _extraStudentId);
    else navigate('day', _extraDate);
  }

  /* Year modal */
  async function openYearModal(yearId) {
    const m = el('year-modal');
    if (!m) return;
    el('year-modal-title').textContent = yearId ? 'Επεξεργασία Χρονιάς' : 'Νέα Χρονιά';
    el('year-id-inp').value = yearId || '';
    el('year-name-inp').value = ''; el('year-start-inp').value = ''; el('year-end-inp').value = '';
    if (yearId) {
      const y = await DB.getYear(yearId);
      if (y) {
        el('year-id-inp').value = y.id;
        el('year-name-inp').value = y.name || '';
        el('year-start-inp').value = y.startDate || '';
        el('year-end-inp').value = y.endDate || '';
      }
    }
    m.hidden = false;
  }
  async function saveYearAction() {
    const id    = (el('year-id-inp').value || '').trim();
    const name  = (el('year-name-inp').value || '').trim();
    const start = el('year-start-inp').value;
    const end   = el('year-end-inp').value;
    if (!id || !start || !end) { toast('Συμπληρώστε όλα τα πεδία', true); return; }
    await DB.saveYear(id, { name: name || id, startDate: start, endDate: end });
    closeModal('year-modal');
    toast('Χρονιά αποθηκεύτηκε');
    S.years = await DB.getYears();
    await setYearAction(id);
    navigate('settings');
  }
  async function setYearAction(yearId) {
    S.year     = yearId;
    S.yearData = await DB.getYear(yearId);
    S.students = await DB.getStudents(yearId);
    S.studentsMap = {};
    S.students.forEach(s => { S.studentsMap[s.id] = s; });
    S.slots    = await DB.getSlots(yearId);
    const yd = el('current-year');
    if (yd) yd.textContent = S.yearData ? (S.yearData.name || yearId) : yearId;
  }

  /* Teacher creation */
  function openCreateTeacher() {
    const m = el('teacher-modal');
    if (m) m.hidden = false;
  }
  async function createTeacherAction() {
    const name  = (el('teacher-name-inp').value || '').trim();
    const email = (el('teacher-email-inp').value || '').trim();
    const pass  = el('teacher-pass-inp').value;
    if (!name || !email || !pass) { toast('Συμπληρώστε όλα τα πεδία', true); return; }
    try {
      await Auth.createUser(name, email, pass, 'teacher');
      closeModal('teacher-modal');
      toast('Εκπαιδευτής δημιουργήθηκε');
      el('teacher-name-inp').value = ''; el('teacher-email-inp').value = ''; el('teacher-pass-inp').value = '';
    } catch(e) { toast('Σφάλμα: ' + e.message, true); }
  }

  /* Level advancement */
  async function advanceLevelsAction() {
    if (!confirm('Προχώρηση ενός επιπέδου για όλους τους μαθητές της χρονιάς;\nΑυτό δεν μπορεί να αναιρεθεί.')) return;
    const all = await DB.getAllStudents();
    let count = 0;
    for (const st of all) {
      const next = LEVEL_NEXT[st.level];
      if (next) { await DB.saveStudent(st.id, { level: next }); count++; }
    }
    toast(`✓ ${count} μαθητές προχώρησαν επίπεδο`);
    S.students = await DB.getStudents(S.year);
    S.students.forEach(s => { S.studentsMap[s.id] = s; });
  }

  /* Export CSV */
  async function exportYearAction() {
    if (!S.year) { toast('Επιλέξτε χρονιά', true); return; }
    toast('Προετοιμασία εξαγωγής…');
    const students = await DB.getStudents(S.year);
    let csv = 'Μαθητής,Επίπεδο,Ώρες/Μάθημα,Μαθήματα/Εβδ,Τιμή/Ώρα,Ολοκλ.Ώρες,Συνολ.Ώρες,Πλήρωσε(€),Υπόλοιπο(€)\n';
    for (const st of students) {
      const stats = await DB.studentStats(st.id, S.year);
      const ph    = st.pricePerHour || 0;
      const total = stats.totalPlanned * ph;
      const rem   = Math.max(0, total - stats.moneyPaid);
      csv += `"${st.name}",${st.level||''},${st.hoursPerSession||0},${st.sessionsPerWeek||0},${ph},${stats.hoursCompleted.toFixed(1)},${stats.totalPlanned.toFixed(1)},${stats.moneyPaid},${rem.toFixed(2)}\n`;
    }
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `ιδιαιτερα-${S.year}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast('✓ Εξαγωγή ολοκληρώθηκε');
  }

  /* Modal helpers */
  function closeModal(id) {
    const m = el(id);
    if (!m) return;
    if (m.dataset.static) { m.hidden = true; } else { m.remove(); }
  }
  function switchTab(btn, tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => { t.hidden = true; });
    btn.classList.add('active');
    const t = el(tabId);
    if (t) t.hidden = false;
  }

  /* ══════════════════════════════════════════
     LOGIN / SETUP SCREENS
  ══════════════════════════════════════════ */
  function renderLogin(errMsg) {
    const shell = el('app-shell');
    if (shell) shell.hidden = true;
    if (!el('login-wrap')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="login-wrap">
          <div class="login-box">
            <div class="login-logo">📅</div>
            <h1>Πρόγραμμα Ιδιαίτερων</h1>
            ${errMsg ? `<div class="error-msg">${escH(errMsg)}</div>` : ''}
            <input type="email" id="login-email" placeholder="Email" autocomplete="username">
            <input type="password" id="login-pass" placeholder="Κωδικός" autocomplete="current-password">
            <label class="check-label"><input type="checkbox" id="login-remember"> Να με θυμάσαι</label>
            <button class="btn btn-primary btn-full" onclick="App.doLogin()">Σύνδεση</button>
          </div>
        </div>`);
    }
    const ep = el('login-email');
    if (ep) ep.addEventListener('keydown', e => { if (e.key==='Enter') el('login-pass').focus(); });
    const pp = el('login-pass');
    if (pp) pp.addEventListener('keydown', e => { if (e.key==='Enter') doLoginAction(); });
  }

  function renderSetup() {
    const shell = el('app-shell');
    if (shell) shell.hidden = true;
    if (!el('login-wrap')) {
      document.body.insertAdjacentHTML('beforeend', `
        <div id="login-wrap">
          <div class="login-box">
            <div class="login-logo">📅</div>
            <h1>Πρώτη Εκκίνηση</h1>
            <p class="hint">Δημιουργήστε τον λογαριασμό διαχειριστή</p>
            <input type="text" id="setup-name" placeholder="Ονοματεπώνυμο">
            <input type="email" id="setup-email" placeholder="Email">
            <input type="password" id="setup-pass" placeholder="Κωδικός (6+ χαρακτήρες)">
            <button class="btn btn-primary btn-full" onclick="App.doSetup()">Δημιουργία Λογαριασμού</button>
          </div>
        </div>`);
    }
  }

  function removeLogin() {
    const lw = el('login-wrap');
    if (lw) lw.remove();
    const shell = el('app-shell');
    if (shell) shell.hidden = false;
  }

  async function doLoginAction() {
    const email    = (el('login-email').value || '').trim();
    const pass     = el('login-pass').value;
    const remember = el('login-remember').checked;
    if (!email || !pass) { toast('Συμπληρώστε email και κωδικό', true); return; }
    try { await Auth.login(email, pass, remember); }
    catch(e) { toast('Σφάλμα σύνδεσης: ' + e.message, true); }
  }
  async function doSetupAction() {
    const name  = (el('setup-name').value || '').trim();
    const email = (el('setup-email').value || '').trim();
    const pass  = el('setup-pass').value;
    if (!name || !email || !pass) { toast('Συμπληρώστε όλα τα πεδία', true); return; }
    if (pass.length < 6) { toast('Ο κωδικός πρέπει να έχει τουλάχιστον 6 χαρακτήρες', true); return; }
    try { await Auth.setupAdmin(name, email, pass); }
    catch(e) { toast('Σφάλμα: ' + e.message, true); }
  }

  /* ══════════════════════════════════════════
     INIT
  ══════════════════════════════════════════ */
  async function init() {
    // Hash routing
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.slice(1);
      const [route, param] = hash.split('/');
      if (route) { S.route = route; S.param = param || null; render(); }
    });

    Auth.onChange(async user => {
      if (!user) {
        try {
          const first = await Auth.isFirstRun();
          if (first) renderSetup(); else renderLogin();
        } catch(e) { renderLogin(); }
        return;
      }

      removeLogin();

      // Update header
      const ud = el('user-display');
      if (ud) ud.textContent = user.name || user.email || '';
      const rb = el('role-badge');
      if (rb) { rb.textContent = Auth.isAdmin ? 'Admin' : 'Teacher'; rb.className = 'badge' + (Auth.isAdmin ? ' badge-admin' : ''); }

      // Load years
      S.years = await DB.getYears();
      if (S.years.length > 0) {
        await setYearAction(S.years[0].id);
      }

      // Parse hash
      const hash = window.location.hash.slice(1);
      if (hash) {
        const [route, param] = hash.split('/');
        S.route = route || 'dashboard';
        S.param = param || null;
      }

      render();
    });
  }

  /* ── Public API ── */
  return {
    navigate, init,
    doLogin: doLoginAction, doSetup: doSetupAction, logout: () => Auth.logout(),
    complete: completeAction, uncomplete: uncompleteAction, deleteLesson: deleteLessonAction,
    openStudentModal, saveStudent: saveStudentAction, confirmDeleteStudent: confirmDeleteStudentAction,
    openAddPayment, savePayment: savePaymentAction, deletePayment: deletePaymentAction,
    openExtraLesson, openExtraLessonDate, saveExtraLesson: saveExtraLessonAction,
    openSlotPicker, saveSlot: saveSlotAction, deleteSlot: deleteSlotAction,
    clearSchedule: clearScheduleAction, generateLessons: generateLessonsAction,
    openYearModal, saveYear: saveYearAction, setYear: setYearAction,
    openCreateTeacher, createTeacher: createTeacherAction,
    advanceLevels: advanceLevelsAction, exportYear: exportYearAction,
    closeModal, switchTab
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
