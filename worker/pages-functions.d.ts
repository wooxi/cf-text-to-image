/**
 * `wrangler pages functions build` 的产物：构建时才生成，不进仓库。
 * 这里只声明它对外暴露的形状——一个带 fetch 的 Worker 默认导出。
 * env 用 any 是为了避免这里的声明和调用方 Env 之间产生无意义的泛型摩擦。
 */
declare module "*/dist/functions/index.js" {
  const worker: {
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response>;
  };
  export default worker;
}
