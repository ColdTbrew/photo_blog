export type GraphPhotoNode = {
  id: string;
  type: "photo";
  photoId: string;
  slug: string;
  title: string;
  src: string;
};

export type GraphTagNode = {
  id: string;
  type: "tag";
  tag: string;
  count: number;
};

export type GraphNode = GraphPhotoNode | GraphTagNode;

export type GraphLink = {
  source: string;
  target: string;
  weight: number;
};

export type GraphMeta = {
  totalPhotos: number;
  totalTags: number;
  topTagsLimit: number;
  minTagFreq: number;
};

export type PhotoGraphResponse = {
  nodes: GraphNode[];
  links: GraphLink[];
  meta: GraphMeta;
};
