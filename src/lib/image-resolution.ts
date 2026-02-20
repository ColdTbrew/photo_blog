import sharp from "sharp";

export const MIN_SHORT_SIDE = 2000;
export const MIN_LONG_SIDE = 3000;
export const WEBP_QUALITY_UPLOAD = 80;
export const AVIF_QUALITY_DOWNLOAD = 62;
export const UPSCALE_KERNEL = "lanczos3";
export const DEFAULT_AVIF_EFFORT = 6;

type NormalizeResolutionResult = {
  shortSide: number;
  longSide: number;
  scale: number;
  targetWidth: number;
  targetHeight: number;
  shouldUpscale: boolean;
};

type EnsureMinimumResolutionInput = {
  bytes: Buffer;
  quality: number;
  outputFormat?: "webp" | "avif";
  enforceMinimum?: boolean;
  fallbackWidth?: number;
  fallbackHeight?: number;
};

type EnsureMinimumResolutionOutput = {
  data: Buffer;
  width: number;
  height: number;
  upscaled: boolean;
  normalized: NormalizeResolutionResult;
};

export function normalizeResolution(width: number, height: number): NormalizeResolutionResult {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error("Image width/height must be positive numbers");
  }

  const shortSide = Math.min(width, height);
  const longSide = Math.max(width, height);
  const scale = Math.max(MIN_SHORT_SIDE / shortSide, MIN_LONG_SIDE / longSide, 1);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  return {
    shortSide,
    longSide,
    scale,
    targetWidth,
    targetHeight,
    shouldUpscale: scale > 1,
  };
}

function resolveSourceSize(
  metadata: sharp.Metadata,
  fallbackWidth?: number,
  fallbackHeight?: number
): { width: number; height: number } {
  const width = metadata.width ?? fallbackWidth;
  const height = metadata.height ?? fallbackHeight;

  if (!width || !height) {
    throw new Error("Unable to determine image dimensions");
  }

  return { width, height };
}

export async function ensureMinimumResolution(
  input: EnsureMinimumResolutionInput
): Promise<EnsureMinimumResolutionOutput> {
  const {
    bytes,
    quality,
    outputFormat = "webp",
    enforceMinimum = true,
    fallbackWidth,
    fallbackHeight,
  } = input;

  const metadata = await sharp(bytes).rotate().metadata();
  const source = resolveSourceSize(metadata, fallbackWidth, fallbackHeight);
  const normalized = normalizeResolution(source.width, source.height);
  const shouldUpscale = enforceMinimum && normalized.shouldUpscale;

  let pipeline = sharp(bytes).rotate();
  if (shouldUpscale) {
    pipeline = pipeline.resize({
      width: normalized.targetWidth,
      height: normalized.targetHeight,
      fit: "fill",
      kernel: UPSCALE_KERNEL,
      withoutEnlargement: false,
    });
  }

  if (outputFormat === "avif") {
    pipeline = pipeline.avif({ quality, effort: DEFAULT_AVIF_EFFORT });
  } else {
    pipeline = pipeline.webp({ quality, effort: 4 });
  }

  const transformed = await pipeline.toBuffer({ resolveWithObject: true });

  return {
    data: transformed.data,
    width: transformed.info.width ?? normalized.targetWidth,
    height: transformed.info.height ?? normalized.targetHeight,
    upscaled: shouldUpscale,
    normalized,
  };
}
