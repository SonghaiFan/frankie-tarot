// Sandboxed MCP views may not have persistent browser storage.
export const preferences = {
  getItem(key: string): string | null {
    try { return window.localStorage.getItem(key); } catch { return null; }
  },
  setItem(key: string, value: string) {
    try { window.localStorage.setItem(key, value); } catch { /* Session defaults still work. */ }
  },
};
