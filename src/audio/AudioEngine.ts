import { mediaUrl } from "../api/stacks";

const CROSSFADE_MS = 300;

class AudioEngine {
  private audioA: HTMLAudioElement;
  private audioB: HTMLAudioElement;
  private activeIsA = true;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceA: MediaElementAudioSourceNode | null = null;
  private sourceB: MediaElementAudioSourceNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private rafId: number | null = null;
  private playing = false;
  private crossfadeEnabled = true;
  private masterVolume = 0.8;
  private crossfadeToken = 0;

  constructor() {
    this.audioA = new Audio();
    this.audioB = new Audio();
    this.audioA.preload = "metadata";
    this.audioB.preload = "metadata";
    this.startGlowLoop();
  }

  get element() {
    return this.activeIsA ? this.audioA : this.audioB;
  }

  setPlaying(playing: boolean) {
    this.playing = playing;
  }

  setCrossfadeEnabled(enabled: boolean) {
    this.crossfadeEnabled = enabled;
  }

  async loadAndPlay(filePath: string) {
    this.ensureGraph();
    const incoming = this.activeIsA ? this.audioB : this.audioA;
    const outgoing = this.activeIsA ? this.audioA : this.audioB;
    const isFirstTrack = !outgoing.src && !incoming.src;

    incoming.src = await mediaUrl(filePath);
    await incoming.load();

    if (this.audioCtx?.state === "suspended") {
      await this.audioCtx.resume();
    }

    if (isFirstTrack || !this.crossfadeEnabled || outgoing.paused) {
      outgoing.pause();
      outgoing.volume = 0;
      incoming.volume = this.masterVolume;
      await incoming.play();
      this.activeIsA = !this.activeIsA;
      this.playing = true;
      return;
    }

    const token = ++this.crossfadeToken;
    incoming.volume = 0;
    await incoming.play();

    const start = performance.now();
    const outStartVol = outgoing.volume;

    const fade = () => {
      if (token !== this.crossfadeToken) return;
      const t = Math.min(1, (performance.now() - start) / CROSSFADE_MS);
      outgoing.volume = outStartVol * (1 - t);
      incoming.volume = this.masterVolume * t;
      if (t < 1) {
        requestAnimationFrame(fade);
      } else {
        outgoing.pause();
        outgoing.volume = 0;
        incoming.volume = this.masterVolume;
        this.activeIsA = !this.activeIsA;
      }
    };
    requestAnimationFrame(fade);
    this.playing = true;
  }

  async play() {
    this.ensureGraph();
    if (this.audioCtx?.state === "suspended") {
      await this.audioCtx.resume();
    }
    await this.element.play();
    this.playing = true;
  }

  pause() {
    this.crossfadeToken++;
    this.audioA.pause();
    this.audioB.pause();
    this.playing = false;
  }

  setVolume(volume: number) {
    this.masterVolume = volume;
    this.element.volume = volume;
  }

  seek(ratio: number) {
    const el = this.element;
    if (el.duration) {
      el.currentTime = ratio * el.duration;
    }
  }

  private ensureGraph() {
    if (this.audioCtx) return;
    this.audioCtx = new AudioContext();
    this.sourceA = this.audioCtx.createMediaElementSource(this.audioA);
    this.sourceB = this.audioCtx.createMediaElementSource(this.audioB);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    this.sourceA.connect(this.analyser);
    this.sourceB.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  private avg(arr: Uint8Array<ArrayBuffer>, from: number, to: number) {
    let sum = 0;
    for (let i = from; i < to; i++) sum += arr[i];
    return sum / (to - from);
  }

  private startGlowLoop() {
    const tick = () => {
      const root = document.documentElement.style;
      if (this.analyser && this.dataArray) {
        this.analyser.getByteFrequencyData(this.dataArray);
        const bass = this.avg(this.dataArray, 0, 8) / 255;
        const treble = this.avg(this.dataArray, 40, 90) / 255;
        const idle =
          0.15 +
          Math.sin(Date.now() / 1400) * 0.03 +
          (Math.random() - 0.5) * 0.015;
        root.setProperty(
          "--glow-opacity",
          (this.playing ? 0.22 + bass * 0.45 : idle).toFixed(3),
        );
        root.setProperty("--glow-scale", (1 + bass * 0.3).toFixed(3));
        root.setProperty("--glow-hue", `${(treble * 40 - 10).toFixed(1)}deg`);
      }
      this.rafId = requestAnimationFrame(tick);
    };
    tick();
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.audioA.pause();
    this.audioB.pause();
  }
}

export const audioEngine = new AudioEngine();
