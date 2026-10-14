/**
 * React hook for voice recording using MediaRecorder API.
 * Negotiates a supported MIME type across browsers (Chrome, Firefox, Safari).
 */
import { useRef, useCallback, useState, useEffect } from "react";

export type RecordingState = "idle" | "recording" | "stopped";

const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/aac",
];

function getSupportedMimeType(): string | undefined {
  for (const mimeType of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }
  return undefined;
}

export function useVoiceRecorder() {
  const [state, setState] = useState<RecordingState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string | undefined>(undefined);
  const generation = useRef(0);
  const starting = useRef(false);
  useEffect(() => () => {
    generation.current++;
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;
    recorder.ondataavailable = null;
    if (recorder.state === "recording") { recorder.onstop = null; recorder.stop(); }
    recorder.stream.getTracks().forEach(track => track.stop());
  }, []);

  const startRecording = useCallback(async (): Promise<void> => {
    if (starting.current || mediaRecorderRef.current?.state === "recording") return;
    starting.current = true;
    const started = generation.current;
    let stream: MediaStream | undefined;
    try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (started !== generation.current) { stream.getTracks().forEach(track => track.stop()); return; }
    const mimeType = getSupportedMimeType();
    mimeTypeRef.current = mimeType;

    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream);

    mediaRecorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.start(100);
    setState("recording");
    } catch (error) { stream?.getTracks().forEach(track => track.stop()); throw error; }
    finally { starting.current = false; }
  }, []);

  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== "recording") {
        resolve(new Blob());
        return;
      }

      recorder.onstop = () => {
        const blobType = mimeTypeRef.current ?? recorder.mimeType ?? "audio/webm";
        const blob = new Blob(chunksRef.current, { type: blobType });
        recorder.stream.getTracks().forEach((t) => t.stop());
        setState("stopped");
        resolve(blob);
      };

      recorder.stop();
    });
  }, []);

  return { state, startRecording, stopRecording };
}
