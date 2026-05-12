// ============= BALLISTIC PREVIEW STATE =============
let previewRunning = false;
let previewSpeed = 1;
let previewProjectiles = [];
let previewBeams = [];
let previewLastTime = 0;
let previewFireTimer = 0;
let previewBurstCounter = 0;
let previewBarrelIndex = 0;
let previewCanvas = null;
let previewCtx = null;
let previewAnimId = null;

// Weapon parameters gathered from DATA
let previewParams = {
  specClass: 'projectile',
  range: 600,
  projSpeed: 800,
  damagePerShot: 100,
  burstSize: 1,
  burstDelay: 0,
  chargeup: 0,
  chargedown: 0.5,
  minSpread: 0,
  maxSpread: 0,
  barrelMode: 'ALTERNATING',
  barrelCount: 1,
  barrelOffsets: [],
  // Beam params
  beamWidth: 10,
  fringeColor: [255, 100, 100, 255],
  coreColor: [255, 255, 255, 255],
  textureScrollSpeed: 200,
  // Projectile visual
  projLength: 20,
  projWidth: 4,
  projFringeColor: [255, 100, 50, 200],
  projCoreColor: [255, 255, 200, 255],
  spawnType: 'BALLISTIC',
  // Missile params
  missileType: null,
  missileAcc: 0,
  missileMaxSpeed: 0,
  missileSize: [10, 10],
  explosionRadius: 50,
  explosionColor: [255, 200, 50, 255]
};

// Layout constants
const PV_WEAPON_X = 80;
const PV_TOP_MARGIN = 40;
const PV_BOTTOM_MARGIN = 40;

