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

/** 极简 D1 替身：只认 settings 表用到的那几条语句 */
function makeDbStub() {
  const rows = new Map<string, string>();
  const exec = (sql: string, args: unknown[]) => ({
    async run() {
      // 会话密钥那条 INSERT 把键写成字面量了，其余按 ? 占位符取
      const literal = sql.includes("'session_secret'");
      const key = literal ? "session_secret" : String(args[0]);
      const value = literal ? String(args[0]) : String(args[1]);
      if (sql.includes("INSERT INTO settings") && !rows.has(key)) {
        rows.set(key, value);
      }
      return {};
    },
    async first() {
      const value = rows.get(String(args[0]));
      return value === undefined ? null : { value };
    },
    async all() {
      return { results: [...rows].map(([key, value]) => ({ key, value })) };
    },
  });
  return {
    rows,
    prepare: (sql: string) => ({
      ...exec(sql, []),
      bind: (...args: unknown[]) => exec(sql, args),
    }),
  };
}

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

  it("没配 SESSION_SECRET 时自动生成并落库，签发的会话照样可校验", async () => {
    const db = makeDbStub();
    const env = makeEnv({
      SESSION_SECRET: "",
      DB: db as unknown as Env["DB"],
    });

    const token = await createSessionToken(env);
    // 第二次调用要复用库里那份，否则刚签发的会话立刻就失效了
    await expect(verifySessionToken(env, token)).resolves.toEqual({
      sub: "owner",
    });
    expect(db.rows.get("session_secret")).toMatch(/^[0-9a-f]{64}$/);
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
