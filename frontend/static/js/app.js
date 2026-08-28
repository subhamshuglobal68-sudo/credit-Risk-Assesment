// static/js/app.js
// Shared helpers used across pages.

function buildFieldElement(field, prefix, value) {
  const wrapper = document.createElement('div');
  wrapper.className = 'field';

  const label = document.createElement('label');
  label.textContent = field.label;
  label.setAttribute('for', prefix + field.name);
  wrapper.appendChild(label);

  let input;
  if (field.type === 'select') {
    input = document.createElement('select');
    const blank = document.createElement('option');
    blank.value = '';
    blank.textContent = '-- select --';
    input.appendChild(blank);
    (field.options || []).forEach(opt => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      input.appendChild(o);
    });
  } else {
    input = document.createElement('input');
    input.type = 'number';
    input.step = 'any';
  }
  input.id = prefix + field.name;
  input.name = field.name;
  if (value !== undefined && value !== null) input.value = value;
  wrapper.appendChild(input);
  return wrapper;
}

function collectFormValues(containerEl, fields) {
  const values = {};
  fields.forEach(field => {
    const el = document.getElementById(containerEl.id + '_' + field.name) ||
               containerEl.querySelector(`[name="${field.name}"]`);
    if (!el) return;
    if (el.value === '') return;
    values[field.name] = field.type === 'number' ? parseFloat(el.value) : el.value;
  });
  return values;
}

function formatPercent(x) {
  return (x * 100).toFixed(1) + '%';
}

// Toggle a button's loading state (spinner + disabled). Reused across pages.
function setButtonLoading(btn, loading) {
  if (!btn) return;
  if (loading) {
    btn.classList.add('is-loading');
    btn.disabled = true;
    if (!btn.querySelector('.spinner')) {
      const sp = document.createElement('span');
      sp.className = 'spinner';
      btn.appendChild(sp);
    }
  } else {
    btn.classList.remove('is-loading');
    btn.disabled = false;
    const sp = btn.querySelector('.spinner');
    if (sp) sp.remove();
  }
}

// Smooth scroll with offset for fixed topbar
function smoothScrollTo(el) {
  if (!el) return;
  const topbarH = 72;
  const y = el.getBoundingClientRect().top + window.pageYOffset - topbarH;
  window.scrollTo({ top: y, behavior: 'smooth' });
}

// ===== UI CONTROLLER =====
(function() {
  const sidebar = document.getElementById('sidebar');
  const toggleBtn = document.getElementById('sidebar-toggle');
  const mobileMenu = document.getElementById('mobile-menu');
  const overlay = document.getElementById('sidebar-overlay');
  const reduceMotionCheckbox = document.getElementById('reduce-motion');

  const COLLAPSED_KEY = 'crea-sidebar-collapsed';
  const REDUCE_MOTION_KEY = 'crea-reduce-motion';
  const THEME_KEY = 'crea-theme';
  const themeToggle = document.getElementById('theme-toggle');

  function applyTheme(dark) {
    document.documentElement.classList.toggle('dark', dark);
    themeToggle?.setAttribute('aria-pressed', dark ? 'true' : 'false');
    themeToggle?.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }

  function initTheme() {
    const stored = localStorage.getItem(THEME_KEY);
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initialDark = stored ? stored === 'dark' : prefersDark;
    applyTheme(initialDark);

    themeToggle?.addEventListener('click', () => {
      const current = localStorage.getItem(THEME_KEY) || (prefersDark ? 'dark' : 'light');
      applyTheme(current !== 'dark');
    });
  }

  function applyCollapsed(collapsed) {
    if (!sidebar || !toggleBtn) return;
    if (collapsed) {
      sidebar.classList.add('collapsed');
      toggleBtn.setAttribute('aria-expanded', 'false');
      toggleBtn.setAttribute('aria-label', 'Expand sidebar');
    } else {
      sidebar.classList.remove('collapsed');
      toggleBtn.setAttribute('aria-expanded', 'true');
      toggleBtn.setAttribute('aria-label', 'Collapse sidebar');
    }
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  }

  function applyReduceMotion(reduced) {
    document.body.classList.toggle('reduce-motion', reduced);
    localStorage.setItem(REDUCE_MOTION_KEY, reduced ? '1' : '0');
    if (reduceMotionCheckbox) reduceMotionCheckbox.checked = reduced;
  }

  function init() {
    // Theme (must run first to prevent flash)
    initTheme();

    // Sidebar collapse from localStorage
    const stored = localStorage.getItem(COLLAPSED_KEY);
    if (stored === '1') applyCollapsed(true);

    // Reduce motion from localStorage or prefers-reduced-motion
    const storedRM = localStorage.getItem(REDUCE_MOTION_KEY);
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (storedRM === '1' || (storedRM === null && prefersReduced)) applyReduceMotion(true);

    // Toggle button click with requestAnimationFrame for smooth sync
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const isCollapsed = sidebar.classList.contains('collapsed');
        requestAnimationFrame(() => {
          applyCollapsed(!isCollapsed);
        });
      });
    }

    // Mobile menu
    if (mobileMenu) {
      mobileMenu.addEventListener('click', () => {
        sidebar.classList.add('open');
        overlay.classList.add('show');
        // Trap focus in sidebar on mobile
        const firstLink = sidebar.querySelector('.nav-link');
        if (firstLink) firstLink.focus();
      });
    }
    if (overlay) {
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
        if (mobileMenu) mobileMenu.focus();
      });
    }

    // Close mobile sidebar on nav link click & handle smooth scroll
    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 760) {
          sidebar.classList.remove('open');
          overlay.classList.remove('show');
        }
      });
    });

    // Escape key closes mobile sidebar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
        if (mobileMenu) mobileMenu.focus();
      }
    });

    // Reduce motion checkbox in settings
    if (reduceMotionCheckbox) {
      reduceMotionCheckbox.addEventListener('change', (e) => applyReduceMotion(e.target.checked));
    }

    // Listen for prefers-reduced-motion changes
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
      if (localStorage.getItem(REDUCE_MOTION_KEY) === null) applyReduceMotion(e.matches);
    });

    // Staggered entry animation for card grids and panels
    const staggerTargets = document.querySelectorAll('.card-grid, .analytics-grid, .dashboard-lower');
    staggerTargets.forEach(el => {
      el.classList.add('stagger-in');
    });

    // Smooth reveal for results on page load (single elements, not grids)
    const contentEl = document.querySelector('.content');
    if (contentEl) {
      const children = contentEl.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (!child.classList.contains('stagger-in') && child.tagName !== 'SCRIPT') {
          child.style.opacity = '0';
          child.style.transform = 'translateY(10px)';
          child.style.transition = `opacity 350ms cubic-bezier(0,.7,.3,1) ${i * 50}ms, transform 350ms cubic-bezier(0,.7,.3,1) ${i * 50}ms`;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              child.style.opacity = '';
              child.style.transform = '';
            });
          });
        }
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
