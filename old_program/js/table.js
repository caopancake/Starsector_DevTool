// ============= TABLE RENDERING =============

function getFilteredRows(tab) {
  if (!DATA || !DATA[tab]) return [];
  let rows = DATA[tab];
  // Faction filter
  if (currentFaction !== 'all') {
    rows = rows.filter(r => (r._faction || 'other') === currentFaction);
  }
  // Search filter
  if (searchText) {
    const s = searchText.toLowerCase();
    rows = rows.filter(r => {
      const name = (r.name || r.id || '').toLowerCase();
      const id = (r.id || '').toLowerCase();
      return name.includes(s) || id.includes(s);
    });
  }
  return rows;
}

function getRowOriginalIndex(tab, row) {
  return DATA[tab].indexOf(row);
}

function renderTable() {
  if (!DATA) return;
  const wrap = document.getElementById('tableWrap');
  const cols = getColumnsForTab(currentTab);
  const rows = getFilteredRows(currentTab);
  const hasActions = (currentTab === 'ships' || currentTab === 'weapons');

  let html = '<table class="data-table"><thead><tr>';
  if (hasActions) html += '<th style="width:80px">操作</th>';
  cols.forEach(col => {
    const ss = sortState[currentTab];
    let arrow = '';
    if (ss && ss.col === col) arrow = ss.asc ? ' ▲' : ' ▼';
    html += `<th onclick="sortBy('${col}')">${col}<span class="sort-arrow">${arrow}</span></th>`;
  });
  html += '</tr></thead><tbody>';

  rows.forEach((row) => {
    const rowIdx = getRowOriginalIndex(currentTab, row);
    const rowId = row.id || '';
    const isSelected = rowId && rowId === selectedRowId;
    html += `<tr style="${isSelected?'background:#1e293b':''}" onclick="selectedRowId='${escHtml(rowId)}';document.querySelectorAll('.data-table tr').forEach(r=>r.style.background='');this.style.background='#1e293b'">`;
    if (hasActions) {
      if (currentTab === 'ships') {
        html += `<td class="row-actions"><button onclick="event.stopPropagation();openShipEditor('${escHtml(rowId)}')">编辑</button></td>`;
      } else if (currentTab === 'weapons') {
        html += `<td class="row-actions">
          <button onclick="event.stopPropagation();openWeaponEditor('${escHtml(rowId)}')">编辑</button>
          <button onclick="event.stopPropagation();openBallisticPreview('${escHtml(rowId)}')" style="background:var(--purple)">预览</button>
        </td>`;
      }
    }
    cols.forEach(col => {
      const val = row[col] !== undefined ? row[col] : '';
      const isChanged = changes[currentTab] && changes[currentTab][rowIdx] && changes[currentTab][rowIdx][col] !== undefined;
      const cls = isChanged ? 'changed' : '';
      html += `<td class="${cls}" data-row="${rowIdx}" data-col="${col}" onclick="startEdit(this)">${escHtml(String(val))}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody></table>';
  wrap.innerHTML = html;

  document.getElementById('tableInfo').textContent = `显示 ${rows.length} / ${DATA[currentTab].length} 行`;
  updateFloatActions();
}

// ============= CELL EDITING =============
function startEdit(td) {
  if (td.classList.contains('editing')) return;
  const rowIdx = parseInt(td.dataset.row);
  const col = td.dataset.col;
  const currentVal = DATA[currentTab][rowIdx][col] !== undefined ? String(DATA[currentTab][rowIdx][col]) : '';

  td.classList.add('editing');
  const input = document.createElement('input');
  input.type = 'text';
  input.value = currentVal;
  td.textContent = '';
  td.appendChild(input);
  input.focus();
  input.select();

  const finish = () => {
    const newVal = input.value;
    td.classList.remove('editing');
    td.textContent = newVal;

    // Check if actually changed from original
    const origVal = String(originalData[currentTab][rowIdx][col] !== undefined ? originalData[currentTab][rowIdx][col] : '');
    if (newVal !== origVal) {
      if (!changes[currentTab][rowIdx]) changes[currentTab][rowIdx] = {};
      changes[currentTab][rowIdx][col] = newVal;
      DATA[currentTab][rowIdx][col] = newVal;
      td.classList.add('changed');
    } else {
      if (changes[currentTab][rowIdx]) {
        delete changes[currentTab][rowIdx][col];
        if (Object.keys(changes[currentTab][rowIdx]).length === 0) delete changes[currentTab][rowIdx];
      }
      DATA[currentTab][rowIdx][col] = newVal;
      td.classList.remove('changed');
    }
    updateFloatActions();
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { input.blur(); }
    if (e.key === 'Escape') { input.value = currentVal; input.blur(); }
  });
}

// ============= SORT =============
function sortBy(col) {
  const ss = sortState[currentTab];
  if (ss && ss.col === col) {
    ss.asc = !ss.asc;
  } else {
    sortState[currentTab] = {col, asc: true};
  }
  const asc = sortState[currentTab].asc;
  DATA[currentTab].sort((a, b) => {
    let va = a[col], vb = b[col];
    if (va === undefined) va = '';
    if (vb === undefined) vb = '';
    const na = parseFloat(va), nb = parseFloat(vb);
    if (!isNaN(na) && !isNaN(nb)) return asc ? na - nb : nb - na;
    return asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });
  // Also re-sort original to keep indices aligned
  originalData[currentTab].sort((a, b) => {
    let va = a[col], vb = b[col];
    if (va === undefined) va = '';
    if (vb === undefined) vb = '';
    const na = parseFloat(va), nb = parseFloat(vb);
    if (!isNaN(na) && !isNaN(nb)) return asc ? na - nb : nb - na;
    return asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
  });
  // Reset changes tracking after sort (indices changed)
  changes[currentTab] = {};
  renderTable();
}
