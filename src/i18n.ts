// ─── UI language (pt-BR / en) ───
// Panel engravings (MASTER, TONE, Major…) stay in English like hardware
// silkscreen; everything that talks to the user is translated.

const STRINGS = {
  en: {
    powerHint: 'press to power on',
    power: 'Power',
    credits: 'Made by',
    controls: 'Controls',
    openControls: 'Controls',
    closeControls: 'Close controls',
    quickControls: 'Quick controls',
    silence: 'Silence chord',
    silenceTitle: 'Silence (Esc)',
    pageExt: 'Show m7, Maj7 and Dim7 chords',
    pageBasic: 'Show major, minor and 7th chords',
    keyOff: 'Off',
    keyLabel: 'Key',
    record: 'Record',
    recStart: '● REC',
    recStop: '■ SAVE',
    recUnsupported: 'Recording is not supported in this browser',
    recSaved: 'Recording saved',
    midi: 'MIDI in',
    midiConnect: 'Connect',
    midiUnsupported: 'Web MIDI is not supported in this browser',
    midiDenied: 'MIDI access denied',
    midiNoDevices: 'No MIDI devices',
    midiDevices: (n: number) => `${n} device${n === 1 ? '' : 's'}`,
    offline: 'Ready to play offline',
    updated: 'Updated — reload to use the new version',
  },
  pt: {
    powerHint: 'pressione para ligar',
    power: 'Ligar/desligar',
    credits: 'Desenvolvido por',
    controls: 'Controles',
    openControls: 'Controles',
    closeControls: 'Fechar controles',
    quickControls: 'Controles rápidos',
    silence: 'Silenciar acorde',
    silenceTitle: 'Silenciar (Esc)',
    pageExt: 'Mostrar acordes m7, Maj7 e Dim7',
    pageBasic: 'Mostrar acordes maiores, menores e com sétima',
    keyOff: 'Desl.',
    keyLabel: 'Tom',
    record: 'Gravar',
    recStart: '● REC',
    recStop: '■ SALVAR',
    recUnsupported: 'Gravação não suportada neste navegador',
    recSaved: 'Gravação salva',
    midi: 'MIDI',
    midiConnect: 'Conectar',
    midiUnsupported: 'Web MIDI não é suportado neste navegador',
    midiDenied: 'Acesso MIDI negado',
    midiNoDevices: 'Nenhum dispositivo MIDI',
    midiDevices: (n: number) => `${n} dispositivo${n === 1 ? '' : 's'}`,
    offline: 'Pronto para tocar offline',
    updated: 'Atualizado — recarregue para usar a nova versão',
  },
} as const;

export type Lang = keyof typeof STRINGS;
type Strings = (typeof STRINGS)[Lang];
type TextKey = { [K in keyof Strings]: Strings[K] extends string ? K : never }[keyof Strings];

export function detectLang(languages: readonly string[] = navigator.languages ?? [navigator.language]): Lang {
  for (const l of languages) {
    const base = l.toLowerCase().split('-')[0];
    if (base === 'pt') return 'pt';
    if (base === 'en') return 'en';
  }
  return 'en';
}

export const lang: Lang = typeof navigator === 'undefined' ? 'en' : detectLang();
export const strings: Strings = STRINGS[lang];
export const t = (key: TextKey): string => strings[key] as string;

/**
 * Fill elements marked with data-i18n (text), data-i18n-aria (aria-label) and
 * data-i18n-title (title).
 */
export function applyTranslations(root: ParentNode = document): void {
  document.documentElement.lang = lang === 'pt' ? 'pt-BR' : 'en';
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n as TextKey); });
  root.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach(el => el.setAttribute('aria-label', t(el.dataset.i18nAria as TextKey)));
  root.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle as TextKey); });
}
