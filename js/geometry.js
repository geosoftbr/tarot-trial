/**
 * geometry.js — utilidades de imagem "puras" (sem dependências externas):
 * transformação de perspectiva, escala de cinza, limiarização (Otsu) e
 * rotulagem de componentes conexos. Funciona tanto no navegador (com
 * ImageData real) quanto em Node (com um objeto {width,height,data}
 * equivalente), o que permite testar a mesma lógica fora do navegador.
 */

// ---------------------------------------------------------------------
// Perspectiva: mapeia o quadrado unitário (0,0)-(1,0)-(1,1)-(0,1) para um
// quadrilátero arbitrário (método clássico de Heckbert, 1989).
// ---------------------------------------------------------------------
function squareToQuad(quad) {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = quad;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;

  let a, b, c, d, e, f, g, h, i;
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    a = x1 - x0; b = x2 - x1; c = x0;
    d = y1 - y0; e = y2 - y1; f = y0;
    g = 0; h = 0; i = 1;
  } else {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
    a = x1 - x0 + g * x1; b = x3 - x0 + h * x3; c = x0;
    d = y1 - y0 + g * y1; e = y3 - y0 + h * y3; f = y0;
    i = 1;
  }
  return { a, b, c, d, e, f, g, h, i };
}

function mapUV(m, u, v) {
  const X = m.a * u + m.b * v + m.c;
  const Y = m.d * u + m.e * v + m.f;
  const W = m.g * u + m.h * v + m.i;
  return [X / W, Y / W];
}

function bilinearSample(src, x, y) {
  const { width, height, data } = src;
  if (x < 0 || y < 0 || x > width - 1 || y > height - 1) return [0, 0, 0, 0];
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1), y1 = Math.min(y0 + 1, height - 1);
  const fx = x - x0, fy = y - y0;
  const idx = (xx, yy) => (yy * width + xx) * 4;
  const out = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const p00 = data[idx(x0, y0) + c], p10 = data[idx(x1, y0) + c];
    const p01 = data[idx(x0, y1) + c], p11 = data[idx(x1, y1) + c];
    const top = p00 * (1 - fx) + p10 * fx;
    const bot = p01 * (1 - fx) + p11 * fx;
    out[c] = top * (1 - fy) + bot * fy;
  }
  return out;
}

/**
 * Corrige a perspectiva de `srcImageData` recortando o quadrilátero `quad`
 * (8 números: x0,y0, x1,y1, x2,y2, x3,y3 em ordem TL,TR,BR,BL) para um
 * retângulo de saída outW x outH.
 */
function warpPerspective(srcImageData, quad, outW, outH) {
  const m = squareToQuad(quad);
  const out = new Uint8ClampedArray(outW * outH * 4);
  for (let y = 0; y < outH; y++) {
    const v = (y + 0.5) / outH;
    for (let x = 0; x < outW; x++) {
      const u = (x + 0.5) / outW;
      const [sx, sy] = mapUV(m, u, v);
      const [r, g, b, a] = bilinearSample(srcImageData, sx, sy);
      const o = (y * outW + x) * 4;
      out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = a === undefined ? 255 : a;
    }
  }
  return { width: outW, height: outH, data: out };
}

/**
 * Garante que o quadrilátero (TL,TR,BR,BL) descreva a carta "em pé": se os
 * lados de cima/baixo forem mais longos que os laterais (carta deitada na
 * foto), gira a ordem dos cantos em 90°. Sem isso a carta deitada seria
 * esticada para o retângulo em pé e o índice do canto ficaria irreconhecível.
 * (Qual dos dois giros de 90° é indiferente: o reconhecimento já tenta o
 * canto de cima e o de baixo, invertido.)
 */
function orientCardQuad(quad) {
  const d = (i, j) => Math.hypot(quad[i * 2] - quad[j * 2], quad[i * 2 + 1] - quad[j * 2 + 1]);
  const horiz = d(0, 1) + d(3, 2);
  const vert = d(0, 3) + d(1, 2);
  if (horiz <= vert) return quad;
  // novo TL = antigo BL, TR = TL, BR = TR, BL = BR
  return [quad[6], quad[7], quad[0], quad[1], quad[2], quad[3], quad[4], quad[5]];
}

