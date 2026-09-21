/**
 * cards.js — Baralho comum (52 cartas) com leitura no estilo tarô (cartomancia).
 *
 * Cada naipe do baralho comum corresponde a um naipe clássico do tarô:
 *   Ouros  -> Ouros/Moedas  (dinheiro, trabalho, corpo, o material)
 *   Copas  -> Copas          (emoções, relações, intuição)
 *   Espadas-> Espadas        (mente, conflitos, decisões, verdades)
 *   Paus   -> Paus/Bastões   (ação, criatividade, desejo, projetos)
 *
 * Nenhuma consulta externa é feita: todo o texto vive neste arquivo,
 * então a leitura funciona 100% offline e sem custo de processamento.
 */

const SUITS = {
  H: { key: 'H', name: 'Copas', symbol: '♥', color: 'red', element: 'Água — emoções, vínculos e intuição' },
  D: { key: 'D', name: 'Ouros', symbol: '♦', color: 'red', element: 'Terra — trabalho, dinheiro e o corpo' },
  S: { key: 'S', name: 'Espadas', symbol: '♠', color: 'black', element: 'Ar — mente, conflitos e decisões' },
  C: { key: 'C', name: 'Paus', symbol: '♣', color: 'black', element: 'Fogo — ação, desejo e criação' },
};

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const RANK_NAME = {
  A: 'Ás', 2: 'Dois', 3: 'Três', 4: 'Quatro', 5: 'Cinco', 6: 'Seis', 7: 'Sete',
  8: 'Oito', 9: 'Nove', 10: 'Dez', J: 'Valete', Q: 'Dama', K: 'Rei',
};

