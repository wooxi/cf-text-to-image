export interface Keyword {
  id: number;
  name: string;
}

export interface KeywordGroup {
  id: number;
  name: string;
  slug: string;
  description: string;
  isParameterGroup: boolean;
  keywords: Keyword[];
}

export interface ImageRecord {
  id: number;
  prompt: string;
  keywordNames: string;
  imagePath: string;
  size: string;
  createdAt: string;
}

export type TaskStatus = "pending" | "processing" | "completed" | "failed";

export interface TaskRecord {
  id: number;
  status: TaskStatus;
  type: string;
  prompt: string;
  keywordNames: string;
  imagePath: string;
  size: string;
  progress: number;
  error: string;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryPage {
  items: ImageRecord[];
  hasMore: boolean;
  nextBefore: number | null;
}

export interface ConfigStatus {
  required: readonly { key: string; scope: string }[];
  missing: string[];
  resolved: {
    llmEndpoint: string;
    llmModel: string;
    imageEndpoint: string;
    imageModel: string;
    promptSystemImage: string;
    promptSystemPolish: string;
  };
  overrides: { image: boolean; polish: boolean };
}

export interface PingResult {
  reachable: boolean;
  status?: number;
  models?: string[];
}

export interface AuthState {
  authenticated: boolean;
  passwordConfigured: boolean;
}

export type TaskType = "image" | "img2img";
