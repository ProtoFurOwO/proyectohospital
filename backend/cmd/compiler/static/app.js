const queryInput = document.getElementById('query');
const runBtn = document.getElementById('runBtn');
const clearBtn = document.getElementById('clearBtn');
const clearLogsBtn = document.getElementById('clearLogsBtn');
const tokensBody = document.getElementById('tokensBody');
const logsEl = document.getElementById('logs');
const resultEl = document.getElementById('result');
const examplesEl = document.getElementById('examples');

const EXAMPLES = [
  'CREATE DATABASE hospital;',
  'USE hospital;',
  'CREATE TABLE pacientes (id INT PRIMARY KEY, nombre VARCHAR);',
  'SHOW DATABASES;',
  'SHOW TABLES;'
];

queryInput.value = EXAMPLES[0];

EXAMPLES.forEach((example) => {
  const button = document.createElement('button');
  button.textContent = example.length > 35 ? `${example.slice(0, 35)}...` : example;
  button.title = example;
  button.addEventListener('click', () => {
    queryInput.value = example;
    tokenize();
  });
  examplesEl.appendChild(button);
});

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json();
}

function renderResult(success, message) {
  resultEl.classList.remove('hidden', 'ok', 'err');
  resultEl.classList.add(success ? 'ok' : 'err');
  resultEl.innerHTML = `<strong>${success ? 'EXITO' : 'ERROR'}:</strong> ${message}`;
}

function renderTokens(tokens) {
  tokensBody.innerHTML = '';

  if (!tokens || tokens.length === 0) {
    const row = document.createElement('tr');
    row.innerHTML = '<td colspan="4">Sin tokens</td>';
    tokensBody.appendChild(row);
    return;
  }

  tokens.forEach((token) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${token.type || ''}</td>
      <td>${token.value || ''}</td>
      <td>${token.line || ''}</td>
      <td>${token.column || ''}</td>
    `;
    tokensBody.appendChild(row);
  });
}

function renderLogs(logs) {
  logsEl.innerHTML = '';

  if (!logs || logs.length === 0) {
    logsEl.textContent = 'No hay logs aun.';
    return;
  }

  const orderedLogs = [...logs].reverse();

  orderedLogs.forEach((entry) => {
    const line = document.createElement('div');
    line.className = `log ${entry.level || ''}`;

    const time = new Date(entry.timestamp).toLocaleTimeString();
    line.innerHTML = `<strong>[${entry.level}]</strong> ${entry.message} <span>(${time})</span>`;
    logsEl.appendChild(line);
  });
}

async function tokenize() {
  const query = queryInput.value.trim();
  if (!query) {
    renderTokens([]);
    return;
  }

  try {
    const payload = await api('/sql/tokenize', {
      method: 'POST',
      body: JSON.stringify({ query })
    });
    renderTokens(payload.tokens || []);
  } catch {
    renderTokens([]);
  }
}

async function execute() {
  const query = queryInput.value.trim();
  if (!query) {
    return;
  }

  runBtn.disabled = true;
  runBtn.textContent = 'Ejecutando...';

  try {
    const payload = await api('/sql/execute', {
      method: 'POST',
      body: JSON.stringify({ query })
    });

    renderResult(payload.success, payload.message || 'Operacion completada');
    renderTokens(payload.tokens || []);
    await loadLogs();
  } catch {
    renderResult(false, 'No se pudo conectar con el servicio de compiladores.');
  } finally {
    runBtn.disabled = false;
    runBtn.textContent = 'Ejecutar (Ctrl+Enter)';
  }
}

async function clearLogs() {
  try {
    await api('/sql/logs', { method: 'DELETE' });
    await loadLogs();
  } catch {
    renderResult(false, 'No se pudieron limpiar los logs.');
  }
}

async function loadLogs() {
  try {
    const payload = await api('/sql/logs');
    renderLogs(payload || []);
  } catch {
    renderLogs([]);
  }
}

queryInput.addEventListener('input', () => {
  clearTimeout(window._tokenDebounce);
  window._tokenDebounce = setTimeout(tokenize, 250);
});

queryInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && event.ctrlKey) {
    execute();
  }
});

runBtn.addEventListener('click', execute);
clearBtn.addEventListener('click', () => {
  queryInput.value = '';
  resultEl.classList.add('hidden');
  renderTokens([]);
});
clearLogsBtn.addEventListener('click', clearLogs);

tokenize();
loadLogs();
