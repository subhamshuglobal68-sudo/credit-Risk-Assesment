let batchGroups = null;
let batchCurrency = 'INR';

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function money(value, currency) {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value));
}

function resultTable(items, kind, currency) {
  if (!items.length) {
    const empty = kind === 'APPROVE' ? 'No approved applications.' : kind === 'REVIEW' ? 'No applications require review.' : 'No rejected applications.';
    return `<p class="muted">${empty}</p>`;
  }
  const headers = kind === 'APPROVE' ? '<th>Applicant ID</th><th>Risk score</th><th>Default probability</th><th>Income</th><th>Loan amount</th><th>Expected loss</th><th>Decision</th>' : kind === 'REVIEW' ? '<th>Applicant ID</th><th>Risk score</th><th>Default probability</th><th>Review reason</th><th>Anomaly flags</th><th>Income / loan / debt</th>' : '<th>Applicant ID</th><th>Risk score</th><th>Default probability</th><th>Loan amount</th><th>Expected loss</th><th>Rejection explanation</th>';
  const rows = items.map(item => {
    const financial = `${money(item.income, currency)} / ${money(item.loan_amount, currency)} / ${money(item.existing_debt, currency)}`;
    if (kind === 'APPROVE') return `<tr><td>${escapeHtml(item.applicant_id)}</td><td>${item.risk_score}</td><td>${(item.probability_of_default * 100).toFixed(1)}%</td><td>${money(item.income, currency)}</td><td>${money(item.loan_amount, currency)}</td><td>${money(item.expected_loss, currency)}</td><td><span class="badge status-good">APPROVE</span></td></tr>`;
    if (kind === 'REVIEW') return `<tr><td>${escapeHtml(item.applicant_id)}</td><td>${item.risk_score}</td><td>${(item.probability_of_default * 100).toFixed(1)}%</td><td>${escapeHtml(item.review_reason)}</td><td>${escapeHtml((item.anomaly_flags || []).join(' · ') || 'None')}</td><td>${financial}</td></tr>`;
    return `<tr><td>${escapeHtml(item.applicant_id)}</td><td>${item.risk_score}</td><td>${(item.probability_of_default * 100).toFixed(1)}%</td><td>${money(item.loan_amount, currency)}</td><td>${money(item.expected_loss, currency)}</td><td>${escapeHtml((item.top_risk_factors || []).join(' · '))}</td></tr>`;
  }).join('');
  return `<div class="table-scroll"><table class="data-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function showCategory(category) {
  const labels = { APPROVE: '🟢 Approved Applications', REVIEW: '🟡 Applications Requiring Review', REJECT: '🔴 Rejected Applications' };
  const container = document.getElementById('results-container');
  const resultsEl = document.getElementById('selected-results');

  // Fade out current content
  resultsEl.classList.add('panel-fade-out');
  setTimeout(() => {
    document.getElementById('selected-results-title').textContent = labels[category];
    resultsEl.innerHTML = resultTable(batchGroups[category], category, batchCurrency);
    resultsEl.classList.remove('panel-fade-out');
    resultsEl.classList.add('panel-fade-in');
    setTimeout(() => resultsEl.classList.remove('panel-fade-in'), 300);
    container.classList.remove('hidden');
    document.querySelectorAll('.category-card').forEach(button => button.classList.toggle('active', button.dataset.category === category));
  }, 150);
}

function renderCategoryButtons(groups) {
  const categories = [
    ['APPROVE', '🟢', 'APPROVED', 'result-approved'],
    ['REVIEW', '🟡', 'REVIEW', 'result-review'],
    ['REJECT', '🔴', 'REJECTED', 'result-rejected'],
  ];
  document.getElementById('category-buttons').innerHTML = categories.map(([key, icon, label, style]) =>
    `<button type="button" class="category-card ${style}" data-category="${key}"><span class="category-icon">${icon}</span><span class="category-label">${label}</span><strong>${groups[key].length}</strong><small>Applications · Click to view →</small></button>`
  ).join('');
  document.querySelectorAll('.category-card').forEach(button => button.addEventListener('click', () => showCategory(button.dataset.category)));
}

document.getElementById('clear-result-selection')?.addEventListener('click', () => {
  document.getElementById('results-container').classList.add('hidden');
  document.querySelectorAll('.category-card').forEach(button => button.classList.remove('active'));
});

document.getElementById('dataset-form')?.addEventListener('submit', async event => {
  event.preventDefault();
  const status = document.getElementById('dataset-status');
  const file = document.getElementById('dataset-file').files[0];
  if (!file) return;
  const submitBtn = event.submitter || document.querySelector('#dataset-form button[type="submit"]');
  setButtonLoading(submitBtn, true);
  status.textContent = 'Preparing dataset for processing...';
  status.className = 'status-banner status-neutral';
  document.getElementById('results-container').classList.add('hidden');
  const formData = new FormData();
  formData.append('dataset', file);
  formData.append('currency', document.getElementById('dataset-currency').value);

  // Live activity indicator so long uploads never look frozen.
  const elapsedEl = document.getElementById('dataset-elapsed');
  const startedAt = Date.now();
  const ticker = setInterval(() => {
    if (elapsedEl) {
      elapsedEl.textContent = `Processing for ${((Date.now() - startedAt) / 1000).toFixed(1)}s...`;
      status.textContent = 'Scoring dataset with the optimized batch model pipeline...';
    }
  }, 700);

  try {
    status.textContent = 'Scoring all rows in a single optimized batch pass...';
    const response = await fetch('/api/batch-predict', { method: 'POST', body: formData });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Dataset processing failed.');
    batchGroups = data.groups;
    batchCurrency = data.currency;
    const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
    status.textContent = `${data.processed_rows} of ${data.total_rows} rows processed in ${elapsed}s.`;
    document.getElementById('dataset-summary').classList.remove('hidden');
    document.getElementById('dataset-title').textContent = `Results: ${data.filename}`;
    document.getElementById('batch-total-count').textContent = data.processed_rows;
    renderCategoryButtons(data.groups);
    if (data.categorization_warning) {
      status.textContent = data.categorization_warning;
      status.className = 'status-banner status-bad';
    }
    const errorsPanel = document.getElementById('batch-errors-panel');
    errorsPanel.classList.toggle('hidden', !data.errors.length);
    document.getElementById('batch-errors').innerHTML = data.errors.map(item => `<p>Row ${item.row_number}: ${escapeHtml(item.error)}</p>`).join('');
  } catch (error) {
    status.textContent = error.message;
    status.className = 'status-banner status-bad';
  } finally {
    clearInterval(ticker);
    if (elapsedEl) elapsedEl.textContent = '';
    setButtonLoading(submitBtn, false);
  }
});

document.getElementById('download-batch-report')?.addEventListener('click', () => {
  if (!batchGroups) return;
  const allItems = [];
  ['APPROVE', 'REVIEW', 'REJECT'].forEach(category => {
    (batchGroups[category] || []).forEach(item => {
      allItems.push(item);
    });
  });
  if (allItems.length === 0) {
    alert("No data available to download.");
    return;
  }
  allItems.sort((a, b) => String(a.applicant_id).localeCompare(String(b.applicant_id)));
  const headers = [
    "Applicant ID",
    "Credit Score (0-1000)",
    "Default Probability",
    "Recommendation",
    "Income",
    "Loan Amount",
    "Existing Debt",
    "Expected Loss",
    "Statistical Anomaly",
    "Primary Risk Factors"
  ];
  let csvContent = headers.join(",") + "\n";
  allItems.forEach(item => {
    const row = [
      `"${item.applicant_id}"`,
      item.risk_score,
      `"${(item.probability_of_default * 100).toFixed(2)}%"`,
      `"${item.recommendation}"`,
      item.income,
      item.loan_amount,
      item.existing_debt,
      item.expected_loss.toFixed(2),
      item.is_anomalous ? "TRUE" : "FALSE",
      `"${(item.top_risk_factors || []).join(' · ').replace(/"/g, '""')}"`
    ];
    csvContent += row.join(",") + "\n";
  });
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `credit_risk_batch_report_${new Date().toISOString().slice(0,10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});
