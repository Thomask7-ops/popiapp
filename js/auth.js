window.Auth = (() => {
  let currentUser = null;
  let currentRole = null;
  let authResolved = false;
  const listeners = [];

  function onChange(fn) {
    listeners.push(fn);
    if (authResolved) fn(currentUser); // fire immediately if auth already resolved
  }

  auth.onAuthStateChanged(async user => {
    if (user) {
      const snap = await db.collection('users').doc(user.uid).get();
      if (snap.exists) {
        currentUser = { uid: user.uid, ...snap.data() };
        currentRole = currentUser.role;
      } else {
        currentUser = { uid: user.uid, name: user.email, role: 'teacher' };
        currentRole = 'teacher';
      }
    } else {
      currentUser = null;
      currentRole = null;
    }
    authResolved = true;
    listeners.forEach(fn => fn(currentUser));
  });

  async function login(email, password, remember) {
    const persistence = remember
      ? firebase.auth.Auth.Persistence.LOCAL
      : firebase.auth.Auth.Persistence.SESSION;
    await auth.setPersistence(persistence);
    return auth.signInWithEmailAndPassword(email, password);
  }

  async function logout() {
    await auth.signOut();
  }

  async function createUser(name, email, password, role) {
    // Create via secondary app to avoid signing out current user
    const secondary = firebase.initializeApp(firebase.app().options, 'secondary');
    const secAuth = secondary.auth();
    const cred = await secAuth.createUserWithEmailAndPassword(email, password);
    await db.collection('users').doc(cred.user.uid).set({ name, email, role, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    await secAuth.signOut();
    secondary.delete();
  }

  async function updatePassword(newPassword) {
    return auth.currentUser.updatePassword(newPassword);
  }

  async function isFirstRun() {
    const snap = await db.collection('users').limit(1).get();
    return snap.empty;
  }

  async function setupAdmin(name, email, password) {
    await auth.createUserWithEmailAndPassword(email, password);
    const user = auth.currentUser;
    await db.collection('users').doc(user.uid).set({
      name, email, role: 'admin',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  return {
    get user() { return currentUser; },
    get role() { return currentRole; },
    get isAdmin() { return currentRole === 'admin'; },
    onChange, login, logout, createUser, updatePassword, isFirstRun, setupAdmin
  };
})();
