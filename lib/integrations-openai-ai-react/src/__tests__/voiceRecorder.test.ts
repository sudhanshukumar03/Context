// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useVoiceRecorder } from "../audio/useVoiceRecorder";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("releases the microphone when the component unmounts", async () => {
  const stopTrack = vi.fn(); const stopRecorder = vi.fn();
  const stream = { getTracks: () => [{ stop: stopTrack }] };
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(async () => stream) } });
  vi.stubGlobal("MediaRecorder", class {
    static isTypeSupported() { return true; }
    state = "recording"; stream = stream; onstop = null; ondataavailable = null;
    start() {} stop = stopRecorder;
  });
  const { result, unmount } = renderHook(() => useVoiceRecorder());
  await act(() => result.current.startRecording());
  unmount();
  expect(stopRecorder).toHaveBeenCalledOnce(); expect(stopTrack).toHaveBeenCalledOnce();
});
it("releases a late permission result without starting recording in an unmounted component", async () => {
  const stopTrack = vi.fn(); let resolve!: (stream: unknown) => void;
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(() => new Promise(yes => { resolve = yes; })) } });
  const Recorder = vi.fn(); vi.stubGlobal("MediaRecorder", Recorder);
  const { result, unmount } = renderHook(() => useVoiceRecorder());
  let pending!: Promise<void>;
  act(() => { pending = result.current.startRecording(); });
  unmount();
  await act(async () => { resolve({ getTracks: () => [{ stop: stopTrack }] }); await pending; });
  expect(stopTrack).toHaveBeenCalledOnce(); expect(Recorder).not.toHaveBeenCalled();
});
it("releases the stream if recorder construction fails", async () => {
  const stopTrack = vi.fn();
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })) } });
  vi.stubGlobal("MediaRecorder", class { static isTypeSupported() { return true; } constructor() { throw new Error("Recorder unavailable"); } });
  const { result } = renderHook(() => useVoiceRecorder());
  await act(async () => { await expect(result.current.startRecording()).rejects.toThrow("Recorder unavailable"); });
  expect(stopTrack).toHaveBeenCalledOnce();
});
