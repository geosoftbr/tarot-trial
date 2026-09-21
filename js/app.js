/**
 * app.js — interface e fluxo do app (câmera → recorte → reconhecimento →
 * confirmação → leitura). Todo o processamento de imagem acontece no
 * aparelho (geometry.js / recognizer.js); nada é enviado para a rede.
 */
(function () {
  'use strict';

  const CARD_W = 420, CARD_H = 588; // proporção 2.5:3.5, mesma do guia da câmera
  const MAX_PHOTO_DIM = 1280;

  const $ = (sel) => document.querySelector(sel);
  const screens = {};
  document.querySelectorAll('.screen').forEach(el => { screens[el.id] = el; });

  function showScreen(id) {
    Object.values(screens).forEach(el => el.classList.remove('active'));
    screens[id].classList.add('active');
  }

  // ------------------------------------------------------------------
  // Estado
  // ------------------------------------------------------------------
  const state = {
    spreadSize: 1,
    cardIndex: 0,
    captured: [],       // [{dataURL, rank, suit, reversed, confidence}]
    stream: null,
    photoImageData: null, // foto atual (ImageData), resolução de trabalho
    quad: null,          // [x0,y0,x1,y1,x2,y2,x3,y3] em pixels da foto
    stage: null,          // {scale, offsetX, offsetY, stageW, stageH}
    dragIndex: -1,
    pickerSuit: null,
    currentResult: null, // {rank, suit, confidence}
  };

  // ------------------------------------------------------------------
  // HOME
  // ------------------------------------------------------------------
  document.querySelectorAll('.spread-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.spread-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.spreadSize = parseInt(btn.dataset.spread, 10);
    });
  });

  $('#btn-start').addEventListener('click', () => {
    state.cardIndex = 0;
    state.captured = [];
    goToCapture();
  });

  document.querySelectorAll('[data-action="back-home"]').forEach(b => b.addEventListener('click', () => {
    stopCamera();
    showScreen('screen-home');
  }));

  // ------------------------------------------------------------------
  // CAPTURA
  // ------------------------------------------------------------------
  const video = $('#video');
  const cameraHint = $('#camera-hint');
  const cameraError = $('#camera-error');

  function positionLabel(i) {
    if (state.spreadSize === 1) return 'Carta 1 de 1';
    const pos = (typeof POSITIONS_3 !== 'undefined') ? POSITIONS_3[i] : null;
    return pos ? `Carta ${i + 1} de 3 — ${pos.label}` : `Carta ${i + 1} de 3`;
  }

  async function goToCapture() {
    $('#capture-title').textContent = positionLabel(state.cardIndex);
    showScreen('screen-capture');
    cameraError.hidden = true;
    cameraHint.hidden = false;
    await startCamera();
  }

  async function startCamera() {
    stopCamera();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showCameraError();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 1280 } },
        audio: false,
      });
      state.stream = stream;
      video.srcObject = stream;
      video.hidden = false;
      await video.play().catch(() => {});
    } catch (err) {
      showCameraError();
    }
  }

  function showCameraError() {
    cameraError.hidden = false;
    cameraHint.hidden = true;
    video.hidden = true;
  }

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach(t => t.stop());
      state.stream = null;
    }
  }

  function downscaleCanvas(srcCanvas, maxDim) {
    const w = srcCanvas.width, h = srcCanvas.height;
    const scale = Math.min(1, maxDim / Math.max(w, h));
    if (scale >= 1) return srcCanvas;
    const c = document.createElement('canvas');
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    c.getContext('2d').drawImage(srcCanvas, 0, 0, c.width, c.height);
    return c;
  }

  function imageDataFromCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  }

  // geometry.js trabalha com objetos simples {width,height,data}; o canvas
  // exige uma instância real de ImageData para putImageData().
  function toRealImageData(obj) {
    if (typeof ImageData !== 'undefined' && obj instanceof ImageData) return obj;
    const arr = obj.data instanceof Uint8ClampedArray ? obj.data : new Uint8ClampedArray(obj.data);
    return new ImageData(arr, obj.width, obj.height);
  }

  $('#btn-shoot').addEventListener('click', () => {
    if (!video.videoWidth) return;
    const c = document.createElement('canvas');
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext('2d').drawImage(video, 0, 0);
    const small = downscaleCanvas(c, MAX_PHOTO_DIM);
    stopCamera();
    state.photoImageData = imageDataFromCanvas(small);
    goToAdjust();
  });

  $('#file-input').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      let bitmap;
      if (window.createImageBitmap) {
        bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      }
      const c = document.createElement('canvas');
      if (bitmap) {
        c.width = bitmap.width; c.height = bitmap.height;
        c.getContext('2d').drawImage(bitmap, 0, 0);
      } else {
        const img = await loadImageEl(file);
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
      }
      const small = downscaleCanvas(c, MAX_PHOTO_DIM);
      stopCamera();
      state.photoImageData = imageDataFromCanvas(small);
      goToAdjust();
    } catch (err) {
      alert('Não foi possível abrir essa imagem.');
    } finally {
      e.target.value = '';
    }
  });

  function loadImageEl(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => { resolve(img); URL.revokeObjectURL(url); };
      img.onerror = reject;
      img.src = url;
    });
  }

  // ------------------------------------------------------------------
  // AJUSTE DE RECORTE (arrastar 4 cantos)
  // ------------------------------------------------------------------
  const stageEl = $('#adjust-stage');
  const adjustCanvas = $('#adjust-canvas');
  const adjustSvg = $('#adjust-svg');
  const handles = [0, 1, 2, 3].map(i => $('#handle-' + i));

  function defaultQuad(imgW, imgH) {
    // mesma proporção da moldura-guia da câmera (62% da largura, 2.5:3.5)
    const w = imgW * 0.62;
    const h = w * (3.5 / 2.5);
    const cx = imgW / 2, cy = imgH / 2;
    const x0 = cx - w / 2, y0 = cy - h / 2, x1 = cx + w / 2, y1 = cy + h / 2;
    return [x0, y0, x1, y0, x1, y1, x0, y1];
  }

  function goToAdjust() {
    showScreen('screen-adjust');
    const img = state.photoImageData;

    let quad = null;
    try { quad = detectBrightQuad(img); } catch (e) { quad = null; }
    state.quad = quad || defaultQuad(img.width, img.height);

    requestAnimationFrame(() => layoutAdjustStage());
  }

  function layoutAdjustStage() {
    const img = state.photoImageData;
    const rect = stageEl.getBoundingClientRect();
    const stageW = Math.round(rect.width), stageH = Math.round(rect.height);
    const scale = Math.min(stageW / img.width, stageH / img.height);
    const drawW = img.width * scale, drawH = img.height * scale;
    const offsetX = (stageW - drawW) / 2, offsetY = (stageH - drawH) / 2;
    state.stage = { scale, offsetX, offsetY, stageW, stageH };

    adjustCanvas.width = stageW;
    adjustCanvas.height = stageH;
    const ctx = adjustCanvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, stageW, stageH);

    const off = document.createElement('canvas');
    off.width = img.width; off.height = img.height;
    off.getContext('2d').putImageData(img, 0, 0);
    ctx.drawImage(off, offsetX, offsetY, drawW, drawH);

    adjustSvg.setAttribute('viewBox', `0 0 ${stageW} ${stageH}`);
    renderHandles();
  }

  function photoToStage(x, y) {
    const s = state.stage;
    return [x * s.scale + s.offsetX, y * s.scale + s.offsetY];
  }
  function stageToPhoto(x, y) {
    const s = state.stage;
    return [(x - s.offsetX) / s.scale, (y - s.offsetY) / s.scale];
  }

  function renderHandles() {
    const q = state.quad;
    const pts = [];
    for (let i = 0; i < 4; i++) {
      const [sx, sy] = photoToStage(q[i * 2], q[i * 2 + 1]);
      handles[i].style.left = sx + 'px';
      handles[i].style.top = sy + 'px';
      pts.push(`${sx},${sy}`);
    }
    adjustSvg.innerHTML = `<polygon points="${pts.join(' ')}" fill="rgba(216,180,103,0.12)" stroke="#d8b467" stroke-width="2.5"/>`;
  }

  handles.forEach((h, i) => {
    h.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      h.setPointerCapture(e.pointerId);
      state.dragIndex = i;
    });
    h.addEventListener('pointermove', (e) => {
      if (state.dragIndex !== i) return;
      const rect = stageEl.getBoundingClientRect();
      const sx = clamp(e.clientX - rect.left, 0, state.stage.stageW);
      const sy = clamp(e.clientY - rect.top, 0, state.stage.stageH);
      const [px, py] = stageToPhoto(sx, sy);
      state.quad[i * 2] = clamp(px, 0, state.photoImageData.width);
      state.quad[i * 2 + 1] = clamp(py, 0, state.photoImageData.height);
      renderHandles();
    });
    h.addEventListener('pointerup', () => { state.dragIndex = -1; });
    h.addEventListener('pointercancel', () => { state.dragIndex = -1; });
  });

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  window.addEventListener('resize', () => {
    if (screens['screen-adjust'].classList.contains('active')) layoutAdjustStage();
  });

  $('#btn-retake').addEventListener('click', retake);
  document.querySelectorAll('[data-action="retake"]').forEach(b => b.addEventListener('click', retake));
  function retake() { goToCapture(); }

  $('#btn-confirm-crop').addEventListener('click', () => {
    const warped = warpPerspective(state.photoImageData, state.quad, CARD_W, CARD_H);
    goToReview(warped);
  });

  // ------------------------------------------------------------------
  // REVISÃO / CONFIRMAÇÃO
  // ------------------------------------------------------------------
  const reviewCanvas = $('#review-canvas');
  const resultName = $('#result-name');
  const resultConfidence = $('#result-confidence');
  const chkReversed = $('#chk-reversed');
  const picker = $('#picker');
  const pickerSuits = $('#picker-suits');
  const pickerRanks = $('#picker-ranks');

  function goToReview(cardImageData) {
    $('#review-title').textContent = positionLabel(state.cardIndex);
    reviewCanvas.width = cardImageData.width;
    reviewCanvas.height = cardImageData.height;
    reviewCanvas.getContext('2d').putImageData(toRealImageData(cardImageData), 0, 0);
    state.currentCardDataURL = reviewCanvas.toDataURL('image/jpeg', 0.85);

    let result;
    try { result = recognizeCard(cardImageData); } catch (e) { result = { rank: null, suit: null, confidence: 0 }; }
    state.currentResult = result;
    chkReversed.checked = false;
    picker.hidden = true;

    updateReviewUI();
    showScreen('screen-review');
  }

  function updateReviewUI() {
    const r = state.currentResult;
    if (r && r.rank && r.suit) {
      const suit = SUITS[r.suit];
      resultName.innerHTML = `${RANK_NAME[r.rank]} de ${suit.name} <span class="suit-${suit.color}">${suit.symbol}</span>`;
      const pct = Math.round((r.confidence || 0) * 100);
      resultConfidence.textContent = pct >= 60
        ? `Identificação automática — confiança ${pct}%`
        : `Identificação incerta (${pct}%) — confira com atenção`;
    } else {
      resultName.textContent = 'Não identificada';
      resultConfidence.textContent = 'Toque abaixo para escolher a carta manualmente';
      picker.hidden = false;
      renderPicker();
    }
  }

  $('#btn-open-picker').addEventListener('click', () => {
    picker.hidden = !picker.hidden;
    if (!picker.hidden) renderPicker();
  });

  function renderPicker() {
    const cur = state.currentResult || {};
    pickerSuits.innerHTML = '';
    Object.values(SUITS).forEach(s => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'suit-btn suit-' + s.color + (cur.suit === s.key ? ' selected' : '');
      b.textContent = s.symbol;
      b.addEventListener('click', () => {
        state.currentResult = Object.assign({}, state.currentResult, { suit: s.key, confidence: 1 });
        renderPicker();
        updateReviewUI();
      });
      pickerSuits.appendChild(b);
    });
    pickerRanks.innerHTML = '';
    RANKS.forEach(r => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rank-btn' + (cur.rank === r ? ' selected' : '');
      b.textContent = r;
      b.addEventListener('click', () => {
        state.currentResult = Object.assign({}, state.currentResult, { rank: r, confidence: 1 });
        renderPicker();
        updateReviewUI();
      });
      pickerRanks.appendChild(b);
    });
  }

  $('#btn-confirm-card').addEventListener('click', () => {
    const r = state.currentResult;
    if (!r || !r.rank || !r.suit) {
      picker.hidden = false;
      renderPicker();
      resultConfidence.textContent = 'Escolha o valor e o naipe da carta para continuar';
      return;
    }
    state.captured.push({
      dataURL: state.currentCardDataURL,
      rank: r.rank,
      suit: r.suit,
      reversed: chkReversed.checked,
    });
    state.cardIndex++;
    if (state.cardIndex < state.spreadSize) {
      goToCapture();
    } else {
      goToReading();
    }
  });

  // ------------------------------------------------------------------
  // LEITURA FINAL
  // ------------------------------------------------------------------
  const readingList = $('#reading-list');
  const readingSynthesis = $('#reading-synthesis');

  function goToReading() {
    readingList.innerHTML = '';
    const readings = state.captured.map(c => getCardReading(c.rank, c.suit, c.reversed));

    readings.forEach((reading, i) => {
      const item = document.createElement('div');
      item.className = 'reading-item';
      const posLabel = state.spreadSize === 3 ? POSITIONS_3[i].label : 'Sua carta';
      item.innerHTML = `
        <img src="${state.captured[i].dataURL}" alt="${reading.name}" />
        <div class="reading-item-body">
          <div class="reading-position">${posLabel}</div>
          <div class="reading-card-name">${reading.name}${reading.reversed ? '<span class="reversed-tag">(invertida)</span>' : ''}</div>
          <div class="reading-element">${reading.element}</div>
          <div class="reading-text">${reading.text}</div>
          <div class="reading-work"><strong>Trabalho</strong> ${reading.workText.replace(/^No trabalho:\s*/, '')}</div>
        </div>`;
      readingList.appendChild(item);
    });

    if (state.spreadSize === 3) {
      readingSynthesis.hidden = false;
      readingSynthesis.innerHTML = `<strong>Síntese da tiragem</strong><br>${synthesize3(readings)}`;
    } else {
      readingSynthesis.hidden = true;
    }

    showScreen('screen-reading');
  }

  $('#btn-new-reading').addEventListener('click', () => {
    state.captured = [];
    state.cardIndex = 0;
    showScreen('screen-home');
  });

  $('#btn-save-image').addEventListener('click', saveReadingAsImage);

  function saveReadingAsImage() {
    const readings = state.captured.map(c => getCardReading(c.rank, c.suit, c.reversed));
    const W = 900;
    const textX = 180, textW = W - 220;
    const lineH = 22;
    const thumbH = 165;
    const rowGap = 34;

    // canvas temporário só para medir quebras de linha antes de saber a
    // altura final (fontes usadas na medição precisam bater com o desenho)
    const measure = document.createElement('canvas').getContext('2d');

    const rows = readings.map((reading, i) => {
      measure.font = '15px Georgia, serif';
      const workClean = reading.workText.replace(/^No trabalho:\s*/, '');
      const textLines = wrapLines(measure, reading.text, textW);
      const workLines = wrapLines(measure, workClean, textW);
      // posição(24) + nome(30) + elemento(20) + texto + respiro(16) + rótulo trabalho(20) + texto trabalho
      const textBlockH = 24 + 30 + 20 + textLines.length * lineH + 16 + 20 + workLines.length * lineH;
      const rowH = Math.max(thumbH, textBlockH);
      return { reading, textLines, workLines, rowH };
    });

    const contentTop = 130;
    let y = contentTop;
    const rowTops = rows.map((r) => { const top = y; y += r.rowH + rowGap; return top; });
    let synthesisTop = null, synthesisLines = [];
    if (state.spreadSize === 3) {
      measure.font = '15px Georgia, serif';
      synthesisLines = wrapLines(measure, synthesize3(readings), W - 80);
      synthesisTop = y;
      y += 40 + synthesisLines.length * lineH;
    }
    const H = y + 40;

    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#17112a'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#d8b467';
    ctx.font = '700 30px Georgia, serif';
    ctx.fillText('Leitura de Cartas', 40, 60);
    ctx.fillStyle = '#b6a9d6';
    ctx.font = '15px Georgia, serif';
    ctx.fillText(new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }), 40, 88);

    let pending = rows.length;
    rows.forEach((row, i) => {
      const rowY = rowTops[i];
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 40, rowY, 118, thumbH);
        drawRowText(row, i, rowY);
        pending--;
        if (pending === 0) finalizeSynthesisAndDownload();
      };
      img.src = state.captured[i].dataURL;
    });

    function drawRowText(row, i, rowY) {
      const { reading, textLines, workLines } = row;
      ctx.fillStyle = '#d8b467';
      ctx.font = '600 12px Georgia, serif';
      const posLabel = state.spreadSize === 3 ? POSITIONS_3[i].label.toUpperCase() : 'SUA CARTA';
      ctx.fillText(posLabel, textX, rowY + 20);
      ctx.fillStyle = '#f3eefc';
      ctx.font = '700 22px Georgia, serif';
      ctx.fillText(reading.name + (reading.reversed ? ' (invertida)' : ''), textX, rowY + 46);
      ctx.fillStyle = '#b6a9d6';
      ctx.font = 'italic 13px Georgia, serif';
      ctx.fillText(reading.element, textX, rowY + 64);
      ctx.fillStyle = '#ece5f9';
      ctx.font = '15px Georgia, serif';
      let ty = rowY + 88;
      ty = drawLines(ctx, textLines, textX, ty, lineH);
      ty += 16;
      ctx.fillStyle = '#d8b467';
      ctx.font = '700 13px Georgia, serif';
      ctx.fillText('TRABALHO', textX, ty);
      ty += 20;
      ctx.fillStyle = '#b6a9d6';
      ctx.font = '15px Georgia, serif';
      drawLines(ctx, workLines, textX, ty, lineH);
    }

    function finalizeSynthesisAndDownload() {
      if (synthesisTop !== null) {
        ctx.fillStyle = '#d8b467';
        ctx.font = '600 15px Georgia, serif';
        ctx.fillText('Síntese da tiragem', 40, synthesisTop);
        ctx.fillStyle = '#b6a9d6';
        ctx.font = '15px Georgia, serif';
        drawLines(ctx, synthesisLines, 40, synthesisTop + 26, lineH);
      }
      const a = document.createElement('a');
      a.download = 'leitura-de-cartas.png';
      a.href = c.toDataURL('image/png');
      a.click();
    }
  }

  /** Quebra `text` em linhas que cabem em maxWidth, sem desenhar. */
  function wrapLines(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line + w + ' ';
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line.trim());
        line = w + ' ';
      } else {
        line = test;
      }
    }
    if (line) lines.push(line.trim());
    return lines;
  }

  /** Desenha linhas já quebradas e retorna o y logo após a última. */
  function drawLines(ctx, lines, x, y, lineHeight) {
    for (const line of lines) {
      ctx.fillText(line, x, y);
      y += lineHeight;
    }
    return y;
  }

  // ------------------------------------------------------------------
  // Instalação do PWA
  // ------------------------------------------------------------------
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    $('#btn-install').hidden = false;
  });
  $('#btn-install').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    $('#btn-install').hidden = true;
  });

  // ------------------------------------------------------------------
  // Service worker (uso offline)
  // ------------------------------------------------------------------
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }
})();
