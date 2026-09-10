import { describe, expect, it } from "vitest";
import {
  clearSessionCookie,
  createSessionToken,
  passwordConfigured,
  sessionCookie,
  verifyPassword,
  verifySessionToken,
} from "../functions/lib/auth";
import type { Env } from "../functions/lib/env";

const SECRET = "test-session-secret-at-least-16-chars";

function makeEnv(overrides: Partial<Env> = {}): Env {
  return {
    SESSION_SECRET: SECRET,
    ACCESS_PASSWORD: "correct-horse-battery",
    ...overrides,
  } as Env;
}

describe("访问密码", () => {
  it("识别是否已配置", () => {
    expect(passwordConfigured(makeEnv())).toBe(true);
    expect(passwordConfigured(makeEnv({ ACCESS_PASSWORD: "" }))).toBe(false);
    expect(passwordConfigured(makeEnv({ ACCESS_PASSWORD: "   " }))).toBe(false);
  });

  it("正确密码通过、错误密码拒绝", async () => {
    const env = makeEnv();
    await expect(verifyPassword(env, "correct-horse-battery")).resolves.toBe(
      true,
    );
    await expect(verifyPassword(env, "correct-horse-batterY")).resolves.toBe(
      false,
    );
    await expect(verifyPassword(env, "")).resolves.toBe(false);
  });

  it("多次连续校验互不污染", async () => {
    // 曾经因为把派生结果按「配置密码」做缓存，导致提交密码直接命中缓存 → 任意密码都能通过
    const env = makeEnv();
    await expect(verifyPassword(env, "correct-horse-battery")).resolves.toBe(
      true,
    );
    await expect(verifyPassword(env, "another-password")).resolves.toBe(false);
    await expect(verifyPassword(env, "yet-another")).resolves.toBe(false);
    await expect(verifyPassword(env, "correct-horse-battery")).resolves.toBe(
      true,
    );
  });

  it("未配置时明确报错而不是静默拒绝", async () => {
    await expect(
      verifyPassword(makeEnv({ ACCESS_PASSWORD: "" }), "x"),
    ).rejects.toThrow(/ACCESS_PASSWORD/);
  });

  it("前后缀相同但长度不同也必须拒绝", async () => {
    const env = makeEnv({ ACCESS_PASSWORD: "abcdefgh" });
    await expect(verifyPassword(env, "abcdefgh")).resolves.toBe(true);
    await expect(verifyPassword(env, "abcdefg")).resolves.toBe(false);
    await expect(verifyPassword(env, "abcdefghi")).resolves.toBe(false);
  });
});

describe("会话令牌", () => {
  it("签发与校验往返", async () => {
    const env = makeEnv();
    await expect(
      verifySessionToken(env, await createSessionToken(env)),
    ).resolves.toEqual({ sub: "owner" });
  });

  it("换密钥或篡改后校验失败", async () => {
    const token = await createSessionToken(makeEnv());
    await expect(
      verifySessionToken(
        makeEnv({ SESSION_SECRET: "another-secret-value-16" }),
        token,
      ),
    ).resolves.toBeNull();
    await expect(
      verifySessionToken(makeEnv(), `${token}x`),
    ).resolves.toBeNull();
  });

  it("SESSION_SECRET 缺失或过短时拒绝签发", async () => {
    await expect(
      createSessionToken(makeEnv({ SESSION_SECRET: "" })),
    ).rejects.toThrow(/SESSION_SECRET/);
    await expect(
      createSessionToken(makeEnv({ SESSION_SECRET: "short" })),
    ).rejects.toThrow(/SESSION_SECRET/);
  });

  it("Cookie 带齐安全属性，登出清空 Max-Age", () => {
    const cookie = sessionCookie("abc");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toMatch(/Max-Age=\d+/);
    expect(clearSessionCookie()).toContain("Max-Age=0");
  });
});
