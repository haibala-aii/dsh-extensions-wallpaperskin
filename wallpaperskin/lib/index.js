/**
 * @haibala/dsh-wallpaperskin — Node half (Host 半区).
 *
 * 骨架实现：注册 /plugins/wallpaperskin 路由，后续在这里实现
 * 壁纸扫描、配置持久化、静态资源等服务。
 */
const name = "wallpaperskin";
const inject = ["webServer"];

function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: "prefix",
    path: "/plugins/wallpaperskin",
    handler: async (req, res) => {
      const url = new URL(req.url || "/", "http://x");
      if (url.pathname === "/plugins/wallpaperskin/health") {
        res.writeHead(200, {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-cache"
        });
        res.end(JSON.stringify({ ok: true, plugin: "dsh-wallpaperskin" }));
        return;
      }
      res.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ ok: false, error: "not found" }));
    }
  }), "dsh-wallpaperskin: routes");
}

export { apply, inject, name };
