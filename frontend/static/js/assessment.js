// static/js/assessment.js

let ASSESS_FIELDS = [];
let LAST_INPUTS = {};

function initAssessmentForm() {
  const specEl = document.getElementById('field-spec');
  if (!specEl) return;
  ASSESS_FIELDS = JSON.parse(specEl.textContent);

  const container = document.getElementById('form-fields');
  ASSESS_FIELDS.forEach(field => {
    container.appendChild(buildFieldElement(field, 'field_'));
  });

  document.getElementById('assessment-form').addEventListener('submit', onSubmitAssessment);
  document.getElementById('btn-explain').addEventListener('click', onViewExplanation);
  document.getElementById('btn-scenario').addEventListener('click', onRunScenario);
  document.getElementById('btn-reset').addEventListener('click', onNewAssessment);
}

function readFormValues() {
  const values = { currency: document.getElementById('assessment-currency').value };
  ASSESS_FIELDS.forEach(field => {
    const el = document.getElementById('field_' + field.name);
    if (!el || el.value === '') return;
    values[field.name] = field.type === 'number' ? parseFloat(el.value) : el.value;
  });
  return values;
}

function showResultSkeleton() {
  const panel = document.getElementById('result-panel');
  const grid = panel.querySelector('.result-grid');
  if (!grid) return;

  grid.innerHTML = '';
  const labels = ['Risk Score', 'Probability of Default', 'Risk Category', 'Recommendation', 'Expected Loss'];
  labels.forEach(label => {
    const block = document.createElement('div');
    block.className = 'result-block';
    block.innerHTML = `
      <div class="result-label">${label}</div>
      <div class="result-value"><div class="skeleton skeleton-line medium" style="margin-top:6px"></div></div>
    `;
    grid.appendChild(block);
  });
  document.getElementById('res-reasons').innerHTML =
    '<li class="skeleton skeleton-line" style="width:90%"></li>' +
    '<li class="skeleton skeleton-line" style="width:75%"></li>' +
    '<li class="skeleton skeleton-line" style="width:85%"></li>';
}

async function onSubmitAssessment(e) {
  e.preventDefault();
  const errBox = document.getElementById('form-errors');
  errBox.textContent = '';
  LAST_INPUTS = readFormValues();

  const submitBtn = e.submitter || document.querySelector('#assessment-form button[type=submit]');
  setButtonLoading(submitBtn, true);

  // Show result panel with skeleton
  const resultPanel = document.getElementById('result-panel');
  resultPanel.classList.remove('hidden');
  showResultSkeleton();

  try {
    const res = await fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(LAST_INPUTS),
    });
    const data = await res.json();
    if (!res.ok) {
      errBox.textContent = data.error || 'Something went wrong.';
      resultPanel.classList.add('hidden');
      return;
    }
    renderResult(data);
  } catch (err) {
    errBox.textContent = 'Network or server error: ' + err;
    resultPanel.classList.add('hidden');
  } finally {
    setButtonLoading(submitBtn, false);
  }
}

function renderResult(data) {
  const panel = document.getElementById('result-panel');
  if (panel) panel.classList.remove('hidden');

  const resScore = document.getElementById('res-score');
  if (resScore) resScore.textContent = `${data.risk_score} / 1000`;

  const resProb = document.getElementById('res-prob');
  if (resProb) resProb.textContent = formatPercent(data.probability_of_default);

  const resCategory = document.getElementById('res-category');
  if (resCategory) resCategory.textContent = data.risk_category;

  const recommendation = document.getElementById('res-recommendation');
  if (recommendation) {
    recommendation.textContent = data.recommendation;
    recommendation.className = `result-value decision-${data.recommendation.toLowerCase()}`;
  }

  const resExpectedLoss = document.getElementById('res-expected-loss');
  if (resExpectedLoss) {
    resExpectedLoss.textContent = formatCurrency(data.display?.expected_loss, data.currency);
  }

  const resThreshold = document.getElementById('res-threshold');
  if (resThreshold) {
    const thresholds = data.decision_thresholds || {};
    resThreshold.textContent =
      `Decision policy: approve at score ${thresholds.approve_score_min ?? '—'}+; reject below ${thresholds.reject_score_below ?? '—'}; otherwise review.`;
  }

  const reasons = document.getElementById('res-reasons');
  if (reasons) {
    reasons.innerHTML = '';
    (data.decision_reasons || []).forEach(r => {
      const li = document.createElement('li');
      li.textContent = r;
      reasons.appendChild(li);
    });
  }

  const anomalyBadge = document.getElementById('res-anomaly');
  if (anomalyBadge && data.anomaly) {
    anomalyBadge.textContent = data.anomaly.label;
    anomalyBadge.className = 'badge ' + (data.anomaly.is_anomalous ? 'status-warn' : 'status-good');
  }

  const expBox = document.getElementById('explanation-box');
  if (expBox) expBox.classList.add('hidden');

  if (panel) panel.scrollIntoView({ behavior: 'smooth' });
}

function formatCurrency(value, currency) {
  if (value === null || value === undefined) return 'Not available';
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', {
    style: 'currency', currency, maximumFractionDigits: 2
  }).format(Number(value));
}

function formatPercent(x) {
  return (x * 100).toFixed(1) + '%';
}

async function onViewExplanation() {
  const box = document.getElementById('explanation-box');
  box.classList.remove('hidden');
  box.innerHTML = '<div class="skeleton skeleton-line medium"></div><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line" style="width:70%"></div>';

  const explainBtn = document.getElementById('btn-explain');
  setButtonLoading(explainBtn, true);

  try {
    const res = await fetch('/api/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(LAST_INPUTS),
    });
    const data = await res.json();
    if (!res.ok) { box.textContent = data.error || 'Could not load explanation.'; return; }
    const exp = data.explanation;
    const fmt = items => items.map(i => `<li>${i.explanation}</li>`).join('') || '<li>None identified.</li>';
    box.classList.remove('result-fade-in');
    void box.offsetWidth;
    box.classList.add('result-fade-in');
    box.innerHTML = `
      <h4>Risk-increasing factors</h4>
      <ul class="reason-list">${fmt(exp.risk_increasing_factors)}</ul>
      <h4>Risk-reducing factors</h4>
      <ul class="reason-list">${fmt(exp.risk_reducing_factors)}</ul>
      <p class="muted small">${exp.disclaimer}</p>
    `;
  } catch (err) {
    box.textContent = 'Network or server error: ' + err;
  } finally {
    setButtonLoading(explainBtn, false);
  }
}

function onRunScenario() {
  sessionStorage.setItem('scenario_inputs', JSON.stringify(LAST_INPUTS));
  window.location.href = '/scenario';
}

function onNewAssessment() {
  ASSESS_FIELDS.forEach(field => {
    const el = document.getElementById('field_' + field.name);
    if (el) el.value = '';
  });
  document.getElementById('result-panel').classList.add('hidden');
  document.getElementById('result-panel').classList.remove('result-fade-in');
  document.getElementById('form-errors').textContent = '';
}

document.addEventListener('DOMContentLoaded', initAssessmentForm);
