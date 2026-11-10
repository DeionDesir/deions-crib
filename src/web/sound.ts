// Chiptune-style sound effects, made on the fly with square waves.
// No audio files: each effect is a short list of notes.

type Note = [frequency: number, seconds: number];

const EFFECTS = {
  select: [[660, 0.04]],
  card: [[220, 0.05], [330, 0.05]],
  deal: [[196, 0.04], [262, 0.04], [196, 0.04]],
  score: [[523, 0.07], [784, 0.11]],
  bigScore: [[523, 0.07], [659, 0.07], [784, 0.07], [1047, 0.16]],
  go: [[330, 0.09], [247, 0.12]],
  wrong: [[196, 0.1], [147, 0.16]],
  win: [[523, 0.1], [659, 0.1], [784, 0.1], [1047, 0.1], [784, 0.1], [1047, 0.3]],
  lose: [[392, 0.14], [330, 0.14], [262, 0.14], [196, 0.3]],
} satisfies Record<string, Note[]>;

export type Effect = keyof typeof EFFECTS;

export class Sound {
  enabled = true;
  private context: AudioContext | null = null;

  play(effect: Effect): void {
    if (!this.enabled) return;
    try {
      // Browsers only allow sound after a tap or key press, which is always
      // the case by the time anything here plays.
      this.context ??= new AudioContext();
      if (this.context.state === 'suspended') void this.context.resume();
      let time = this.context.currentTime;
      for (const [frequency, seconds] of EFFECTS[effect] as Note[]) {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = 'square';
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.06, time);
        gain.gain.setValueAtTime(0, time + seconds * 0.9);
        oscillator.connect(gain).connect(this.context.destination);
        oscillator.start(time);
        oscillator.stop(time + seconds);
        time += seconds;
      }
    } catch {
      // No audio available: play silently.
    }
  }
}
