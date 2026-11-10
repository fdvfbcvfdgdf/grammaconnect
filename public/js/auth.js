// Handles the login and registration forms (both pages share this file).
const form = document.querySelector('form');
const msg = document.getElementById('msg');
const isLogin = form.id === 'login-form';

// Pre-select the role if the visitor came from the landing page buttons.
const roleSelect = document.getElementById('role');
const params = new URLSearchParams(location.search);
if (roleSelect && params.get('role')) roleSelect.value = params.get('role');

if (roleSelect) {
  const workerFields = document.getElementById('worker-fields');
  const toggle = () => { workerFields.hidden = roleSelect.value !== 'worker'; };
  roleSelect.addEventListener('change', toggle);
  toggle();
}

// Quick Demo Login buttons for evaluators & viva testing
const demoClientBtn = document.getElementById('demo-client-btn');
const demoWorkerBtn = document.getElementById('demo-worker-btn');

if (demoClientBtn) {
  demoClientBtn.onclick = () => {
    document.getElementById('email').value = 'client@grammaconnect.org';
    document.getElementById('password').value = 'password123';
    form.requestSubmit();
  };
}

if (demoWorkerBtn) {
  demoWorkerBtn.onclick = () => {
    document.getElementById('email').value = 'suresh@grammaconnect.org';
    document.getElementById('password').value = 'password123';
    form.requestSubmit();
  };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const submitBtn = form.querySelector('button[type="submit"]');
  if (submitBtn) submitBtn.disabled = true;
  showMessage(msg, 'Processing...', true);

  const body = Object.fromEntries(new FormData(form).entries());
  try {
    const out = await api(isLogin ? '/api/auth/login' : '/api/auth/register', { method: 'POST', body });
    API.token = out.token;
    showMessage(msg, 'Success! Redirecting...', true);
    setTimeout(() => {
      location.href = '/dashboard.html';
    }, 400);
  } catch (err) {
    showMessage(msg, err.message);
    if (submitBtn) submitBtn.disabled = false;
  }
});
