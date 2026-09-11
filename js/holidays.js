/* Greek public holidays + school breaks + namedays */
window.Holidays = (() => {

  /* ── Orthodox Easter (Julian→Gregorian) ── */
  function orthodoxEaster(year) {
    const a = year % 4, b = year % 7, c = year % 19;
    const d = (19 * c + 15) % 30;
    const e = (2 * a + 4 * b - d + 34) % 7;
    const month = Math.floor((d + e + 114) / 31);
    const day   = (d + e + 114) % 31 + 1;
    const dt = new Date(year, month - 1, day);
    dt.setDate(dt.getDate() + 13); // Julian → Gregorian
    return dt;
  }

  function addDays(dt, n) {
    const d = new Date(dt); d.setDate(d.getDate() + n); return d;
  }
  function fmt(dt) {
    return dt.toISOString().slice(0, 10);
  }

  /* ── Public holidays (fixed) ── */
  const FIXED = [
    { md: '01-01', name: 'Πρωτοχρονιά',       type: 'public' },
    { md: '01-06', name: 'Θεοφάνεια',          type: 'public' },
    { md: '03-25', name: 'Εθνική Εορτή',        type: 'public' },
    { md: '05-01', name: 'Πρωτομαγιά',         type: 'public' },
    { md: '08-15', name: 'Κοίμηση Θεοτόκου',   type: 'public' },
    { md: '10-28', name: 'Εθνική Εορτή (ΟΧΙ)', type: 'public' },
    { md: '12-25', name: 'Χριστούγεννα',        type: 'public' },
    { md: '12-26', name: 'Σύναξη Θεοτόκου',    type: 'public' },
  ];

  /* ── Generate holidays for a given year ── */
  function forYear(year) {
    const list = [];

    // Fixed
    for (const h of FIXED) {
      list.push({ date: `${year}-${h.md}`, name: h.name, type: h.type, allowLesson: false });
    }

    // Moveable (Easter-based)
    const easter = orthodoxEaster(year);
    const moveable = [
      { offset: -48, name: 'Καθαρά Δευτέρα' },
      { offset:  -2, name: 'Μεγάλη Παρασκευή' },
      { offset:   0, name: 'Κυριακή του Πάσχα' },
      { offset:   1, name: 'Δευτέρα Πάσχα' },
      { offset:  39, name: 'Ανάληψη' },
      { offset:  49, name: 'Αγίου Πνεύματος' },
    ];
    for (const m of moveable) {
      list.push({ date: fmt(addDays(easter, m.offset)), name: m.name, type: 'public', allowLesson: false });
    }

    // School Christmas break (Dec 23 – Jan 7)
    const christmasStart = new Date(year, 11, 23); // Dec 23
    for (let d = 0; d < 16; d++) {
      const dt = addDays(christmasStart, d);
      list.push({ date: fmt(dt), name: 'Χριστουγεννιάτικες Διακοπές', type: 'school', allowLesson: false });
    }

    // School Easter break: Holy Week (Mon before Easter) + Easter week
    const holyMonday = addDays(easter, -6);
    for (let d = -6; d <= 7; d++) {
      const dt = addDays(easter, d);
      list.push({ date: fmt(dt), name: d < 0 ? 'Μεγάλη Εβδομάδα' : 'Πασχαλινές Διακοπές', type: 'school', allowLesson: false });
    }

    // Carnival (Αποκριές) — 3 days before Καθαρά Δευτέρα
    const katharaD = addDays(easter, -48);
    for (let d = -3; d < 0; d++) {
      list.push({ date: fmt(addDays(katharaD, d)), name: 'Αποκριές', type: 'school', allowLesson: false });
    }

    return list;
  }

  /* ── Greek nameday calendar ── */
  const NAMEDAYS = {
    '01-01': ['Βασίλης', 'Βασιλική', 'Βασιλεία'],
    '01-06': ['Θεοφάνης', 'Φανή', 'Φώτης', 'Φωτεινή'],
    '01-07': ['Ιωάννης', 'Γιάννης', 'Ζωή'],
    '01-17': ['Αντώνης', 'Αντωνία'],
    '01-18': ['Αθανάσιος', 'Κυρίλλος'],
    '01-30': ['Βασίλειος', 'Γρηγόριος', 'Ιωάννης'],
    '02-02': ['Υπαπαντή'],
    '02-10': ['Χαράλαμπος', 'Χαρά'],
    '03-17': ['Αλέξιος'],
    '03-19': ['Χρύσανθος', 'Δαρεία'],
    '03-25': ['Ευαγγελισμός', 'Ευαγγελία', 'Βαγγέλης'],
    '04-23': ['Γεώργιος', 'Γιώργης', 'Γεωργία'],
    '04-30': ['Ιακώβης'],
    '05-05': ['Ειρήνη'],
    '05-21': ['Κωνσταντίνος', 'Κώστας', 'Ελένη'],
    '06-11': ['Βαρθολομαίος'],
    '06-24': ['Ιωάννης', 'Γιάννης'],
    '06-29': ['Πέτρος', 'Παύλος'],
    '06-30': ['Σύναξη Αγίων Αποστόλων'],
    '07-17': ['Μαρίνα', 'Μαρία'],
    '07-20': ['Ηλίας', 'Ηλιάνα'],
    '07-22': ['Μαρία Μαγδαληνή'],
    '07-26': ['Παρασκευή'],
    '07-27': ['Παντελεήμων'],
    '08-06': ['Χριστόδουλος', 'Σωτήρης'],
    '08-15': ['Παναγία', 'Μαρία', 'Δέσποινα'],
    '08-23': ['Απόδοση Κοιμήσεως'],
    '08-27': ['Φανουρία', 'Φανούριος'],
    '08-29': ['Ιωάννης'],
    '09-08': ['Παναγία', 'Μαριάννα'],
    '09-14': ['Νικόλαος', 'Αναστάσιος'],
    '09-17': ['Σοφία', 'Πίστη', 'Ελπίδα', 'Αγάπη'],
    '10-18': ['Λουκάς'],
    '10-26': ['Δημήτριος', 'Δημήτρης', 'Δήμητρα'],
    '11-01': ['Κοσμάς', 'Δαμιανός'],
    '11-08': ['Αρχάγγελος Μιχαήλ', 'Μιχάλης', 'Γαβριήλ'],
    '11-13': ['Ιωάννης Χρυσόστομος', 'Χρύσα'],
    '11-14': ['Φίλιππος'],
    '11-16': ['Ματθαίος'],
    '11-21': ['Παναγία'],
    '11-25': ['Αικατερίνη', 'Κατερίνα', 'Μερκούριος'],
    '11-30': ['Ανδρέας'],
    '12-04': ['Βαρβάρα'],
    '12-05': ['Σάββας'],
    '12-06': ['Νικόλαος', 'Νίκη', 'Νικολέτα'],
    '12-09': ['Αννα'],
    '12-12': ['Σπυρίδων', 'Σπύρος'],
    '12-17': ['Δανιήλ'],
    '12-27': ['Στέφανος'],
  };

  function nameday(dateStr) {
    const md = dateStr.slice(5);
    return NAMEDAYS[md] || [];
  }

  return { forYear, nameday, orthodoxEaster, fmt, addDays };
})();
