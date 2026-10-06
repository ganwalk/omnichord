// ─── Computer keyboard shortcuts ───
// Uses KeyboardEvent.code (physical key position), so the layout works the same
// on US, ABNT2 and other keyboards.

import { CHORD_TYPES, type ChordType } from '../theory';

const ROWS: [codes: string[], typeId: string][] = [
  [['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'Minus', 'Equal'], 'dom7'],
  [['KeyQ', 'KeyW', 'KeyE', 'KeyR', 'KeyT', 'KeyY', 'KeyU', 'KeyI', 'KeyO', 'KeyP', 'BracketLeft', 'BracketRight'], 'maj'],
  [['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote', 'Backslash'], 'min'],
];

const KEYMAP = new Map<string, { root: number; type: ChordType }>();
for (const [codes, typeId] of ROWS) {
  const type = CHORD_TYPES.find(t => t.id === typeId)!;
  codes.forEach((code, root) => KEYMAP.set(code, { root, type }));
}

export interface KeyboardActions {
  readonly powered: boolean;
  togglePower(): void;
  selectChord(root: number, type: ChordType): void;
  clearChord(): void;
  toggleRhythm(): void;
}

const isButton = (t: EventTarget | null): boolean => t instanceof HTMLElement && t.closest('button') !== null;

export function bindKeyboard(app: KeyboardActions): void {
  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const isEnter = e.code === 'Enter' || e.code === 'NumpadEnter';

    // Enter on a focused button is handled by the button itself.
    if (isEnter && isButton(e.target)) return;

    if (e.code === 'Space') e.preventDefault(); // never scroll / activate buttons
    if (e.repeat) return;

    if (!app.powered) {
      if (isEnter || e.code === 'Space') app.togglePower();
      return;
    }

    const chord = KEYMAP.get(e.code);
    if (chord) app.selectChord(chord.root, chord.type);
    else if (e.code === 'Escape') app.clearChord();
    else if (e.code === 'Space') app.toggleRhythm();
  });

  // Space activates a focused button on keyup; Space is reserved for the rhythm.
  document.addEventListener('keyup', e => {
    if (e.code === 'Space' && isButton(e.target)) e.preventDefault();
  });
}
