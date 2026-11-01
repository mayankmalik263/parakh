// A visitor's own Groq API key. Kept only in this browser and sent as X-Groq-Key so their
// simulations use their free Groq quota instead of the shared one. The server never stores it.
const STORAGE_KEY = 'mass_groq_key';
const CHANGE_EVENT = 'mass-groq-key-change';

export function getGroqKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setGroqKey(key: string) {
  try {
    if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode / blocked storage: the shared quota still works.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** For useSyncExternalStore: fires on changes in this tab and in other tabs. */
export function subscribeGroqKey(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}