// ============= OPEN / CLOSE =============
function openBallisticPreview(weaponId) {
  if (!weaponId) return;

  // Gather weapon CSV data
  const csvRow = (DATA.weapons || []).find(r => r.id === weaponId);
  const wpnFile = DATA.wpnFiles ? DATA.wpnFiles[weaponId] : null;

  if (!wpnFile) {
    // No .wpn file - still allow preview using CSV data with defaults
    previewParams.specClass = 'projectile';
  } else {
    previewParams.specClass = wpnFile.specClass || 'projectile';
  }
  previewParams.range = parseFloat((csvRow && csvRow['range']) || 600) || 600;
  previewParams.projSpeed = parseFloat((csvRow && csvRow['proj speed']) || 800) || 800;
  previewParams.damagePerShot = parseFloat((csvRow && csvRow['damage/shot']) || 100) || 100;
  previewParams.burstSize = parseInt((csvRow && csvRow['burst size']) || 1) || 1;
  previewParams.burstDelay = parseFloat((csvRow && csvRow['burst delay']) || 0) || 0;
  previewParams.chargeup = parseFloat((csvRow && csvRow['chargeup']) || 0) || 0;
  previewParams.chargedown = parseFloat((csvRow && csvRow['chargedown']) || 0.5) || 0.5;
  previewParams.minSpread = parseFloat((csvRow && csvRow['min spread']) || 0) || 0;
  previewParams.maxSpread = parseFloat((csvRow && csvRow['max spread']) || 0) || 0;

  // Extract from .wpn file (may be null for weapons without .wpn)
  previewParams.barrelMode = (wpnFile && wpnFile.barrelMode) || 'ALTERNATING';
  const offsets = (wpnFile && wpnFile.turretOffsets) || [10, 0];
  previewParams.barrelCount = Math.floor(offsets.length / 2);
  previewParams.barrelOffsets = [];
  for (let i = 0; i < previewParams.barrelCount; i++) {
    previewParams.barrelOffsets.push({x: offsets[i * 2], y: offsets[i * 2 + 1]});
  }
  if (previewParams.barrelCount === 0) {
    previewParams.barrelCount = 1;
    previewParams.barrelOffsets = [{x: 0, y: 0}];
  }

  // Beam params from .wpn
  previewParams.beamWidth = (wpnFile && wpnFile.width) || 10;
  previewParams.fringeColor = (wpnFile && wpnFile.fringeColor) || [255, 100, 100, 255];
  previewParams.coreColor = (wpnFile && wpnFile.coreColor) || [255, 255, 255, 255];
  previewParams.textureScrollSpeed = (wpnFile && wpnFile.textureScrollSpeed) || 200;

  // Projectile params from .proj file
  const projId = wpnFile ? wpnFile.projectileSpecId : null;
  const projFile = (projId && DATA.projFiles) ? DATA.projFiles[projId] : null;
  if (projFile) {
    previewParams.projLength = projFile.length || 20;
    previewParams.projWidth = projFile.width || 4;
    previewParams.projFringeColor = projFile.fringeColor || [255, 100, 50, 200];
    previewParams.projCoreColor = projFile.coreColor || [255, 255, 200, 255];
    previewParams.spawnType = projFile.spawnType || 'BALLISTIC';

    if (projFile.specClass === 'missile') {
      previewParams.missileType = projFile.missileType || 'MISSILE';
      const eng = projFile.engineSpec || {};
      previewParams.missileAcc = eng.acc || 200;
      previewParams.missileMaxSpeed = eng.maxSpeed || previewParams.projSpeed;
      previewParams.missileSize = projFile.size || [10, 10];
      previewParams.explosionRadius = projFile.explosionRadius || 50;
      previewParams.explosionColor = projFile.explosionColor || [255, 200, 50, 255];
    } else {
      previewParams.missileType = null;
    }
  } else {
    previewParams.projLength = 20;
    previewParams.projWidth = 4;
    previewParams.projFringeColor = [255, 100, 50, 200];
    previewParams.projCoreColor = [255, 255, 200, 255];
    previewParams.spawnType = 'BALLISTIC';
    previewParams.missileType = null;
  }

  // Compute DPS
  let dps = 0;
  const totalCycleTime = previewParams.chargeup + previewParams.chargedown + (previewParams.burstSize - 1) * previewParams.burstDelay;
  if (totalCycleTime > 0) {
    dps = (previewParams.damagePerShot * previewParams.burstSize) / totalCycleTime;
  }

  // Show modal
  document.getElementById('previewTitle').textContent = '弹道预览: ' + weaponId;
  document.getElementById('previewStats').textContent =
    `射程: ${previewParams.range} | 弹速: ${previewParams.projSpeed} | DPS: ${dps.toFixed(1)}`;
  document.getElementById('ballisticPreviewModal').classList.add('show');

  // Init canvas
  previewCanvas = document.getElementById('previewCanvas');
  previewCtx = previewCanvas.getContext('2d');
  const container = previewCanvas.parentElement;
  const rect = container.getBoundingClientRect();
  previewCanvas.width = rect.width;
  previewCanvas.height = rect.height;

  // Reset state
  previewProjectiles = [];
  previewBeams = [];
  previewFireTimer = previewParams.chargeup;
  previewBurstCounter = 0;
  previewBarrelIndex = 0;
  previewSpeed = 1;
  previewRunning = true;
  previewLastTime = 0;

  // Update speed buttons
  document.querySelectorAll('#ballisticPreviewModal .mode-btn').forEach(b => {
    if (b.textContent.includes('x')) {
      b.classList.toggle('active', b.textContent === '1x');
    }
  });
  document.getElementById('previewPlayBtn').textContent = '暂停';

  // Start animation
  if (previewAnimId) cancelAnimationFrame(previewAnimId);
  previewAnimId = requestAnimationFrame(previewFrame);
}

function closeBallisticPreview() {
  previewRunning = false;
  if (previewAnimId) { cancelAnimationFrame(previewAnimId); previewAnimId = null; }
  document.getElementById('ballisticPreviewModal').classList.remove('show');
}

