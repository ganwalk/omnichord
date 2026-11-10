// ─── What the 3D view reads from, and does to, the twin ───
// The twin (main.ts) owns the instrument; the 3D view is another way to see and
// play it. It reads this state every frame and calls these actions on input.

export interface TwinApi {
  readonly powered: boolean;
  /** Pad LED level: 0 off (row colour, dim), 1 in the chosen key, 2 the chord being played. */
  padLevel(type: number, root: number): 0 | 1 | 2;
  /** Status LEDs: power, play, arp, beat. */
  led(id: string): boolean;
  /** Slider position, 0 (front end of the slot) … 1 (back end). */
  sliderPos(setting: string): number;
  /** Encoder knob rotation, degrees. */
  readonly encoderAngle: number;
  /** When string `idx` was last plucked (performance.now() ms), for its glow. */
  pluckedAt(idx: number): number;
  readonly lowAtBottom: boolean;
  /** The live screen canvases, by id ('robot', 'chord'). */
  readonly screens: Map<string, HTMLCanvasElement>;

  togglePower(): void;
  pressPad(type: number, root: number): void;
  /** Function pads: `down` false on release (SHIFT is held). */
  fnPad(action: string, down: boolean): void;
  setSlider(setting: string, pos: number): void;
  encoderTurn(dir: 1 | -1): void;
  encoderPush(): void;
  /** Strumplate under a finger, `y` in panel millimetres (0 = back edge). */
  strumDown(pointerId: number, y: number, timeStamp: number): void;
  strumMove(pointerId: number, y: number, timeStamp: number): void;
  strumUp(pointerId: number): void;
}
