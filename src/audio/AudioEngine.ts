import { mediaUrl } from "../api/stacks";

const CROSSFADE_MS = 300;
const DECODE_FORMATS = new Set(["flac", "ogg", "opus"]);

type ProgressCallback = (currentTime: number, duration: number) => void;

class AudioEngine {
  private audioA: HTMLAudioElement;
  private audioB: HTMLAudioElement;
  private activeIsA = true;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private gainA: GainNode | null = null;
  private gainB: GainNode | null = null;
  private sourceA: MediaElementAudioSourceNode | null = null;
  private sourceB: MediaElementAudioSourceNode | null = null;
  private bufferSource: AudioBufferSourceNode | null = null;
  private bufferGain: GainNode | null = null;
  private bufferDuration = 0;
  private bufferStartedAt = 0;
  private bufferOffset = 0;
  private lastFilePath: string | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private rafId: number | null = null;
  private playing = false;
  private crossfadeEnabled = true;
  private masterVolume = 0.8;
  private crossfadeToken = 0;
  private mode: "element" | "buffer" = "element";
  private progressListeners = new Set<ProgressCallback>();
  private onEndedCallback: (() => void) | null = null;

  constructor() {
    this.audioA = this.createAudioElement("stacks-audio-a");
    this.audioB = this.createAudioElement("stacks-b-audio-b");
    this.audioA.addEventListener("ended", () => this.handleElementEnded());
    this.audioB.addEventListener("ended", () => this.handleElementEnded());
    this.startGlowLoop();
    this.startProgressLoop();
  }

  private createAudioElement(id: string) {
    const el = new Audio();
    el.id = id;
    el.preload = "auto";
    el.style.display = "none";
    document.body.appendChild(el);
    return el;
  }

  private handleElementEnded() {
    if (this.mode === "element" && this.playing) {
      this.onEndedCallback?.();
    }
  }

  get element() {
    return this.activeIsA ? this.audioA : this.audioB;
  }

  onProgress(callback: ProgressCallback) {
    this.progressListeners.add(callback);
    return () => this.progressListeners.delete(callback);
  }

  onEnded(callback: () => void) {
    this.onEndedCallback = callback;
  }

  setPlaying(playing: boolean) {
    this.playing = playing;
  }

  setCrossfadeEnabled(enabled: boolean) {
    this.crossfadeEnabled = enabled;
  }

  async loadAndPlay(filePath: string) {
    this.lastFilePath = filePath;
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
    if (DECODE_FORMATS.has(ext)) {
      await this.playDecoded(filePath, 0);
      return;
    }
    await this.playViaElement(filePath);
  }

  private async playViaElement(filePath: string) {
    this.stopBuffer();
    this.mode = "element";
    this.ensureGraph();
    await this.resumeContext();

    const incoming = this.activeIsA ? this.audioB : this.audioA;
    const outgoing = this.activeIsA ? this.audioA : this.audioB;
    const incomingGain = this.activeIsA ? this.gainB! : this.gainA!;
    const outgoingGain = this.activeIsA ? this.gainA! : this.gainB!;
    const isFirstTrack = !outgoing.src && !incoming.src;

    incoming.src = await mediaUrl(filePath);
    await incoming.load();

    if (isFirstTrack || !this.crossfadeEnabled || outgoing.paused) {
      outgoing.pause();
      outgoingGain.gain.value = 0;
      incomingGain.gain.value = 1;
      await incoming.play();
      this.activeIsA = !this.activeIsA;
      this.playing = true;
      return;
    }

    const token = ++this.crossfadeToken;
    incomingGain.gain.value = 0;
    await incoming.play();

    const start = performance.now();
    const outStartVol = outgoingGain.gain.value;

    const fade = () => {
      if (token !== this.crossfadeToken) return;
      const t = Math.min(1, (performance.now() - start) / CROSSFADE_MS);
      outgoingGain.gain.value = outStartVol * (1 - t);
      incomingGain.gain.value = t;
      if (t < 1) {
        requestAnimationFrame(fade);
      } else {
        outgoing.pause();
        outgoingGain.gain.value = 0;
        incomingGain.gain.value = 1;
        this.activeIsA = !this.activeIsA;
      }
    };
    requestAnimationFrame(fade);
    this.playing = true;
  }

