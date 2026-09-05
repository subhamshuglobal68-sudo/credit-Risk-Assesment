// static/js/scenario.js - Enhanced What-If Simulator

const WI = {
  original: null,        // original frontend applicant payload
  current: null,         // current scenario state (starts as copy of original)
  lastResult: null,
  debounceTimer: null,
  historyKey: 'wi_history',
};

const WI_SLIDERS = [
  { id: 'wi-income', key: 'income', fmt: v => '₹' + formatNumber(v), min: 10000, max: 300000 },
  { id: 'wi-debt', key: 'existing_debt', fmt: v => '₹' + formatNumber(v), min: 0, max: 200000 },
  { id: 'wi-late', key: 'late_payments_last_2y', fmt: v => String(v), min: 0, max: 5 },
  // Backend requires existing_credits in [1..10], so min is 1 (a borrower
  // always carries their current credit reference).
  { id: 'wi-accounts', key: 'num_open_accounts', fmt: v => String(v), min: 1, max: 6 },
  { id: 'wi-loan', key: 'loan_amount', fmt: v => '₹' + formatNumber(v), min: 10000, max: 100000 },
];

// Defaults used when sessionStorage has no saved applicant.
const WI_DEFAULTS = {
  age: 35,
  income: 50000,
  loan_amount: 50000,
  existing_debt: 12000,
  employment_duration_years: 5,
  credit_history_years: 3,
  num_open_accounts: 1,
  late_payments_last_2y: 0,
  housing_status: 'RENT',
  employment_type: 'SALARIED',
};

function formatNumber(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function formatPercent(p) {
  return (p * 100).toFixed(1) + '%';
}

function getOriginalApplicant() {
  try {
    const saved = JSON.parse(sessionStorage.getItem('scenario_inputs') || 'null');
    if (saved && typeof saved === 'object') return saved;
  } catch (e) { /* ignore */ }
  return { ...WI_DEFAULTS };
}

function clampSlider(slider, val) {
  const min = parseFloat(slider.min), max = parseFloat(slider.max);
  return Math.max(min, Math.min(max, Number(val)));
}

function initSliders() {
  WI_SLIDERS.forEach(s => {
    const el = document.getElementById(s.id);
    if (!el) return;
    el.addEventListener('input', () => {
      const v = parseFloat(el.value) || s.min;
      const label = document.getElementById(s.id + '-val');
      if (label) label.textContent = s.fmt(v);
      WI.current[s.key] = v;
      scheduleRecalc(); // Enable live updates as slider is dragged
    });
    el.addEventListener('change', () => scheduleRecalc());
  });
}

function initPresets() {
  document.querySelectorAll('[data-preset]').forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
  });
}

function applyPreset(name) {
  const o = WI.original;
  switch (name) {
    case 'income-up':
      WI.current.income = (o.income || 50000) * 1.2;
      break;
    case 'income-down':
      WI.current.income = (o.income || 50000) * 0.8;
      break;
    case 'debt-down':
      WI.current.existing_debt = Math.max(0, (o.existing_debt || 12000) * 0.8);
      break;
    case 'debt-zero':
      WI.current.existing_debt = Math.max(0, (o.existing_debt || 12000) * 0.5);
      break;
    case 'clean-history':
      WI.current.late_payments_last_2y = 0;
      WI.current.credit_history_years = Math.max(WI.current.credit_history_years || 3, 6);
      break;
    case 'loan-down':
      WI.current.loan_amount = (o.loan_amount || 50000) * 0.8;
      break;
  }
  refreshSliderValues();
  scheduleRecalc();
}

function refreshSliderValues() {
  WI_SLIDERS.forEach(s => {
    const el = document.getElementById(s.id);
    const label = document.getElementById(s.id + '-val');
    if (!el) return;
    el.value = clampSlider(el, WI.current[s.key]);
    if (label) label.textContent = s.fmt(WI.current[s.key]);
  });
}

