document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('dashboard-results-container');
  if (!container) return;

  const titles = {
    APPROVE: '🟢 Approved Applications',
    REVIEW: '🟡 Applications Requiring Review',
    REJECT: '🔴 Rejected Applications',
  };
  const buttons = document.querySelectorAll('[data-dashboard-category]');
  const panels = document.querySelectorAll('[data-dashboard-panel]');

  function switchCategory(category) {
    document.getElementById('dashboard-selected-title').textContent = titles[category];

    // Fade out current visible panels
    const currentVisible = container.querySelectorAll('[data-dashboard-panel]:not(.hidden)');
    currentVisible.forEach(p => {
      p.classList.add('panel-fade-out');
    });

    // After fade-out completes, swap visibility and fade in
    setTimeout(() => {
      currentVisible.forEach(p => p.classList.add('hidden'));
      currentVisible.forEach(p => p.classList.remove('panel-fade-out'));

      container.classList.remove('hidden');
      const target = container.querySelector(`[data-dashboard-panel="${category}"]`);
      if (target) {
        target.classList.remove('hidden');
        target.classList.add('panel-fade-in');
        // Remove animation class after it completes
        setTimeout(() => target.classList.remove('panel-fade-in'), 300);
      }
    }, 150);

    buttons.forEach(item => item.classList.toggle('active', item.dataset.dashboardCategory === category));
  }

  buttons.forEach(button => button.addEventListener('click', () => {
    switchCategory(button.dataset.dashboardCategory);
  }));

  document.getElementById('dashboard-hide-results')?.addEventListener('click', () => {
    container.classList.add('hidden');
    buttons.forEach(button => button.classList.remove('active'));
  });
});
