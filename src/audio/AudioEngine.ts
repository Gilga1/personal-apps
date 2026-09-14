import { isWebMode, mediaUrl, readAudioBytes } from "../api/stacks";

const DECODE_FORMATS = new Set(["flac", "ogg", "opus"]);

type ProgressCallback = (currentTime: number, duration: number) => void;

/** Reliable playback: plain <audio> for MP3/M4A; decoded buffers for FLAC (WebView2 can't play FLAC natively). */
class AudioEngine {
  private audio: HTMLAudioElement;
  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private bufferSource: AudioBufferSourceNode | null = null;
  private bufferDuration = 0;
  private bufferStartedAt = 0;
  private bufferOffset = 0;
  private lastFilePath: string | null = null;
  private playing = false;
  private masterVolume = 0.8;
  private mode: "element" | "buffer" = "element";
  private progressListeners = new Set<ProgressCallback>();
  private onEndedCallback: (() => void) | null = null;
  private rafId: number | null = null;

  constructor() {
    this.audio = document.createElement("audio");
    this.audio.id = "stacks-audio";
    this.audio.preload = "auto";
    this.audio.style.display = "none";
    document.body.appendChild(this.audio);
    this.audio.addEventListener("ended", () => {
      if (this.mode === "element" && this.playing) {
        this.onEndedCallback?.();
      }
    });
    this.startProgressLoop();
  }

  get element() {
    return this.audio;
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

  setCrossfadeEnabled(_enabled: boolean) {
    // Crossfade disabled in simplified engine for reliable Windows playback.
  }

  async loadAndPlay(filePath: string) {
    this.lastFilePath = filePath;
    await this.unlockAudio();
    const ext = filePath.split(".").pop()?.toLowerCase() ?? "";

    if (DECODE_FORMATS.has(ext) || isWebMode()) {
      await this.playDecoded(filePath, 0);
      return;
    }

    try {
      await this.playElement(filePath);
    } catch {
      await this.playDecoded(filePath, 0);
    }
  }

  private async playElement(filePath: string) {
    this.stopBuffer();
    this.mode = "element";
    const url = await mediaUrl(filePath);
    this.audio.src = url;
    this.audio.volume = this.masterVolume;
    await this.audio.load();
    await this.audio.play();
    if (this.audio.paused) {
      throw new Error("HTML audio playback failed");
    }
    this.playing = true;
  }

  private async playDecoded(filePath: string, seekTo: number) {
    this.mode = "buffer";
    this.audio.pause();
    this.stopBuffer();
    const ctx = this.getCtx();

    let arrayBuffer: ArrayBuffer;
    if (isWebMode()) {
      const url = await mediaUrl(filePath);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Could not load audio (${response.status})`);
      }
      arrayBuffer = await response.arrayBuffer();
    } else {
      const bytes = await readAudioBytes(filePath);
      arrayBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
    }

    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    this.bufferDuration = audioBuffer.duration;
    this.bufferOffset = Math.min(Math.max(0, seekTo), audioBuffer.duration);

    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = this.masterVolume;
    this.gainNode.connect(ctx.destination);

    this.bufferSource = ctx.createBufferSource();
    this.bufferSource.buffer = audioBuffer;
    this.bufferSource.connect(this.gainNode);
    this.bufferSource.onended = () => {
      if (this.playing) this.onEndedCallback?.();
    };
    this.bufferSource.start(0, this.bufferOffset);
    this.bufferStartedAt = ctx.currentTime - this.bufferOffset;
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
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
  }

  async play() {
    if (this.mode === "buffer" && this.lastFilePath) {
      await this.playDecoded(this.lastFilePath, this.bufferOffset);
      return;
    }
    this.audio.volume = this.masterVolume;
    await this.audio.play();
    this.playing = true;
  }

  pause() {
    if (this.mode === "buffer") {
      this.bufferOffset = this.getBufferTime();
      this.stopBuffer();
    } else {
      this.audio.pause();
    }
    this.playing = false;
  }

  setVolume(volume: number) {
    this.masterVolume = volume;
    this.audio.volume = volume;
    if (this.gainNode) {
      this.gainNode.gain.value = volume;
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
    if (this.audio.duration) {
      this.audio.currentTime = ratio * this.audio.duration;
    }
  }

  private async unlockAudio() {
    const ctx = this.getCtx();
    if (ctx.state === "suspended") {
      await ctx.resume();
    }
  }

  private getCtx() {
    if (!this.audioCtx) {
      this.audioCtx = new AudioContext();
    }
    return this.audioCtx;
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
    return this.audio.currentTime || 0;
  }

  private getDuration() {
    if (this.mode === "buffer") return this.bufferDuration;
    return this.audio.duration || 0;
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

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.stopBuffer();
    this.audio.pause();
    this.audio.remove();
    this.audioCtx?.close();
  }
}

export const audioEngine = new AudioEngine();