// Leituras por naipe + número. upright / reversed em 1-2 frases objetivas.
const MEANINGS = {
  H: {
    A: { up: 'Um novo sentimento nasce: amor, alegria ou uma conexão verdadeira começando a florescer.', rev: 'Coração fechado ou uma emoção represada pedindo espaço para aparecer.' },
    2: { up: 'União, parceria e atração mútua — um vínculo equilibrado se fortalece.', rev: 'Desencontro afetivo ou uma relação desequilibrada que precisa de conversa.' },
    3: { up: 'Celebração, amizade e alegrias compartilhadas com quem você ama.', rev: 'Excessos, fofoca ou um terceiro complicando um vínculo.' },
    4: { up: 'Momento de reflexão emocional; algo bom pode estar diante de você, mas passa despercebido.', rev: 'Saindo do tédio e reabrindo os olhos para novas possibilidades afetivas.' },
    5: { up: 'Perda ou decepção que dói, mas ainda há copas de pé — nem tudo está perdido.', rev: 'Aceitação e perdão; a hora de soltar o que já passou.' },
    6: { up: 'Nostalgia, memórias de infância e reencontros que aquecem o coração.', rev: 'Viver preso ao passado impede de aproveitar o presente.' },
    7: { up: 'Muitas possibilidades e sonhos diante de você — cuidado para não se perder em fantasias.', rev: 'Clareza chegando: hora de escolher um caminho real em vez de ilusões.' },
    8: { up: 'Deixar algo emocionalmente confortável para trás em busca de algo mais profundo.', rev: 'Medo de seguir em frente prende você numa situação que já não faz sentido.' },
    9: { up: 'Satisfação, gratidão e um desejo realizado — o chamado "carta dos desejos".', rev: 'Satisfação superficial ou excessos em busca de prazer.' },
    10: { up: 'Harmonia plena em família, felicidade duradoura e paz emocional.', rev: 'Briga familiar ou uma harmonia que existe só na aparência.' },
    J: { up: 'Uma pessoa (ou parte sua) sensível, romântica e criativa trazendo uma mensagem afetiva.', rev: 'Imaturidade emocional ou uma notícia sentimental que gera insegurança.' },
    Q: { up: 'Uma pessoa (ou parte sua) intuitiva, acolhedora e compassiva cuidando de quem ama.', rev: 'Emoção à flor da pele, carência ou dificuldade em colocar limites afetivos.' },
    K: { up: 'Uma pessoa (ou parte sua) equilibrada emocionalmente, generosa e madura nos sentimentos.', rev: 'Frieza, manipulação emocional ou dificuldade em lidar com os próprios sentimentos.' },
  },
  D: {
    A: { up: 'Nova oportunidade material: dinheiro, trabalho ou um projeto concreto começando bem.', rev: 'Oportunidade perdida ou insegurança financeira pedindo atenção.' },
    2: { up: 'Equilíbrio entre várias responsabilidades — você está malabarizando bem as prioridades.', rev: 'Sobrecarga e desorganização financeira ou de agenda.' },
    3: { up: 'Trabalho em equipe reconhecido; habilidade e colaboração dando bons frutos.', rev: 'Falta de coordenação ou trabalho não reconhecido como merecia.' },
    4: { up: 'Segurança material e controle sobre o que você construiu — cuidado para não virar apego.', rev: 'Apego excessivo a dinheiro ou posses, medo de perder o que tem.' },
    5: { up: 'Dificuldade financeira ou sensação de exclusão, mas ajuda está mais perto do que parece.', rev: 'Recuperação começando; a fase mais dura já passou.' },
    6: { up: 'Generosidade e trocas justas — dar e receber em equilíbrio.', rev: 'Relação de poder desigual em dinheiro ou favores.' },
    7: { up: 'Avaliação do que foi plantado; hora de decidir se vale investir mais ou colher agora.', rev: 'Impaciência ou investimento de tempo/dinheiro que não está compensando.' },
    8: { up: 'Dedicação, aprendizado e aperfeiçoamento de uma habilidade ou ofício.', rev: 'Falta de foco ou trabalho feito sem capricho.' },
    9: { up: 'Conquista pelo próprio esforço; independência e conforto material merecidos.', rev: 'Isolamento apesar do conforto, ou dificuldade em desfrutar do que conquistou.' },
    10: { up: 'Prosperidade duradoura, legado e estabilidade para a família.', rev: 'Conflitos de herança ou instabilidade numa base que parecia sólida.' },
    J: { up: 'Uma pessoa (ou parte sua) estudiosa e prática, começando algo com os pés no chão.', rev: 'Procrastinação ou falta de compromisso com um plano material.' },
    Q: { up: 'Uma pessoa (ou parte sua) prática, acolhedora e boa administradora dos recursos.', rev: 'Negligência com finanças, saúde ou rotina de cuidado.' },
    K: { up: 'Uma pessoa (ou parte sua) próspera, confiável e generosa nos negócios.', rev: 'Materialismo excessivo ou rigidez no controle do dinheiro.' },
  },
  S: {
    A: { up: 'Clareza mental repentina; uma verdade ou decisão corta a confusão.', rev: 'Confusão de ideias ou uma verdade usada de forma injusta.' },
    2: { up: 'Impasse: duas opções difíceis exigem uma decisão que você vem evitando.', rev: 'Indecisão prolongada gerando ainda mais tensão.' },
    3: { up: 'Dor emocional clara e inevitável — uma mágoa que precisa ser sentida para curar.', rev: 'Início da cura de uma dor antiga, ou reabertura de uma ferida.' },
    4: { up: 'Pausa necessária; descanso mental antes de retomar a luta.', rev: 'Esgotamento por não ter parado a tempo, ou volta forçada à ação.' },
    5: { up: 'Vitória que custou caro, ou um conflito onde ninguém realmente ganha.', rev: 'Momento de deixar uma briga de lado e buscar reconciliação.' },
    6: { up: 'Transição para águas mais calmas; deixando um período difícil para trás.', rev: 'Dificuldade em seguir em frente, resistência à mudança necessária.' },
    7: { up: 'Estratégia, esperteza ou uma ação feita às escondidas — cuidado com meias-verdades.', rev: 'Uma mentira vindo à tona ou culpa por um comportamento evasivo.' },
    8: { up: 'Sensação de estar preso, mas as amarras são mais mentais do que reais.', rev: 'Libertação de um padrão de pensamento limitante.' },
    9: { up: 'Ansiedade, insônia ou preocupações que crescem mais na mente do que na realidade.', rev: 'Alívio depois de encarar o medo, ou desespero que precisa de ajuda.' },
    10: { up: 'Um fim doloroso, mas definitivo — o pior já passou e só resta reconstruir.', rev: 'Resistência a encerrar algo que já claramente acabou.' },
    J: { up: 'Uma pessoa (ou parte sua) curiosa e vigilante, atenta a informações e fofocas.', rev: 'Fofoca, más notícias ou um plano mal executado.' },
    Q: { up: 'Uma pessoa (ou parte sua) direta, independente e de raciocínio afiado.', rev: 'Frieza excessiva ou mágoa que virou amargura.' },
    K: { up: 'Uma pessoa (ou parte sua) racional, autoritária e clara em suas decisões.', rev: 'Autoritarismo, crueldade ou uso do poder para manipular.' },
  },
  C: {
    A: { up: 'Faísca inicial de inspiração, energia e vontade de começar algo novo.', rev: 'Falta de direção ou motivação que ainda não encontrou saída.' },
    2: { up: 'Planejamento de algo maior; olhando para o horizonte e traçando o próximo passo.', rev: 'Medo de sair da zona de conforto e assumir um plano ousado.' },
    3: { up: 'Expansão; os primeiros resultados de um projeto começam a aparecer.', rev: 'Atraso ou obstáculos inesperados no que estava planejado.' },
    4: { up: 'Celebração, estabilidade e um momento de conquista compartilhada.', rev: 'Uma comemoração adiada ou instabilidade na base de algo bom.' },
    5: { up: 'Competição ou conflito de egos — energias disputando espaço.', rev: 'Fim de uma disputa, ou conflitos internos ainda não resolvidos.' },
    6: { up: 'Vitória reconhecida publicamente; méritos sendo recompensados.', rev: 'Reconhecimento adiado ou orgulho excessivo atrapalhando.' },
    7: { up: 'Persistência diante de desafios; defender sua posição com determinação.', rev: 'Sentir-se sobrecarregado e prestes a desistir da defesa.' },
    8: { up: 'Movimento rápido; notícias, viagens ou decisões que se resolvem de uma vez.', rev: 'Atrasos frustrantes ou coisas acontecendo rápido demais para acompanhar.' },
    9: { up: 'Resiliência; você está quase lá, mesmo cansado de tanto lutar.', rev: 'Exaustão ou desconfiança que impede de pedir ajuda.' },
    10: { up: 'Sobrecarga de responsabilidades — carregando mais peso do que deveria sozinho.', rev: 'Hora de delegar ou soltar um fardo que não é mais seu.' },
    J: { up: 'Uma pessoa (ou parte sua) entusiasmada, cheia de ideias e vontade de agir.', rev: 'Impulsividade ou notícia envolvendo um novo projeto que ainda é instável.' },
    Q: { up: 'Uma pessoa (ou parte sua) confiante, carismática e independente.', rev: 'Insegurança escondida atrás de uma postura confiante demais.' },
    K: { up: 'Uma pessoa (ou parte sua) visionária, corajosa e nata para liderar.', rev: 'Impulsividade, arrogância ou liderança que vira autoritarismo.' },
  },
};

