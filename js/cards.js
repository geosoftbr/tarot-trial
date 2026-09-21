/**
 * cards.js — Baralho comum (52 cartas) com leitura no estilo tarô (cartomancia).
 *
 * Cada naipe do baralho comum corresponde a um naipe clássico do tarô:
 *   Ouros  -> Ouros/Moedas  (dinheiro, trabalho, corpo, o material)
 *   Copas  -> Copas          (emoções, relações, intuição)
 *   Espadas-> Espadas        (mente, conflitos, decisões, verdades)
 *   Paus   -> Paus/Bastões   (ação, criatividade, desejo, projetos)
 *
 * Cada carta traz, além da leitura geral (upright/invertida), um recorte
 * dedicado a trabalho ("work"), sempre exibido junto com o texto geral.
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

// Leituras por naipe + número: up/rev (leitura geral) e work.up/work.rev
// (recorte de trabalho, sempre exibido junto com a leitura geral).
const MEANINGS = {
  H: {
    A: { up: 'Um novo sentimento nasce: amor, alegria ou uma conexão verdadeira começando a florescer. É o convite para se abrir emocionalmente e deixar entrar algo puro, sem precisar controlar o resultado.', rev: 'Coração fechado ou uma emoção represada pedindo espaço para aparecer — algo que você sente, mas ainda não conseguiu nomear.',
      work: { up: 'No trabalho: o começo de uma parceria ou projeto que nasce de afinidade genuína com a equipe, não só de obrigação — bom momento para propor algo que vem do coração.', rev: 'No trabalho: dificuldade em se conectar com colegas ou em sentir prazer no que faz agora; vale notar se o desânimo é passageiro ou um sinal maior.' } },
    2: { up: 'União, parceria e atração mútua — um vínculo equilibrado se fortalece, com escuta e reciprocidade dos dois lados.', rev: 'Desencontro afetivo ou uma relação desequilibrada, em que um lado dá mais do que recebe; falta uma conversa sincera.',
      work: { up: 'No trabalho: uma parceria ou sociedade que funciona bem porque as duas partes se respeitam — bom momento para negociações e alianças.', rev: 'No trabalho: uma parceria desequilibrada, em que o esforço não é dividido de forma justa; pode ser hora de reajustar combinados.' } },
    3: { up: 'Celebração, amizade e alegrias compartilhadas com quem você ama — um momento de conexão social genuína, sem competição.', rev: 'Excessos, fofoca ou um terceiro complicando um vínculo que até pouco tempo atrás era simples.',
      work: { up: 'No trabalho: reconhecimento em equipe, comemorações de conquistas coletivas e um ambiente colaborativo que vale a pena cultivar.', rev: 'No trabalho: fofoca de corredor ou uma dinâmica de grupo que exclui alguém; fique atento a triangulações.' } },
    4: { up: 'Momento de reflexão emocional; algo bom pode estar diante de você, mas o tédio ou a rotina fazem passar despercebido.', rev: 'Saindo do tédio e reabrindo os olhos para novas possibilidades afetivas que estavam ali o tempo todo.',
      work: { up: 'No trabalho: apatia ou piloto automático numa função que já não estimula — vale reparar em oportunidades que você tem ignorado por comodismo.', rev: 'No trabalho: o interesse volta a aparecer; um projeto novo ou uma mudança de rotina reacende a motivação.' } },
    5: { up: 'Perda ou decepção que dói, mas ainda há copas de pé — nem tudo está perdido, mesmo que a dor pareça ocupar todo o campo de visão agora.', rev: 'Aceitação e perdão começando a se formar; a hora de soltar o que já passou e olhar para o que ainda resta.',
      work: { up: 'No trabalho: uma decepção com um projeto, uma vaga ou um reconhecimento que não veio — dói, mas não anula o que você já construiu até aqui.', rev: 'No trabalho: você começa a fazer as pazes com uma frustração profissional e a enxergar o caminho à frente de novo.' } },
    6: { up: 'Nostalgia, memórias de infância e reencontros que aquecem o coração — um contato com raízes que faz bem.', rev: 'Viver preso ao passado impede de aproveitar o presente; comparar tudo com "como era antes" trava o avanço.',
      work: { up: 'No trabalho: contato com uma experiência, um mentor ou uma habilidade antiga que volta a ser útil agora, de um jeito inesperado.', rev: 'No trabalho: apego a métodos ou glórias antigas que já não servem à realidade atual da função.' } },
    7: { up: 'Muitas possibilidades e sonhos diante de você — a imaginação está fértil, mas é preciso cuidado para não se perder em fantasias sem raiz.', rev: 'Clareza chegando: hora de escolher um caminho real em vez de girar entre opções que só existem na cabeça.',
      work: { up: 'No trabalho: muitas ideias e caminhos possíveis de carreira ou projeto — o desafio é escolher um e tirar do papel, em vez de sonhar com todos ao mesmo tempo.', rev: 'No trabalho: finalmente fica claro qual projeto ou direção profissional vale o foco agora.' } },
    8: { up: 'Deixar algo emocionalmente confortável para trás em busca de algo mais profundo e verdadeiro, mesmo que doa sair.', rev: 'Medo de seguir em frente prende você numa situação que já não faz sentido, só porque é conhecida.',
      work: { up: 'No trabalho: coragem de deixar um emprego, cargo ou rotina confortável demais em busca de algo mais alinhado com o que você quer para si.', rev: 'No trabalho: permanecer num lugar por medo da mudança, mesmo sabendo que ali não há mais crescimento.' } },
    9: { up: 'Satisfação, gratidão e um desejo realizado — a chamada "carta dos desejos", quando o esforço finalmente se traduz em contentamento.', rev: 'Satisfação superficial ou excessos em busca de prazer que não preenchem o vazio de verdade.',
      work: { up: 'No trabalho: a sensação de dever cumprido, um objetivo profissional alcançado e reconhecido, motivo real de orgulho.', rev: 'No trabalho: uma conquista que parece boa por fora, mas deixa uma sensação de vazio ou de "não era bem isso".' } },
    10: { up: 'Harmonia plena em família, felicidade duradoura e paz emocional — uma base sólida que sustenta o resto da vida.', rev: 'Briga familiar ou uma harmonia que existe só na aparência, escondendo tensões que ainda não foram ditas.',
      work: { up: 'No trabalho: um time ou ambiente em que as pessoas realmente se dão bem, com um propósito comum que vai além da tarefa do dia a dia.', rev: 'No trabalho: uma equipe que parece unida por fora, mas tem conflitos represados que cedo ou tarde vêm à tona.' } },
    J: { up: 'Uma pessoa (ou parte sua) sensível, romântica e criativa trazendo uma mensagem afetiva — alguém que sente antes de racionalizar.', rev: 'Imaturidade emocional ou uma notícia sentimental que pega de surpresa e mexe mais do que deveria.',
      work: { up: 'No trabalho: alguém (ou você) traz sensibilidade e criatividade ao time — bom para tarefas que pedem empatia, atendimento ou um olhar mais humano.', rev: 'No trabalho: reações emocionais desproporcionais a uma crítica ou situação, atrapalhando a comunicação profissional.' } },
    Q: { up: 'Uma pessoa (ou parte sua) intuitiva, acolhedora e compassiva, cuidando de quem ama sem esperar nada em troca.', rev: 'Emoção à flor da pele, carência ou dificuldade em colocar limites afetivos claros com quem está por perto.',
      work: { up: 'No trabalho: uma liderança ou colega que acolhe o time, ouve de verdade e cria um ambiente psicologicamente seguro.', rev: 'No trabalho: dificuldade em dizer não, assumindo tarefas ou problemas alheios além da própria capacidade.' } },
    K: { up: 'Uma pessoa (ou parte sua) emocionalmente equilibrada, generosa e madura nos sentimentos, que sabe sentir sem ser dominada pelo sentimento.', rev: 'Frieza, manipulação emocional ou dificuldade em lidar com os próprios sentimentos, escondendo-os atrás do controle.',
      work: { up: 'No trabalho: uma liderança serena, que decide com equilíbrio entre razão e empatia, sem se deixar levar por picos emocionais.', rev: 'No trabalho: uso da posição ou da calma aparente para manipular pessoas ou evitar assumir responsabilidade emocional por decisões.' } },
  },
  D: {
    A: { up: 'Nova oportunidade material: dinheiro, trabalho ou um projeto concreto começando com o pé direito, com potencial real de crescer.', rev: 'Oportunidade perdida ou insegurança financeira pedindo atenção antes que vire um problema maior.',
      work: { up: 'No trabalho: uma proposta, vaga ou projeto novo surge com bases sólidas — vale considerar com seriedade.', rev: 'No trabalho: uma chance boa passou despercebida, ou a insegurança financeira está pesando mais do que deveria nas decisões de carreira.' } },
    2: { up: 'Equilíbrio entre várias responsabilidades — você está malabarizando bem as prioridades, mesmo sob pressão.', rev: 'Sobrecarga e desorganização financeira ou de agenda, com bolas prestes a cair.',
      work: { up: 'No trabalho: boa capacidade de dividir o tempo entre várias tarefas ou projetos sem perder a qualidade de nenhum.', rev: 'No trabalho: excesso de tarefas simultâneas ameaçando a entrega de tudo; hora de repriorizar ou pedir ajuda.' } },
    3: { up: 'Trabalho em equipe reconhecido; habilidade técnica e colaboração dando bons frutos visíveis para quem está de fora.', rev: 'Falta de coordenação ou um trabalho bem-feito que não foi reconhecido como deveria.',
      work: { up: 'No trabalho: um projeto colaborativo caminha bem porque cada pessoa contribui com sua especialidade — ótimo momento para dividir tarefas.', rev: 'No trabalho: desalinhamento sobre quem faz o quê, gerando retrabalho, ou um esforço que passou despercebido por quem deveria notar.' } },
    4: { up: 'Segurança material e controle sobre o que você construiu — uma base estável, desde que não vire apego rígido demais.', rev: 'Apego excessivo a dinheiro ou posses, e medo de perder o que tem a ponto de travar novas decisões.',
      work: { up: 'No trabalho: estabilidade construída com esforço, um cargo ou renda consolidados — mas vale não travar em nome de uma zona de conforto.', rev: 'No trabalho: medo de arriscar uma mudança de carreira por apego à segurança atual, mesmo insatisfeito.' } },
    5: { up: 'Dificuldade financeira ou sensação de exclusão, mas ajuda está mais perto do que parece — só é preciso pedir ou aceitar.', rev: 'Recuperação começando; a fase mais dura financeira ou profissionalmente já passou.',
      work: { up: 'No trabalho: um momento de aperto, insegurança no cargo ou sensação de estar de fora do grupo — mas há suporte disponível, se você buscar.', rev: 'No trabalho: a superação de uma fase difícil de instabilidade profissional já está em curso.' } },
    6: { up: 'Generosidade e trocas justas — dar e receber em equilíbrio, sem que ninguém saia perdendo.', rev: 'Relação de poder desigual envolvendo dinheiro ou favores, em que um lado depende demais do outro.',
      work: { up: 'No trabalho: mentoria, ajuda mútua entre colegas ou uma negociação justa que beneficia as duas partes.', rev: 'No trabalho: favores ou ajudas que criam dependência ou dívida silenciosa entre colegas ou com a chefia.' } },
    7: { up: 'Avaliação do que foi plantado; hora de decidir se vale investir mais tempo e dinheiro, ou colher o que já está pronto.', rev: 'Impaciência, ou um investimento de tempo e dinheiro que não está compensando como esperado.',
      work: { up: 'No trabalho: momento de avaliar se um projeto de longo prazo está valendo o esforço investido, com calma e números reais.', rev: 'No trabalho: ansiedade por resultados que ainda não vieram, ou insistência num projeto que já mostrou não compensar.' } },
    8: { up: 'Dedicação, aprendizado e aperfeiçoamento de uma habilidade ou ofício, com foco quase artesanal no que está sendo feito.', rev: 'Falta de foco ou um trabalho feito sem capricho, só para cumprir tabela.',
      work: { up: 'No trabalho: fase de estudo, especialização ou aperfeiçoamento técnico que vai valer a pena no médio prazo.', rev: 'No trabalho: entregas feitas no automático, sem capricho, correndo o risco de comprometer a reputação profissional.' } },
    9: { up: 'Conquista pelo próprio esforço; independência e conforto material merecidos, construídos sem depender de ninguém.', rev: 'Isolamento apesar do conforto, ou dificuldade em realmente desfrutar do que já foi conquistado.',
      work: { up: 'No trabalho: autonomia conquistada com mérito — um cargo, negócio ou renda que são fruto direto do seu esforço.', rev: 'No trabalho: sucesso que veio acompanhado de solidão, excesso de trabalho ou dificuldade em delegar.' } },
    10: { up: 'Prosperidade duradoura, legado e estabilidade para a família — uma conquista que atravessa gerações ou vai além de você.', rev: 'Conflitos de herança ou instabilidade surgindo numa base que parecia sólida.',
      work: { up: 'No trabalho: um negócio, carreira ou patrimônio profissional sendo construído para durar, com solidez de longo prazo.', rev: 'No trabalho: disputas por reconhecimento, sucessão ou divisão de resultados dentro de um negócio ou sociedade.' } },
    J: { up: 'Uma pessoa (ou parte sua) estudiosa e prática, começando algo novo com os pés no chão e disposição para aprender fazendo.', rev: 'Procrastinação ou falta de compromisso real com um plano material que segue só no papel.',
      work: { up: 'No trabalho: alguém (ou você) em fase de aprendizado prático, disposto a começar de baixo para entender bem o ofício.', rev: 'No trabalho: planos e metas que nunca saem do papel por falta de disciplina para começar.' } },
    Q: { up: 'Uma pessoa (ou parte sua) prática, acolhedora e boa administradora dos recursos, que cuida do dinheiro e das pessoas ao mesmo tempo.', rev: 'Negligência com finanças, saúde ou rotina de cuidado, deixando o básico de lado.',
      work: { up: 'No trabalho: uma gestão competente e humana dos recursos e da equipe, equilibrando resultado com bem-estar.', rev: 'No trabalho: descuido com processos, prazos ou com o próprio bem-estar em nome da produtividade.' } },
    K: { up: 'Uma pessoa (ou parte sua) próspera, confiável e generosa nos negócios, que constrói riqueza sem perder a integridade.', rev: 'Materialismo excessivo ou rigidez no controle do dinheiro, medindo tudo só pelo retorno financeiro.',
      work: { up: 'No trabalho: uma liderança ou posição de autoridade sólida no meio profissional, reconhecida pela competência e pela palavra.', rev: 'No trabalho: decisões guiadas só pelo lucro, ou um controle financeiro tão rígido que sufoca a equipe.' } },
  },
  S: {
    A: { up: 'Clareza mental repentina; uma verdade ou decisão corta a confusão como uma lâmina, trazendo alívio mesmo que doa.', rev: 'Confusão de ideias, ou uma verdade sendo usada de forma injusta contra alguém.',
      work: { up: 'No trabalho: uma decisão importante fica clara de repente, ou uma informação nova corta um impasse que travava um projeto.', rev: 'No trabalho: informações truncadas, mal-entendidos ou uma verdade usada de forma política para prejudicar alguém.' } },
    2: { up: 'Impasse: duas opções difíceis exigem uma decisão que você vem evitando, mesmo sabendo que a espera já é uma escolha.', rev: 'Indecisão prolongada gerando ainda mais tensão e um desgaste que poderia ser evitado.',
      work: { up: 'No trabalho: uma escolha profissional difícil — entre dois caminhos, propostas ou projetos — não pode mais ser adiada.', rev: 'No trabalho: indecisão sobre uma proposta, mudança de área ou conflito, deixando tudo em suspenso por tempo demais.' } },
    3: { up: 'Dor emocional clara e inevitável — uma mágoa, crítica ou perda que precisa ser sentida de verdade para poder curar.', rev: 'Início da cura de uma dor antiga, ou a reabertura de uma ferida que parecia superada.',
      work: { up: 'No trabalho: uma crítica dura, um corte ou uma decepção profissional que machuca, mas traz também uma verdade necessária.', rev: 'No trabalho: uma mágoa profissional antiga volta à tona, ou finalmente começa a cicatrizar.' } },
    4: { up: 'Pausa necessária; descanso mental antes de retomar a luta, para não desmoronar por excesso de tensão acumulada.', rev: 'Esgotamento por não ter parado a tempo, ou uma volta forçada à ação antes de estar pronto.',
      work: { up: 'No trabalho: hora de tirar férias, um dia de folga ou simplesmente desacelerar antes que o esgotamento vire algo mais sério.', rev: 'No trabalho: burnout batendo à porta por não ter respeitado os próprios limites, ou retorno apressado demais de uma pausa.' } },
    5: { up: 'Vitória que custou caro, ou um conflito em que, no fundo, ninguém sai realmente ganhando.', rev: 'Momento de deixar uma briga de lado e buscar reconciliação, mesmo que o orgulho resista.',
      work: { up: 'No trabalho: uma disputa interna, mesmo vencida, deixa um gosto amargo e prejudica o clima da equipe a médio prazo.', rev: 'No trabalho: hora de fazer as pazes com um colega ou área depois de um conflito, em vez de insistir em ter razão.' } },
    6: { up: 'Transição para águas mais calmas; deixando um período difícil para trás, mesmo que a travessia ainda esteja em curso.', rev: 'Dificuldade em seguir em frente, resistência a uma mudança que já é necessária.',
      work: { up: 'No trabalho: uma mudança de emprego, área ou equipe que, mesmo desconfortável no início, leva a um lugar mais tranquilo.', rev: 'No trabalho: resistência a uma transição profissional necessária, prolongando uma situação desgastante.' } },
    7: { up: 'Estratégia, esperteza ou uma ação feita às escondidas — cuidado com meias-verdades, mesmo as ditas com boa intenção.', rev: 'Uma mentira vindo à tona, ou culpa por um comportamento evasivo que pesa na consciência.',
      work: { up: 'No trabalho: bom momento para agir com estratégia e discrição num projeto sensível — mas sem cruzar a linha da desonestidade.', rev: 'No trabalho: uma omissão, atalho antiético ou informação escondida sendo descoberta, com risco à credibilidade.' } },
    8: { up: 'Sensação de estar preso, embora as amarras sejam mais mentais do que reais — as saídas existem, mas o medo as esconde.', rev: 'Libertação de um padrão de pensamento limitante que fazia você se sentir mais preso do que realmente estava.',
      work: { up: 'No trabalho: sensação de estar numa função sem saída, quando na prática existem opções que o medo não deixa enxergar.', rev: 'No trabalho: a percepção muda e fica claro que havia mais liberdade de escolha profissional do que você imaginava.' } },
    9: { up: 'Ansiedade, insônia ou preocupações que crescem mais na mente do que na realidade dos fatos.', rev: 'Alívio depois de encarar o medo de frente, ou um desespero que já pede ajuda de verdade.',
      work: { up: 'No trabalho: noites maldormidas por causa de um prazo, uma avaliação ou um problema que, na prática, tem solução mais simples do que parece à noite.', rev: 'No trabalho: alívio depois de finalmente conversar sobre a pressão, ou um sinal de que a ansiedade com o trabalho já passou do ponto saudável.' } },
    10: { up: 'Um fim doloroso, mas definitivo — o pior já passou, e só resta reconstruir a partir daqui.', rev: 'Resistência a encerrar algo que já claramente acabou, prolongando um sofrimento desnecessário.',
      work: { up: 'No trabalho: o fim de um ciclo profissional difícil — uma demissão, um projeto encerrado, uma fase de crise — que, por pior que tenha sido, abre espaço para recomeçar.', rev: 'No trabalho: dificuldade em admitir que um projeto, cargo ou ciclo profissional já chegou ao fim.' } },
    J: { up: 'Uma pessoa (ou parte sua) curiosa e vigilante, atenta a informações, notícias e detalhes que outros deixam passar.', rev: 'Fofoca, más notícias ou um plano mal executado por pressa ou falta de cuidado.',
      work: { up: 'No trabalho: alguém (ou você) atento a detalhes e informações estratégicas, útil para investigação, análise ou pesquisa.', rev: 'No trabalho: fofoca circulando pelo escritório, ou um plano mal comunicado gerando confusão na equipe.' } },
    Q: { up: 'Uma pessoa (ou parte sua) direta, independente e de raciocínio afiado, que prefere a verdade curta a um consolo confortável.', rev: 'Frieza excessiva ou uma mágoa antiga que, sem perceber, virou amargura.',
      work: { up: 'No trabalho: uma liderança ou colega que fala com clareza e independência, sem rodeios — valiosa em decisões difíceis.', rev: 'No trabalho: uma postura fria ou cortante demais com a equipe, afastando pessoas mesmo sem essa intenção.' } },
    K: { up: 'Uma pessoa (ou parte sua) racional, autoritária e clara em suas decisões, que usa a lógica como bússola principal.', rev: 'Autoritarismo, crueldade ou uso do poder para manipular em vez de liderar.',
      work: { up: 'No trabalho: uma liderança técnica, justa e objetiva, que decide com base em lógica e dados, não em favoritismo.', rev: 'No trabalho: uma chefia autoritária, que usa a posição para intimidar ou manipular em vez de orientar.' } },
  },
  C: {
    A: { up: 'Faísca inicial de inspiração, energia e vontade de começar algo novo — o impulso puro antes de qualquer plano.', rev: 'Falta de direção ou motivação que ainda não encontrou por onde sair.',
      work: { up: 'No trabalho: a ideia inicial de um projeto, negócio ou mudança de carreira surge com força total — bom momento para dar o primeiro passo.', rev: 'No trabalho: falta de motivação ou clareza sobre que direção profissional tomar, com a energia meio dispersa.' } },
    2: { up: 'Planejamento de algo maior; olhando para o horizonte e traçando o próximo passo com ambição realista.', rev: 'Medo de sair da zona de conforto e assumir um plano ousado que já está pronto na cabeça.',
      work: { up: 'No trabalho: fase de planejamento estratégico, olhando para onde a carreira ou o projeto pode crescer nos próximos passos.', rev: 'No trabalho: um plano ambicioso engavetado por medo de arriscar ou de pedir a mudança que você quer.' } },
    3: { up: 'Expansão; os primeiros resultados de um projeto começam a aparecer, confirmando que o caminho escolhido funciona.', rev: 'Atraso ou obstáculos inesperados no que estava planejado, exigindo ajuste de rota.',
      work: { up: 'No trabalho: um projeto ou negócio começa a mostrar os primeiros frutos concretos do investimento feito.', rev: 'No trabalho: atrasos, fornecedores ou parceiros que não entregam no combinado, travando o crescimento esperado.' } },
    4: { up: 'Celebração, estabilidade e um momento de conquista compartilhada com quem ajudou a construir o caminho até aqui.', rev: 'Uma comemoração adiada, ou instabilidade na base de algo que parecia sólido.',
      work: { up: 'No trabalho: uma conquista profissional que merece ser celebrada com a equipe — reconhecimento coletivo bem-vindo.', rev: 'No trabalho: uma conquista que ainda não pode ser comemorada porque a base do projeto ou da empresa está instável.' } },
    5: { up: 'Competição ou conflito de egos — energias fortes disputando espaço, sem necessariamente um vilão nessa história.', rev: 'Fim de uma disputa, ou conflitos internos que ainda não foram totalmente resolvidos.',
      work: { up: 'No trabalho: competição saudável (ou nem tanto) entre colegas ou áreas disputando os mesmos recursos ou reconhecimento.', rev: 'No trabalho: uma rivalidade profissional se resolvendo, ou uma disputa que voltou para dentro e virou desmotivação.' } },
    6: { up: 'Vitória reconhecida publicamente; méritos sendo recompensados diante de quem importa.', rev: 'Reconhecimento adiado, ou orgulho excessivo atrapalhando a forma como a vitória é recebida.',
      work: { up: 'No trabalho: uma conquista, promoção ou projeto bem-sucedido sendo reconhecido publicamente pela equipe ou liderança.', rev: 'No trabalho: um mérito que demora a ser reconhecido, ou um sucesso que vira arrogância na forma de tratar os colegas.' } },
    7: { up: 'Persistência diante de desafios; defender sua posição com determinação, mesmo em desvantagem no início.', rev: 'Sentir-se sobrecarregado e prestes a desistir da defesa, mesmo perto de vencer.',
      work: { up: 'No trabalho: defender uma ideia, projeto ou posição diante de resistência, mesmo quando parece que está pregando sozinho.', rev: 'No trabalho: vontade de jogar a toalha diante da pressão, justamente quando falta pouco para o reconhecimento vir.' } },
    8: { up: 'Movimento rápido; notícias, viagens ou decisões profissionais que se resolvem de uma vez, sem enrolação.', rev: 'Atrasos frustrantes, ou coisas acontecendo rápido demais para acompanhar direito.',
      work: { up: 'No trabalho: uma resposta, proposta ou decisão que estava parada se resolve rapidamente — fique atento às próximas semanas.', rev: 'No trabalho: um processo (contratação, resposta, aprovação) travado sem explicação clara, ou mudanças acontecendo rápido demais para a equipe se adaptar.' } },
    9: { up: 'Resiliência; você está quase lá, mesmo cansado de tanto lutar por essa conquista.', rev: 'Exaustão ou desconfiança que impede de pedir ajuda mesmo precisando dela.',
      work: { up: 'No trabalho: a reta final de um projeto puxado, em que a experiência acumulada segura as pontas mesmo com o cansaço.', rev: 'No trabalho: desgaste acumulado e relutância em admitir que precisa de apoio da equipe ou da liderança.' } },
    10: { up: 'Sobrecarga de responsabilidades — carregando mais peso profissional do que seria saudável sozinho.', rev: 'Hora de delegar ou soltar um fardo que, no fundo, já não é mais só seu.',
      work: { up: 'No trabalho: acúmulo de tarefas e responsabilidades além da conta, um sinal de que a divisão de trabalho na equipe precisa mudar.', rev: 'No trabalho: aprender a delegar ou dizer não a mais uma tarefa, antes que a sobrecarga vire esgotamento.' } },
    J: { up: 'Uma pessoa (ou parte sua) entusiasmada, cheia de ideias e vontade de agir, mesmo sem todos os detalhes resolvidos.', rev: 'Impulsividade, ou uma notícia envolvendo um novo projeto que ainda é instável demais para se animar.',
      work: { up: 'No trabalho: alguém (ou você) trazendo entusiasmo e ideias novas para a equipe, ótimo para tirar projetos parados do papel.', rev: 'No trabalho: decisões profissionais tomadas por impulso, sem avaliar direito os riscos envolvidos.' } },
    Q: { up: 'Uma pessoa (ou parte sua) confiante, carismática e independente, que inspira só de estar por perto.', rev: 'Insegurança escondida atrás de uma postura confiante demais, que mais parece máscara.',
      work: { up: 'No trabalho: uma liderança carismática que motiva o time pelo exemplo, com autonomia e presença marcante.', rev: 'No trabalho: uma confiança que soa exagerada demais para ser verdadeira, escondendo insegurança sobre a própria capacidade.' } },
    K: { up: 'Uma pessoa (ou parte sua) visionária, corajosa e nata para liderar, capaz de assumir riscos calculados.', rev: 'Impulsividade, arrogância ou uma liderança que vira autoritarismo quando contrariada.',
      work: { up: 'No trabalho: uma liderança visionária, que assume riscos calculados e empurra a equipe para além do óbvio.', rev: 'No trabalho: decisões impulsivas de quem lidera, ou um estilo de gestão que vira autoritarismo sob pressão.' } },
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
    workText: reversed ? m.work.rev : m.work.up,
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
