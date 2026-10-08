# OmniHarp

Sintetizador de acordes inspirado em autoharps eletrônicos dos anos 80: grade de
acordes, *strumplate* de 24 cordas, bateria eletrônica e arpejador. Roda no
navegador (desktop e celular), pode ser instalado como app (PWA, funciona
offline) e empacotado como app nativo Android/iOS com Capacitor.

## Recursos

- 72 acordes (maior, menor, 7, m7, Maj7, °7) e strumplate de 4 oitavas
- 7 ritmos e arpejador com 7 modos, sincronizados no mesmo relógio
- **Tom**: destaca os acordes do campo harmônico escolhido
- **REC**: grava o que você toca e baixa/compartilha o áudio (WebM ou M4A)
- **MIDI**: toque um acorde num teclado MIDI e o OmniHarp acompanha
  (Chrome/Edge/Android; o Safari não suporta Web MIDI)
- Configurações salvas no aparelho; interface em português ou inglês
  conforme o idioma do sistema; tela não apaga enquanto o instrumento está ligado

## Layouts

| Tela | Layout |
|---|---|
| Desktop e tablet | instrumento completo, ocupa a altura da tela sem rolagem |
| Celular deitado | grade com 3 linhas de acordes por vez (⇅ alterna básicos/estendidos), strumplate ao lado, controles no painel ⚙ |
| Celular em pé | grade transposta (12 notas × 3 tipos), strumplate vertical à direita (graves embaixo), controles no painel ⚙ |

## Desenvolvimento

Requer Node 20.19+.

```bash
npm install
npm run dev        # servidor local com hot reload
npm test           # testes unitários (Vitest)
npm run typecheck  # checagem de tipos
npm run build      # build de produção em dist/
npm run preview    # serve o build de dist/
```

## Deploy (Vercel)

O `vercel.json` já define build (`npm run build`), saída (`dist`) e os
cabeçalhos de cache (o `sw.js` nunca fica em cache; `assets/` é imutável).
Basta importar o repositório no Vercel.

O service worker é gerado no build (`src/sw.js` → `dist/sw.js`) com a lista
exata de arquivos; cada deploy cria um cache novo e apaga o anterior.

## Apps nativos (Capacitor)

Os projetos `android/` e `ios/` já estão no repositório, com ícones, splash,
tela sempre acesa e (iOS) áudio tocando mesmo com a chave de silencioso.

```bash
npm run cap:android   # build + sync + abre no Android Studio
npm run cap:ios       # build + sync + abre no Xcode (requer macOS)
```

Depois de mudar o código web, rode `npm run cap:sync` antes de compilar o app.
Para trocar o ícone: edite `scripts/icon.svg`, rode `npm run icons` (PWA) e
`node scripts/gen-native-assets.cjs && npx @capacitor/assets generate --ios --android`
(nativos). Ambos os scripts usam o Playwright.

## Estrutura

```
index.html              marcação do instrumento (entrada do Vite)
src/
  main.ts               controlador: estado, energia, ligação entre UI e áudio
  settings.ts           valores padrão dos controles (fonte única da verdade)
  theory.ts             notas, tipos de acorde, distribuição das cordas
  patterns.ts           padrões de ritmo (grade em semicolcheias ou tercinas)
  arp.ts                modos do arpejador e velocidades
  sequencer.ts          relógio único de ritmo + arpejo (agendamento no AudioContext)
  audio/engine.ts       AudioContext, mixer, reverb, ciclo de vida
  audio/instruments.ts  acorde sustentado, corda dedilhada, bateria
  ui/                   grade de acordes, strumplate, teclado, robô
  i18n.ts               textos pt-BR / en
  storage.ts            configurações salvas (localStorage, validadas)
  sw.js                 service worker (modelo preenchido no build)
  audio/recorder.ts     gravação do master (MediaRecorder)
  platform/             PWA, wake lock, MIDI, integração nativa (Capacitor)
  styles.css
android/, ios/          projetos nativos (Capacitor)
tests/                  testes de teoria, padrões, arpejo e sequenciador
```

## Vídeos promocionais

`promo/` gera vídeos verticais (1080×1920, 30 fps) com a interface real do app e
trilhas renderizadas pelo próprio motor de áudio. Cada vídeo tem uma partitura
única — imagem e som ficam sincronizados por quadro.

| Vídeo | Partitura | Saída |
|---|---|---|
| Recursos (32 s) | `promo/score.ts` | `promo/out/omniharp-promo.mp4` |
| História "Conexão" (34 s): o robô triste num mundo cinza encontra um cabo, se pluga e o OmniHarp ganha vida | `promo/story-score.ts` | `promo/out/omniharp-story.mp4` |

```bash
NODE_PATH="$(npm root -g)" npm run promo                    # vídeo de recursos
NODE_PATH="$(npm root -g)" npm run promo -- --video story   # vídeo da história
NODE_PATH="$(npm root -g)" npm run promo -- --video story --stills 12,20   # quadros soltos
```

O robô da história (`promo/lib/robot.ts`) é um boneco vetorial articulado com a
mesma tela CRT do ícone; as expressões ficam em `promo/lib/face.ts`.

Requer Playwright com Chromium instalado globalmente e `ffmpeg`. Para mostrar o
endereço do app no final, preencha `CTA_URL` em `promo/score.ts`.

## Atalhos de teclado

Usam a posição física das teclas (funciona em teclados US e ABNT2).

| Teclas | Ação |
|---|---|
| `1` … `=` | acordes com sétima (C7 … B7) |
| `Q` … `]` | acordes maiores (C … B) |
| `A` … `\` | acordes menores (Cm … Bm) |
| `Espaço` | liga/desliga o ritmo |
| `Esc` | silencia o acorde |
| `Enter` | liga o instrumento |
