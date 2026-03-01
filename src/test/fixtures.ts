import type { Photo } from "@/types/photo";

export function makePhoto(overrides: Partial<Photo> = {}): Photo {
  return {
    id: "p_001",
    slug: "first-shot",
    src: "https://example.com/photo.webp",
    width: 3200,
    height: 2400,
    title: "First Shot",
    caption: "Golden hour in Seoul.",
    tags: ["seoul", "street"],
    takenAt: "2026-01-10",
    createdAt: "2026-01-11T00:00:00.000Z",
    exifMake: "FUJIFILM",
    exifModel: "X-T5",
    exifLensModel: "XF 23mm",
    exifIso: 160,
    exifFocalLengthMm: 23,
    exifFNumber: 2,
    exifExposureTime: "1/125s",
    ...overrides,
  };
}
