import { describe, expect, it } from "vitest";
import {
  DEFAULT_SIZE,
  SIZE_RATIOS,
  SIZE_TIERS,
  resolveSize,
} from "../src/lib/sizes";

describe("尺寸档位表", () => {
  it("同一比例下每一档都是不同的尺寸", () => {
    // 旧实现里 16:9 的 512/1024/1536 全部退化成 1344x768
    for (const ratio of SIZE_RATIOS) {
      const values = Object.values(SIZE_TIERS[ratio]);
      expect(
        new Set(values).size,
        `比例 ${ratio} 存在重复尺寸：${values.join(", ")}`,
      ).toBe(values.length);
    }
  });

  it("每个尺寸都在服务端允许的单边范围内", () => {
    for (const tiers of Object.values(SIZE_TIERS)) {
      for (const size of Object.values(tiers)) {
        const [width, height] = size.split("x").map(Number);
        expect(width).toBeGreaterThanOrEqual(256);
        expect(height).toBeGreaterThanOrEqual(256);
        expect(width).toBeLessThanOrEqual(4096);
        expect(height).toBeLessThanOrEqual(4096);
      }
    }
  });

  it("按已选标签推导尺寸", () => {
    expect(resolveSize(["9:16", "1024"])).toBe("768x1344");
    expect(resolveSize(["9:16", "2048"])).toBe("1440x2560");
    expect(resolveSize(["16:9"])).toBe(SIZE_TIERS["16:9"]["1024"]);
    expect(resolveSize(["1:1", "9999"])).toBe(SIZE_TIERS["1:1"]["1024"]);
  });

  it("没选比例时用默认尺寸", () => {
    expect(resolveSize([])).toBe(DEFAULT_SIZE);
    expect(resolveSize(["单人", "柔光"])).toBe(DEFAULT_SIZE);
  });
});
