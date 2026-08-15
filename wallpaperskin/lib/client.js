/**
 * @haibala/dsh-wallpaperskin — Browser half (Client 半区).
 *
 * 静态图片版：
 *  - 在 DSH 设置中注册“壁纸皮肤”独立界面
 *  - 展示本地 Wallpaper Engine 壁纸库（静态预览图）
 *  - 点击选择后作为 DSH 应用背景，铺满并适配窗口大小
 */
window.__ModuleLoader__.load({
  id: "dsh-wallpaperskin",
  factory: (require) => {
    "use strict";
    var module = { exports: {} };
    var exports = module.exports;

    const React = require("react");
    const h = React.createElement;

    const name = "wallpaperskin";
    const inject = ["slots"];

    const API = "/plugins/wallpaperskin";
    const DEFAULTS = { enabled: false, selectedId: null };

    /* ================= 小型 store ================= */
    const listeners = new Set();
    let state = Object.assign({}, DEFAULTS, {
      wallpapers: [],
      loading: true,
      applying: false,
      error: null
    });
    const store = {
      get: () => state,
      set(patch) {
        state = Object.assign({}, state, patch);
        for (const l of listeners) l(state);
      },
      subscribe(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
      }
    };

    /* ================= 背景样式 ================= */
    const styleEl = document.createElement("style");
    styleEl.setAttribute("data-wallpaperskin", "true");
    document.head.appendChild(styleEl);
    styleEl.textContent = `
      html::before {
        content: "";
        position: fixed;
        left: 0; top: 0;
        width: 100%; height: 100%;
        background-image: var(--dswsk-image, none);
        background-position: center;
        background-size: cover;
        background-repeat: no-repeat;
        pointer-events: none;
        z-index: -1;
        opacity: var(--dswsk-opacity, 0);
        transition: opacity 0.3s ease;
      }
      @media (prefers-reduced-motion: reduce) {
        html::before { transition: none; }
      }
      .dswsk-page { padding: 4px 20px 28px; max-width: 960px; display: flex; flex-direction: column; gap: 16px; }
      .dswsk-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .dswsk-title { font-size: 16px; line-height: 24px; font-weight: 600; margin: 0; color: var(--dsw-alias-label-primary); }
      .dswsk-subtitle { font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-secondary); }
      .dswsk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
      .dswsk-card {
        border: 1px solid var(--dsw-alias-border-l1);
        border-radius: 12px;
        overflow: hidden;
        cursor: pointer;
        background: var(--dsw-alias-bg-layer-2);
        transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
      }
      .dswsk-card:hover { border-color: var(--dsw-alias-brand-primary); transform: translateY(-2px); }
      .dswsk-card.dswsk-selected {
        border-color: var(--dsw-alias-brand-primary);
        box-shadow: 0 0 0 2px var(--dsw-alias-brand-primary);
      }
      .dswsk-thumb { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; background: var(--dsw-alias-bg-layer-3); }
      .dswsk-meta { padding: 8px 10px; min-width: 0; }
      .dswsk-name {
        font-size: 13px; line-height: 20px; color: var(--dsw-alias-label-primary);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .dswsk-type { font-size: 11px; line-height: 18px; color: var(--dsw-alias-label-secondary); text-transform: capitalize; }
      .dswsk-hint { font-size: 12px; line-height: 18px; color: var(--dsw-alias-label-secondary); }
      .dswsk-error { font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-error-primary); }
      .dswsk-ok { font-size: 12px; line-height: 18px; color: var(--dsw-alias-state-success-primary); }
      .dswsk-btn {
        box-sizing: border-box; height: 32px; padding: 0 14px; cursor: pointer;
        background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-primary);
        border: 1px solid var(--dsw-alias-border-l1); border-radius: 8px;
        font-family: inherit; font-size: 13px; line-height: 20px; flex: none;
      }
      .dswsk-btn:hover { background: var(--dsw-alias-bg-layer-3, var(--dsw-alias-bg-layer-2)); }
      .dswsk-btn-primary {
        background: var(--dsw-alias-brand-primary); border-color: transparent; color: #fff;
      }
      .dswsk-btn-primary:hover { opacity: 0.9; background: var(--dsw-alias-brand-primary); }
      .dswsk-status { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    `;

    const rootStyle = () => document.documentElement.style;
    function applyWallpaper(url) {
      if (!url) {
        rootStyle().setProperty("--dswsk-image", "none");
        rootStyle().setProperty("--dswsk-opacity", "0");
        return;
      }
      rootStyle().setProperty("--dswsk-image", 'url("' + url + '")');
      rootStyle().setProperty("--dswsk-opacity", "1");
    }

    /* ================= 数据通路 ================= */
    async function fetchJson(url, options) {
      const res = await fetch(url, options);
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    }

    async function load() {
      store.set({ loading: true, error: null });
      try {
        const [listRes, cfgRes] = await Promise.all([
          fetchJson(API + "/list"),
          fetchJson(API + "/config")
        ]);
        const wallpapers = listRes && listRes.ok && Array.isArray(listRes.wallpapers)
          ? listRes.wallpapers
          : [];
        const config = cfgRes && cfgRes.ok && cfgRes.config ? cfgRes.config : {};
        const next = Object.assign({}, DEFAULTS, config, { wallpapers, loading: false, error: null });
        store.set(next);

        if (next.enabled && next.selectedId) {
          const selected = wallpapers.find((w) => w.id === next.selectedId);
          if (selected) applyWallpaper(selected.imageUrl);
        }
      } catch (err) {
        store.set({ loading: false, error: String((err && err.message) || err) });
      }
    }

    async function selectWallpaper(w) {
      store.set({ applying: true, error: null });
      applyWallpaper(w.imageUrl);
      const cfg = { enabled: true, selectedId: w.id };
      try {
        await fetchJson(API + "/config", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(cfg)
        });
        store.set({ applying: false, enabled: true, selectedId: w.id });
      } catch (err) {
        store.set({ applying: false, error: String((err && err.message) || err) });
      }
    }

    async function disableWallpaper() {
      applyWallpaper(null);
      const cfg = { enabled: false, selectedId: null };
      try {
        await fetchJson(API + "/config", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(cfg)
        });
        store.set({ enabled: false, selectedId: null, error: null });
      } catch (err) {
        store.set({ error: String((err && err.message) || err) });
      }
    }

    /* ================= 设置页 UI ================= */
    function SettingsView() {
      const [snap, setSnap] = React.useState(store.get());
      React.useEffect(() => store.subscribe(setSnap), []);

      return h("div", { className: "dswsk-page" }, [
        h("div", { className: "dswsk-header" }, [
          h("div", { className: "dswsk-title" }, "壁纸皮肤（静态图片）"),
          h("button", {
            className: "dswsk-btn" + (snap.enabled ? "" : " dswsk-btn-primary"),
            disabled: snap.applying,
            onClick: () => (snap.enabled ? disableWallpaper() : load())
          }, snap.enabled ? "关闭壁纸" : "重新扫描")
        ]),
        h("div", { className: "dswsk-subtitle" }, "从本地 Wallpaper Engine 壁纸库读取静态预览图，点击即可应用到 DSH 背景，自动铺满并适配窗口大小。"),
        h("div", { className: "dswsk-status" }, [
          snap.enabled && snap.selectedId
            ? h("span", { className: "dswsk-ok" }, "当前已启用壁纸")
            : h("span", { className: "dswsk-hint" }, "当前未启用壁纸"),
          snap.applying ? h("span", { className: "dswsk-hint" }, "正在应用…") : null,
          snap.loading ? h("span", { className: "dswsk-hint" }, "正在扫描 Wallpaper Engine…") : null,
          snap.error ? h("span", { className: "dswsk-error" }, snap.error) : null
        ]),
        h("div", { className: "dswsk-subtitle" }, "共 " + snap.wallpapers.length + " 张可用的静态壁纸"),
        h("div", { className: "dswsk-grid" }, snap.wallpapers.map((w) =>
          h("div", {
            key: w.id,
            className: "dswsk-card" + (snap.selectedId === w.id ? " dswsk-selected" : ""),
            onClick: () => selectWallpaper(w)
          }, [
            h("img", { className: "dswsk-thumb", src: w.previewUrl, alt: w.title, loading: "lazy" }),
            h("div", { className: "dswsk-meta" }, [
              h("div", { className: "dswsk-name" }, w.title),
              h("div", { className: "dswsk-type" }, w.type + " · " + w.source)
            ])
          ])
        ))
      ]);
    }

    /* ================= Cordis 插件入口 ================= */
    function apply(ctx) {
      ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register(
        { name: "settings.section", id: "wallpaperskin", order: 30, label: "壁纸皮肤" },
        () => h("div", { className: "dswsk-page" }, h(SettingsView))
      )), "dsh-wallpaperskin: settings");

      ctx.effect(() => () => {
        styleEl.remove();
        for (const v of ["--dswsk-image", "--dswsk-opacity"]) {
          rootStyle().removeProperty(v);
        }
      }, "dsh-wallpaperskin: cleanup");

      load();
    }

    exports.name = name;
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
