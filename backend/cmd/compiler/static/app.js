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

/* --- TABS LOGIC --- */
const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    // Remove active classes
    tabBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    // Add active to current
    btn.classList.add('active');
    const targetId = btn.getAttribute('data-target');
    document.getElementById(targetId).classList.add('active');
  });
});

/* --- CENTRAL LOG VIEWER LOGIC --- */
const togglePollingBtn = document.getElementById('togglePollingBtn');
const clearAllLogsBtn = document.getElementById('clearAllLogsBtn');
const pollingIndicator = document.getElementById('pollingIndicator');
const lastUpdateText = document.getElementById('lastUpdateText');
const centralLogsBody = document.getElementById('centralLogsBody');

const statTotal = document.getElementById('statTotal');
const statValid = document.getElementById('statValid');
const statInvalid = document.getElementById('statInvalid');
const statShown = document.getElementById('statShown');

const filterNivel = document.getElementById('filterNivel');
const filterModulo = document.getElementById('filterModulo');

let isPolling = true;
let centralLogsData = [];
let pollingInterval = null;

async function fetchCentralLogs() {
  try {
    const data = await api('/logs');
    centralLogsData = data.entries || [];
    statTotal.textContent = data.total || 0;
    statValid.textContent = data.valid || 0;
    statInvalid.textContent = data.invalid || 0;
    
    pollingIndicator.classList.add('active');
    if (isPolling) pollingIndicator.classList.add('polling');
    lastUpdateText.textContent = `Actualizado: ${new Date().toLocaleTimeString()}`;
    
    renderCentralLogs();
  } catch (err) {
    pollingIndicator.classList.remove('active', 'polling');
    lastUpdateText.textContent = 'Error de conexión';
  }
}

function renderCentralLogs() {
  const fNivel = filterNivel.value;
  const fModulo = filterModulo.value;
  
  const filtered = centralLogsData.filter(log => {
    if (fNivel !== 'ALL') {
      const nTok = (log.tokens || []).find(t => t.type === 'NIVEL');
      if (!nTok || nTok.value !== fNivel) return false;
    }
    if (fModulo !== 'ALL') {
      const mTok = (log.tokens || []).find(t => t.type === 'MODULO');
      if (!mTok || mTok.value !== fModulo) return false;
    }
    return true;
  });
  
  statShown.textContent = filtered.length;
  centralLogsBody.innerHTML = '';
  
  if (filtered.length === 0) {
    centralLogsBody.innerHTML = '<tr><td colspan="5" class="empty-msg" style="text-align:center; padding: 2rem; color: var(--muted)">No hay logs que coincidan</td></tr>';
    return;
  }
  
  filtered.forEach(log => {
    const isValid = log.estado === 'Válido';
    const tr = document.createElement('tr');
    
    let tokensHtml = '';
    (log.tokens || []).forEach(t => {
      const tClass = `badge-${t.type.toLowerCase()}`;
      tokensHtml += `<span class="log-badge ${tClass}">&lt;${t.type}&gt; ${t.value}</span>`;
    });
    
    const timeStr = log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '—';
    const statusHtml = `<span class="${isValid ? 'status-valid' : 'status-invalid'}">${isValid ? '✓ Válido' : '✗ Inválido'}</span>`;
    
    tr.innerHTML = `
      <td style="color:var(--muted); font-size:0.7rem;">${log.id}</td>
      <td style="color:var(--muted); font-size:0.7rem; white-space:nowrap;">${timeStr}</td>
      <td style="font-family: monospace;">${log.raw}</td>
      <td>${tokensHtml}</td>
      <td style="text-align: center;">${statusHtml}</td>
    `;
    centralLogsBody.appendChild(tr);
  });
}

function setupPolling() {
  if (pollingInterval) clearInterval(pollingInterval);
  if (isPolling) {
    pollingInterval = setInterval(fetchCentralLogs, 2000);
    pollingIndicator.classList.add('polling');
    togglePollingBtn.textContent = '⏸ Pausar';
  } else {
    pollingIndicator.classList.remove('polling');
    togglePollingBtn.textContent = '▶ Reanudar';
  }
}

togglePollingBtn.addEventListener('click', () => {
  isPolling = !isPolling;
  setupPolling();
});

clearAllLogsBtn.addEventListener('click', async () => {
  try {
    await api('/logs', { method: 'DELETE' });
    await fetchCentralLogs();
  } catch (err) {
    console.error('Error limpiando logs', err);
  }
});

filterNivel.addEventListener('change', renderCentralLogs);
filterModulo.addEventListener('change', renderCentralLogs);

// Initialize logs tab
fetchCentralLogs();
setupPolling();

