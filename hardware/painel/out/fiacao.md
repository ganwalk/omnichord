# Fiação do OmniHarp

Gerado por `hardware/painel/gerar.cjs` a partir das posições das placas e do
caminho de cada cabo dentro da caixa. O comprimento já inclui 15 % de folga.
Não edite à mão: mude o gerador e rode de novo.

| Cabo | De | Para | Tipo | Comprimento |
|---|---|---|---|---|
| Telas + encoder | Conector 16 vias, placa das telas | Conector 16 vias, placa principal | cabo flat 16 vias (IDC, passo 1,27 mm) | 220 mm |
| Sliders | Conector 14 vias, placa dos sliders | Conector 14 vias, placa principal | cabo flat 14 vias (IDC, passo 1,27 mm) | 100 mm |
| Conectores traseiros | Conector 16 vias, placa traseira | Conector 16 vias, placa principal | cabo flat 16 vias (IDC, passo 1,27 mm) | 200 mm |
| Pads (matriz 7 × 12) | Conector 20 vias, placa dos pads | Conector 20 vias, placa principal | cabo flat 20 vias (IDC, passo 1,27 mm) | 60 mm |
| LEDs dos pads | Conector 3 vias, placa dos pads | Conector 3 vias, placa principal | 3 fios 24–26 AWG (conector JST) | 50 mm |
| Botão + LED de power | Botão liga/desliga (com LED) | Conector 4 vias, placa principal | 4 fios 24–26 AWG (conector JST) | 300 mm |
| USB (painel → Teensy) | USB-C (MIDI + carga) | Teensy 4.1 + Audio Shield (empilhados) | cabo USB-C de painel → micro-USB | 270 mm |
| Strumplate (I²C) | Sensor MPR121 (cordas 1–12) | Conector 5 vias, placa principal | 5 fios 24–26 AWG (conector JST) | 330 mm |
| Entre os dois MPR121 | Sensor MPR121 (cordas 1–12) | Sensor MPR121 (cordas 13–24) | 4 fios 24–26 AWG (conector JST) | 100 mm |
| Áudio + 5 V para o amplificador | Conector 5 vias, placa principal | Amplificador PAM8302A | 5 fios 24–26 AWG (conector JST) | 450 mm |
| Alto-falante | Amplificador PAM8302A | Caixa do alto-falante (fechada) | 2 fios 24–26 AWG (conector JST) | 60 mm |
| 5 V para a placa principal | Carregador + elevador 5 V | Conector 2 vias, placa principal | 2 fios 24–26 AWG (conector JST) | 210 mm |
| Bateria | Baterias 2 × 18650 (suporte) | Carregador + elevador 5 V | 2 fios 24–26 AWG (conector JST) | 50 mm |
| Carga (5 V do USB-C) | Placa de conectores (traseira) | Carregador + elevador 5 V | 2 fios 24–26 AWG (conector JST) | 200 mm |

## Entradas e saídas (parede de trás, da esquerda para a direita para quem está tocando)

- USB-C (MIDI + carga)
- MIDI IN (DIN)
- MIDI OUT (DIN)
- SYNC (P2)
- Pedal SUSTAIN (P10)
- Fone (P2)
- Saída LINE R (P10)
- Saída LINE L/MONO (P10)
- Chave do alto-falante

## Placas

- **Placa das telas e do encoder**: 231.6 × 47 mm
- **Placa dos sliders (10)**: 233.6 × 66 mm
- **Pads de silicone + placa com contatos e LEDs RGB**: 233.6 × 149.8 mm
- **Strumplate (placa) + acrílico**: 112 × 234.3 mm
- **Placa principal (sobre espaçadores de 4 mm)**: 110 × 62 mm
- **Placa de conectores (traseira)**: 234 × 46 mm
