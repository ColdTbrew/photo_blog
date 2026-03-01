import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  AVIF_QUALITY_DOWNLOAD,
  MIN_LONG_SIDE,
  MIN_SHORT_SIDE,
  ensureMinimumResolution,
  normalizeResolution,
} from "@/lib/image-resolution";

describe("normalizeResolution", () => {
  it("throws for non-positive dimensions", () => {
    expect(() => normalizeResolution(0, 200)).toThrow("Image width/height must be positive numbers");
    expect(() => normalizeResolution(1200, -1)).toThrow("Image width/height must be positive numbers");
  });

  it("keeps size when already above minimum", () => {
    const normalized = normalizeResolution(3200, 2400);

    expect(normalized.shortSide).toBe(2400);
    expect(normalized.longSide).toBe(3200);
    expect(normalized.scale).toBe(1);
    expect(normalized.targetWidth).toBe(3200);
    expect(normalized.targetHeight).toBe(2400);
    expect(normalized.shouldUpscale).toBe(false);
  });

  it("computes upscale target from short/long constraints", () => {
    const normalized = normalizeResolution(1500, 2250);

    expect(normalized.scale).toBeCloseTo(Math.max(MIN_SHORT_SIDE / 1500, MIN_LONG_SIDE / 2250), 6);
    expect(normalized.targetWidth).toBe(2000);
    expect(normalized.targetHeight).toBe(3000);
    expect(normalized.shouldUpscale).toBe(true);
  });
});

describe("ensureMinimumResolution", () => {
  it("returns same size when minimum enforcement is disabled", async () => {
    const source = await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 3,
        background: { r: 30, g: 40, b: 50 },
      },
    })
      .jpeg()
      .toBuffer();

    const output = await ensureMinimumResolution({
      bytes: source,
      quality: 80,
      outputFormat: "webp",
      enforceMinimum: false,
    });

    expect(output.upscaled).toBe(false);
    expect(output.width).toBe(320);
    expect(output.height).toBe(240);
    expect(output.normalized.shouldUpscale).toBe(true);
  });

  it("upscales when minimum enforcement is enabled", async () => {
    const source = await sharp({
      create: {
        width: 300,
        height: 450,
        channels: 3,
        background: { r: 110, g: 90, b: 70 },
      },
    })
      .jpeg()
      .toBuffer();

    const output = await ensureMinimumResolution({
      bytes: source,
      quality: AVIF_QUALITY_DOWNLOAD,
      outputFormat: "avif",
      enforceMinimum: true,
    });

    expect(output.upscaled).toBe(true);
    expect(output.width).toBe(2000);
    expect(output.height).toBe(3000);
    expect(output.normalized.shouldUpscale).toBe(true);
  });
});
