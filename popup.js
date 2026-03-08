// Query Feature Parser - popup.js

let currentUrl = null;

// --- Parsing ---

function parseParams(url) {
  try {
    const u = new URL(url);
    const entries = [];
    u.searchParams.forEach((value, key) => entries.push({ key, value }));
    return { entries, base: u };
  } catch {
    return null;
  }
}

function buildUrl(base, entries) {
  const u = new URL(base.href);
  u.search = '';
  entries.forEach(({ key, value }) => u.searchParams.append(key, value));
  return u.href;
}

// --- DOM helpers ---

function $(id) { return document.getElementById(id); }

function showError(msg) {
  const el = $('error-msg');
  el.textContent = msg;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 3000);
}

function setVisible(id, visible) {
  $(id).classList.toggle('hidden', !visible);
}

// --- Render ---

function render(entries, base) {
  const list = $('params-list');
  list.innerHTML = '';

  if (entries.length === 0) {
    setVisible('params-container', false);
    setVisible('no-params', true);
    return;
  }

  setVisible('no-params', false);
  setVisible('params-container', true);
  $('param-count').textContent = `${entries.length} param${entries.length !== 1 ? 's' : ''}`;

  entries.forEach(({ key, value }, idx) => {
    const li = document.createElement('li');
    li.className = 'param-row';
    li.dataset.idx = idx;

    const keyEl = document.createElement('input');
    keyEl.type = 'text';
    keyEl.value = key;
    keyEl.className = 'param-key';
    keyEl.dataset.field = 'key';

    const sep = document.createElement('span');
    sep.className = 'sep';
    sep.textContent = '=';

    const valEl = document.createElement('input');
    valEl.type = 'text';
    valEl.value = value;
    valEl.className = 'param-value';
    valEl.dataset.field = 'value';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn btn-icon';
    copyBtn.title = 'Copy value';
    copyBtn.textContent = '⎘';

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-icon btn-danger';
    delBtn.title = 'Delete param';
    delBtn.textContent = '✕';

    // Inline edit: update URL on blur
    [keyEl, valEl].forEach(input => {
      input.addEventListener('change', () => {
        const row = input.closest('.param-row');
        const i = parseInt(row.dataset.idx, 10);
        if (input.dataset.field === 'key') {
          entries[i].key = input.value.trim();
        } else {
          entries[i].value = input.value;
        }
        updateTabUrl(buildUrl(base, entries));
      });
    });

    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(value).catch(() => showError('Clipboard access denied.'));
    });

    delBtn.addEventListener('click', () => {
      entries.splice(idx, 1);
      updateTabUrl(buildUrl(base, entries));
      render(entries, base);
    });

    li.append(keyEl, sep, valEl, copyBtn, delBtn);
    list.appendChild(li);
  });
}

// --- Tab interaction ---

function updateTabUrl(newUrl) {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab) return;
    chrome.tabs.update(tab.id, { url: newUrl });
    currentUrl = newUrl;
  });
}

function loadCurrentTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab || !tab.url) {
      showError('Cannot access this tab.');
      return;
    }

    currentUrl = tab.url;

    const urlBar = $('url-display');
    try {
      const u = new URL(tab.url);
      urlBar.textContent = u.hostname + u.pathname;
      urlBar.title = tab.url;
    } catch {
      urlBar.textContent = tab.url;
    }

    const parsed = parseParams(tab.url);
    if (!parsed) {
      showError('Invalid URL.');
      return;
    }

    render(parsed.entries, parsed.base);

    // Wire up toolbar buttons with current entries/base
    $('copy-all-btn').onclick = () => {
      const obj = Object.fromEntries(parsed.entries.map(({ key, value }) => [key, value]));
      navigator.clipboard.writeText(JSON.stringify(obj, null, 2))
        .catch(() => showError('Clipboard access denied.'));
    };

    $('clear-btn').onclick = () => {
      parsed.entries.length = 0;
      updateTabUrl(buildUrl(parsed.base, []));
      render([], parsed.base);
    };

    $('add-btn').onclick = () => {
      const key = $('new-key').value.trim();
      const value = $('new-value').value;
      if (!key) { showError('Key cannot be empty.'); return; }
      parsed.entries.push({ key, value });
      updateTabUrl(buildUrl(parsed.base, parsed.entries));
      render(parsed.entries, parsed.base);
      $('new-key').value = '';
      $('new-value').value = '';
    };

    // Allow Enter in the add form
    [$('new-key'), $('new-value')].forEach(input => {
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') $('add-btn').click();
      });
    });
  });
}

document.addEventListener('DOMContentLoaded', loadCurrentTab);
