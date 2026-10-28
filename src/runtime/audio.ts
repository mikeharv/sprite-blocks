// Minimal Web Audio sound player for the built-in sound effects.
import { soundUrl } from '../assets';

let ctx: AudioContext | null = null;
const buffers = new Map<string, Promise<AudioBuffer | null>>();

function context(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** Call from a user gesture (e.g. the Run button) so browsers allow audio. */
export function unlockAudio(): void {
  const c = context();
  if (c.state === 'suspended') void c.resume();
}

function load(id: string): Promise<AudioBuffer | null> {
  let p = buffers.get(id);
  if (!p) {
    p = fetch(soundUrl(id))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(r.statusText))))
      .then((data) => context().decodeAudioData(data))
      .catch(() => null);
    buffers.set(id, p);
  }
  return p;
}

export function preloadSounds(ids: string[]): void {
  ids.forEach((id) => void load(id));
}

export function playSound(id: string, volume = 0.6): void {
  void load(id).then((buffer) => {
    if (!buffer) return;
    const c = context();
    const src = c.createBufferSource();
    const gain = c.createGain();
    gain.gain.value = volume;
    src.buffer = buffer;
    src.connect(gain).connect(c.destination);
    src.start();
  });
}