function scheduleRecalc() {
  clearTimeout(WI.debounceTimer);
  WI.debounceTimer = setTimeout(recalc, 350);
}

async function recalc() {
  const errBox = document.getElementById('wi-errors');
  errBox.textContent = '';
  showLoading(true);

  const original = WI.original;
  const modified = { ...WI.current };

  try {
    const res = await fetch('/api/scenario', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ original, modified }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error || data.details || `Request failed (${res.status}).`;
      errBox.textContent = msg;
      showLoading(false);
      return;
    }

    WI.lastResult = data;
    renderResult(data);
    addToHistory(data);
    showLoading(false);
  } catch (err) {
    errBox.textContent = 'It looks like the server is unavailable. Please confirm the backend is running, then try again.';
    showLoading(false);
  }
}

function showLoading(on) {
  const loading = document.getElementById('wi-loading');
  const body = document.getElementById('wi-result-body');
  if (!loading || !body) return;
  loading.classList.toggle('hidden', !on);
  body.classList.toggle('hidden', on);
}

function riskColor(cat) {
  if (['APPROVE', 'LOW'].includes(cat)) return 'var(--good)';
  if (['REVIEW', 'MEDIUM'].includes(cat)) return 'var(--warn)';
  return 'var(--bad)';
}

function renderResult(data) {
  const before = data.before, after = data.after, change = data.change;

  const bScore = document.getElementById('wi-score-before');
  const aScore = document.getElementById('wi-score-after');
  const bCat = document.getElementById('wi-cat-before');
  const aCat = document.getElementById('wi-cat-after');

  animateNumber(bScore, before.risk_score);
  animateNumber(aScore, after.risk_score);

  bCat.textContent = before.risk_category;
  aCat.textContent = after.risk_category;
  bCat.style.color = riskColor(before.risk_category);
  aCat.style.color = riskColor(after.risk_category);

  // Gauge
  setGauge('geo-fill-before', before.risk_score);
  setGauge('geo-fill-after', after.risk_score);

  // Change
  const delta = change.risk_score_delta;
  const deltaEl = document.getElementById('wi-score-delta');
  deltaEl.textContent = (delta > 0 ? '+' : '') + delta;
  deltaEl.style.color = delta > 0 ? 'var(--good)' : (delta < 0 ? 'var(--bad)' : 'var(--muted)');
  document.getElementById('wi-cat-change').textContent =
    change.category_changed ? `${change.from_category} → ${change.to_category} (category changed!)` : 'no category change';

  // Probability + anomaly
  document.getElementById('wi-prob-before').textContent = formatPercent(before.probability_of_default);
  document.getElementById('wi-prob-after').textContent = formatPercent(after.probability_of_default);
  const anomB = document.getElementById('wi-anomaly-before');
  const anomA = document.getElementById('wi-anomaly-after');
  anomB.textContent = anomalyText(before);
  anomA.textContent = anomalyText(after);
  anomB.style.color = before.anomaly.is_anomalous ? 'var(--warn)' : 'var(--good)';
  anomA.style.color = after.anomaly.is_anomalous ? 'var(--warn)' : 'var(--good)';

  // Changed fields table
  const rows = document.getElementById('wi-changed-fields');
  const noChanges = document.getElementById('wi-no-changes');
  if (data.changed_fields && data.changed_fields.length) {
    rows.innerHTML = data.changed_fields.map(c =>
      `<tr><td>${escapeHtml(c.field)}</td><td>${escapeHtml(val(c.before))}</td><td class="wi-now-val">${escapeHtml(val(c.after))}</td></tr>`
    ).join('');
    noChanges.hidden = true;
    rows.closest('.wi-table').hidden = false;
  } else {
    rows.innerHTML = '';
    noChanges.hidden = false;
    rows.closest('.wi-table').hidden = true;
  }

  // Explanations
  renderExplanation('wi-exp-before', before.explanation);
  renderExplanation('wi-exp-after', after.explanation);
}