// ---------------------------------------------------------------------
// Escala de cinza + Otsu
// ---------------------------------------------------------------------
function toGray(imageData) {
  const { width, height, data } = imageData;
  const gray = new Float32Array(width * height);
  for (let p = 0, o = 0; p < gray.length; p++, o += 4) {
    gray[p] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }
  return gray;
}

function otsuThreshold(gray) {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[Math.max(0, Math.min(255, gray[i] | 0))]++;
  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, wF = 0, varMax = -1, threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varBetween > varMax) { varMax = varBetween; threshold = t; }
  }
  return threshold;
}

// ---------------------------------------------------------------------
// Componentes conexos (flood fill iterativo, conectividade-8)
// ---------------------------------------------------------------------
function labelComponents(mask, width, height) {
  const labels = new Int32Array(width * height).fill(0);
  let nextLabel = 0;
  const stack = new Int32Array(width * height);
  const comps = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start] !== 0) continue;
    nextLabel++;
    let sp = 0;
    stack[sp++] = start;
    labels[start] = nextLabel;
    let minX = width, maxX = -1, minY = height, maxY = -1, count = 0;
    while (sp > 0) {
      const idx = stack[--sp];
      const x = idx % width, y = (idx / width) | 0;
      count++;
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const nIdx = ny * width + nx;
          if (mask[nIdx] && labels[nIdx] === 0) {
            labels[nIdx] = nextLabel;
            stack[sp++] = nIdx;
          }
        }
      }
    }
    comps.push({ label: nextLabel, count, minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 });
  }
  return { labels, comps };
}

// ---------------------------------------------------------------------
// Detecção do maior blob claro (best-effort para localizar a carta) e seus
// 4 cantos aproximados pelo método dos pontos extremos (x+y)/(x-y).
// ---------------------------------------------------------------------
function detectBrightQuad(imageData, opts = {}) {
  const maxDim = opts.maxDim || 260;
  const { width, height } = imageData;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const sw = Math.max(1, Math.round(width * scale));
  const sh = Math.max(1, Math.round(height * scale));

  // reamostragem simples (nearest) para acelerar
  const small = { width: sw, height: sh, data: new Uint8ClampedArray(sw * sh * 4) };
  for (let y = 0; y < sh; y++) {
    const sy = Math.min(height - 1, Math.round(y / scale));
    for (let x = 0; x < sw; x++) {
      const sx = Math.min(width - 1, Math.round(x / scale));
      const si = (sy * width + sx) * 4, di = (y * sw + x) * 4;
      small.data[di] = imageData.data[si];
      small.data[di + 1] = imageData.data[si + 1];
      small.data[di + 2] = imageData.data[si + 2];
      small.data[di + 3] = 255;
    }
  }

  const gray = toGray(small);
  const t = otsuThreshold(gray);
  const mask = new Uint8Array(sw * sh);
  for (let i = 0; i < gray.length; i++) mask[i] = gray[i] > t ? 1 : 0;

  const { labels, comps } = labelComponents(mask, sw, sh);
  if (!comps.length) return null;
  comps.sort((a, b) => b.count - a.count);
  const best = comps[0];
  // ignora blobs pequenos demais (provavelmente ruído, não uma carta)
  if (best.count < sw * sh * 0.06) return null;

  let minSum = Infinity, maxSum = -Infinity, minDiff = Infinity, maxDiff = -Infinity;
  let tl = null, br = null, tr = null, bl = null;
  for (let idx = 0; idx < labels.length; idx++) {
    if (labels[idx] !== best.label) continue;
    const x = idx % sw, y = (idx / sw) | 0;
    const s = x + y, d = x - y;
    if (s < minSum) { minSum = s; tl = [x, y]; }
    if (s > maxSum) { maxSum = s; br = [x, y]; }
    if (d > maxDiff) { maxDiff = d; tr = [x, y]; }
    if (d < minDiff) { minDiff = d; bl = [x, y]; }
  }
  if (!tl || !tr || !br || !bl) return null;

  const inv = 1 / scale;
  return [
    tl[0] * inv, tl[1] * inv,
    tr[0] * inv, tr[1] * inv,
    br[0] * inv, br[1] * inv,
    bl[0] * inv, bl[1] * inv,
  ];
}

