// Shared helpers used by every page: token storage, API calls, escaping and messages.
const API = {
  get token() { return localStorage.getItem('gc_token'); },
  set token(value) {
    if (value) localStorage.setItem('gc_token', value);
    else localStorage.removeItem('gc_token');
  },
};

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (API.token) headers.Authorization = 'Bearer ' + API.token;
  const res = await fetch(path, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed (' + res.status + ')');
  return data;
}

// Escape text before putting it into innerHTML, to prevent script injection.
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function showMessage(el, text, ok = false) {
  el.textContent = text;
  el.className = 'msg ' + (ok ? 'ok' : 'error');
}

function logout() {
  API.token = null;
  location.href = '/';
}
