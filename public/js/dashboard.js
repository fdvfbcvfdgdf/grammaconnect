// Dashboard logic. Clients post jobs and appoint workers; workers edit their profile and answer requests.
let ME = null;
let completingJobId = null;

(async function init() {
  if (!API.token) return (location.href = '/login.html');
  try {
    ME = (await api('/api/auth/me')).user;
  } catch {
    API.token = null;
    return (location.href = '/login.html');
  }

  document.getElementById('who').textContent = `${ME.name} (${ME.role})`;
  document.getElementById('logout').onclick = logout;

  // Rating modal listeners
  const ratingModal = document.getElementById('rating-modal');
  const modalCancel = document.getElementById('modal-cancel-btn');
  const modalSubmit = document.getElementById('modal-submit-btn');

  if (modalCancel) {
    modalCancel.onclick = () => {
      ratingModal.style.display = 'none';
      completingJobId = null;
    };
  }

  if (modalSubmit) {
    modalSubmit.onclick = async () => {
      if (!completingJobId) return;
      const rating = document.getElementById('modal-rating-val').value;
      const feedback = document.getElementById('modal-feedback-val').value.trim();
      modalSubmit.disabled = true;
      try {
        await api(`/api/jobs/${completingJobId}`, {
          method: 'PATCH',
          body: { action: 'complete', rating, feedback },
        });
        ratingModal.style.display = 'none';
        completingJobId = null;
        loadMyJobs();
        loadWorkers();
        loadAppointments();
      } catch (err) {
        alert(err.message);
      } finally {
        modalSubmit.disabled = false;
      }
    };
  }

  if (ME.role === 'client') clientView();
  else workerView();
})();

const badge = (status) => `<span class="badge ${esc(status)}">${esc(status)}</span>`;

// ---------------- CLIENT ----------------

function clientView() {
  document.getElementById('app').innerHTML = `
    <div class="dashboard-header">
      <div>
        <h1>Welcome, ${esc(ME.name)}</h1>
        <p class="muted">Post local household jobs, discover verified rural workers, and manage appointments.</p>
      </div>
      <span class="user-badge-role">Household Client</span>
    </div>

    <div class="dashboard-grid">
      <!-- Post a Job Section -->
      <section class="card">
        <h2>📝 Post a Community Work Requirement</h2>
        <form id="job-form">
          <label>
            Job Title
            <input name="title" placeholder="e.g. Repair bathroom pipe leakage" required>
          </label>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <label>
              Required Trade / Skill
              <input name="skill" placeholder="e.g. Plumber, Electrician" required>
            </label>
            <label>
              Village / Location
              <input name="location" placeholder="e.g. Gudlavalleru" required>
            </label>
          </div>
          <label>
            Payment Offered (INR)
            <input name="pay" type="number" min="1" placeholder="e.g. 700" required>
          </label>
          <label>
            Job Description
            <textarea name="description" rows="3" placeholder="Describe the problem, materials available, preferred time..."></textarea>
          </label>
          <button type="submit" class="btn" style="margin-top: 4px;">Publish Job</button>
          <p class="msg" id="job-msg"></p>
        </form>
      </section>

      <!-- My Jobs Section -->
      <section class="card">
        <h2>🛠 My Jobs History</h2>
        <div id="my-jobs" class="item-list"></div>
      </section>

      <!-- Find Workers Section -->
      <section class="card full-col">
        <h2>🔍 Find Verified Rural Workers</h2>
        <div class="filter-row">
          <input id="f-skill" placeholder="Filter by skill (e.g. Electrician, Carpenter)">
          <input id="f-location" placeholder="Filter by location (e.g. Gudlavalleru)">
          <button type="button" id="f-go" class="btn sm">Search Directory</button>
        </div>
        <div id="workers" class="grid-3" style="margin-bottom: 0;"></div>
      </section>

      <!-- Appointment Requests Section -->
      <section class="card full-col">
        <h2>📬 Appointment Requests & Status</h2>
        <div id="appts" class="item-list"></div>
      </section>
    </div>`;

  document.getElementById('job-form').onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById('job-msg');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      await api('/api/jobs', { method: 'POST', body: Object.fromEntries(new FormData(e.target)) });
      e.target.reset();
      showMessage(msg, 'Job posted successfully!', true);
      loadMyJobs();
      loadWorkers();
    } catch (err) {
      showMessage(msg, err.message);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  };

  document.getElementById('f-go').onclick = loadWorkers;

  loadMyJobs();
  loadWorkers();
  loadAppointments();
}

