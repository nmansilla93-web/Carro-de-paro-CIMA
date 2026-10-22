/* ===== Firebase adapter ===== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, collection, doc, addDoc, setDoc, onSnapshot, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDMD738RH9XQL3nk72gb6DzWkoCK6a7rqA",
  authDomain: "carro-de-paro-2edef.firebaseapp.com",
  projectId: "carro-de-paro-2edef",
  storageBucket: "carro-de-paro-2edef.firebasestorage.app",
  messagingSenderId: "162134137018",
  appId: "1:162134137018:web:98506a042eec159c32ca83",
  measurementId: "G-GHD9D3VCQH"
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);
const auth = getAuth(app);

// Sign in anonymously so rules that require auth allow access.
// Reads and writes wait for it: a listener attached before sign-in is rejected and never retries.
const ready = signInAnonymously(auth).catch(err => console.warn("Anonymous sign-in failed", err));

function docSnap(id, data) {
  return { id, exists: data !== undefined, data: () => structuredClone(data) };
}

function makeQuery(colName, order = null, max = null) {
  return {
    orderBy(field, dir = "asc") { return makeQuery(colName, { field, dir }, max); },
    limit(n) { return makeQuery(colName, order, n); },
    async add(data) {
      await ready;
      const ref = await addDoc(collection(firestore, colName), data);
      return { id: ref.id };
    },
    onSnapshot(cb) {
      let q = collection(firestore, colName);
      if (order) q = query(q, orderBy(order.field, order.dir || "asc"));
      if (max) q = query(q, limit(max));
      ready.then(() => onSnapshot(q, snap => {
        const docs = snap.docs.map(d => docSnap(d.id, d.data()));
        cb({ docs });
      }, err => console.warn("Firestore", colName, err)));
    }
  };
}

function makeDoc(path) {
  const [col, id] = path.split("/");
  return {
    async set(data) { await ready; await setDoc(doc(firestore, col, id), data); },
    onSnapshot(cb) {
      ready.then(() => onSnapshot(doc(firestore, col, id), snap => {
        cb(docSnap(id, snap.exists() ? snap.data() : undefined));
      }, err => console.warn("Firestore", path, err)));
    }
  };
}

window.firebaseBackend = {
  db: {
    collection: (c) => makeQuery(c),
    doc: makeDoc
  },
  user: { id: async () => "firebase", can: async () => true, canEdit: async () => true },
  downloads: window.localBackend ? window.localBackend.downloads : null
};
