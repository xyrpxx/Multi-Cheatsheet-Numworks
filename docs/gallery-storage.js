(function (root) {
  'use strict';
  function open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MultiCheatsheet', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('sessions');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Close other editor tabs to update storage'));
    });
  }
  async function transaction(mode, value) {
    const db = await open();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('sessions', mode), store = tx.objectStore('sessions');
        const request = mode === 'readonly' ? store.get('gallery') : store.put(value, 'gallery');
        tx.oncomplete = () => resolve(request.result);
        tx.onerror = () => reject(tx.error || request.error);
        tx.onabort = () => reject(tx.error || new Error('Saving aborted'));
      });
    } finally { db.close(); }
  }
  root.GalleryStorage = {load: () => transaction('readonly'), save: value => transaction('readwrite', value)};
})(globalThis);
