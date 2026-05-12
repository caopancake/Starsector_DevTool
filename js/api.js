// ============= API / SERVER COMMUNICATION =============

async function loadData() {
  try {
    const resp = await fetch('/api/data');
    if (!resp.ok) throw new Error('Server error: ' + resp.status);
    DATA = await resp.json();
    // Deep copy for revert
    originalData = {
      ships: JSON.parse(JSON.stringify(DATA.ships)),
      weapons: JSON.parse(JSON.stringify(DATA.weapons)),
      wings: JSON.parse(JSON.stringify(DATA.wings)),
      hullmods: JSON.parse(JSON.stringify(DATA.hullmods)),
      industries: JSON.parse(JSON.stringify(DATA.industries))
    };
    changes = {ships:{}, weapons:{}, wings:{}, hullmods:{}, industries:{}};
    buildFactionButtons();
  } catch(e) {
    document.getElementById('tableWrap').innerHTML = '<div class="loading" style="color:var(--error)">加载失败: ' + e.message + '</div>';
    console.error(e);
  }
}

async function saveChanges() {
  // Save all tabs that have changes
  for (const tab of Object.keys(changes)) {
    if (Object.keys(changes[tab]).length === 0) continue;
    const headers = DATA.csvHeaders ? DATA.csvHeaders[tab] : TABLE_COLUMNS[tab];
    const rows = DATA[tab];
    try {
      const resp = await fetch('/api/save_csv', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({table: tab, header: headers, rows: rows})
      });
      if (!resp.ok) throw new Error('Save failed: ' + resp.status);
      const csvPath = DATA.csvPaths ? DATA.csvPaths[tab] : tab;
      showToast(`已保存 ${csvPath}`, 'success');
    } catch(e) {
      showToast(`保存 ${tab} 失败: ${e.message}`, 'error');
      return;
    }
  }
  // Update originals
  originalData = {
    ships: JSON.parse(JSON.stringify(DATA.ships)),
    weapons: JSON.parse(JSON.stringify(DATA.weapons)),
    wings: JSON.parse(JSON.stringify(DATA.wings)),
    hullmods: JSON.parse(JSON.stringify(DATA.hullmods)),
    industries: JSON.parse(JSON.stringify(DATA.industries))
  };
  changes = {ships:{}, weapons:{}, wings:{}, hullmods:{}, industries:{}};
  renderTable();
}

async function saveShipFile() {
  if (!editorShip || !editorHullId) return;
  try {
    const resp = await fetch('/api/save_ship', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({hullId: editorHullId, data: editorShip})
    });
    if (!resp.ok) throw new Error('Save failed: ' + resp.status);
    // Update local cache
    DATA.shipFiles[editorHullId] = JSON.parse(JSON.stringify(editorShip));
    showToast(`已保存 ${editorHullId}.ship`, 'success');
  } catch(e) {
    showToast(`保存失败: ${e.message}`, 'error');
  }
}

function addNewRow() {
  const tab = currentTab;
  const headers = DATA.csvHeaders ? DATA.csvHeaders[tab] : TABLE_COLUMNS[tab];
  // Prompt for ID
  const newId = prompt(`输入新${tab === 'ships' ? '舰船' : tab === 'weapons' ? '武器' : tab === 'wings' ? '联队' : tab === 'hullmods' ? '船插' : '工业'} ID:`, 'new_' + tab + '_' + Date.now());
  if (!newId) return;
  const newRow = {};
  headers.forEach(h => newRow[h] = '');
  if (newRow.hasOwnProperty('id')) newRow['id'] = newId;
  if (newRow.hasOwnProperty('name')) newRow['name'] = newId;
  newRow['_faction'] = 'other';

  // For ships, also create a .ship file
  if (tab === 'ships') {
    const shipData = {
      hullId: newId, hullName: newId, hullSize: 'FRIGATE',
      style: 'LOW_TECH', width: 100, height: 150,
      center: [50, 75], collisionRadius: 80,
      shieldCenter: [0, 0], shieldRadius: 60,
      spriteName: '', viewOffset: 0,
      weaponSlots: [], engineSlots: [],
      bounds: [-60,-30, -60,30, 60,30, 60,-30],
      builtInMods: [], builtInWeapons: {}, builtInWings: []
    };
    DATA.shipFiles[newId] = shipData;
    DATA.shipSprites[newId] = '';
    // Save .ship to server
    fetch('/api/save_ship', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({hullId: newId, data: shipData})
    }).then(r => r.json()).then(d => {
      if (d.ok) showToast('已创建 ' + newId + '.ship', 'success');
    });
  }

  DATA[tab].push(newRow);
  // Also add to original for consistency
  originalData[tab].push(JSON.parse(JSON.stringify(newRow)));
  // Save to server
  fetch('/api/add_csv_row', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({table: tab, row: newRow})
  }).then(r => r.json()).then(d => {
    if (d.ok) showToast('已添加行: ' + newId, 'success');
    else showToast('添加失败', 'error');
  });
  renderTable();
}

function deleteSelectedRow() {
  if (!selectedRowId) {
    showToast('请先点击选中一行', 'error');
    return;
  }
  const tab = currentTab;
  if (!confirm(`确定删除 ${selectedRowId} 吗？此操作不可撤销。`)) return;

  // Remove from local data
  DATA[tab] = DATA[tab].filter(r => r.id !== selectedRowId);
  originalData[tab] = originalData[tab].filter(r => r.id !== selectedRowId);

  // If ships, also delete .ship file
  if (tab === 'ships') {
    delete DATA.shipFiles[selectedRowId];
    delete DATA.shipSprites[selectedRowId];
    fetch('/api/delete_ship', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({hullId: selectedRowId})
    });
  }

  // Delete from server CSV
  fetch('/api/delete_csv_row', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({table: tab, id: selectedRowId})
  }).then(r => r.json()).then(d => {
    if (d.ok) showToast('已删除: ' + selectedRowId, 'success');
    else showToast('删除失败: ' + (d.error||''), 'error');
  });

  selectedRowId = null;
  renderTable();
}

