# OmniSound

Sintetizador de acordes inspirado em autoharps eletrônicos dos anos 80: grade de
acordes, *strumplate* de 24 cordas, bateria eletrônica e arpejador. Roda no
navegador (desktop e celular), sem dependências em tempo de execução.

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

O Vercel detecta o projeto como **Vite** automaticamente:

- Build command: `npm run build`
- Output directory: `dist`

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
  styles.css
tests/                  testes de teoria, padrões, arpejo e sequenciador
```

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
