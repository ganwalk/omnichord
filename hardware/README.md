# OmniHarp físico

Versão de hardware do OmniHarp: um instrumento independente, com pads de silicone próprios,
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
| Pads | 72 de acorde (6 × 12) + 12 de função: **pads de silicone translúcido**, baixos (4 mm acima do painel), como numa SPD ou num Launchpad. Uma única peça de silicone por baixo do painel, com uma pastilha condutiva sob cada pad, apertando contatos na placa. Cada pad tem um **LED RGB** embaixo (SK6812): a cor da fileira vem da luz, o acorde tocado acende forte e os acordes do tom acendem fraco. A peça de silicone pode ser feita sob medida (fábrica de teclados de silicone, com molde) ou, para o protótipo, moldada em silicone com moldes impressos em resina. |
| Legendas | No painel: notas acima das colunas e tipo de acorde ao lado das fileiras (opção "c") |
| Strumplate | Coluna à direita, abaixo do alto-falante: PCB com 24 trilhas horizontais (passo de ~9 mm) e plano de terra, lida por 2 × MPR121, coberta por acrílico de 1 mm. Nunca coberta por madeira. |
| Controles | 10 sliders soldados na placa (o painel só tem os rasgos), encoder com botão (MENU), oitava pelos pads OCT − / OCT +, de −2 a +2 (o valor aparece no visor) |
| Visores | **Duas telas coloridas iguais de 2,4" (IPS, 320 × 240, controlador ST7789 ou ILI9341, SPI)**, lado a lado: "Sys monitor" com o robô do app (verde, com as linhas de varredura) e "Chord display" com o acorde na cor da fileira dele, mais o estado do ritmo, do arpejo, da oitava e do tom, e o menu. Mesmo modelo, mesma janela (51 × 39 mm); o espaçamento segue a placa do módulo (~77 × 43 mm). Cada tela tem seu pino de seleção, num barramento separado do sensor da strumplate. |
| Painel | Placa de circuito usada como painel: fibra de vidro preta, serigrafia branca, acabamento dourado (ENIG), dividida em 2 partes (controles e coluna da direita), presas à madeira por parafusos M3. A maquete é em MDF cortado a laser. |
| Moldura | Madeira maciça de 20 mm (freijó ou cedro, com detalhes em imbuia), **a mesma largura nos quatro lados**, 55 mm de altura. Base de compensado multilaminado de 9 mm num rebaixo embaixo. O painel desce 1,5 mm abaixo da borda da madeira e apoia em sarrafos colados por dentro (10 × 15 mm), onde é parafusado; uma travessa de 16 mm sustenta a emenda. Conectores na parede de trás. |
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
| `layout.json` | Posição e função de cada controle, lida pelo gêmeo digital |
| `painel-interno.svg` / `.png` | Vista de dentro (planta sem o painel + corte de frente a trás) com as peças nas posições e alturas reais, e o resultado da checagem de folgas |

### Layout

Duas zonas, e cada uma é uma parte do painel:

- **Esquerda (controles):** tudo segue as 12 colunas dos pads (19,05 mm), então
  os controles têm exatamente a largura da grade de acordes. De cima para baixo:
  1. POWER, as duas telas (SYS MONITOR e CHORD DISPLAY), a marca OMNIHARP e o
     encoder MENU, encostado na borda direita da grade. A atividade MIDI aparece
     no SYS MONITOR.
  2. Sliders em três grupos: MIXER (colunas 1–6), RHYTHM (7–9) e ARPEGGIATOR (10–12).
  3. Pads de função, cada um embaixo do grupo dele. O pad de liga/desliga
     de cada grupo (PLAY, ARP) fica na ponta direita, mais perto da mão que
     dedilha, com um LED ao lado. TAP (bater o tempo) fica logo antes dos pads do
     ritmo, com um LED que pisca na batida.
  4. Nomes das notas e a grade de 6 × 12 acordes.
- **Direita:** grade retangular do alto-falante em cima (mesma largura da strumplate, para a coluna formar um bloco só) e strumplate embaixo, com as 24 cordas na
  horizontal, do agudo (fundo) ao grave (perto de quem toca), como no app com o
  celular em pé. O firmware pode inverter a ordem.

Medidas do rascunho: painel com **417 × 316 mm**; por fora, com a moldura, **457 × 356 × 55 mm**. Por dentro há 43 mm entre a base e o painel.
Strumplate de 110 × 231 mm, com cordas a cada ~9 mm.

### Pensado para a montagem

- **Uma placa por zona:**
  - placa dos pads: fileira de função + grade, a matriz 7 × 12, com os 84 LEDs;
  - placa dos sliders;
  - placa dos visores e encoder;
  - placa da strumplate;
  - alto-falante com amplificador, debaixo da grade de furos.
- O painel se divide na linha azul tracejada. Debaixo dessa emenda corre uma
  travessa de madeira que sustenta as duas partes.
- **Furos de fixação** de 3,6 mm para parafusos M3 nas bordas e dos dois lados da
  emenda, com folga para a madeira se mover.
- Todos os pads usam o mesmo furo e o mesmo passo, então uma única peça de
  silicone e uma única placa servem para os 84.
- **Consumo dos LEDs:** 84 LEDs no branco máximo puxariam ~5 A. O firmware limita
  o brilho (cerca de 20 %), o que fica abaixo de 1 A.
- **Checagem de folgas:** o gerador monta cada peça como uma caixa 3D (posição e
  altura) e avisa se duas ficam a menos de 1 mm uma da outra. Embaixo do painel
  ficam as telas, o encoder, os sliders, a placa dos pads, a strumplate com os
  MPR121 e a caixa do alto-falante; na base ficam o Teensy com o Audio Shield, as
  baterias, o carregador e o amplificador; os conectores entram pela parede de
  trás, por baixo das telas.
