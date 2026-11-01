// A visitor's own BharatCode API key. Kept only in this browser and sent as X-BharatCode-Key so
// their plans use their own BharatCode quota instead of the shared one. The server never stores it.
const STORAGE_KEY = 'parakh_bharatcode_key';
const CHANGE_EVENT = 'parakh-bharatcode-key-change';

export function getBharatCodeKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setBharatCodeKey(key: string) {
  try {
    if (key.trim()) localStorage.setItem(STORAGE_KEY, key.trim());
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Private mode / blocked storage: the shared quota still works.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** For useSyncExternalStore: fires on changes in this tab and in other tabs. */
export function subscribeBharatCodeKey(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}