// ---------------------------------------------------------------------
// Reamostragem bilinear de uma máscara binária/0-1 recortada por uma caixa
// delimitadora (bbox) para um quadrado outSize x outSize (0/1). Não usa
// canvas — funciona igual no navegador e no Node, o que permite testar a
// mesma lógica de classificação fora do navegador.
// ---------------------------------------------------------------------
function resizeBoxToSquare(mask, width, bbox, outSize) {
  const { minX, minY, maxX, maxY } = bbox;
  const bw = Math.max(1, maxX - minX + 1);
  const bh = Math.max(1, maxY - minY + 1);
  const out = new Uint8Array(outSize * outSize);
  for (let oy = 0; oy < outSize; oy++) {
    const v = bh <= 1 ? 0 : (oy + 0.5) / outSize * (bh - 1);
    const y0 = Math.floor(v), y1 = Math.min(bh - 1, y0 + 1), fy = v - y0;
    for (let ox = 0; ox < outSize; ox++) {
      const u = bw <= 1 ? 0 : (ox + 0.5) / outSize * (bw - 1);
      const x0 = Math.floor(u), x1 = Math.min(bw - 1, x0 + 1), fx = u - x0;
      const g = (xx, yy) => mask[(minY + yy) * width + (minX + xx)] ? 1 : 0;
      const top = g(x0, y0) * (1 - fx) + g(x1, y0) * fx;
      const bot = g(x0, y1) * (1 - fx) + g(x1, y1) * fx;
      const val = top * (1 - fy) + bot * fy;
      out[oy * outSize + ox] = val > 0.5 ? 1 : 0;
    }
  }
  return out;
}

/**
 * Como resizeBoxToSquare, mas devolve intensidade contínua (0..1) em vez de
 * binarizar no final — preserva bordas suaves, o que discrimina melhor
 * formas parecidas (ex.: espadas x paus) em índices pequenos/com ruído.
 * `field` já deve estar em 0..1 (1 = tinta).
 */
function resizeBoxToSquareSoft(field, width, bbox, outSize) {
  const { minX, minY, maxX, maxY } = bbox;
  const bw = Math.max(1, maxX - minX + 1);
  const bh = Math.max(1, maxY - minY + 1);
  const out = new Float32Array(outSize * outSize);
  for (let oy = 0; oy < outSize; oy++) {
    const v = bh <= 1 ? 0 : (oy + 0.5) / outSize * (bh - 1);
    const y0 = Math.floor(v), y1 = Math.min(bh - 1, y0 + 1), fy = v - y0;
    for (let ox = 0; ox < outSize; ox++) {
      const u = bw <= 1 ? 0 : (ox + 0.5) / outSize * (bw - 1);
      const x0 = Math.floor(u), x1 = Math.min(bw - 1, x0 + 1), fx = u - x0;
      const g = (xx, yy) => field[(minY + yy) * width + (minX + xx)];
      const top = g(x0, y0) * (1 - fx) + g(x1, y0) * fx;
      const bot = g(x0, y1) * (1 - fx) + g(x1, y1) * fx;
      out[oy * outSize + ox] = top * (1 - fy) + bot * fy;
    }
  }
  return out;
}

/** Similaridade 0..1 entre dois campos contínuos (1 - diferença média absoluta). */
function softSimilarity(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return 1 - sum / a.length;
}

function jaccard(a, b) {
  let inter = 0, union = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i], bv = b[i];
    if (av || bv) union++;
    if (av && bv) inter++;
  }
  return union === 0 ? 0 : inter / union;
}

if (typeof module !== 'undefined') {
  module.exports = {
    squareToQuad, mapUV, warpPerspective, orientCardQuad, toGray, otsuThreshold,
    labelComponents, detectBrightQuad, resizeBoxToSquare, jaccard,
    resizeBoxToSquareSoft, softSimilarity,
  };
}
