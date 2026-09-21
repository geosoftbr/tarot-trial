/**
 * recognizer.js — reconhecimento da carta (valor + naipe) a partir da
 * imagem já corrigida em perspectiva (ver geometry.js). Todo o
 * processamento é local (nenhuma rede, nenhum modelo de IA), então roda
 * offline e sem custo de tokens.
 *
 * Estratégia (a mesma validada em proto/test_recognition.py, ~97% de
 * acerto em testes sintéticos com rotação/ruído):
 *   1. Recorta o índice do canto (número/letra sobre o naipe).
 *   2. Separa por componentes conexos: o de baixo é o naipe, o(s) de
 *      cima formam o valor (ex.: "10" tem dois componentes lado a lado).
 *   3. Cor média da tinta define vermelho/preto (restringe o naipe a 2
 *      candidatos).
 *   4. Compara cada recorte (redimensionado para 48x48) com os modelos
 *      pré-gerados por sobreposição (Jaccard) e fica com o de maior
 *      pontuação.
 *   5. Repete no canto oposto (invertido 180°) se o primeiro canto
 *      tiver pouca tinta (pode estar coberto pela mão) e fica com o
 *      resultado mais confiante.
 *
 * A confiança retornada nunca deve ser tratada como certeza: a interface
 * SEMPRE deve oferecer uma forma fácil de corrigir a carta manualmente.
 */