async function loadMyJobs() {
  const { jobs } = await api('/api/jobs');
  const el = document.getElementById('my-jobs');
  if (!jobs.length) {
    el.innerHTML = '<p class="muted" style="padding: 16px 0;">You have not posted any jobs yet. Use the form to post your first work requirement.</p>';
    return;
  }

  el.innerHTML = jobs.map((j) => `
    <div class="item-card">
      <div style="flex:1">
        <h4>${esc(j.title)} ${badge(j.status)}</h4>
        <div class="muted" style="font-size: 0.88rem;">
          ${esc(j.skill)} · 📍 ${esc(j.location)} · <strong>₹${esc(j.pay)}</strong>
        </div>
        ${j.workerName ? `
          <div style="font-size: 0.88rem; color: var(--primary); margin-top: 4px;">
            Assigned to: <strong>${esc(j.workerName)}</strong>
            ${j.workerPhone ? ` · <a href="tel:${esc(j.workerPhone)}" style="font-weight:600;">📞 ${esc(j.workerPhone)}</a>` : ''}
          </div>` : ''}
        ${j.description ? `<p style="font-size: 0.86rem; color: #475569; margin-top: 6px;">${esc(j.description)}</p>` : ''}
      </div>
      <div style="display:flex; gap: 8px; flex-wrap: wrap; align-items:center;">
        ${j.status === 'assigned' ? `
          <button type="button" class="btn sm" data-job="complete" data-id="${esc(j.id)}">Mark Completed</button>` : ''}
        ${['open', 'assigned'].includes(j.status) ? `
          <button type="button" class="btn sm danger" data-job="cancel" data-id="${esc(j.id)}">Cancel</button>` : ''}
      </div>
    </div>`).join('');

  el.querySelectorAll('button[data-job]').forEach((btn) => {
    btn.onclick = async () => {
      if (btn.dataset.job === 'complete') {
        completingJobId = btn.dataset.id;
        document.getElementById('rating-modal').style.display = 'flex';
        return;
      }
      if (!confirm('Are you sure you want to cancel this job?')) return;
      try {
        await api(`/api/jobs/${btn.dataset.id}`, { method: 'PATCH', body: { action: btn.dataset.job } });
        loadMyJobs();
        loadWorkers();
        loadAppointments();
      } catch (err) {
        alert(err.message);
      }
    };
  });
}

