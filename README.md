# Leitura de Cartas — PWA

App instalável (PWA) que usa a câmera do celular para fotografar uma carta
de baralho comum, reconhece o valor e o naipe **por processamento de imagem
local** (sem IA externa, sem enviar nada para a internet) e mostra uma
leitura no estilo tarô ao lado da foto.

## Como hospedar

É um site 100% estático (HTML/CSS/JS puro, sem build, sem backend). Basta
subir a pasta inteira em qualquer hospedagem estática com **HTTPS**
(obrigatório para a câmera funcionar fora de `localhost`):

- **Netlify / Vercel / Cloudflare Pages**: arraste a pasta no painel, ou
  `netlify deploy` / `vercel` na raiz do projeto.
- **GitHub Pages**: suba os arquivos para um repositório e ative o Pages
  nas configurações.
- **Servidor próprio**: qualquer Nginx/Apache/Caddy servindo os arquivos
  estáticos com HTTPS já funciona.

Para testar localmente antes de publicar:

```bash
python3 -m http.server 8080
# depois abra http://localhost:8080 no celular (mesma rede) ou no computador
```

`localhost` é uma exceção às regras de HTTPS dos navegadores, então a
câmera funciona mesmo em `http://localhost`.

## Instalar no celular

Depois de publicado com HTTPS, abra o link no navegador do celular:

- **Android (Chrome)**: menu ⋮ → "Adicionar à tela inicial" (ou o botão
  "Instalar" que aparece no próprio app).
- **iPhone (Safari)**: botão de compartilhar → "Adicionar à Tela de Início".

O app passa a abrir em tela cheia, com ícone próprio, e funciona **offline**
depois da primeira visita (o service worker guarda todos os arquivos).

## Como funciona o reconhecimento (sem IA, sem custo de tokens)

Tudo roda no próprio aparelho, em JavaScript puro:

1. **Localização da carta** — o app procura o maior retângulo claro da
   foto (limiar de Otsu + componentes conexos) e sugere os 4 cantos; a
   pessoa pode arrastar os pontos para ajustar.
2. **Correção de perspectiva** — os 4 cantos são mapeados para um
   retângulo padrão via transformação projetiva (método clássico de
   Heckbert), a mesma ideia usada em apps de "escanear documento".
3. **Leitura do índice do canto** — separa por componentes conexos o
   valor (em cima) do naipe (embaixo), mede a cor média da tinta
   (vermelho/preto) e compara a forma com modelos pré-gerados (uma vez,
   a partir de uma fonte serifada) por similaridade — sem rede neural,
   sem chamada de API.
4. **Confirmação manual** — a carta identificada aparece sempre destacada
   com a confiança da leitura; a pessoa pode corrigir em dois toques
   (naipe + valor) se o palpite automático errar.

Em testes com 52 cartas sintéticas (rotação, ruído e desfoque variados), o
reconhecimento automático acerta valor **e** naipe em ~84% dos casos, com
o naipe sozinho acertando ~92% e o valor sozinho ~89% — por isso a etapa
de confirmação manual é sempre exibida antes da leitura.

## Estrutura do projeto

```
index.html          telas do app (captura, ajuste, revisão, leitura)
css/styles.css       visual
js/cards.js          significados das 52 cartas (leitura estilo tarô)
js/geometry.js        perspectiva, escala de cinza, componentes conexos
js/recognizer.js      reconhecimento do valor/naipe a partir da carta já corrigida
js/templates-data.js  modelos de cada valor/naipe (gerados uma vez, embutidos)
js/app.js             interface, câmera, fluxo de captura → leitura
manifest.webmanifest  metadados do PWA
sw.js                 cache offline (app shell)
icons/                ícones do app (normal e "maskable")
```

Nenhum arquivo depende de rede: fontes, ícones e toda a lógica estão
embutidos no próprio projeto.
