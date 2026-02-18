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
};

export type PhotoListResponse = {
  items: Photo[];
  hasMore: boolean;
  nextCursor: string | null;
};