function togglePreview() {
  previewRunning = !previewRunning;
  document.getElementById('previewPlayBtn').textContent = previewRunning ? '暂停' : '播放';
  if (previewRunning) {
    previewLastTime = 0;
    previewAnimId = requestAnimationFrame(previewFrame);
  }
}

function setPreviewSpeed(speed) {
  previewSpeed = speed;
  document.querySelectorAll('#ballisticPreviewModal .mode-btn').forEach(b => {
    if (b.textContent.includes('x')) {
      b.classList.toggle('active', parseFloat(b.textContent) === speed);
    }
  });
}

function resetPreview() {
  previewProjectiles = [];
  previewBeams = [];
  previewFireTimer = previewParams.chargeup;
  previewBurstCounter = 0;
  previewBarrelIndex = 0;
  previewLastTime = 0;
  if (!previewRunning) {
    previewRunning = true;
    document.getElementById('previewPlayBtn').textContent = '暂停';
    previewAnimId = requestAnimationFrame(previewFrame);
  }
}

// ============= ANIMATION FRAME =============
function previewFrame(timestamp) {
  if (!previewRunning) return;

  if (previewLastTime === 0) previewLastTime = timestamp;
  const rawDt = (timestamp - previewLastTime) / 1000;
  const dt = rawDt * previewSpeed;
  previewLastTime = timestamp;

  // Prevent huge dt from tab switching
  const clampedDt = Math.min(dt, 0.1);

  if (previewParams.specClass === 'beam') {
    updateBeamPreview(clampedDt);
  } else if (previewParams.missileType) {
    updateMissilePreview(clampedDt);
  } else {
    updateProjectilePreview(clampedDt);
  }

  drawPreview();

  previewAnimId = requestAnimationFrame(previewFrame);
}

// ============= PROJECTILE UPDATE =============
function updateProjectilePreview(dt) {
  const params = previewParams;
  const flightTime = params.range / params.projSpeed;

  // Fire logic
  previewFireTimer -= dt;
  if (previewFireTimer <= 0) {
    // Fire a shot
    fireProjectile();
    previewBurstCounter++;

    if (previewBurstCounter >= params.burstSize) {
      // Burst complete, wait for chargedown + chargeup
      previewFireTimer = params.chargedown + params.chargeup;
      previewBurstCounter = 0;
    } else {
      // Next in burst
      previewFireTimer = params.burstDelay;
    }
  }

  // Update positions
  previewProjectiles.forEach(p => {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.age += dt;
  });

  // Remove expired (beyond range or flight time)
  const rangePixels = getScaledRange();
  previewProjectiles = previewProjectiles.filter(p => {
    return (p.x - PV_WEAPON_X) < rangePixels + 50 && p.age < flightTime + 0.5;
  });
}

function fireProjectile() {
  const params = previewParams;
  const canvasH = previewCanvas.height;
  const centerY = canvasH / 2;

  // Get barrel position
  const barrel = params.barrelOffsets[previewBarrelIndex] || {x: 0, y: 0};

  // Advance barrel for ALTERNATING mode
  if (params.barrelMode === 'ALTERNATING') {
    previewBarrelIndex = (previewBarrelIndex + 1) % params.barrelCount;
  }

  // Calculate spawn position
  // barrel.x = forward = rightward in preview, barrel.y = sideways = vertical in preview
  const scale = getPixelScale();
  const spawnX = PV_WEAPON_X + barrel.x * scale;
  const spawnY = centerY - barrel.y * scale;

  // Spread angle
  const spreadRange = params.maxSpread - params.minSpread;
  const spread = params.minSpread + Math.random() * spreadRange;
  const angleRad = (Math.random() - 0.5) * spread * Math.PI / 180;

  const speed = params.projSpeed * getPixelScale();
  const vx = speed * Math.cos(angleRad);
  const vy = speed * Math.sin(angleRad);

  if (params.barrelMode === 'LINKED') {
    // Fire from all barrels simultaneously
    for (let i = 0; i < params.barrelCount; i++) {
      const b = params.barrelOffsets[i] || {x: 0, y: 0};
      const sx = PV_WEAPON_X + b.x * scale;
      const sy = centerY - b.y * scale;
      const sAngle = (Math.random() - 0.5) * spread * Math.PI / 180;
      const svx = speed * Math.cos(sAngle);
      const svy = speed * Math.sin(sAngle);
      previewProjectiles.push({
        x: sx, y: sy, vx: svx, vy: svy, age: 0,
        length: params.projLength, width: params.projWidth,
        fringeColor: params.projFringeColor, coreColor: params.projCoreColor,
        isBeamLike: params.spawnType === 'BALLISTIC_AS_BEAM'
      });
    }
  } else {
    previewProjectiles.push({
      x: spawnX, y: spawnY, vx: vx, vy: vy, age: 0,
      length: params.projLength, width: params.projWidth,
      fringeColor: params.projFringeColor, coreColor: params.projCoreColor,
      isBeamLike: params.spawnType === 'BALLISTIC_AS_BEAM'
    });
  }
}