Todas as medidas ficam no topo do `gerar.cjs`. As marcadas com `CHECK` dependem da
peça comprada: meça com paquímetro e ajuste antes de mandar cortar.

**Ao imprimir:** escolha "tamanho real" ou "100%" e confira a régua de 100 mm no rodapé.

## Gêmeo digital (`twin.html`)

Uma página do app que desenha **este painel** (a partir do `layout.json`) e toca
com o mesmo motor de som:

```bash
npm run dev    # depois abra http://localhost:5173/twin.html
```

- Pads, sliders, encoder MENU, pads de função e strumplate vertical funcionam
  com mouse, toque ou teclado.
- As duas telas coloridas (320 × 240) mostram o robô do app e o acorde, com o
  menu (tom, LEDs dos pads, sentido da strumplate, brilho).
- O brilho dos pads mostra os LEDs RGB que ficam embaixo de cada um.
- Depois de mudar o painel, rode `node hardware/painel/gerar.cjs`: o gêmeo
  passa a usar o layout novo.

## Modelo 3D

O 3D faz parte do gêmeo digital. No site, a página **`/3d`** abre direto nele
(`omniharp.vercel.app/3d` depois do deploy); localmente, `twin.html#3d` ou o
botão **3D** no topo do gêmeo.
É o mesmo instrumento ao vivo: as telas mostram as telas do gêmeo, os pads
acendem, os sliders e o encoder se mexem e as cordas brilham quando tocadas.
Dá para tocar no próprio 3D (pads, sliders, encoder, botão de ligar e
strumplate); arrastar em qualquer outro lugar gira a vista. Vistas: tocar, frente,
de cima, traseira, por dentro e explodida. Passe o mouse numa peça para ver o
nome; nos cabos aparece também o comprimento.

```bash
node hardware/painel/gerar.cjs            # painel, peças, cabos (layout.json, model.json)
node hardware/3d/capturar-telas.mjs       # fotografa as telas do gêmeo para os desenhos
node hardware/painel/gerar.cjs            # de novo, para os desenhos usarem as fotos
python3 hardware/3d/modelo_step.py        # CAD: 3d/out/omniharp.step (pip install cadquery-ocp)
```

- **`omniharp.step`**: o conjunto inteiro para Onshape, Fusion ou FreeCAD, com nome
  e cor em cada peça: moldura, base, sarrafos, travessa, painel com os furos reais,
  pads, botões, placas, conectores, conectores da traseira e todos os cabos.
- **Fiação:** `painel/out/fiacao.md` lista cada cabo (de onde sai, aonde vai, tipo e
  comprimento com folga). O gerador confere se algum cabo atravessa uma peça.
- **Telas nos desenhos:** os PDFs, a prévia e o 3D usam fotos das telas do próprio
  gêmeo (`tela-robo.png`, `tela-acorde.png`), tiradas por `capturar-telas.mjs`.

### Placas e cabos

| Placa | Onde fica | Liga na principal por |
|---|---|---|
| Principal (Teensy 4.1 + Audio Shield) | Na base, sob os pads | — |
| Pads (84 contatos + 84 LEDs) | Presa sob o painel | Flat de 20 vias + 3 fios (LEDs) |
| Sliders (10) | Presa sob o painel | Flat de 14 vias |
| Telas e encoder | Presa sob o painel, atrás | Flat de 16 vias |
| Traseira (todos os conectores) | Na base, encostada na parede de trás | Flat de 16 vias + cabo USB |
| Strumplate + 2 MPR121 | Presa sob o painel, à direita | 5 fios (I²C) |
| Amplificador → alto-falante | Na base, à direita | 5 fios; 2 fios até o alto-falante |
| Baterias → carregador | Na base | 2 fios; 2 fios de 5 V até a principal |

## Próximas etapas

1. **Teste em papel.** Imprima o A2, apoie na mesa, posicione as mãos e simule tocar. Anote o que estiver apertado ou longe.
2. **Comprar as peças críticas** (sliders, telas, encoder, jaques, alto-falante) e medir. Atualize os valores `CHECK`.
3. **Maquete em MDF de 3 mm cortada a laser** (`painel-corte.dxf`), com as peças encaixadas.
4. **Protoboard:** Teensy + áudio + MIDI + alguns botões + strumplate de teste + robô.
5. **Firmware** (`firmware/`, PlatformIO): lógica do app portada para C++, com testes que comparam as notas geradas com as do app.
6. **Placas de circuito:** painel, placa dos pads (contatos, LEDs e diodos montados pela fábrica), placa das telas, placa dos sliders, placa traseira, strumplate e placa principal. Faça um pedido de teste pequeno antes, junto com uma amostra dos pads de silicone.
7. **Moldura** em madeira, primeiro numa maquete de compensado barato, depois na madeira final. Os gabaritos para a tupia são cortados a laser em MDF.
8. **Montagem, blindagem e calibração.**

## Solda

O projeto foi pensado para exigir pouca solda:

- Os pads de silicone não levam solda: só apertam os contatos da placa.
- Diodos e componentes pequenos podem ser montados pela fábrica da placa (serviço de montagem).
- Sobram os pinos do Teensy e dos módulos, jaques, conectores DIN, sliders e encoder: algumas dezenas de pontos de solda de furo passante, ótimos para quem está aprendendo.
- Quem for ajudar deve ler o aviso sobre o **terra do fone** na tabela acima antes de ligar o jaque P2.