  private async playDecoded(filePath: string, seekTo: number) {
    this.mode = "buffer";
    this.ensureGraph();
    await this.resumeContext();
    this.stopBuffer();
    this.audioA.pause();
    this.audioB.pause();
    if (this.gainA) this.gainA.gain.value = 0;
    if (this.gainB) this.gainB.gain.value = 0;

    const url = await mediaUrl(filePath);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not load audio file (${response.status})`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioCtx!.decodeAudioData(arrayBuffer);
    this.bufferDuration = audioBuffer.duration;
    this.bufferOffset = Math.min(Math.max(0, seekTo), audioBuffer.duration);

    this.bufferSource = this.audioCtx!.createBufferSource();
    this.bufferGain = this.audioCtx!.createGain();
    this.bufferSource.buffer = audioBuffer;
    this.bufferSource.connect(this.bufferGain);
    this.bufferGain.connect(this.analyser!);
    this.bufferGain.gain.value = 1;
    this.bufferSource.onended = () => {
      if (this.playing) this.onEndedCallback?.();
    };
    this.bufferSource.start(0, this.bufferOffset);
    this.bufferStartedAt = this.audioCtx!.currentTime - this.bufferOffset;
    this.playing = true;
  }

  private stopBuffer() {
    if (this.bufferSource) {
      try {
        this.bufferSource.stop();
      } catch {
        // already stopped
      }
      this.bufferSource.disconnect();
      this.bufferSource = null;
    }
    if (this.bufferGain) {
      this.bufferGain.disconnect();
      this.bufferGain = null;
    }
  }

  async play() {
    if (this.mode === "buffer" && this.lastFilePath) {
      await this.playDecoded(this.lastFilePath, this.bufferOffset);
      return;
    }
    this.ensureGraph();
    await this.resumeContext();
    const gain = this.activeIsA ? this.gainA! : this.gainB!;
    gain.gain.value = 1;
    await this.element.play();
    this.playing = true;
  }

  pause() {
    this.crossfadeToken++;
    if (this.mode === "buffer") {
      this.bufferOffset = this.getBufferTime();
      this.stopBuffer();
    } else {
      this.audioA.pause();
      this.audioB.pause();
    }
    this.playing = false;
  }

  setVolume(volume: number) {
    this.masterVolume = volume;
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
  }

  seek(ratio: number) {
    if (this.mode === "buffer") {
      const target = ratio * this.bufferDuration;
      if (this.lastFilePath) {
        void this.playDecoded(this.lastFilePath, target);
      }
      return;
    }
    const el = this.element;
    if (el.duration) {
      el.currentTime = ratio * el.duration;
    }
  }

  private getBufferTime() {
    if (!this.audioCtx) return this.bufferOffset;
    if (!this.playing) return this.bufferOffset;
    return Math.min(
      this.bufferDuration,
      this.audioCtx.currentTime - this.bufferStartedAt,
    );
  }

  private getCurrentTime() {
    if (this.mode === "buffer") return this.getBufferTime();
    return this.element.currentTime || 0;
  }

  private getDuration() {
    if (this.mode === "buffer") return this.bufferDuration;
    return this.element.duration || 0;
  }

  private async resumeContext() {
    if (this.audioCtx?.state === "suspended") {
      await this.audioCtx.resume();
    }
  }

  private ensureGraph() {
    if (this.audioCtx) return;
    this.audioCtx = new AudioContext();
    this.masterGain = this.audioCtx.createGain();
    this.gainA = this.audioCtx.createGain();
    this.gainB = this.audioCtx.createGain();
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 256;

    this.sourceA = this.audioCtx.createMediaElementSource(this.audioA);
    this.sourceB = this.audioCtx.createMediaElementSource(this.audioB);

    this.sourceA.connect(this.gainA);
    this.sourceB.connect(this.gainB);
    this.gainA.connect(this.analyser);
    this.gainB.connect(this.analyser);
    this.analyser.connect(this.masterGain);
    this.masterGain.connect(this.audioCtx.destination);

    this.masterGain.gain.value = this.masterVolume;
    this.gainA.gain.value = 0;
    this.gainB.gain.value = 0;
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
  }

  private startProgressLoop() {
    const tick = () => {
      const time = this.getCurrentTime();
      const duration = this.getDuration();
      for (const listener of this.progressListeners) {
        listener(time, duration);
      }
      this.rafId = requestAnimationFrame(tick);
    };
    tick();
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
      requestAnimationFrame(tick);
    };
    tick();
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.stopBuffer();
    this.audioA.pause();
    this.audioB.pause();
    this.audioA.remove();
    this.audioB.remove();
  }
}

export const audioEngine = new AudioEngine();
