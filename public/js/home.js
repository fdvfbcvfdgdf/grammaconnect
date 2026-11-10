// Logic for landing page: worker search, category filtering, stats display.
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('workers-grid');
  const skillInput = document.getElementById('search-skill');
  const locInput = document.getElementById('search-location');
  const searchBtn = document.getElementById('search-btn');
  const resetBtn = document.getElementById('reset-btn');
  const categoryBar = document.getElementById('category-bar');

  let currentCategory = '';

  async function loadStats() {
    try {
      const stats = await api('/api/stats');
      if (stats.totalWorkers) document.getElementById('stat-workers').textContent = stats.totalWorkers + '+';
      if (stats.totalJobs) document.getElementById('stat-jobs').textContent = stats.totalJobs + '+';
      if (stats.locationsCovered) document.getElementById('stat-locations').textContent = stats.locationsCovered + '+';
    } catch {
      // Fallback already in HTML
    }
  }

  async function loadWorkers() {
    grid.innerHTML = '<p class="muted" style="text-align:center; grid-column: 1 / -1; padding: 20px;">Searching local workers...</p>';

    const skill = (currentCategory || skillInput.value || '').trim();
    const location = (locInput.value || '').trim();
    const query = new URLSearchParams();
    if (skill) query.set('skill', skill);
    if (location) query.set('location', location);

    try {
      const { workers } = await api('/api/workers?' + query.toString());
      renderWorkers(workers || []);
    } catch (err) {
      grid.innerHTML = `<p class="muted" style="text-align:center; grid-column: 1 / -1; color: var(--danger); padding: 20px;">Could not load workers: ${esc(err.message)}</p>`;
    }
  }

  function getInitials(name) {
    return (name || 'W')
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  function renderWorkers(workers) {
    if (!workers.length) {
      grid.innerHTML = `
        <div style="text-align:center; grid-column: 1 / -1; padding: 40px 20px;">
          <h3 style="color: var(--text-muted); margin-bottom: 8px;">No matching workers found</h3>
          <p class="muted">Try adjusting your skill filter or searching for another village/mandal area.</p>
        </div>`;
      return;
    }

    grid.innerHTML = workers.map((w) => `
      <div class="worker-card">
        <div>
          <div class="worker-top">
            <div class="worker-avatar">${esc(getInitials(w.name))}</div>
            <div class="worker-details">
              <h3>${esc(w.name)}</h3>
              <span class="worker-skill-badge">${esc(w.skill)}</span>
              <div class="worker-meta">
                <span>📍 ${esc(w.location)}</span>
                <span class="worker-rating">★ ${esc(w.rating || 4.8)} <span style="color:var(--text-muted); font-size:0.75rem;">(${esc(w.reviewCount || 10)})</span></span>
              </div>
            </div>
          </div>
          <p class="worker-bio">${esc(w.bio || 'Verified rural artisan ready to take up community service assignments.')}</p>
          <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 8px;">
            <span>⏱ ${esc(w.experience || 1)} yrs exp</span> · 
            <span>${w.available ? '<span style="color: var(--success); font-weight: 600;">● Available Now</span>' : '<span style="color: var(--text-muted);">○ Currently Busy</span>'}</span>
          </div>
        </div>

        <div class="worker-footer">
          <div class="worker-rate">
            ₹${esc(w.rate)} <span>/ day</span>
          </div>
          <div class="worker-actions">
            ${w.phone ? `<a href="tel:${esc(w.phone)}" class="btn sm outline" title="Call directly">📞 Call</a>` : ''}
            <a href="/dashboard.html" class="btn sm" ${w.available ? '' : 'style="opacity:0.6; pointer-events:none;"'}>Appoint</a>
          </div>
        </div>
      </div>
    `).join('');
  }

  // Category pills event
  if (categoryBar) {
    categoryBar.addEventListener('click', (e) => {
      const pill = e.target.closest('.cat-pill');
      if (!pill) return;
      categoryBar.querySelectorAll('.cat-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.dataset.skill || '';
      skillInput.value = currentCategory;
      loadWorkers();
    });
  }

  if (searchBtn) searchBtn.onclick = () => {
    currentCategory = '';
    categoryBar.querySelectorAll('.cat-pill').forEach((p) => p.classList.remove('active'));
    loadWorkers();
  };

  if (resetBtn) resetBtn.onclick = () => {
    skillInput.value = '';
    locInput.value = '';
    currentCategory = '';
    categoryBar.querySelectorAll('.cat-pill').forEach((p) => p.classList.remove('active'));
    categoryBar.querySelector('.cat-pill')?.classList.add('active');
    loadWorkers();
  };

  loadStats();
  loadWorkers();
});
