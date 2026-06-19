export type KeywordSelectionMode = "single" | "multi";

export interface KeywordGroup {
  id: number;
  name: string;
  slug: string;
  description?: string;
  parameterGroup?: boolean;
  facets?: KeywordFacet[];
  keywords: Keyword[];
}

export interface KeywordFacet {
  slug: string;
  name: string;
  description?: string;
  selectionMode: KeywordSelectionMode;
  maxSelect?: number;
  keywords: Keyword[];
}

export interface Keyword {
  id: number;
  groupId: number;
  name: string;
  facetSlug?: string;
}

export interface ImageRecord {
  id: number;
  keywordNames: string;
  prompt: string;
  imagePath: string;
  type: string;
  posterPath: string;
  createdAt: string;
}

export interface ConfigItem {
  key: string;
  value: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
