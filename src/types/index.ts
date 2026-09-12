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

/** 设置页读到的配置：可编辑值、密钥是否已填、还缺哪些、成品图存哪 */
export interface SettingsPayload {
  values: Record<string, string>;
  secrets: Record<string, boolean>;
  missing: string[];
  storage: "image-bed" | "r2";
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
