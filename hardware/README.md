# OmniHarp físico

Versão de hardware do OmniHarp: um instrumento independente, com teclas próprias,
strumplate capacitiva, som interno, saídas de áudio e MIDI, visor com o robozinho
e moldura de madeira. O app web continua sendo a referência de comportamento: o
firmware vai reproduzir a mesma lógica de `src/theory.ts`, `patterns.ts`, `arp.ts`,
`sequencer.ts` e `ui/robot.ts`.

> Status: **rascunho do painel** (para testar em papel e em maquete de MDF).
> Firmware e placas de circuito ainda não começaram.

## Decisões

| Tema | Decisão |
|---|---|
| Cérebro | Teensy 4.1 + Teensy Audio Shield Rev D (SGTL5000) |
| Som interno | Alto-falante retangular de faixa larga (~70 × 40 mm, 4 Ω, 3–5 W) numa caixa fechada de madeira, debaixo de uma grade retangular com a mesma largura da strumplate, com amplificador mono PAM8302A que fica mudo ao ligar, quando entra um fone ou pela chave |
| Saídas de áudio | 2 × P10 (L/MONO e R; com plugue só no L, o som vira mono), P2 de fone (isolado: o terra dele é o VGND do Audio Shield) |
| MIDI | Saída e entrada DIN de 5 pinos + USB-MIDI; acordes no canal 1, cordas no 2, arpejo no 3, bateria no 10 (General MIDI), MIDI Clock com Start/Stop |
| Extras | P10 para pedal de sustain, P2 de sincronia (pulso de tempo) |
| Teclas | 72 de acorde (6 × 12) + 12 de função, switches estilo MX em **soquetes hot-swap** (sem solda nos switches), teclas lisas compradas prontas, uma cor por fileira |
| Legendas | No painel: notas acima das colunas e tipo de acorde ao lado das fileiras (opção "c") |
| Strumplate | Coluna à direita, abaixo do alto-falante: PCB com 24 trilhas horizontais (passo de ~9 mm) e plano de terra, lida por 2 × MPR121, coberta por acrílico de 1 mm. Nunca coberta por madeira. |
| Controles | 10 sliders soldados na placa (o painel só tem os rasgos), encoder com botão (MENU), oitava pelas teclas OCT − / OCT + (o valor aparece no visor) |
| Visores | **Duas telas OLED iguais de 2,42" (SSD1309, 128 × 64, verdes)**, lado a lado: "Sys monitor" com o robô (mesmos rostos e tempos do app) e "Chord display" com o acorde desenhado em estilo de LED. Mesmo modelo, mesma janela e mesma altura; o espaçamento segue o tamanho da placa do módulo (~71 × 41 mm). Use as versões SPI (cada tela com seu pino de seleção), num barramento separado do sensor da strumplate. |
| Painel | Placa de circuito usada como painel: fibra de vidro preta, serigrafia branca, acabamento dourado (ENIG), dividida em 2 partes (controles e coluna da direita), presas à madeira por parafusos M3. A maquete é em MDF cortado a laser. |
| Moldura | Madeira maciça (freijó ou cedro, com detalhes em imbuia), base de compensado multilaminado, rebaixo onde o painel apoia, buchas roscadas M4, furos oblongos para a madeira se mover |
| Blindagem | Fita de alumínio por dentro da moldura, ligada ao terra; aterramento em estrela |

## Painel (`painel/`)

```bash
node hardware/painel/gerar.cjs
```

Gera em `hardware/painel/out/`:

| Arquivo | Para quê |
|---|---|
| `painel-A2.pdf` | Impressão em tamanho real numa folha A2 (gráfica, plotter) |
| `painel-A4.pdf` | Tamanho real em 6 folhas A4 com 10 mm de sobreposição (impressora de casa) |
| `painel-corte.dxf` | Só os cortes, para o corte a laser da maquete em MDF de 3 mm |
| `painel-corte.svg` | Cortes (vermelho), serigrafia (preto), peças (cinza tracejado), moldura (marrom) |
| `painel-visual.svg` / `.png` | Como o instrumento deve ficar pronto |

