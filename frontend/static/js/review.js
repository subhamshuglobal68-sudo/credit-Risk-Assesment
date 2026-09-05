// static/js/review.js - Anomaly & Manual Review Intelligence Center

const RC = {
  items: [],
  currentDetail: null,
  statusColor: (s) => ({
    OPEN: 'status-open',
    IN_REVIEW: 'status-in_review',
    VERIFICATION_REQUIRED: 'status-verification_required',
    ESCALATED: 'status-escalated',
    RESOLVED: 'status-resolved',
  }[s] || 'status-open'),
};

function formatNumber(n) {
  return Number(n || 0).toLocaleString('en-IN');
}
function formatPercent(p) {
  return (Number(p) * 100).toFixed(1) + '%';
}
function escapeHtml(s) {
  return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function riskBadge(cat) {
  const map = { Low: 'status-good', Medium: 'status-warn', High: 'status-bad' };
  return `<span class="badge ${map[cat] || 'status-neutral'}">${cat || '—'}</span>`;
}
function anomalyCell(r) {
  if (!r.is_anomalous) return `<span class="status-neutral">Normal</span>`;
  return `<span class="status-warn">Anomalous</span>`;
}

function buildQuery() {
  const params = new URLSearchParams();
  const status = document.getElementById('rc-status').value;
  const priority = document.getElementById('rc-priority').value;
  const risk = document.getElementById('rc-risk').value;
  const anomalous = document.getElementById('rc-anomalous').value;
  const search = document.getElementById('rc-search').value.trim();
  if (status) params.set('status', status);
  if (priority) params.set('priority', priority);
  if (risk) params.set('risk_category', risk);
  if (anomalous) params.set('anomalous', anomalous);
  if (search) params.set('search', search);
  params.set('per_page', '200');
  return params.toString();
}

async function loadQueue() {
  const tbody = document.getElementById('rc-queue');
  const empty = document.getElementById('rc-empty');
  tbody.innerHTML = '<tr><td colspan="8" class="rc-empty">Loading…</td></tr>';
  empty.classList.add('hidden');

  try {
    const res = await fetch('/api/reviews?' + buildQuery());
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to load');

    RC.items = data.items || [];
    if (!RC.items.length) { tbody.innerHTML = ''; empty.classList.remove('hidden'); return; }

    tbody.innerHTML = RC.items.map(r => `
      <tr class="rc-row" data-id="${r.id}">
        <td class="mono">${escapeHtml(r.request_id ? r.request_id.slice(0, 8) : '—')}</td>
        <td>${riskBadge(r.risk_category)}</td>
        <td class="mono">${formatPercent(r.probability)}</td>
        <td>${anomalyCell(r)}</td>
        <td><span class="priority-pill priority-${escapeHtml(r.review_priority)}">${escapeHtml(r.review_priority)}</span></td>
        <td><span class="${RC.statusColor(r.status)}">${escapeHtml(humanStatus(r.status))}</span></td>
        <td class="muted">${r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}</td>
        <td><button class="btn btn-sm" data-open="${r.id}">Investigate</button></td>
      </tr>
    `).join('');

    tbody.querySelectorAll('[data-open]').forEach(btn => {
      btn.addEventListener('click', () => openDetail(btn.dataset.open));
    });
    renderMatrix();
    loadStats();
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="8" class="rc-empty">${escapeHtml(err.message)}</td></tr>`;
  }
}

function humanStatus(s) {
  return (s || '').replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

async function loadStats() {
  try {
    const res = await fetch('/api/reviews/stats');
    const s = await res.json();
    setKpi('kpi-total', s.total);
    setKpi('kpi-open', s.open);
    setKpi('kpi-inreview', s.in_review);
    setKpi('kpi-high', s.high_priority);
    setKpi('kpi-anom', s.anomalous_pending);
  } catch (e) { /* ignore */ }
}

function setKpi(id, v) {
  document.getElementById(id).textContent = v === null || v === undefined ? '—' : v;
}

function openDetail(id) {
  fetch('/api/reviews/' + id)
    .then(res => res.json())
    .then(d => { RC.currentDetail = d; renderDetail(d); })
    .catch(err => console.error(err));
}

function renderDetail(r) {
  RC.currentDetail = r;
  document.getElementById('rc-detail-id').textContent = '#' + (r.id || '');
  const body = document.getElementById('rc-detail-body');
  body.innerHTML = `
    <div class="rc-summary-grid">
      <div class="rc-summary-item"><div class="rc-label">Risk</div><div class="rc-value">${riskBadge(r.risk_category)}</div></div>
      <div class="rc-summary-item"><div class="rc-label">Priority</div><div class="rc-value">${escapeHtml(r.review_priority)}</div></div>
      <div class="rc-summary-item"><div class="rc-label">Prob. of Default</div><div class="rc-value">${formatPercent(r.probability)}</div></div>
      <div class="rc-summary-item"><div class="rc-label">Anomaly Score</div><div class="rc-value">${r.anomaly_score ? (r.anomaly_score * 100).toFixed(1) : '—'}%</div></div>
    </div>

    <div class="rc-reasons">
      ${(r.review_reasons || []).map(x => `<li><span class="material-symbols-outlined">flag</span>${escapeHtml(x)}</li>`).join('')}
    </div>

    <h4 class="rc-notes-head">Review Actions</h4>
    <div class="rc-actions">
      ${['OPEN', 'IN_REVIEW', 'VERIFICATION_REQUIRED', 'ESCALATED', 'RESOLVED'].map(s =>
        `<button class="btn btn-sm${r.status === s ? ' btn-selected' : ''}" data-status="${s}">${escapeHtml(humanStatus(s))}</button>`
      ).join('')}
    </div>
    <div class="rc-actions" style="margin-top: 10px;">
      <button class="btn btn-sm btn-primary" id="rc-btn-report" type="button" style="width: 100%; display: flex; justify-content: center; align-items: center; gap: 8px;">
        <span class="material-symbols-outlined" style="font-size: 16px;">picture_as_pdf</span>
        <span>Generate Assessment Report</span>
      </button>
    </div>

    <h4 class="rc-notes-head">Notes</h4>
    <div id="rc-notes-list">
      ${(r.reviewer_notes || []).slice().reverse().map(n =>
        `<div class="rc-note">${escapeHtml(n.text)}<time>${new Date(n.timestamp).toLocaleString()} — ${escapeHtml(n.author || 'reviewer')}</time></div>`
      ).join('') || '<p class="muted small">No notes yet.</p>'}
    </div>
    <div class="rc-add-note">
      <textarea id="rc-note-text" placeholder="Add a review note…" aria-label="Review note"></textarea>
      <button class="btn btn-primary" id="rc-add-note-btn">Add</button>
    </div>

    <h4 class="rc-notes-head">Timeline</h4>
    <div class="rc-timeline" id="rc-timeline"></div>

    <h4 class="rc-notes-head">Applicant Snapshot</h4>
    <div class="rc-summary-grid">
      <div class="rc-summary-item"><div class="rc-label">Age</div><div class="rc-value">${r.age !== null ? r.age : '—'}</div></div>
      <div class="rc-summary-item"><div class="rc-label">Job</div><div class="rc-value">${escapeHtml(r.job || '—')}</div></div>
      <div class="rc-summary-item"><div class="rc-label">Credit Amount</div><div class="rc-value">${formatNumber(r.credit_amount)}</div></div>
      <div class="rc-summary-item"><div class="rc-label">Duration (mo)</div><div class="rc-value">${r.duration !== null ? r.duration : '—'}</div></div>
      <div class="rc-summary-item"><div class="rc-label">Existing Credits</div><div class="rc-value">${r.existing_credits !== null ? r.existing_credits : '—'}</div></div>
      <div class="rc-summary-item"><div class="rc-label">Request ID</div><div class="rc-value" style="font-size:12px">${escapeHtml(r.request_id || '—')}</div></div>
    </div>
  `;

  // Wire actions
  body.querySelectorAll('[data-status]').forEach(btn => {
    btn.addEventListener('click', () => updateStatus(r.id, btn.dataset.status, btn));
  });
  document.getElementById('rc-btn-report').addEventListener('click', () => {
    window.open('/assessment/report?review_id=' + r.id, '_blank');
  });
  document.getElementById('rc-add-note-btn').addEventListener('click', addNote);

  showDrawer(true);
  loadTimeline(r.id);
}

function updateStatus(id, status, btn) {
  fetch('/api/reviews/' + id + '/status', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
    .then(res => res.json())
    .then(d => {
      if (d.error) return alert(d.error);
      // Re-render detail with fresh data
      openDetail(id);
      loadQueue();
    })
    .catch(() => alert('Failed to update status'));
}

function addNote() {
  const text = document.getElementById('rc-note-text').value.trim();
  if (!text || !RC.currentDetail) return;
  fetch('/api/reviews/' + RC.currentDetail.id + '/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
    .then(res => res.json())
    .then(d => { if (d.error) return alert(d.error); openDetail(RC.currentDetail.id); loadQueue(); })
    .catch(() => alert('Failed to add note'));
}

function loadTimeline(id) {
  fetch('/api/reviews/' + id + '/timeline')
    .then(res => res.json())
    .then(d => {
      const el = document.getElementById('rc-timeline');
      if (!el) return;
      el.innerHTML = (d.events || []).map(e => `
        <div class="rc-tl-item">
          <div class="rc-tl-detail">${escapeHtml(e.detail || '')}</div>
          <div class="rc-tl-time">${e.timestamp ? new Date(e.timestamp).toLocaleString() : ''}${e.author ? ' — ' + escapeHtml(e.author) : ''}</div>
          ${(e.reasons || []).length ? `<div class="rc-tl-reasons rc-reasons">${e.reasons.map(x => `<li><span class="material-symbols-outlined">flag</span>${escapeHtml(x)}</li>`).join('')}</div>` : ''}
        </div>
      `).join('') || '<p class="muted small">No events.</p>';
    })
    .catch(() => {});
}

function showDrawer(show) {
  document.getElementById('rc-overlay').classList.toggle('show', show);
  document.getElementById('rc-drawer').classList.toggle('show', show);
}

// Risk vs Anomaly matrix
function renderMatrix() {
  const canvas = document.getElementById('rc-matrix');
  if (!canvas || !RC.items.length) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const padL = 50, padB = 40, padT = 20, padR = 20;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  ctx.clearRect(0, 0, W, H);

  // background
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--panel-2').trim() || '#1C2538';
  ctx.fillRect(0, 0, W, H);

  // axes
  ctx.strokeStyle = '#8892A4';
  ctx.fillStyle = '#8892A4';
  ctx.font = '11px sans-serif';
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();

  // gridlines + labels (x = probability, y = anomaly)
  for (let i = 0; i <= 4; i++) {
    const x = padL + plotW * i / 4;
    ctx.beginPath(); ctx.moveTo(x, H - padB); ctx.lineTo(x, padT);
    ctx.strokeStyle = 'rgba(136,146,164,.15)'; ctx.stroke();
    ctx.fillStyle = '#8892A4';
    ctx.fillText((i * 25) + '%', x - 12, H - padB + 16);
  }
  for (let i = 0; i <= 4; i++) {
    const y = H - padB - plotH * i / 4;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y);
    ctx.strokeStyle = 'rgba(136,146,164,.15)'; ctx.stroke();
    ctx.fillStyle = '#8892A4';
    ctx.fillText((i * 25) + '%', 8, y + 4);
  }
  // axis labels
  ctx.fillText('Anomaly score →', padL, padT - 6);
  ctx.fillText('→ Probability of Default', W - padR - 150, H - padB + 32);

  // quadrant divider at 50/50
  const mx = padL + plotW * 0.5, my = H - padB - plotH * 0.5;
  ctx.setLineDash([5,5]); ctx.strokeStyle = 'rgba(136,146,164,.5)'; ctx.strokeRect(padL, padT, plotW, plotH);
  ctx.beginPath(); ctx.moveTo(mx, padT); ctx.lineTo(mx, H - padB); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(padL, my); ctx.lineTo(W - padR, my); ctx.stroke();
  ctx.setLineDash([]);

  const colors = { HIGH: '#FF7A7A', MEDIUM: '#FFC46B', LOW: '#4EDCAB' };
  const radius = 6;
  RC.items.forEach(r => {
    const x = padL + plotW * Math.max(0, Math.min(1, r.probability || 0));
    const y = H - padB - plotH * Math.max(0, Math.min(1, r.anomaly_score || 0));
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = colors[r.review_priority] || colors.MEDIUM;
    ctx.fill();
    ctx.strokeStyle = '#0B0E14'; ctx.lineWidth = 1; ctx.stroke();
    if (r.is_anomalous) {
      ctx.beginPath(); ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
      ctx.strokeStyle = colors[r.review_priority] || colors.MEDIUM;
      ctx.setLineDash([3,3]); ctx.stroke(); ctx.setLineDash([]);
    }
  });
  // store item under click
  canvas._items = RC.items;
  canvas._scale = { padL, plotW, plotH, H, padT, padB };
}

function onClickMatrix(e) {
  const canvas = document.getElementById('rc-matrix');
  if (!canvas._items) return;
  const rect = canvas.getBoundingClientRect();
  const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
  const s = canvas._scale;
  const x = (sx - s.padL) / s.plotW;
  const y = 1 - (sy - s.padT) / s.plotH;
  let best = null, bestDist = Infinity;
  canvas._items.forEach(r => {
    const px = s.padL + s.plotW * (r.probability || 0);
    const py = s.H - s.padB - s.plotH * (r.anomaly_score || 0);
    const d = Math.hypot(px - sx, py - sy);
    if (d < bestDist && d < 20) { bestDist = d; best = r; }
  });
  if (best) openDetail(best.id);
}

function seedReviews() {
  const btn = document.getElementById('rc-seed');
  btn.disabled = true;
  btn.textContent = 'Scanning…';
  fetch('/api/reviews/seed', { method: 'POST' })
    .then(res => res.json())
    .then(d => { btn.textContent = `Created ${d.created} review(s)`; loadQueue(); loadStats(); })
    .catch(() => { btn.textContent = 'Scan & seed reviews'; btn.disabled = false; })
    .finally(() => setTimeout(() => { btn.textContent = 'Scan & seed reviews'; btn.disabled = false; }, 2000));
}

function init() {
  document.querySelectorAll('#rc-status, #rc-priority, #rc-risk, #rc-anomalous').forEach(el => {
    el.addEventListener('change', loadQueue);
  });
  let debounce;
  document.getElementById('rc-search').addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(loadQueue, 300);
  });
  document.getElementById('rc-close').addEventListener('click', () => showDrawer(false));
  document.getElementById('rc-overlay').addEventListener('click', () => showDrawer(false));
  document.getElementById('rc-seed').addEventListener('click', seedReviews);
  document.getElementById('rc-matrix').addEventListener('click', onClickMatrix);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') showDrawer(false); });
  loadStats();
  loadQueue();
}

document.addEventListener('DOMContentLoaded', init);
