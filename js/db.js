/* All Firestore operations */
window.DB = (() => {
  const ts = () => firebase.firestore.FieldValue.serverTimestamp();

  /* ── Academic Years ── */
  async function getYears() {
    const snap = await db.collection('academicYears').orderBy('name', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  async function saveYear(yearId, data) {
    await db.collection('academicYears').doc(yearId).set(data, { merge: true });
  }
  async function getYear(yearId) {
    const snap = await db.collection('academicYears').doc(yearId).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }

  /* ── Students ── */
  async function getStudents(yearId) {
    let q = db.collection('students').orderBy('name');
    if (yearId) q = db.collection('students').where('activeYears', 'array-contains', yearId).orderBy('name');
    const snap = await q.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  async function getAllStudents() {
    const snap = await db.collection('students').orderBy('name').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  async function getStudent(id) {
    const snap = await db.collection('students').doc(id).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
  }
  async function saveStudent(id, data) {
    if (id) {
      await db.collection('students').doc(id).set({ ...data, updatedAt: ts() }, { merge: true });
      return id;
    } else {
      const ref = await db.collection('students').add({ ...data, createdAt: ts() });
      return ref.id;
    }
  }
  async function deleteStudent(id) {
    await db.collection('students').doc(id).delete();
  }

  /* ── Schedule Slots ── */
  async function getSlots(yearId) {
    const snap = await db.collection('scheduleSlots').where('yearId', '==', yearId).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  async function saveSlot(data) {
    return db.collection('scheduleSlots').add(data);
  }
  async function deleteSlot(id) {
    return db.collection('scheduleSlots').doc(id).delete();
  }
  async function deleteAllSlots(yearId) {
    const snap = await db.collection('scheduleSlots').where('yearId', '==', yearId).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    return batch.commit();
  }

  /* ── Lessons ── */
  async function getLessons(studentId, yearId) {
    let q = db.collection('lessons').where('yearId', '==', yearId);
    if (studentId) q = q.where('studentId', '==', studentId);
    const snap = await q.orderBy('date').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  async function getLessonsForDate(date) {
    const snap = await db.collection('lessons').where('date', '==', date).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  async function getLessonsForRange(startDate, endDate, yearId) {
    const snap = await db.collection('lessons')
      .where('yearId', '==', yearId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  async function saveLesson(id, data) {
    if (id) {
      await db.collection('lessons').doc(id).set({ ...data, updatedAt: ts() }, { merge: true });
      return id;
    } else {
      const ref = await db.collection('lessons').add({ ...data, createdAt: ts() });
      return ref.id;
    }
  }
  async function deleteLesson(id) {
    return db.collection('lessons').doc(id).delete();
  }
  async function completeLesson(id, completedAt) {
    await db.collection('lessons').doc(id).update({ completed: true, completedAt: completedAt || ts() });
  }
  async function uncompleteLesson(id) {
    await db.collection('lessons').doc(id).update({ completed: false, completedAt: null });
  }

  /* ── Payments ── */
  async function getPayments(studentId, yearId) {
    let q = db.collection('payments').orderBy('date', 'desc');
    if (yearId) q = db.collection('payments').where('yearId', '==', yearId).orderBy('date', 'desc');
    if (studentId && yearId) {
      q = db.collection('payments')
        .where('studentId', '==', studentId)
        .where('yearId', '==', yearId)
        .orderBy('date', 'desc');
    } else if (studentId) {
      q = db.collection('payments').where('studentId', '==', studentId).orderBy('date', 'desc');
    }
    const snap = await q.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }
  async function savePayment(data) {
    return db.collection('payments').add({ ...data, createdAt: ts() });
  }
  async function deletePayment(id) {
    return db.collection('payments').doc(id).delete();
  }

  /* ── Generate lessons from schedule ── */
  async function generateLessons(yearId, slots, holidays) {
    const year = await getYear(yearId);
    if (!year) return 0;

    const holidayDates = new Set(
      holidays.filter(h => !h.allowLesson).map(h => h.date)
    );

    const DAYS_MAP = [1, 2, 3, 4, 5, 6]; // Mon=1..Sat=6 (JS: 0=Sun)
    const start = new Date(year.startDate);
    const end   = new Date(year.endDate);
    const SLOTS_TIMES = ['13:30','14:00','14:30','15:00','15:30','16:00','16:30',
                         '17:00','17:30','18:00','18:30','19:00','19:30','20:00',
                         '20:30','21:00','21:30','22:00'];

    let batch = db.batch();
    let batchCount = 0;
    let count = 0;

    for (let dt = new Date(start); dt <= end; dt.setDate(dt.getDate() + 1)) {
      const dateStr = Holidays.fmt(dt);
      const dow = dt.getDay(); // 0=Sun, 1=Mon ... 6=Sat
      if (dow === 0) continue; // skip Sunday

      for (const slot of slots) {
        if (DAYS_MAP[slot.day] !== dow) continue;
        if (holidayDates.has(dateStr)) continue;

        const ref = db.collection('lessons').doc();
        batch.set(ref, {
          studentId: slot.studentId,
          yearId,
          date: dateStr,
          startTime: SLOTS_TIMES[slot.startSlot],
          duration: slot.slotsCount * 0.5,
          completed: false,
          completedAt: null,
          isExtra: false,
          createdAt: ts()
        });
        count++;
        batchCount++;
        if (batchCount >= 490) {
          await batch.commit();
          batch = db.batch();
          batchCount = 0;
        }
      }
    }
    if (batchCount > 0) await batch.commit();
    return count;
  }

  /* ── Stats for a student ── */
  async function studentStats(studentId, yearId) {
    const [lessons, payments] = await Promise.all([
      getLessons(studentId, yearId),
      getPayments(studentId, yearId)
    ]);
    const completed = lessons.filter(l => l.completed);
    const hoursCompleted = completed.reduce((a, l) => a + (l.duration || 0), 0);
    const totalPlanned   = lessons.reduce((a, l) => a + (l.duration || 0), 0);
    const moneyPaid      = payments.reduce((a, p) => a + (p.amount || 0), 0);
    return { lessons, payments, completed, hoursCompleted, totalPlanned, moneyPaid, totalLessons: lessons.length };
  }

  return {
    getYears, saveYear, getYear,
    getStudents, getAllStudents, getStudent, saveStudent, deleteStudent,
    getSlots, saveSlot, deleteSlot, deleteAllSlots,
    getLessons, getLessonsForDate, getLessonsForRange, saveLesson, deleteLesson,
    completeLesson, uncompleteLesson,
    getPayments, savePayment, deletePayment,
    generateLessons, studentStats
  };
})();
