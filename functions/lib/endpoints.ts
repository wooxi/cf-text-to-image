/**
 * 归一化上游端点：
 *  - 缺协议时补 https://（否则 fetch 报 "Invalid URL"，极难排查）
 *  - 去掉结尾斜杠
 *  - 没有路径段时补 /v1
 */
export function normalizeEndpoint(endpoint: string): string {
 let url = (endpoint || "").trim();
 if (!url) throw new Error("端点地址为空");
 if (!/^https?:\/\//i.test(url)) url = "https://" + url;
 url = url.replace(/\/+$/, "");
 const afterHost = url.replace(/^https?:\/\/[^/]+/i, "");
 if (!afterHost) url += "/v1";
 return url;
}
