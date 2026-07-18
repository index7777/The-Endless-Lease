const randomBetween = (minimum: number, maximum: number) => minimum + Math.random() * (maximum - minimum);

export class TitleAmbientEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private timers = new Set<number>();
  private sources: AudioScheduledSourceNode[] = [];
  private elevator: HTMLAudioElement | null = null;
  private stopped = false;
  private muted = false;
  private volume = 1;

  async start() {
    if (this.stopped || typeof window === "undefined") return;
    if (this.context) {
      await this.context.resume().catch(() => undefined);
      return;
    }
    const AudioClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioClass) return;
    const context = new AudioClass();
    this.context = context;
    this.master = context.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(context.destination);
    await context.resume().catch(() => undefined);
    this.createDrone();
    this.createAirConditioner();
    this.createFluorescentHum();
    this.scheduleFluorescentFlicker();
    this.scheduleElevator();
    this.scheduleKeys();
    this.schedulePiano();
    this.playPianoNote(261.63, 2.8, .018);
    this.setTimer(() => this.playPianoNote(329.63, 3.2, .015), 2800);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (!this.context || !this.master) return;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(muted ? 0 : this.volume, this.context.currentTime, .08);
    if (this.elevator) this.elevator.muted = muted;
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    if (!this.context || !this.master) return;
    this.master.gain.cancelScheduledValues(this.context.currentTime);
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.context.currentTime, .08);
  }

  playPaperAndFade() {
    if (!this.context || !this.master) return;
    const context = this.context;
    const duration = .62;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < data.length; index++) {
      const progress = index / data.length;
      const scrape = Math.sin(progress * 160 + Math.sin(progress * 31) * 3) * .22;
      data[index] = (Math.random() * 2 - 1 + scrape) * Math.sin(progress * Math.PI) * .34;
    }
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "bandpass"; filter.frequency.value = 1250; filter.Q.value = .55;
    gain.gain.value = .09;
    source.buffer = buffer; source.connect(filter); filter.connect(gain); gain.connect(this.master);
    source.start();
    this.master.gain.cancelScheduledValues(context.currentTime);
    this.master.gain.setValueAtTime(this.muted ? 0 : this.volume, context.currentTime);
    this.master.gain.linearRampToValueAtTime(0, context.currentTime + 1.5);
    this.setTimer(() => this.stop(), 1700);
  }

  stop() {
    if (this.stopped) return;
    this.stopped = true;
    this.timers.forEach(timer => window.clearTimeout(timer));
    this.timers.clear();
    this.sources.forEach(source => { try { source.stop(); } catch { /* already stopped */ } });
    this.sources = [];
    this.elevator?.pause();
    void this.context?.close();
    this.context = null;
    this.master = null;
  }

  private createDrone() {
    if (!this.context || !this.master) return;
    const filter = this.context.createBiquadFilter();
    filter.type = "lowpass"; filter.frequency.value = 92; filter.Q.value = .7;
    filter.connect(this.master);
    [[43.2, .028], [64.7, .011]].forEach(([frequency, volume]) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      oscillator.type = "sine"; oscillator.frequency.value = frequency;
      oscillator.detune.value = randomBetween(-5, 5); gain.gain.value = volume;
      oscillator.connect(gain); gain.connect(filter); oscillator.start(); this.sources.push(oscillator);
    });
  }

  private createAirConditioner() {
    if (!this.context || !this.master) return;
    const seconds = 4;
    const buffer = this.context.createBuffer(1, this.context.sampleRate * seconds, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    let previous = 0;
    for (let index = 0; index < data.length; index++) {
      previous = previous * .985 + (Math.random() * 2 - 1) * .015;
      data[index] = previous;
    }
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer; source.loop = true;
    filter.type = "bandpass"; filter.frequency.value = 175; filter.Q.value = .45; gain.gain.value = .016;
    source.connect(filter); filter.connect(gain); gain.connect(this.master); source.start(); this.sources.push(source);
  }

  private createFluorescentHum() {
    if (!this.context || !this.master) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine"; oscillator.frequency.value = 119.6; gain.gain.value = .006;
    oscillator.connect(gain); gain.connect(this.master); oscillator.start(); this.sources.push(oscillator);
  }

  private scheduleFluorescentFlicker() {
    this.setTimer(() => {
      if (!this.context || !this.master || this.stopped) return;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = "square"; oscillator.frequency.value = randomBetween(85, 145);
      gain.gain.setValueAtTime(.012, this.context.currentTime);
      gain.gain.exponentialRampToValueAtTime(.0001, this.context.currentTime + randomBetween(.025, .075));
      oscillator.connect(gain); gain.connect(this.master); oscillator.start(); oscillator.stop(this.context.currentTime + .09);
      this.scheduleFluorescentFlicker();
    }, randomBetween(3500, 11000));
  }

  private scheduleElevator() {
    this.setTimer(() => {
      if (this.stopped) return;
      const audio = new Audio("/audio/elevator-door-cc0.wav");
      audio.volume = .035; audio.muted = this.muted; this.elevator = audio;
      if (this.context && this.master) this.context.createMediaElementSource(audio).connect(this.master);
      void audio.play().catch(() => undefined);
      this.scheduleElevator();
    }, randomBetween(20000, 60000));
  }

  private scheduleKeys() {
    this.setTimer(() => {
      if (!this.context || !this.master || this.stopped) return;
      [1760, 2310, 2870].forEach((frequency, index) => {
        const oscillator = this.context!.createOscillator();
        const gain = this.context!.createGain();
        oscillator.type = "sine"; oscillator.frequency.value = frequency + randomBetween(-70, 70);
        const at = this.context!.currentTime + index * .055;
        gain.gain.setValueAtTime(.0001, at); gain.gain.exponentialRampToValueAtTime(.008, at + .008); gain.gain.exponentialRampToValueAtTime(.0001, at + .34);
        oscillator.connect(gain); gain.connect(this.master!); oscillator.start(at); oscillator.stop(at + .36);
      });
      this.scheduleKeys();
    }, randomBetween(40000, 90000));
  }

  private schedulePiano() {
    this.setTimer(() => {
      const notes = [196, 220, 261.63, 329.63];
      this.playPianoNote(notes[Math.floor(Math.random() * notes.length)], randomBetween(2, 4), .012);
      this.schedulePiano();
    }, randomBetween(15000, 35000));
  }

  private playPianoNote(frequency: number, duration: number, volume: number) {
    if (!this.context || !this.master || this.stopped) return;
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const delay = this.context.createDelay(1);
    const reverb = this.context.createGain();
    filter.type = "lowpass"; filter.frequency.value = 980;
    gain.gain.setValueAtTime(.0001, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, this.context.currentTime + .018);
    gain.gain.exponentialRampToValueAtTime(volume * .24, this.context.currentTime + .42);
    gain.gain.exponentialRampToValueAtTime(.0001, this.context.currentTime + duration);
    delay.delayTime.value = .31; reverb.gain.value = .16;
    filter.connect(gain); gain.connect(this.master); gain.connect(delay); delay.connect(reverb); reverb.connect(this.master);
    [[1, 1], [2, .2], [3.01, .07]].forEach(([ratio, strength]) => {
      const oscillator = this.context!.createOscillator();
      const partialGain = this.context!.createGain();
      oscillator.type = "sine"; oscillator.frequency.value = frequency * ratio; oscillator.detune.value = randomBetween(-7, 7);
      partialGain.gain.value = strength;
      oscillator.connect(partialGain); partialGain.connect(filter);
      oscillator.start(); oscillator.stop(this.context!.currentTime + duration + .05);
    });
  }

  private setTimer(callback: () => void, delay: number) {
    const timer = window.setTimeout(() => { this.timers.delete(timer); callback(); }, delay);
    this.timers.add(timer);
  }
}
