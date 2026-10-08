import { describe, it, expect } from "vitest";
import { SequenceBuffer } from "../audio/useAudioPlayback";

describe("SequenceBuffer", () => {
  it("buffers and yields audio packets in strict sequence order", () => {
    const buffer = new SequenceBuffer(5);

    // Push seq 1 and 2 before 0
    expect(buffer.push(1, "chunk-1")).toEqual([]);
    expect(buffer.push(2, "chunk-2")).toEqual([]);

    // Push seq 0 should drain 0, 1, and 2
    expect(buffer.push(0, "chunk-0")).toEqual(["chunk-0", "chunk-1", "chunk-2"]);

    // Subsequent packet in sequence
    expect(buffer.push(3, "chunk-3")).toEqual(["chunk-3"]);
  });

  it("recovers from dropped packets when buffer exceeds maxGap threshold", () => {
    const buffer = new SequenceBuffer(3);

    // Packet 0 is lost/dropped; packets 1, 2, 3, 4 arrive
    expect(buffer.push(1, "chunk-1")).toEqual([]);
    expect(buffer.push(2, "chunk-2")).toEqual([]);
    expect(buffer.push(3, "chunk-3")).toEqual([]);
    // Exceeds maxGap 3: pending has 4 items, min key is 1 -> recovers to seq 1
    const recovered = buffer.push(4, "chunk-4");
    expect(recovered).toEqual(["chunk-1", "chunk-2", "chunk-3", "chunk-4"]);
  });

  it("resets internal state properly", () => {
    const buffer = new SequenceBuffer(5);
    buffer.push(5, "orphan");
    buffer.reset();
    expect(buffer.push(0, "chunk-0")).toEqual(["chunk-0"]);
  });
});