const POSITIONS_3 = [
  { key: 'past', label: 'Passado', hint: 'O que trouxe você até aqui' },
  { key: 'present', label: 'Presente', hint: 'Onde você está agora' },
  { key: 'future', label: 'Futuro', hint: 'Para onde as coisas caminham' },
];

/** Retorna a leitura completa de uma carta. rank: 'A'..'K' ; suitKey: 'H'|'D'|'S'|'C' */
function getCardReading(rank, suitKey, reversed) {
  const suit = SUITS[suitKey];
  const m = MEANINGS[suitKey][rank];
  return {
    rank,
    suitKey,
    name: `${RANK_NAME[rank]} de ${suit.name}`,
    suitName: suit.name,
    symbol: suit.symbol,
    color: suit.color,
    element: suit.element,
    reversed: !!reversed,
    text: reversed ? m.rev : m.up,
  };
}

/** Pequena síntese heurística para tiragens de 3 cartas, combinando os naipes presentes. */
function synthesize3(readings) {
  const suitsPresent = new Set(readings.map(r => r.suitKey));
  const nRev = readings.filter(r => r.reversed).length;
  let base;
  if (suitsPresent.size === 1) {
    const s = SUITS[[...suitsPresent][0]];
    base = `As três cartas vêm do mesmo naipe (${s.name}): o tema de ${s.element.split(' — ')[1]} domina toda essa fase, do passado ao futuro.`;
  } else if (suitsPresent.size === 3) {
    base = 'As três cartas vêm de naipes diferentes: passado, presente e futuro pedem atenção a áreas distintas da vida — vale olhar cada uma com calma.';
  } else {
    base = 'Duas das três cartas compartilham o mesmo naipe, indicando um fio condutor entre parte dessa jornada.';
  }
  if (nRev >= 2) base += ' Várias cartas invertidas sugerem um momento de introspecção — algo pede para ser revisto por dentro antes de agir por fora.';
  return base;
}

if (typeof module !== 'undefined') {
  module.exports = { SUITS, RANKS, RANK_NAME, MEANINGS, POSITIONS_3, getCardReading, synthesize3 };
}
