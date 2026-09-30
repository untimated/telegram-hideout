// The client's backup copy of its wallet (coins, drunk, fuel, day). The server is the source of
// truth; after a server restart it accepts this copy once (see game.js restore). Inside Telegram
// the copy lives in Telegram CloudStorage (per user, survives reinstalls and follows the account
// across devices); elsewhere, and as a fallback, in localStorage.
const CLOUD_KEY = 'hideout_wallet';
const SAVE_DELAY_MS = 2000;

export function createWalletStore() {
  const telegram = window.Telegram?.WebApp;
  const cloud = telegram?.initData && telegram.isVersionAtLeast?.('6.9') ? telegram.CloudStorage : null;
  let pending;
  let timer;

  const localKey = playerID => `hideout.wallet.${playerID}`;
  const parse = text => {
    try {
      const value = JSON.parse(text || 'null');
      return value && typeof value === 'object' ? value : null;
    } catch {
      return null;
    }
  };
  const readLocal = playerID => {
    try { return parse(localStorage.getItem(localKey(playerID))); } catch { return null; }
  };

  return {
    // Resolves to the saved wallet or null; never rejects, and gives up on Telegram after 3 s.
    load(playerID) {
      if (!cloud) return Promise.resolve(readLocal(playerID));
      return new Promise(resolve => {
        const fallback = setTimeout(() => resolve(readLocal(playerID)), 3000);
        try {
          cloud.getItem(CLOUD_KEY, (error, value) => {
            clearTimeout(fallback);
            resolve((!error && parse(value)) || readLocal(playerID));
          });
        } catch {
          clearTimeout(fallback);
          resolve(readLocal(playerID));
        }
      });
    },
    // Saves immediately to localStorage and, a couple of seconds after the last change, to Telegram.
    save(playerID, wallet) {
      const text = JSON.stringify(wallet);
      try { localStorage.setItem(localKey(playerID), text); } catch { /* Storage unavailable. */ }
      if (!cloud) return;
      pending = text;
      clearTimeout(timer);
      timer = setTimeout(() => {
        try { cloud.setItem(CLOUD_KEY, pending, () => {}); } catch { /* Best effort. */ }
      }, SAVE_DELAY_MS);
    },
  };
}