// ============= MISSILE UPDATE =============
function updateMissilePreview(dt) {
  const params = previewParams;
  const flightTime = params.range / Math.max(params.missileMaxSpeed, params.projSpeed, 1);

  // Fire logic (same as projectile)
  previewFireTimer -= dt;
  if (previewFireTimer <= 0) {
    fireMissile();
    previewBurstCounter++;
    if (previewBurstCounter >= params.burstSize) {
      previewFireTimer = params.chargedown + params.chargeup;
      previewBurstCounter = 0;
    } else {
      previewFireTimer = params.burstDelay;
    }
  }

  // Update missile physics
  const rangePixels = getScaledRange();
  const scale = getPixelScale();
  const maxSpeedPx = params.missileMaxSpeed * scale;
  const accPx = params.missileAcc * scale;

  previewProjectiles.forEach(p => {
    // Accelerate
    if (p.speed < maxSpeedPx) {
      p.speed = Math.min(maxSpeedPx, p.speed + accPx * dt);
    }
    p.vx = p.speed * Math.cos(p.angle);
    p.vy = p.speed * Math.sin(p.angle);
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.age += dt;

    // Trail
    p.trail.push({x: p.x, y: p.y});
    if (p.trail.length > 30) p.trail.shift();

    // Check if hit range
    if ((p.x - PV_WEAPON_X) >= rangePixels && !p.exploding) {
      p.exploding = true;
      p.explosionAge = 0;
    }
    if (p.exploding) {
      p.explosionAge += dt;
    }
  });

  // Remove expired
  previewProjectiles = previewProjectiles.filter(p => {
    if (p.exploding && p.explosionAge > 0.5) return false;
    if (p.age > flightTime + 2) return false;
    return true;
  });
}

function fireMissile() {
  const params = previewParams;
  const canvasH = previewCanvas.height;
  const centerY = canvasH / 2;
  const scale = getPixelScale();

  const barrel = params.barrelOffsets[previewBarrelIndex] || {x: 0, y: 0};
  if (params.barrelMode === 'ALTERNATING') {
    previewBarrelIndex = (previewBarrelIndex + 1) % params.barrelCount;
  }

  const spawnX = PV_WEAPON_X + barrel.x * scale;
  const spawnY = centerY - barrel.y * scale;

  const spreadRange = params.maxSpread - params.minSpread;
  const spread = params.minSpread + Math.random() * spreadRange;
  const angleRad = (Math.random() - 0.5) * spread * Math.PI / 180;

  const initialSpeed = params.projSpeed * scale * 0.3; // Missiles start slower

  const createMissile = (sx, sy, ang) => {
    previewProjectiles.push({
      x: sx, y: sy, vx: 0, vy: 0,
      speed: initialSpeed, angle: ang, age: 0,
      trail: [],
      exploding: false, explosionAge: 0,
      isMissile: true
    });
  };

  if (params.barrelMode === 'LINKED') {
    for (let i = 0; i < params.barrelCount; i++) {
      const b = params.barrelOffsets[i] || {x: 0, y: 0};
      const sx = PV_WEAPON_X + b.x * scale;
      const sy = centerY - b.y * scale;
      const sAngle = (Math.random() - 0.5) * spread * Math.PI / 180;
      createMissile(sx, sy, sAngle);
    }
  } else {
    createMissile(spawnX, spawnY, angleRad);
  }
}

