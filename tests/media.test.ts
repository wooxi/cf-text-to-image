import { describe, expect, it } from "vitest";
import {
  IMAGE_PREFIX,
  contentTypeForExt,
  deleteImage,
  extForContentType,
  isSafeKey,
} from "../functions/lib/media";
import type { Env } from "../functions/lib/env";

describe("isSafeKey", () => {
  it("拒绝路径穿越与非法字符", () => {
    expect(isSafeKey("../secret")).toBe(false);
    expect(isSafeKey("a/../../b")).toBe(false);
    expect(isSafeKey("")).toBe(false);
    expect(isSafeKey("a b.png")).toBe(false);
    expect(isSafeKey("a?.png")).toBe(false);
    // 生成结果是平铺在 images/ 下的，键里不该出现路径分隔符
    expect(isSafeKey("nested/a.png")).toBe(false);
    expect(isSafeKey(".hidden")).toBe(false);
  });

  it("接受正常的 uuid 文件名", () => {
    expect(isSafeKey("d895b7b7-3ab1-4efa-9719-caf0faa6838d.png")).toBe(true);
    expect(isSafeKey("a.webp")).toBe(true);
  });
});

describe("扩展名与内容类型", () => {
  it("按内容类型取扩展名", () => {
    expect(extForContentType("image/jpeg; charset=binary")).toBe("jpg");
    expect(extForContentType("IMAGE/PNG")).toBe("png");
    expect(extForContentType("application/octet-stream")).toBeNull();
    expect(extForContentType(null)).toBeNull();
  });

  it("按扩展名取内容类型", () => {
    expect(contentTypeForExt("png")).toBe("image/png");
    expect(contentTypeForExt("webp")).toBe("image/webp");
    expect(contentTypeForExt("bin")).toBe("application/octet-stream");
  });
});

describe("deleteImage", () => {
  function envWithRecorder() {
    const deleted: string[] = [];
    const env = {
      IMAGES_BUCKET: {
        delete: async (key: string) => {
          deleted.push(key);
        },
      },
    } as unknown as Env;
    return { env, deleted };
  }

  it("删除本站生成结果", async () => {
    const { env, deleted } = envWithRecorder();
    await deleteImage(
      env,
      `${IMAGE_PREFIX}abc.png`.replace(IMAGE_PREFIX, "/api/images?file="),
    );
    expect(deleted).toEqual(["images/abc.png"]);
  });

  it("对外链与脏数据不做任何删除", async () => {
    const { env, deleted } = envWithRecorder();
    await deleteImage(env, "https://cdn.example.com/a.png");
    await deleteImage(env, "/api/images?file=../../etc/passwd");
    await deleteImage(env, "");
    await deleteImage(env, null);
    expect(deleted).toEqual([]);
  });
});