### Layout

Duas zonas, e cada uma é uma parte do painel:

- **Esquerda (controles):** tudo segue as 12 colunas das teclas (19,05 mm), então
  os controles têm exatamente a largura da grade de acordes. De cima para baixo:
  1. POWER, as duas telas (SYS MONITOR e CHORD DISPLAY), a marca OMNIHARP e o
     encoder MENU, encostado na borda direita da grade. O LED do tempo fica ao
     lado do título RHYTHM; a atividade MIDI aparece no SYS MONITOR.
  2. Sliders em três grupos: MIXER (colunas 1–6), RHYTHM (7–9) e ARPEGGIATOR (10–12).
  3. Teclas de função, cada uma embaixo do grupo dela. A tecla de liga/desliga
     de cada grupo (PLAY, ARP) fica na ponta direita, mais perto da mão que
     dedilha, com um LED ao lado. TAP tempo = SHIFT + PLAY.
  4. Nomes das notas e a grade de 6 × 12 acordes.
- **Direita:** grade retangular do alto-falante em cima (mesma largura da strumplate, para a coluna formar um bloco só) e strumplate embaixo, com as 24 cordas na
  horizontal, do agudo (fundo) ao grave (perto de quem toca), como no app com o
  celular em pé. O firmware pode inverter a ordem.

Medidas do rascunho: painel com **409 × 305 mm**; com a moldura, **469 × 335 mm**.
Strumplate de 110 × 231 mm, com cordas a cada ~9 mm.

### Pensado para a montagem

- **Uma placa por zona:**
  - placa das teclas: fileira de função + grade, a matriz 7 × 12;
  - placa dos sliders;
  - placa dos visores e encoder;
  - placa da strumplate;
  - alto-falante com amplificador, debaixo da grade de furos.
- O painel se divide na linha azul tracejada. Debaixo dessa emenda corre uma
  travessa de madeira que sustenta as duas partes.
- **Furos de fixação** de 3,6 mm para parafusos M3 nas bordas e dos dois lados da
  emenda, com folga para a madeira se mover.
- Todas as teclas usam a mesma medida de furo e o mesmo passo, então uma única
  placa de teclas segura as 84.
Todas as medidas ficam no topo do `gerar.cjs`. As marcadas com `CHECK` dependem da
peça comprada: meça com paquímetro e ajuste antes de mandar cortar.

**Ao imprimir:** escolha "tamanho real" ou "100%" e confira a régua de 100 mm no rodapé.

## Próximas etapas

1. **Teste em papel.** Imprima o A2, apoie na mesa, posicione as mãos e simule tocar. Anote o que estiver apertado ou longe.
2. **Comprar as peças críticas** (switches, sliders, OLED, mostradores, encoder, jaques) e medir. Atualize os valores `CHECK`.
3. **Maquete em MDF de 3 mm cortada a laser** (`painel-corte.dxf`), com as peças encaixadas.
4. **Protoboard:** Teensy + áudio + MIDI + alguns botões + strumplate de teste + robô.
5. **Firmware** (`firmware/`, PlatformIO): lógica do app portada para C++, com testes que comparam as notas geradas com as do app.
6. **Placas de circuito:** painel, placa das teclas (soquetes hot-swap e diodos montados pela fábrica), strumplate e placa principal. Faça um pedido de teste pequeno antes.
7. **Moldura** em madeira, primeiro numa maquete de compensado barato, depois na madeira final. Os gabaritos para a tupia são cortados a laser em MDF.
8. **Montagem, blindagem e calibração.**

## Solda

O projeto foi pensado para exigir pouca solda:

- Os switches entram em **soquetes hot-swap**.
- Diodos e componentes pequenos podem ser montados pela fábrica da placa (serviço de montagem).
- Sobram os pinos do Teensy e dos módulos, jaques, conectores DIN, sliders e encoder: algumas dezenas de pontos de solda de furo passante, ótimos para quem está aprendendo.
- Quem for ajudar deve ler o aviso sobre o **terra do fone** na tabela acima antes de ligar o jaque P2.