// ============= BEAM UPDATE =============
function updateBeamPreview(dt) {
  const params = previewParams;

  // Beam state
  if (previewBeams.length === 0) {
    // Initialize beam state
    previewBeams.push({
      phase: 'chargeup',
      timer: params.chargeup,
      widthFactor: 0,
      textureOffset: 0
    });
  }

  const beam = previewBeams[0];
  beam.textureOffset += params.textureScrollSpeed * dt;

  if (beam.phase === 'chargeup') {
    beam.timer -= dt;
    beam.widthFactor = Math.min(1, 1 - (beam.timer / Math.max(params.chargeup, 0.01)));
    if (beam.timer <= 0) {
      beam.phase = 'firing';
      beam.widthFactor = 1;
      beam.timer = 999; // Continuous
    }
  } else if (beam.phase === 'firing') {
    beam.widthFactor = 1;
    // Add slight pulsing
    beam.widthFactor = 0.9 + 0.1 * Math.sin(beam.textureOffset * 0.05);
  }
}

// ============= DRAWING =============
function drawPreview() {
  if (!previewCtx || !previewCanvas) return;
  const ctx = previewCtx;
  const w = previewCanvas.width;
  const h = previewCanvas.height;

  // Clear
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#080c14';
  ctx.fillRect(0, 0, w, h);

  // Draw subtle grid
  ctx.strokeStyle = '#1e293b33';
  ctx.lineWidth = 0.5;
  const gridStep = 50;
  for (let x = PV_WEAPON_X; x < w; x += gridStep) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
  }

  const centerY = h / 2;
  const rangePixels = getScaledRange();
  const rangeEndX = PV_WEAPON_X + rangePixels;

  // Draw range marker
  ctx.beginPath();
  ctx.moveTo(rangeEndX, PV_TOP_MARGIN);
  ctx.lineTo(rangeEndX, h - PV_BOTTOM_MARGIN);
  ctx.strokeStyle = '#ef444488';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Range label
  ctx.fillStyle = '#ef444488';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${previewParams.range}`, rangeEndX, PV_TOP_MARGIN - 6);

  // Draw weapon icon
  drawWeaponIcon(ctx, PV_WEAPON_X, centerY);

  // Draw content based on type
  if (previewParams.specClass === 'beam') {
    drawBeamPreview(ctx, centerY, rangePixels);
  } else if (previewParams.missileType) {
    drawMissilePreview(ctx, centerY);
  } else {
    drawProjectilePreview(ctx, centerY);
  }
}

function drawWeaponIcon(ctx, x, y) {
  // Simple weapon representation
  ctx.save();
  ctx.translate(x, y);

  // Body
  ctx.fillStyle = '#374151';
  ctx.strokeStyle = '#6b7280';
  ctx.lineWidth = 1;
  ctx.fillRect(-15, -10, 30, 20);
  ctx.strokeRect(-15, -10, 30, 20);

  // Barrel(s) - draw all barrel positions
  const scale = getPixelScale();
  const params = previewParams;
  ctx.fillStyle = '#9ca3af';
  for (let i = 0; i < params.barrelCount; i++) {
    const b = params.barrelOffsets[i] || {x: 0, y: 0};
    const bx = b.x * scale;
    const by = -b.y * scale;
    ctx.fillRect(bx, by - 2, 12, 4);
  }

  // Muzzle indicator
  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.arc(15, 0, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawProjectilePreview(ctx, centerY) {
  const scale = getPixelScale();

  previewProjectiles.forEach(p => {
    const angle = Math.atan2(p.vy, p.vx);

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);

    if (p.isBeamLike) {
      // Draw as a line/ray
      const len = p.length * scale * 0.5;
      const wid = p.width * scale * 0.3;

      // Outer fringe
      ctx.fillStyle = pvColorToRgba(p.fringeColor, 0.6);
      ctx.fillRect(-len / 2, -wid, len, wid * 2);

      // Core
      ctx.fillStyle = pvColorToRgba(p.coreColor, 0.9);
      ctx.fillRect(-len / 2, -wid * 0.4, len, wid * 0.8);
    } else {
      // Draw as elongated projectile
      const len = Math.max(p.length * scale * 0.15, 4);
      const wid = Math.max(p.width * scale * 0.15, 2);

      // Outer fringe
      ctx.fillStyle = pvColorToRgba(p.fringeColor, 0.7);
      ctx.beginPath();
      ctx.ellipse(0, 0, len, wid, 0, 0, Math.PI * 2);
      ctx.fill();

      // Core (brighter, smaller)
      ctx.fillStyle = pvColorToRgba(p.coreColor, 0.9);
      ctx.beginPath();
      ctx.ellipse(0, 0, len * 0.6, wid * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();

      // Glow
      ctx.shadowColor = pvColorToRgba(p.fringeColor, 0.5);
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.ellipse(0, 0, len * 0.3, wid * 0.3, 0, 0, Math.PI * 2);
      ctx.fillStyle = pvColorToRgba(p.coreColor, 1);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  });
}

function drawMissilePreview(ctx, centerY) {
  const scale = getPixelScale();
  const params = previewParams;
  const missileW = (params.missileSize[0] || 10) * scale * 0.15;
  const missileH = (params.missileSize[1] || 6) * scale * 0.15;

  previewProjectiles.forEach(p => {
    if (p.exploding) {
      // Draw explosion
      const expRadius = params.explosionRadius * scale * 0.1 * Math.min(1, p.explosionAge * 4);
      const alpha = Math.max(0, 1 - p.explosionAge * 2);
      const ec = params.explosionColor;

      ctx.beginPath();
      ctx.arc(p.x, p.y, expRadius, 0, Math.PI * 2);
      ctx.fillStyle = pvColorToRgba(ec, alpha * 0.4);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(p.x, p.y, expRadius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = pvColorToRgba([255, 255, 200, 255], alpha * 0.8);
      ctx.fill();
      return;
    }

    // Draw trail
    if (p.trail.length > 1) {
      ctx.beginPath();
      ctx.moveTo(p.trail[0].x, p.trail[0].y);
      for (let i = 1; i < p.trail.length; i++) {
        ctx.lineTo(p.trail[i].x, p.trail[i].y);
      }
      ctx.strokeStyle = '#f59e0b44';
      ctx.lineWidth = Math.max(missileH * 0.5, 2);
      ctx.stroke();

      // Engine glow at tail
      const tail = p.trail[0];
      ctx.beginPath();
      ctx.arc(tail.x, tail.y, missileH * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = '#f59e0b66';
      ctx.fill();
    }

    // Draw missile body
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);

    // Body
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(-missileW, -missileH / 2, missileW * 2, missileH);

    // Nose cone
    ctx.beginPath();
    ctx.moveTo(missileW, 0);
    ctx.lineTo(missileW - missileH * 0.4, -missileH / 2);
    ctx.lineTo(missileW - missileH * 0.4, missileH / 2);
    ctx.closePath();
    ctx.fillStyle = '#ef4444';
    ctx.fill();

    // Fins
    ctx.fillStyle = '#6b7280';
    ctx.fillRect(-missileW, -missileH, missileH * 0.3, missileH * 0.5);
    ctx.fillRect(-missileW, missileH * 0.5, missileH * 0.3, missileH * 0.5);

    ctx.restore();
  });
}

function drawBeamPreview(ctx, centerY, rangePixels) {
  if (previewBeams.length === 0) return;
  const beam = previewBeams[0];
  const params = previewParams;
  const scale = getPixelScale();

  const beamStartX = PV_WEAPON_X + 15;
  const beamEndX = PV_WEAPON_X + rangePixels;
  const beamWidth = params.beamWidth * scale * 0.15 * beam.widthFactor;

  if (beamWidth <= 0) return;

  // Draw from each barrel
  for (let i = 0; i < params.barrelCount; i++) {
    const barrel = params.barrelOffsets[i] || {x: 0, y: 0};
    const barrelY = centerY - barrel.y * scale;
    const startX = beamStartX + barrel.x * scale;

    // Glow (outer)
    const gradient = ctx.createLinearGradient(startX, barrelY - beamWidth * 2, startX, barrelY + beamWidth * 2);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.3, pvColorToRgba(params.fringeColor, 0.2));
    gradient.addColorStop(0.5, pvColorToRgba(params.fringeColor, 0.4));
    gradient.addColorStop(0.7, pvColorToRgba(params.fringeColor, 0.2));
    gradient.addColorStop(1, 'transparent');
    ctx.fillStyle = gradient;
    ctx.fillRect(startX, barrelY - beamWidth * 2, beamEndX - startX, beamWidth * 4);

    // Fringe layer
    ctx.fillStyle = pvColorToRgba(params.fringeColor, 0.7 * beam.widthFactor);
    ctx.fillRect(startX, barrelY - beamWidth, beamEndX - startX, beamWidth * 2);

    // Core layer
    const coreWidth = beamWidth * 0.5;
    ctx.fillStyle = pvColorToRgba(params.coreColor, 0.9 * beam.widthFactor);
    ctx.fillRect(startX, barrelY - coreWidth, beamEndX - startX, coreWidth * 2);

    // Texture scroll effect (animated stripes)
    const stripeSpacing = 20;
    const offset = beam.textureOffset % stripeSpacing;
    ctx.save();
    ctx.globalAlpha = 0.3 * beam.widthFactor;
    ctx.fillStyle = pvColorToRgba(params.coreColor, 1);
    for (let sx = startX + offset; sx < beamEndX; sx += stripeSpacing) {
      ctx.fillRect(sx, barrelY - coreWidth * 0.8, 3, coreWidth * 1.6);
    }
    ctx.restore();

    // Impact point glow
    ctx.beginPath();
    ctx.arc(beamEndX, barrelY, beamWidth * 1.5 * beam.widthFactor, 0, Math.PI * 2);
    ctx.fillStyle = pvColorToRgba(params.coreColor, 0.5 * beam.widthFactor);
    ctx.fill();
  }
}

// ============= UTILITY FUNCTIONS =============
function getPixelScale() {
  // Scale game units to pixel units on canvas
  // We want the range to fit within ~70% of canvas width
  if (!previewCanvas) return 0.5;
  const availableWidth = previewCanvas.width - PV_WEAPON_X - 60;
  return availableWidth / Math.max(previewParams.range, 100);
}

function getScaledRange() {
  return previewParams.range * getPixelScale();
}

function pvColorToRgba(colorArr, alpha) {
  if (!colorArr || colorArr.length < 3) return 'rgba(255,255,255,' + alpha + ')';
  const a = colorArr.length >= 4 ? (colorArr[3] / 255) * alpha : alpha;
  return `rgba(${colorArr[0]},${colorArr[1]},${colorArr[2]},${a.toFixed(3)})`;
}

// ============= WINDOW RESIZE =============
window.addEventListener('resize', () => {
  if (previewCanvas && document.getElementById('ballisticPreviewModal').classList.contains('show')) {
    const container = previewCanvas.parentElement;
    const rect = container.getBoundingClientRect();
    previewCanvas.width = rect.width;
    previewCanvas.height = rect.height;
    if (!previewRunning) drawPreview();
  }
});
