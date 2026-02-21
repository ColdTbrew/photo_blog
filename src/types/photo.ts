export type Photo = {
  id: string;
  slug: string;
  src: string;
  width: number;
  height: number;
  title: string;
  caption: string;
  tags: string[];
  takenAt: string | null;
  createdAt: string;
  exifMake?: string | null;
  exifModel?: string | null;
  exifLensModel?: string | null;
  exifIso?: number | null;
  exifFocalLengthMm?: number | null;
  exifFNumber?: number | null;
  exifExposureTime?: string | null;
};

export type PhotoListResponse = {
  items: Photo[];
  hasMore: boolean;
  nextCursor: string | null;
};
