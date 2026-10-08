/**
 * React hook for streaming audio playback using AudioWorklet.
 * Supports real-time PCM16 audio streaming from SSE responses.
 * Includes sequence buffer for reordering out-of-order chunks and automatic cleanup.
 */
import { useRef, useCallback, useState, useEffect } from "react";
import { decodePCM16ToFloat32 } from "./audio-utils";

export type PlaybackState = "idle" | "initializing" | "playing" | "ended" | "error";

export interface AudioPlaybackOptions {
  workletPath: string;
  sampleRate?: number;
  maxBufferGap?: number;
  onEnded?: () => void;
  onError?: (err: Error) => void;
}

/**
 * Reorders audio chunks that may arrive out of sequence.
 * Includes packet gap recovery to prevent buffer lockups if an intermediate packet drops.
 */
export class SequenceBuffer {
  private pending = new Map<number, string[]>();
  private nextSeq = 0;
  private maxGap: number;

  constructor(maxGap = 10) {
    this.maxGap = maxGap;
  }

  /** Add chunk with sequence number, returns chunks ready to play in order */
  push(seq: number, data: string): string[] {
    if (!this.pending.has(seq)) {
      this.pending.set(seq, []);
    }
    this.pending.get(seq)!.push(data);

    // Gap recovery: If nextSeq dropped and buffer grows beyond threshold, skip to min available
    if (!this.pending.has(this.nextSeq) && this.pending.size > this.maxGap) {
      const minAvailable = Math.min(...this.pending.keys());
      if (minAvailable > this.nextSeq) {
        this.nextSeq = minAvailable;
      }
    }

    // Drain consecutive ready sequences
    const ready: string[] = [];
    while (this.pending.has(this.nextSeq)) {
      ready.push(...this.pending.get(this.nextSeq)!);
      this.pending.delete(this.nextSeq);
      this.nextSeq++;
    }
    return ready;
  }

  reset() {
    this.pending.clear();
    this.nextSeq = 0;
  }
}

export function useAudioPlayback(optionsOrPath: string | AudioPlaybackOptions) {
  const options: AudioPlaybackOptions =
    typeof optionsOrPath === "string" ? { workletPath: optionsOrPath } : optionsOrPath;

  const { workletPath, sampleRate = 24000, maxBufferGap = 10 } = options;

  const [state, setState] = useState<PlaybackState>("idle");
  const [error, setError] = useState<Error | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const readyRef = useRef(false);
  const seqBufferRef = useRef(new SequenceBuffer(maxBufferGap));

  // Lifecycle cleanup: close AudioContext and disconnect node on unmount
  useEffect(() => {
    return () => {
      readyRef.current = false;
      seqBufferRef.current.reset();
      if (workletRef.current) {
        workletRef.current.disconnect();
        workletRef.current = null;
      }
      if (ctxRef.current && ctxRef.current.state !== "closed") {
        ctxRef.current.close().catch(() => {});
        ctxRef.current = null;
      }
    };
  }, []);

  const init = useCallback(async () => {
    if (readyRef.current) return;
    if (!workletPath) {
      const err = new Error("workletPath is required for audio playback");
      setError(err);
      setState("error");
      throw err;
    }

    try {
      setState("initializing");
      const ctx = new AudioContext({ sampleRate });

      // Handle suspended audio context (browser autoplay policies)
      if (ctx.state === "suspended") {
        await ctx.resume();
      }

      await ctx.audioWorklet.addModule(workletPath);
      const worklet = new AudioWorkletNode(ctx, "audio-playback-processor");
      worklet.connect(ctx.destination);

      worklet.port.onmessage = (e) => {
        if (e.data.type === "ended") {
          setState("idle");
          options.onEnded?.();
        }
      };

      ctxRef.current = ctx;
      workletRef.current = worklet;
      readyRef.current = true;
      setError(null);
      setState("idle");
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      setState("error");
      options.onError?.(errorObj);
      throw errorObj;
    }
  }, [workletPath, sampleRate]);

  /** Push audio directly (no sequencing) - for simple streaming */
  const pushAudio = useCallback((base64Audio: string) => {
    if (!workletRef.current) return;
    const samples = decodePCM16ToFloat32(base64Audio);
    workletRef.current.port.postMessage({ type: "audio", samples });
    setState("playing");
  }, []);

  /** Push audio with sequence number - reorders before playback */
  const pushSequencedAudio = useCallback((seq: number, base64Audio: string) => {
    if (!workletRef.current) return;

    const readyChunks = seqBufferRef.current.push(seq, base64Audio);
    for (const chunk of readyChunks) {
      const samples = decodePCM16ToFloat32(chunk);
      workletRef.current.port.postMessage({ type: "audio", samples });
    }
    if (readyChunks.length > 0) {
      setState("playing");
    }
  }, []);

  const signalComplete = useCallback(() => {
    workletRef.current?.port.postMessage({ type: "streamComplete" });
  }, []);

  const clear = useCallback(() => {
    workletRef.current?.port.postMessage({ type: "clear" });
    seqBufferRef.current.reset();
    setState("idle");
  }, []);

  return {
    state,
    error,
    isPlaying: state === "playing",
    init,
    pushAudio,
    pushSequencedAudio,
    signalComplete,
    clear,
  };
}