function anomalyText(bucket) {
  const a = bucket.anomaly;
  return a.is_anomalous ? `Anomalous (${(a.anomaly_score * 100).toFixed(1)}%)` : 'Normal profile';
}

function renderExplanation(listId, exp) {
  const list = document.getElementById(listId);
  if (!list) return;
  const items = [];
  (exp.risk_increasing_factors || []).slice(0, 3).forEach(f =>
    items.push(`<li class="wi-inc"><span class="material-symbols-outlined">trending_up</span>${escapeHtml(f.explanation)}</li>`)
  );
  (exp.risk_reducing_factors || []).slice(0, 3).forEach(f =>
    items.push(`<li class="wi-dec"><span class="material-symbols-outlined">trending_down</span>${escapeHtml(f.explanation)}</li>`)
  );
  list.innerHTML = items.length ? items.join('') : '<li class="muted small">No dominant factors.</li>';
}

function setGauge(id, score) {
  const path = document.getElementById(id);
  if (!path) return;
  // Map score 0..1000 -> arc fraction 0..0.5 (180 deg)
  const frac = Math.max(0, Math.min(1000, score)) / 1000;
  const angle = Math.PI * frac; // 0..PI
  const r = 80, cx = 100, cy = 110;
  const start = { x: 20, y: 110 };
  const end = {
    x: cx + r * Math.cos(Math.PI - angle),
    y: cy - r * Math.sin(Math.PI - angle),
  };
  const largeArc = frac > 0.5 ? 1 : 0;
  const d = `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
  path.setAttribute('d', d);
  path.style.stroke = riskColor(score > 600 ? 'APPROVE' : score >= 400 ? 'REVIEW' : 'HIGH');
}

function animateNumber(el, target) {
  const start = parseInt(el.textContent) || 0;
  const dur = 500;
  const t0 = performance.now();
  function frame(t) {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(start + (target - start) * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

function val(v) {
  return (v === null || v === undefined) ? '—' : v;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---- History ----
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(WI.historyKey) || '[]'); } catch (e) { return []; }
}
function addToHistory(data) {
  const hist = loadHistory();
  hist.unshift({
    ts: new Date().toISOString(),
    delta: data.change.risk_score_delta,
    from: data.before.risk_category,
    to: data.after.risk_category,
  });
  localStorage.setItem(WI.historyKey, JSON.stringify(hist.slice(0, 20)));
  renderHistory(hist.slice(0, 20));
}
function renderHistory(hist) {
  const list = document.getElementById('wi-history-list');
  if (!list) return;
  list.innerHTML = hist.map(h => {
    const cls = h.delta > 0 ? 'wi-hist-good' : h.delta < 0 ? 'wi-hist-bad' : '';
    return `<div class="wi-hist-item">
      <span class="wi-hist-time">${new Date(h.ts).toLocaleTimeString()}</span>
      <span>${h.from} → ${h.to}</span>
      <span class="${cls}">${h.delta > 0 ? '+' : ''}${h.delta}</span>
    </div>`;
  }).join('') || '<p class="muted small">No scenarios run yet.</p>';
}

function init() {
  const specEl = document.getElementById('field-spec');
  if (!specEl) return;

  WI.original = getOriginalApplicant();
  WI.current = { ...WI.original };

  initSliders();
  initPresets();
  refreshSliderValues();

  document.getElementById('wi-run').addEventListener('click', recalc);
  document.getElementById('wi-reset').addEventListener('click', () => {
    WI.current = { ...WI.original };
    refreshSliderValues();
    recalc();
  });
  document.getElementById('wi-clear-history').addEventListener('click', () => {
    localStorage.removeItem(WI.historyKey);
    renderHistory([]);
  });

  renderHistory(loadHistory() || []);
}

document.addEventListener('DOMContentLoaded', init);
