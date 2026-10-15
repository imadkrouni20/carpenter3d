const DB_NAME = 'carpenter3d';
const STORE = 'models';
const SETTINGS = 'settings';

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(SETTINGS)) db.createObjectStore(SETTINGS, { keyPath: 'k' });
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function saveModel(model) {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(JSON.parse(JSON.stringify(model)));
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}

export async function getModel(id) {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const rq = tx.objectStore(STORE).get(id);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}

export async function listModels() {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readonly');
    const rq = tx.objectStore(STORE).getAll();
    rq.onsuccess = () => res(rq.result || []);
    rq.onerror = () => rej(rq.error);
  });
}

export async function deleteModel(id) {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}

export async function setSetting(k, v) {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(SETTINGS, 'readwrite');
    tx.objectStore(SETTINGS).put({ k, v });
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}

export async function getSetting(k) {
  const db = await open();
  return new Promise((res, rej) => {
    const tx = db.transaction(SETTINGS, 'readonly');
    const rq = tx.objectStore(SETTINGS).get(k);
    rq.onsuccess = () => res(rq.result?.v);
    rq.onerror = () => rej(rq.error);
  });
}
