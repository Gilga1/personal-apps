import { convertFileSrc } from "@tauri-apps/api/core";

class AudioEngine {
  private audio: HTMLAudioElement;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private rafId: number | null = null;
  private playing = false;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = "metadata";
    this.startGlowLoop();
  }

  get element() {
    return this.audio;
  }

  setPlaying(playing: boolean) {
    this.playing = playing;
  }

  async loadTrack(filePath: string) {
    this.ensureGraph();
    this.audio.src = convertFileSrc(filePath);
    await this.audio.load();
  }

  async play() {
    this.ensureGraph();
    if (this.audioCtx?.state === "suspended") {
      await this.audioCtx.resume();
    }
    await this.audio.play();
    this.playing = true;
  }

  pause() {
    this.audio.pause();
    this.playing = false;
  }

  setVolume(volume: number) {
    this.audio.volume = volume;
  }

  seek(ratio: number) {
    if (this.audio.duration) {
      this.audio.currentTime = ratio * this.audio.duration;
    }
  }

  private ensureGraph() {
    if (this.audioCtx) return;
    this.audioCtx = new AudioContext();
    const source = this.audioCtx.createMediaElementSource(this.audio);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;
    source.connect(this.analyser);
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
    this.audio.pause();
    this.audio.src = "";
  }
}

export const audioEngine = new AudioEngine();
