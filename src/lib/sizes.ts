/**
 * 输出尺寸档位表。
 *
 * 同一比例下每一档都必须是不同的尺寸（旧实现里 16:9 的 512/1024/1536
 * 都退化成 1344x768）。服务端只校验「格式 + 单边 256-4096」，
 * 不维护一份需要和这里保持同步的白名单。
 */

export const SIZE_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"] as const;
export type SizeRatio = (typeof SIZE_RATIOS)[number];

export const SIZE_TIERS: Record<SizeRatio, Record<string, string>> = {
 "1:1": {
  "512": "512x512",
  "1024": "1024x1024",
  "1536": "1536x1536",
  "2048": "2048x2048",
 },
 "3:4": {
  "512": "768x1024",
  "1024": "768x1344",
  "1536": "1152x1536",
  "2048": "1536x2048",
 },
 "4:3": {
  "512": "1024x768",
  "1024": "1344x768",
  "1536": "1536x1152",
  "2048": "2048x1536",
 },
 "9:16": {
  "512": "576x1024",
  "1024": "768x1344",
  "1536": "1152x2048",
  "2048": "1440x2560",
 },
 "16:9": {
  "512": "1024x576",
  "1024": "1344x768",
  "1536": "2048x1152",
  "2048": "2560x1440",
 },
};

export const DEFAULT_SIZE = "1024x1024";

/** 从已选标签里挑出比例与清晰度档位，推导最终尺寸。 */
export function resolveSize(selected: readonly string[]): string {
 const ratio = SIZE_RATIOS.find((candidate) => selected.includes(candidate));
 if (!ratio) return DEFAULT_SIZE;

 const tiers = SIZE_TIERS[ratio];
 const tier = Object.keys(tiers).find((key) => selected.includes(key));
 return tier ? tiers[tier] : tiers["1024"];
}
