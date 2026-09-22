/**
 * recognizer.js — reconhecimento da carta (valor + naipe) a partir da
 * imagem já corrigida em perspectiva (ver geometry.js). Todo o
 * processamento é local (nenhuma rede, nenhum modelo de IA), então roda
 * offline e sem custo de tokens.
 *
 * Estratégia:
 *   1. Recorta o canto da carta (caixa estreita, ver INDEX_BOX).
 *   2. Separa a tinta do papel pelo menor canal RGB (preto e vermelho
 *      ficam igualmente escuros) e divide em componentes conexos.
 *   3. Descarta o que não é índice (pedaços do naipe grande do centro ou
 *      da moldura das figuras, que encostam na borda do recorte) e pega o
 *      valor (componente mais alto + vizinhos na mesma linha, ex.: "10") e
 *      o naipe pequeno logo abaixo dele.
 *   4. Cor média da tinta do índice define vermelho/preto (restringe o
 *      naipe a 2 candidatos).
 *   5. Compara cada recorte (48x48) com os modelos de cada valor/naipe —
 *      um gerado de fonte e outro tirado de fotos reais do baralho — e
 *      fica com o de maior similaridade.
 *   6. Faz o mesmo no canto oposto (invertido 180°) e fica com o
 *      resultado mais confiante.
 *
 * Em 52 fotos reais (uma de cada carta), acerta valor e naipe de todas,
 * com os modelos do baralho avaliados sem a própria foto; só com os
 * modelos de fonte (outros baralhos), ~79%.
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
  const { otsuThreshold, labelComponents, resizeBoxToSquareSoft, softSimilarity } = geo;
  const { TEMPLATE_SIZE, RANK_TEMPLATES, SUIT_TEMPLATES, DECK_RANK_TEMPLATES, DECK_SUIT_TEMPLATES } = tpl;
  // cada valor/naipe tem dois modelos: o da fonte (genérico, serve para
  // outros baralhos) e o tirado de fotos reais do baralho (bem mais fiel a
  // ele). Vale a maior similaridade entre os dois.
  const RANK_MODELS = {}, SUIT_MODELS = {};
  for (const k in RANK_TEMPLATES) RANK_MODELS[k] = [RANK_TEMPLATES[k], DECK_RANK_TEMPLATES[k]].filter(Boolean);
  for (const k in SUIT_TEMPLATES) SUIT_MODELS[k] = [SUIT_TEMPLATES[k], DECK_SUIT_TEMPLATES[k]].filter(Boolean);
  function bestSimilarity(grid, models) {
    let best = -1;
    for (const m of models) { const s = softSimilarity(grid, m); if (s > best) best = s; }
    return best;
  }

  const SUIT_IS_RED = { S: false, H: true, D: true, C: false };
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const SUITS = ['S', 'H', 'D', 'C'];

  // Fração do card (já corrigido em perspectiva) onde o índice de canto
  // normalmente aparece nos baralhos padrão. A caixa é propositalmente
  // estreita (o índice ocupa ~3–15% da largura): mais larga, ela pega o
  // primeiro naipe grande do centro ou a moldura das figuras (J/Q/K).
  // O que ainda sobrar disso encosta na borda direita/de baixo do recorte
  // e é descartado em classifyCorner.
  const INDEX_BOX = { x0: 0, y0: 0, x1: 0.23, y1: 0.36 };

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
   * Dentro do recorte do canto, separa o que é o índice (valor em cima,
   * naipe pequeno logo abaixo) do resto: pedaços do naipe grande do centro
   * ou da moldura das figuras (que encostam na borda direita/de baixo do
   * recorte), sombras/fundo na borda (faixas longas) e sujeira (pequenos).
   * Retorna { labels, comps: { rankComps, suitComp } } ou comps = null.
   */
  function selectIndexComponents(mask, width, height) {
    const { labels, comps } = labelComponents(mask, width, height);
    const minCount = Math.max(5, width * height * 0.0015);
    const cand = comps.filter(c =>
      c.count >= minCount &&
      c.maxX < width - 2 && c.maxY < height - 2 &&
      (c.maxX - c.minX) < width * 0.8 && (c.maxY - c.minY) < height * 0.6);
    if (cand.length === 0) return { labels, comps: null };

    // valor: o componente mais alto (entre os da metade esquerda), mais os
    // que estão lado a lado com ele na mesma linha (ex.: "1" e "0" do 10)
    const left = cand.filter(c => c.minX < width * 0.5);
    if (left.length === 0) return { labels, comps: null };
    left.sort((a, b) => a.minY - b.minY);
    const top = left[0];
    const th = top.maxY - top.minY + 1;
    const rankComps = cand.filter(c => {
      if (c === top) return true;
      const overlap = Math.min(c.maxY, top.maxY) - Math.max(c.minY, top.minY);
      const gapX = Math.max(c.minX - top.maxX, top.minX - c.maxX);
      return overlap > 0.5 * Math.min(th, c.maxY - c.minY + 1) && gapX < th * 0.6;
    });
    const rMinX = Math.min(...rankComps.map(c => c.minX));
    const rMaxX = Math.max(...rankComps.map(c => c.maxX));
    const rMaxY = Math.max(...rankComps.map(c => c.maxY));
    const rW = rMaxX - rMinX + 1;

    // naipe: o próximo componente abaixo do valor, alinhado com ele
    // na horizontal (centro dentro da faixa do valor, com folga)
    const below = cand.filter(c =>
      !rankComps.includes(c) &&
      c.minY > rMaxY - th * 0.15 &&
      c.cx > rMinX - rW * 0.6 && c.cx < rMaxX + rW * 0.6);
    if (below.length === 0) return { labels, comps: null };
    below.sort((a, b) => a.minY - b.minY);
    // pontinhos soltos (ex.: sujeira entre valor e naipe) não contam
    const biggest = Math.max(...below.map(c => c.count));
    const suitComp = below.find(c => c.count >= biggest * 0.35);
    return { labels, comps: { rankComps, suitComp } };
  }

  /**
   * Classifica um recorte de índice (canto). Retorna null se não houver
   * tinta suficiente (provavelmente canto coberto/mal enquadrado).
   */
  function classifyCorner(cropImageData, opts = {}) {
    const { width, height } = cropImageData;
    // "escuridão" = menor dos canais R,G,B: o papel é claro nos três, e tanto
    // a tinta preta quanto a vermelha são escuras em pelo menos um (o vermelho
    // quase some na escala de cinza comum, que o deixava fraco demais).
    const gray = minChannel(cropImageData);
    const t = otsuThreshold(gray);
    // tinta = pixels bem mais escuros que o limiar (margem para evitar
    // pegar sombras suaves como se fossem tinta)
    const inkThreshold = Math.max(30, t - 12);
    const mask = new Uint8Array(width * height);
    let inkCount = 0, inkSum = 0, paperSum = 0;
    for (let i = 0; i < gray.length; i++) {
      if (gray[i] < inkThreshold) { mask[i] = 1; inkCount++; inkSum += gray[i]; }
      else paperSum += gray[i];
    }
    if (inkCount < 18) return null;

    // campo contínuo de "intensidade de tinta" (0..1), usado só para a
    // comparação de forma (a segmentação em componentes continua binária).
    // Normaliza entre o tom médio do papel (0) e o da tinta (1), para não
    // depender da iluminação nem da cor/força da impressão.
    const paper = paperSum / Math.max(1, gray.length - inkCount);
    const inkLevel = inkSum / inkCount;
    const span = Math.max(1, paper - inkLevel);
    const ink = new Float32Array(width * height);
    for (let i = 0; i < gray.length; i++) {
      const v = (paper - gray[i]) / span;
      ink[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }

    const { labels, comps } = selectIndexComponents(mask, width, height);
    if (!comps) return null;
    const { rankComps, suitComp } = comps;
    const rankBox = {
      minX: Math.min(...rankComps.map(c => c.minX)),
      maxX: Math.max(...rankComps.map(c => c.maxX)),
      minY: Math.min(...rankComps.map(c => c.minY)),
      maxY: Math.max(...rankComps.map(c => c.maxY)),
    };
    const suitBox = { minX: suitComp.minX, maxX: suitComp.maxX, minY: suitComp.minY, maxY: suitComp.maxY };

    const rankGrid = resizeBoxToSquareSoft(ink, width, rankBox, TEMPLATE_SIZE);
    const suitGrid = resizeBoxToSquareSoft(ink, width, suitBox, TEMPLATE_SIZE);

    // cor média da tinta (vermelho x preto), só nos pixels do índice
    const indexLabels = new Set([suitComp, ...rankComps].map(c => c.label));
    let rSum = 0, bSum = 0, n = 0;
    const { data } = cropImageData;
    for (let i = 0; i < mask.length; i++) {
      if (!indexLabels.has(labels[i])) continue;
      rSum += data[i * 4]; bSum += data[i * 4 + 2]; n++;
    }
    const isRed = n > 0 && (rSum / n - bSum / n) > 12;

    let bestRank = null, bestRankScore = -1;
    for (const r of RANKS) {
      const s = bestSimilarity(rankGrid, RANK_MODELS[r]);
      if (s > bestRankScore) { bestRankScore = s; bestRank = r; }
    }
    const suitCandidates = SUITS.filter(s => SUIT_IS_RED[s] === isRed);
    let bestSuit = null, bestSuitScore = -1;
    for (const s of suitCandidates) {
      const sc = bestSimilarity(suitGrid, SUIT_MODELS[s]);
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
      ...(opts.debug ? { rankGrid, suitGrid, rankAspect: boxAspect(rankBox), suitAspect: boxAspect(suitBox) } : {}),
    };
  }

  function minChannel(imageData) {
    const { width, height, data } = imageData;
    const out = new Float32Array(width * height);
    for (let p = 0, o = 0; p < out.length; p++, o += 4) {
      const r = data[o], g = data[o + 1], b = data[o + 2];
      out[p] = r < g ? (r < b ? r : b) : (g < b ? g : b);
    }
    return out;
  }

  /** Altura / largura de uma caixa delimitadora. */
  function boxAspect(b) { return (b.maxY - b.minY + 1) / (b.maxX - b.minX + 1); }

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
