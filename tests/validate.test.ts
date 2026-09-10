import { describe, expect, it } from "vitest";
import { normalizeEndpoint } from "../functions/lib/endpoints";
import {
  decodeDataUri,
  MAX_REF_IMAGES,
  validateTaskBody,
} from "../functions/lib/validate";
import { HttpError } from "../functions/lib/http";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";

function expectHttpError(
  fn: () => unknown,
  status: number,
  messagePart?: string,
) {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(HttpError);
    expect((e as HttpError).status).toBe(status);
    if (messagePart) expect((e as HttpError).message).toContain(messagePart);
    return;
  }
  throw new Error("预期抛出 HttpError，但没有抛出");
}

describe("normalizeEndpoint", () => {
  it("缺协议时补 https://", () => {
    // 旧实现会产出 "apihub.example.com/v1"，fetch 直接抛 Invalid URL
    expect(normalizeEndpoint("apihub.example.com")).toBe(
      "https://apihub.example.com/v1",
    );
  });

  it("去掉结尾斜杠并按需补 /v1", () => {
    expect(normalizeEndpoint("https://api.openai.com")).toBe(
      "https://api.openai.com/v1",
    );
    expect(normalizeEndpoint("https://api.openai.com/")).toBe(
      "https://api.openai.com/v1",
    );
    expect(normalizeEndpoint("https://api.openai.com/v1/")).toBe(
      "https://api.openai.com/v1",
    );
    expect(normalizeEndpoint("http://localhost:8080")).toBe(
      "http://localhost:8080/v1",
    );
  });

  it("已有路径时不再追加", () => {
    expect(normalizeEndpoint("https://proxy.example.com/openai")).toBe(
      "https://proxy.example.com/openai",
    );
    expect(normalizeEndpoint("https://proxy.example.com/api/v1")).toBe(
      "https://proxy.example.com/api/v1",
    );
  });

  it("空值报错", () => {
    expect(() => normalizeEndpoint("  ")).toThrow();
  });
});

describe("validateTaskBody", () => {
  it("接受最小合法请求并套用默认尺寸", () => {
    const task = validateTaskBody({ type: "image", prompt: "一只猫" });
    expect(task).toMatchObject({
      type: "image",
      prompt: "一只猫",
      size: "1024x1024",
      refImages: [],
    });
  });

  it("按形状校验尺寸，而不是维护一份尺寸白名单", () => {
    expect(validateTaskBody({ prompt: "x", size: "0750x1500" }).size).toBe(
      "750x1500",
    );
    expectHttpError(
      () => validateTaskBody({ prompt: "x", size: "abc" }),
      400,
      "尺寸格式",
    );
    expectHttpError(
      () => validateTaskBody({ prompt: "x", size: "1234567x10" }),
      400,
      "尺寸格式",
    );
    expectHttpError(
      () => validateTaskBody({ prompt: "x", size: "10x10" }),
      400,
      "单边",
    );
    expectHttpError(
      () => validateTaskBody({ prompt: "x", size: "99999x99999" }),
      400,
      "单边",
    );
    expectHttpError(
      () => validateTaskBody({ prompt: "x", size: "5000x5000" }),
      400,
      "单边",
    );
  });

  it("拒绝外链参考图（避免把上游请求变成 SSRF 跳板）", () => {
    expectHttpError(
      () =>
        validateTaskBody({
          type: "img2img",
          prompt: "x",
          image: ["https://evil.example.com/a.png"],
        }),
      400,
      "外链",
    );
  });

  it("拒绝非图片 Data URI", () => {
    expectHttpError(
      () =>
        validateTaskBody({
          type: "img2img",
          prompt: "x",
          image: ["data:text/html;base64,PHNjcmlwdD4="],
        }),
      400,
    );
  });

  it("限制参考图数量与类型", () => {
    const many = Array.from({ length: MAX_REF_IMAGES + 1 }, () => TINY_PNG);
    expectHttpError(
      () => validateTaskBody({ type: "img2img", prompt: "x", image: many }),
      400,
      "最多",
    );
    expectHttpError(
      () =>
        validateTaskBody({
          type: "img2img",
          prompt: "x",
          image: "not-an-array",
        }),
      400,
    );
  });

  it("img2img 必须有参考图", () => {
    expectHttpError(
      () => validateTaskBody({ type: "img2img", prompt: "x" }),
      400,
      "至少需要一张",
    );
  });

  it("拒绝未知任务类型（视频已下线）", () => {
    expectHttpError(
      () => validateTaskBody({ type: "video", prompt: "x" }),
      400,
      "任务类型",
    );
  });

  it("截断超长文本而不是报错", () => {
    expect(validateTaskBody({ prompt: "a".repeat(5000) }).prompt).toHaveLength(
      4000,
    );
    expect(
      validateTaskBody({ prompt: "x", keywords: "b".repeat(3000) }).keywords,
    ).toHaveLength(2000);
  });

  it("提示词与关键词不能同时为空", () => {
    expectHttpError(() => validateTaskBody({ type: "image" }), 400, "至少提供");
    expectHttpError(
      () => validateTaskBody({ type: "image", prompt: "   " }),
      400,
      "至少提供",
    );
  });
});

describe("decodeDataUri", () => {
  it("解码出正确的字节", () => {
    const { bytes, contentType } = decodeDataUri(TINY_PNG);
    expect(contentType).toBe("image/png");
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([
      0x89, 0x50, 0x4e, 0x47,
    ]);
  });

  it("把 image/jpg 归一为 image/jpeg", () => {
    expect(decodeDataUri("data:image/jpg;base64,AAAA").contentType).toBe(
      "image/jpeg",
    );
  });
});