(function (root, factory) {
  if (typeof module !== 'undefined') {
    const geo = require('./geometry.js');
    const tpl = require('./templates-data.js');
    module.exports = factory(geo, tpl);
  } else {
    // navegador: expõe as funções como globais simples (mesmo padrão de
    // geometry.js e cards.js), já que geometry.js e templates-data.js
    // também publicam suas variáveis de topo em `window`.
    Object.assign(root, factory(root, root));
  }
})(typeof self !== 'undefined' ? self : this, function (geo, tpl) {
  const { toGray, otsuThreshold, labelComponents, resizeBoxToSquareSoft, softSimilarity } = geo;
  const { TEMPLATE_SIZE, RANK_TEMPLATES, SUIT_TEMPLATES } = tpl;

  const SUIT_IS_RED = { S: false, H: true, D: true, C: false };
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = ['S', 'H', 'D', 'C'];

  // Fração do card (já corrigido em perspectiva) onde o índice de canto
  // normalmente aparece nos baralhos padrão.
  const INDEX_BOX = { x0: 0.02, y0: 0.015, x1: 0.30, y1: 0.30 };

  function cropRegion(imageData, x0, y0, x1, y1) {
    const { width, height, data } = imageData;
    const px0 = Math.max(0, Math.floor(x0 * width));
    const py0 = Math.max(0, Math.floor(y0 * height));
    const px1 = Math.min(width, Math.ceil(x1 * width));
    const py1 = Math.min(height, Math.ceil(y1 * height));
    const cw = Math.max(1, px1 - px0), ch = Math.max(1, py1 - py0);
    const out = new Uint8ClampedArray(cw * ch * 4);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const si = ((py0 + y) * width + (px0 + x)) * 4;
        const di = (y * cw + x) * 4;
        out[di] = data[si]; out[di + 1] = data[si + 1];
        out[di + 2] = data[si + 2]; out[di + 3] = 255;
      }
    }
    return { width: cw, height: ch, data: out };
  }

  /** Gira 180 graus (usado para tentar o canto oposto). */
  function rotate180(imageData) {
    const { width, height, data } = imageData;
    const out = new Uint8ClampedArray(data.length);
    const n = width * height;
    for (let i = 0; i < n; i++) {
      const si = i * 4, di = (n - 1 - i) * 4;
      out[di] = data[si]; out[di + 1] = data[si + 1];
      out[di + 2] = data[si + 2]; out[di + 3] = 255;
    }
    return { width, height, data: out };
  }

  /**
   * Classifica um recorte de índice (canto). Retorna null se não houver
   * tinta suficiente (provavelmente canto coberto/mal enquadrado).
   */
  function classifyCorner(cropImageData) {
    const { width, height } = cropImageData;
    const gray = toGray(cropImageData);
    const t = otsuThreshold(gray);
    // tinta = pixels bem mais escuros que o limiar (margem para evitar
    // pegar sombras suaves como se fossem tinta)
    const inkThreshold = Math.max(30, t - 12);
    const mask = new Uint8Array(width * height);
    let inkCount = 0;
    for (let i = 0; i < gray.length; i++) {
      if (gray[i] < inkThreshold) { mask[i] = 1; inkCount++; }
    }
    if (inkCount < 18) return null;

    // campo contínuo de "intensidade de tinta" (0..1), usado só para a
    // comparação de forma (a segmentação em componentes continua binária).
    // Normaliza pelo fundo local (t) para não depender da iluminação.
    const ink = new Float32Array(width * height);
    for (let i = 0; i < gray.length; i++) {
      const v = (t - gray[i]) / Math.max(1, t);
      ink[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }

    const { labels, comps } = labelComponents(mask, width, height);
    const real = comps.filter(c => c.count >= 5);
    if (real.length === 0) return null;
    real.sort((a, b) => a.cy - b.cy);

    const suitComp = real[real.length - 1];
    const rankComps = real.length > 1 ? real.slice(0, -1) : real;
    const rankBox = {
      minX: Math.min(...rankComps.map(c => c.minX)),
      maxX: Math.max(...rankComps.map(c => c.maxX)),
      minY: Math.min(...rankComps.map(c => c.minY)),
      maxY: Math.max(...rankComps.map(c => c.maxY)),
    };
    const suitBox = { minX: suitComp.minX, maxX: suitComp.maxX, minY: suitComp.minY, maxY: suitComp.maxY };

    const rankGrid = resizeBoxToSquareSoft(ink, width, rankBox, TEMPLATE_SIZE);
    const suitGrid = resizeBoxToSquareSoft(ink, width, suitBox, TEMPLATE_SIZE);

    // cor média da tinta (vermelho x preto)
    let rSum = 0, bSum = 0, n = 0;
    const { data } = cropImageData;
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      rSum += data[i * 4]; bSum += data[i * 4 + 2]; n++;
    }
    const isRed = n > 0 && (rSum / n - bSum / n) > 12;

    let bestRank = null, bestRankScore = -1;
    for (const r of RANKS) {
      const s = softSimilarity(rankGrid, RANK_TEMPLATES[r]);
      if (s > bestRankScore) { bestRankScore = s; bestRank = r; }
    }
    const suitCandidates = SUITS.filter(s => SUIT_IS_RED[s] === isRed);
    let bestSuit = null, bestSuitScore = -1;
    for (const s of suitCandidates) {
      const sc = softSimilarity(suitGrid, SUIT_TEMPLATES[s]);
      if (sc > bestSuitScore) { bestSuitScore = sc; bestSuit = s; }
    }

    return {
      rank: bestRank,
      suit: bestSuit,
      isRed,
      confidence: (bestRankScore + bestSuitScore) / 2,
      rankScore: bestRankScore,
      suitScore: bestSuitScore,
      inkCount,
    };
  }

  /**
   * Recebe a imagem da carta já corrigida em perspectiva (retangular,
   * proporção ~2.5:3.5) e tenta reconhecer valor + naipe, testando os
   * dois cantos opostos e ficando com o melhor resultado.
   */
  function recognizeCard(cardImageData) {
    const tl = cropRegion(cardImageData, INDEX_BOX.x0, INDEX_BOX.y0, INDEX_BOX.x1, INDEX_BOX.y1);
    const brRaw = cropRegion(cardImageData, 1 - INDEX_BOX.x1, 1 - INDEX_BOX.y1, 1 - INDEX_BOX.x0, 1 - INDEX_BOX.y0);
    const br = rotate180(brRaw);

    const resTL = classifyCorner(tl);
    const resBR = classifyCorner(br);

    let best = null, corner = null;
    if (resTL && (!resBR || resTL.confidence >= resBR.confidence)) { best = resTL; corner = 'top-left'; }
    else if (resBR) { best = resBR; corner = 'bottom-right'; }

    if (!best) return { rank: null, suit: null, confidence: 0, corner: null };
    return { ...best, corner };
  }

  return { recognizeCard, classifyCorner, cropRegion, rotate180, INDEX_BOX, RANKS, SUITS };
});