async function handleSpriteUpload(input) {
  if (!input.files || !input.files[0] || !editorShip) return;
  const file = input.files[0];
  if (!file.name.toLowerCase().endsWith('.png')) {
    showToast('只支持 PNG 格式', 'error'); return;
  }
  // Read file as base64
  const reader = new FileReader();
  reader.onload = async () => {
    const b64Full = reader.result; // data:image/png;base64,xxxx
    const b64Data = b64Full.split(',')[1]; // pure base64
    const filename = file.name;
    try {
      // First attempt: no overwrite
      let resp = await fetch('/api/upload_sprite', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({filename, data: b64Data, overwrite: false})
      });
      let result = await resp.json();
      // If file exists, ask user
      if (result.exists) {
        if (!confirm(result.message || `${filename} 已存在，是否覆盖？`)) {
          input.value = ''; return;
        }
        // Retry with overwrite
        resp = await fetch('/api/upload_sprite', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({filename, data: b64Data, overwrite: true})
        });
        result = await resp.json();
      }
      if (result.ok) {
        pushUndo();
        const spritePath = result.path;
        editorShip.spriteName = spritePath;
        showToast(`贴图已保存: ${spritePath}`, 'success');
        // Load the uploaded image
        editorImg = new Image();
        editorImg.src = b64Full;
        editorImg.onload = () => {
          editorShip.width = editorImg.width;
          editorShip.height = editorImg.height;
          if (!editorShip.center || (editorShip.center[0] === 0 && editorShip.center[1] === 0)) {
            editorShip.center = [Math.round(editorImg.width/2), Math.round(editorImg.height/2)];
          }
          const panel = document.getElementById('canvasPanel');
          const rect = panel.getBoundingClientRect();
          editorScale = Math.min((rect.width*0.6)/editorImg.width, (rect.height*0.6)/editorImg.height);
          DATA.shipSprites[editorHullId] = b64Full;
          if (!DATA.availableSprites.includes(spritePath)) DATA.availableSprites.push(spritePath);
          renderSidebar();
          drawCanvas();
        };
      } else if (result.error) {
        showToast('上传失败: ' + result.error, 'error');
      }
    } catch(e) {
      showToast('上传失败: ' + e.message, 'error');
    }
    input.value = '';
  };
  reader.readAsDataURL(file);
}

function changeSprite(spritePath) {
  if (!editorShip) return;
  pushUndo();
  editorShip.spriteName = spritePath;
  // Load new sprite image
  editorImg = new Image();
  if (spritePath) {
    editorImg.src = '/api/sprite/' + spritePath;
    editorImg.onload = () => {
      // Auto-set width/height from image
      editorShip.width = editorImg.width;
      editorShip.height = editorImg.height;
      if (!editorShip.center || (editorShip.center[0] === 0 && editorShip.center[1] === 0)) {
        editorShip.center = [Math.round(editorImg.width/2), Math.round(editorImg.height/2)];
      }
      // Recalculate scale
      const panel = document.getElementById('canvasPanel');
      const rect = panel.getBoundingClientRect();
      const sw = (rect.width * 0.6) / editorImg.width;
      const sh = (rect.height * 0.6) / editorImg.height;
      editorScale = Math.min(sw, sh);
      // Update sprite cache
      const canvas2 = document.createElement('canvas');
      canvas2.width = editorImg.width; canvas2.height = editorImg.height;
      canvas2.getContext('2d').drawImage(editorImg, 0, 0);
      DATA.shipSprites[editorHullId] = canvas2.toDataURL('image/png');
      renderSidebar();
      drawCanvas();
    };
  } else {
    editorImg = new Image();
    renderSidebar();
    drawCanvas();
  }
}

// ============= WEAPON / PROJECTILE API =============
async function loadWeaponFile(id) {
  try {
    const resp = await fetch('/api/wpn/' + encodeURIComponent(id));
    if (!resp.ok) return null;
    return await resp.json();
  } catch(e) { console.error('[API] loadWeaponFile:', e); return null; }
}

async function saveWeaponFileToServer(id, data) {
  try {
    const clean = {}; for (const k in data) { if (!k.startsWith('_')) clean[k] = data[k]; }
    const resp = await fetch('/api/save_wpn', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({id, data: clean})
    });
    const r = await resp.json();
    if (r.ok) { DATA.wpnFiles[id] = JSON.parse(JSON.stringify(data)); showToast('已保存 '+id+'.wpn','success'); }
    else showToast('保存失败: '+(r.error||''),'error');
    return r;
  } catch(e) { showToast('保存失败: '+e.message,'error'); return {error:e.message}; }
}

async function loadProjectileFile(id) {
  try {
    const resp = await fetch('/api/proj/' + encodeURIComponent(id));
    if (!resp.ok) return null;
    return await resp.json();
  } catch(e) { console.error('[API] loadProjectileFile:', e); return null; }
}

async function saveProjectileFileToServer(id, data) {
  try {
    const clean = {}; for (const k in data) { if (!k.startsWith('_')) clean[k] = data[k]; }
    const resp = await fetch('/api/save_proj', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({id, data: clean})
    });
    const r = await resp.json();
    if (r.ok) { DATA.projFiles[id] = JSON.parse(JSON.stringify(data)); showToast('已保存 '+id+'.proj','success'); }
    else showToast('保存失败: '+(r.error||''),'error');
    return r;
  } catch(e) { showToast('保存失败: '+e.message,'error'); return {error:e.message}; }
}
