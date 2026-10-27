// Short tones for the brew timer. Browsers only allow sound after a tap, so unlockAudio() runs from the Start
// button; until then beep() is silent. Vibration does not work on iPhone, which is why the timer has sound.

let ctx: AudioContext | null = null

export function unlockAudio() {
  try {
    ctx ??= new AudioContext()
    void ctx.resume()
  } catch {
    /* no Web Audio: the timer still runs, silently */
  }
}

/** A sine tone that fades out: `ms` long, at `freq` Hz. */
export function beep(freq: number, ms: number, volume = 0.2) {
  if (!ctx || ctx.state !== 'running') return
  const end = ctx.currentTime + ms / 1000
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(volume, ctx.currentTime)
  gain.gain.exponentialRampToValueAtTime(0.001, end)
  osc.connect(gain).connect(ctx.destination)
  osc.start()
  osc.stop(end)
}

// A new step: a clear, higher tone. The last three seconds before it: soft ticks.
export const stepTone = () => beep(880, 220)
export const tickTone = () => beep(660, 70, 0.08)