function getInitials(name) {
  return (name || 'W')
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

async function loadWorkers() {
  const skill = document.getElementById('f-skill').value.trim();
  const location = document.getElementById('f-location').value.trim();
  const query = new URLSearchParams({ skill, location }).toString();
  const [{ workers }, { jobs }] = await Promise.all([api('/api/workers?' + query), api('/api/jobs')]);
  const openJobs = jobs.filter((j) => j.status === 'open');
  const el = document.getElementById('workers');

  if (!workers.length) {
    el.innerHTML = '<p class="muted" style="grid-column: 1 / -1; padding: 20px;">No workers match your search filters.</p>';
    return;
  }

  el.innerHTML = workers.map((w) => `
    <div class="worker-card">
      <div>
        <div class="worker-top">
          <div class="worker-avatar">${esc(getInitials(w.name))}</div>
          <div class="worker-details">
            <h3>${esc(w.name)}</h3>
            <span class="worker-skill-badge">${esc(w.skill)}</span>
            <div class="worker-meta">
              <span>📍 ${esc(w.location)}</span>
              <span class="worker-rating">★ ${esc(w.rating || 4.8)}</span>
            </div>
          </div>
        </div>
        <p class="worker-bio">${esc(w.bio || 'Local skilled artisan.')}</p>
        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 8px;">
          <span>⏱ ${esc(w.experience)} yrs experience</span> · 
          <span>₹${esc(w.rate)}/day</span> · 
          ${w.available ? '<span style="color:var(--success); font-weight:600;">Available</span>' : '<span style="color:var(--text-muted);">Busy</span>'}
        </div>
      </div>

      <div class="worker-footer">
        <div>
          ${w.phone ? `<a href="tel:${esc(w.phone)}" class="btn sm outline" style="margin-right: 6px;">📞 Call</a>` : ''}
        </div>
        <div>
          ${openJobs.length ? `
            <div style="display:flex; gap: 6px; align-items: center;">
              <select data-job-for="${esc(w.id)}" style="max-width: 140px; font-size: 0.82rem; padding: 6px 8px;">
                ${openJobs.map((j) => `<option value="${esc(j.id)}">${esc(j.title)}</option>`).join('')}
              </select>
              <button type="button" class="btn sm" data-appoint="${esc(w.id)}" ${w.available ? '' : 'disabled'}>Appoint</button>
            </div>`
          : '<span class="muted" style="font-size: 0.82rem;">Post an open job to appoint</span>'}
        </div>
      </div>
    </div>`).join('');

  el.querySelectorAll('button[data-appoint]').forEach((btn) => {
    btn.onclick = async () => {
      const select = el.querySelector(`select[data-job-for="${btn.dataset.appoint}"]`);
      if (!select) return;
      const jobId = select.value;
      btn.disabled = true;
      try {
        await api('/api/appointments', { method: 'POST', body: { jobId, workerId: btn.dataset.appoint } });
        alert('Appointment request sent to the worker successfully!');
        loadAppointments();
      } catch (err) {
        alert(err.message);
      } finally {
        btn.disabled = false;
      }
    };
  });
}

// ---------------- WORKER ----------------

function workerView() {
  document.getElementById('app').innerHTML = `
    <div class="dashboard-header">
      <div>
        <h1>Welcome, ${esc(ME.name)}</h1>
        <p class="muted">Manage your trade profile, receive appointment requests, and view open village jobs.</p>
      </div>
      <span class="user-badge-role">Rural Worker / Artisan</span>
    </div>

    <div class="dashboard-grid">
      <!-- Profile Section -->
      <section class="card">
        <h2>🛠 My Artisan Profile</h2>
        <form id="profile-form">
          <label>
            Primary Skill / Trade
            <input name="skill" placeholder="e.g. Electrician, Carpenter" value="${esc(ME.skill || '')}" required>
          </label>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <label>
              Village / Mandal Area
              <input name="location" placeholder="e.g. Gudlavalleru" value="${esc(ME.location || '')}" required>
            </label>
            <label>
              Contact Phone
              <input name="phone" placeholder="e.g. +91 98480 12345" value="${esc(ME.phone || '')}">
            </label>
          </div>
          <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <label>
              Daily Wage Rate (INR)
              <input name="rate" type="number" min="0" placeholder="e.g. 750" value="${esc(ME.rate || '')}">
            </label>
            <label>
              Years of Experience
              <input name="experience" type="number" min="0" placeholder="e.g. 8" value="${esc(ME.experience || '')}">
            </label>
          </div>
          <label>
            Introduction / Experience Bio
            <textarea name="bio" rows="3" placeholder="Brief details about your work experience...">${esc(ME.bio || '')}</textarea>
          </label>
          <label style="flex-direction:row; align-items:center; gap: 8px; font-weight: normal; margin-top: 4px;">
            <input type="checkbox" name="available" ${ME.available !== false ? 'checked' : ''} style="width:auto"> 
            <strong>Currently Available for New Work</strong>
          </label>
          <button type="submit" class="btn" style="margin-top: 6px;">Save Profile Changes</button>
          <p class="msg" id="profile-msg"></p>
        </form>
      </section>

      <!-- Appointment Requests Section -->
      <section class="card">
        <h2>📬 Appointment Requests Received</h2>
        <div id="appts" class="item-list"></div>
      </section>

      <!-- Open Jobs Section -->
      <section class="card full-col">
        <h2>📋 Open Community Jobs in the Area</h2>
        <div id="open-jobs" class="item-list"></div>
      </section>
    </div>`;

  document.getElementById('profile-form').onsubmit = async (e) => {
    e.preventDefault();
    const msg = document.getElementById('profile-msg');
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    const body = {
      ...Object.fromEntries(new FormData(e.target)),
      available: e.target.elements.available.checked,
    };
    try {
      const { user } = await api('/api/workers/me', { method: 'PUT', body });
      ME = user;
      showMessage(msg, 'Profile updated successfully!', true);
    } catch (err) {
      showMessage(msg, err.message);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  };

  loadAppointments();
  loadOpenJobs();
}

async function loadOpenJobs() {
  const { jobs } = await api('/api/jobs');
  const open = jobs.filter((j) => j.status === 'open');
  const el = document.getElementById('open-jobs');

  if (!open.length) {
    el.innerHTML = '<p class="muted" style="padding: 16px 0;">No open community jobs right now. Check back soon!</p>';
    return;
  }

  el.innerHTML = open.map((j) => `
    <div class="item-card">
      <div>
        <h4>${esc(j.title)}</h4>
        <div class="muted" style="font-size: 0.88rem;">
          ${esc(j.skill)} · 📍 ${esc(j.location)} · <strong>₹${esc(j.pay)} offered</strong>
        </div>
        <p style="font-size: 0.9rem; color: #475569; margin-top: 6px;">${esc(j.description || 'No additional description.')}</p>
      </div>
      <div>
        <span class="badge open">Open Requirement</span>
      </div>
    </div>`).join('');
}

// ---------------- SHARED APPOINTMENTS ----------------

async function loadAppointments() {
  const { appointments } = await api('/api/appointments');
  const el = document.getElementById('appts');
  if (!appointments.length) {
    el.innerHTML = '<p class="muted" style="padding: 16px 0;">No appointment requests recorded yet.</p>';
    return;
  }

  el.innerHTML = appointments.map((a) => `
    <div class="item-card">
      <div style="flex:1">
        <h4>${esc(a.jobTitle)} ${badge(a.status)}</h4>
        <div class="muted" style="font-size: 0.88rem;">
          ${ME.role === 'client' 
            ? `Worker: <strong>${esc(a.workerName)}</strong> (${esc(a.workerSkill)}) ${a.workerPhone ? `· <a href="tel:${esc(a.workerPhone)}">📞 ${esc(a.workerPhone)}</a>` : ''}`
            : `Client: <strong>${esc(a.clientName)}</strong> ${a.clientPhone ? `· <a href="tel:${esc(a.clientPhone)}">📞 ${esc(a.clientPhone)}</a>` : ''}`}
          · Requested on: ${esc(new Date(a.createdAt).toLocaleDateString())}
        </div>
      </div>
      ${ME.role === 'worker' && a.status === 'pending' ? `
        <div style="display:flex; gap: 8px;">
          <button type="button" class="btn sm" data-resp="accept" data-id="${esc(a.id)}">Accept Job</button>
          <button type="button" class="btn sm danger" data-resp="reject" data-id="${esc(a.id)}">Decline</button>
        </div>` : ''}
    </div>`).join('');

  el.querySelectorAll('button[data-resp]').forEach((btn) => {
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        await api(`/api/appointments/${btn.dataset.id}`, { method: 'PATCH', body: { action: btn.dataset.resp } });
        loadAppointments();
        if (ME.role === 'worker') loadOpenJobs();
      } catch (err) {
        alert(err.message);
      } finally {
        btn.disabled = false;
      }
    };
  });
}
