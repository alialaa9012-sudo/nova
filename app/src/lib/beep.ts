/** Short alert tone for new orders on the call-center board. Silent where audio is unavailable. */
export function playBeep(): void {
  try {
    const Ctx = window.AudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.value = 0.15
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
    osc.onended = () => void ctx.close()
  } catch {
    /* autoplay blocked or no audio device */
  }
}
