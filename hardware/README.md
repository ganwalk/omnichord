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
| Som interno | Alto-falante de 3" (4 Ω, 5 W) numa caixa fechada de madeira, com amplificador mono PAM8302A que fica mudo ao ligar, quando entra um fone ou pela chave |
| Saídas de áudio | 2 × P10 (L/MONO e R; com plugue só no L, o som vira mono), P2 de fone (isolado: o terra dele é o VGND do Audio Shield) |
| MIDI | Saída e entrada DIN de 5 pinos + USB-MIDI; acordes no canal 1, cordas no 2, arpejo no 3, bateria no 10 (General MIDI), MIDI Clock com Start/Stop |
| Extras | P10 para pedal de sustain, P2 de sincronia (pulso de tempo) |
| Teclas | 72 de acorde (6 × 12) + 12 de função, switches estilo MX em **soquetes hot-swap** (sem solda nos switches), teclas lisas compradas prontas, uma cor por fileira |
| Legendas | No painel: notas acima das colunas e tipo de acorde ao lado das fileiras (opção "c") |
| Strumplate | PCB com 24 trilhas (passo de 8 mm) e plano de terra, lida por 2 × MPR121, coberta por acrílico de 1 mm. Nunca coberta por madeira. |
| Controles | 10 sliders soldados na placa (o painel só tem os rasgos), chave de oitava de 3 posições, encoder com botão (MENU) |
| Visores | "Sys monitor": OLED verde de 2,42" (SSD1309) com o robô, os mesmos rostos e tempos do app. "Chord display": 2 × mostradores verdes de 14 segmentos com 4 caracteres (HT16K33). Os dois ficam num barramento I²C separado do sensor da strumplate. |
| Painel | Placa de circuito usada como painel: fibra de vidro preta, serigrafia branca, acabamento dourado (ENIG), dividida em 2–3 partes. A maquete é em MDF cortado a laser. |
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

Medidas do rascunho: painel com **503 × 291 mm**; com a moldura, **563 × 321 mm**.
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
