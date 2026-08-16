/**
 * @haibala-aii/dsh-extensions-wallpaperskin — Browser half (Client 半区).
 *
 * 静态图片版：
 *  - 在扩展中心注册“壁纸皮肤”卡片与弹窗
 *  - 展示本地 Wallpaper Engine 壁纸库（静态预览图）
 *  - 预览后确认应用为 DSH 的背景皮肤
 */
window.__ModuleLoader__.load({
  id: "@haibala-aii/dsh-extensions-wallpaperskin",
  factory: (require) => {
    "use strict";
    var module = { exports: {} };
    var exports = module.exports;

    const React = require("react");
    const h = React.createElement;
    const { Modal } = require("@deepseek-ai/dsh-client-ui-primitives");

    const name = "wallpaperskin";
    const inject = ["slots"];

    const API = "/plugins/wallpaperskin";
    const PACKAGE_NAME = "@haibala-aii/dsh-extensions-wallpaperskin";
    const EXTENSION_OPEN_EVENT = "dsh:extension-open";
    const DEFAULT_TRANSPARENCY = 36;
    const MAX_TRANSPARENCY = 70;
    const DEFAULTS = {
      enabled: false,
      selectedId: null,
      draftId: null,
      surfaceTransparency: DEFAULT_TRANSPARENCY,
      draftTransparency: DEFAULT_TRANSPARENCY
    };

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
      .dswsk-background {
        position: fixed;
        left: 0; top: 0;
        width: 100%; height: 100%;
        background-image: var(--dswsk-image, none);
        background-position: center;
        background-size: cover;
        background-repeat: no-repeat;
        pointer-events: none;
        z-index: 0;
        opacity: var(--dswsk-opacity, 0);
        transition: opacity 0.3s ease;
      }
      body.dswsk-active {
        --dsw-alias-bg-base: color-mix(in srgb, var(--dswsk-base-color) var(--dswsk-base-opacity, 64%), transparent);
        --dsw-specific-sidebar-fill: color-mix(in srgb, var(--dswsk-sidebar-color) var(--dswsk-sidebar-opacity, 78%), transparent);
        background: transparent !important;
      }
      body.dswsk-active > #root {
        position: relative;
        z-index: 1;
        background: transparent !important;
      }
      body.dswsk-active #root > [class*="_frame"],
      body.dswsk-active #root [class*="centerCol"],
      body.dswsk-active #root [class*="detailsCol"] {
        background: transparent !important;
      }
      @media (prefers-reduced-motion: reduce) {
        .dswsk-background { transition: none; }
      }
      .dswsk-page { padding: 4px 20px 28px; max-width: 960px; display: flex; flex-direction: column; gap: 16px; }
      .dswsk-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
      .dswsk-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .dswsk-tabs { display: flex; gap: 4px; padding: 3px; border-radius: 10px; background: var(--dsw-alias-bg-layer-2); }
      .dswsk-tab { height: 32px; padding: 0 12px; border: 0; border-radius: 8px; background: transparent; color: var(--dsw-alias-label-secondary); cursor: pointer; font: inherit; font-size: 13px; }
      .dswsk-tab[aria-selected="true"] { background: var(--dsw-alias-bg-layer-3); color: var(--dsw-alias-label-primary); box-shadow: 0 1px 2px rgb(0 0 0 / 10%); }
      .dswsk-tab:focus-visible, .dswsk-card:focus-visible, .dswsk-link:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
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
      .dswsk-btn:disabled { cursor: not-allowed; opacity: 0.45; }
      .dswsk-btn-primary {
        background: var(--dsw-alias-brand-primary); border-color: transparent; color: #fff;
      }
      .dswsk-btn-primary:hover { opacity: 0.9; background: var(--dsw-alias-brand-primary); }
      .dswsk-status { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
      .dswsk-control { display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l2); border-radius: 8px; background: var(--dsw-alias-bg-layer-1); }
      .dswsk-control-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--dsw-alias-label-primary); font-size: 13px; line-height: 20px; }
      .dswsk-control-value { color: var(--dsw-alias-label-secondary); font-variant-numeric: tabular-nums; }
      .dswsk-range { width: 100%; height: 24px; margin: 0; accent-color: var(--dsw-alias-brand-primary); cursor: pointer; }
      .dswsk-range:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 2px; }
      .dswsk-link { color: var(--dsw-alias-brand-primary); font-size: 12px; line-height: 18px; text-decoration: none; }
      .dswsk-link:hover { text-decoration: underline; }
      .dswsk-footer-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; width: 100%; }
      .dswsk-modal { width: min(900px, calc(100vw - 48px)); }
      .dswsk-modal-content { max-height: min(78vh, 760px); overflow: auto; }
      .dswsk-modal-page { padding: 0; max-width: none; gap: 12px; }
    `;

    const rootStyle = () => document.documentElement.style;
    const backgroundEl = document.createElement("div");
    backgroundEl.className = "dswsk-background";
    (document.body || document.documentElement).appendChild(backgroundEl);
    function normalizeTransparency(value) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) return DEFAULT_TRANSPARENCY;
      return Math.min(MAX_TRANSPARENCY, Math.max(0, Math.round(parsed)));
    }
    function applySurfaceTransparency(value) {
      const transparency = normalizeTransparency(value);
      const sidebarTransparency = Math.max(0, transparency - 14);
      rootStyle().setProperty("--dswsk-base-opacity", (100 - transparency) + "%");
      rootStyle().setProperty("--dswsk-sidebar-opacity", (100 - sidebarTransparency) + "%");
    }
    function applyWallpaper(url) {
      if (!url) {
        rootStyle().setProperty("--dswsk-image", "none");
        rootStyle().setProperty("--dswsk-opacity", "0");
        backgroundEl.style.backgroundImage = "none";
        document.body && document.body.classList.remove("dswsk-active");
        return;
      }
      const bodyStyle = document.body ? getComputedStyle(document.body) : null;
      if (bodyStyle && !document.body.classList.contains("dswsk-active")) {
        rootStyle().setProperty("--dswsk-base-color", bodyStyle.getPropertyValue("--dsw-alias-bg-base").trim());
        rootStyle().setProperty("--dswsk-sidebar-color", bodyStyle.getPropertyValue("--dsw-specific-sidebar-fill").trim());
      }
      rootStyle().setProperty("--dswsk-image", 'url("' + url + '")');
      rootStyle().setProperty("--dswsk-opacity", "1");
      backgroundEl.style.backgroundImage = 'url("' + url + '")';
      document.body && document.body.classList.add("dswsk-active");
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
        const selectedId = wallpapers.some((w) => w.id === config.selectedId) ? config.selectedId : null;
        const surfaceTransparency = normalizeTransparency(config.surfaceTransparency);
        const next = Object.assign({}, DEFAULTS, config, {
          selectedId,
          draftId: selectedId,
          surfaceTransparency,
          draftTransparency: surfaceTransparency,
          wallpapers,
          loading: false,
          error: null
        });
        store.set(next);
        applySurfaceTransparency(surfaceTransparency);

        if (next.enabled && selectedId) {
          const selected = wallpapers.find((w) => w.id === selectedId);
          if (selected) applyWallpaper(selected.imageUrl);
        } else {
          applyWallpaper(null);
        }
      } catch (err) {
        store.set({ loading: false, error: String((err && err.message) || err) });
      }
    }

    function chooseWallpaper(w) {
      store.set({ draftId: w.id, error: null });
    }

    async function confirmWallpaper() {
      const current = store.get();
      const w = current.wallpapers.find((item) => item.id === current.draftId);
      const transparency = normalizeTransparency(current.draftTransparency);
      const wallpaperChanged = current.draftId !== current.selectedId;
      const transparencyChanged = transparency !== current.surfaceTransparency;
      if (!w || (!wallpaperChanged && !transparencyChanged)) return;
      const previous = current.wallpapers.find((item) => item.id === current.selectedId);
      store.set({ applying: true, error: null });
      applySurfaceTransparency(transparency);
      applyWallpaper(w.imageUrl);
      const cfg = { enabled: true, selectedId: w.id, surfaceTransparency: transparency };
      try {
        const result = await fetchJson(API + "/config", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(cfg)
        });
        if (!result || !result.ok) throw new Error(result && result.error ? result.error : "保存壁纸配置失败");
        store.set({
          applying: false,
          enabled: true,
          selectedId: w.id,
          draftId: w.id,
          surfaceTransparency: transparency,
          draftTransparency: transparency
        });
      } catch (err) {
        applySurfaceTransparency(current.surfaceTransparency);
        applyWallpaper(previous ? previous.imageUrl : null);
        store.set({ applying: false, error: String((err && err.message) || err) });
      }
    }

    function resetDraft() {
      const current = store.get();
      applySurfaceTransparency(current.surfaceTransparency);
      store.set({
        draftId: current.selectedId,
        draftTransparency: current.surfaceTransparency,
        error: null
      });
    }

    async function disableWallpaper() {
      const current = store.get();
      const previous = current.wallpapers.find((item) => item.id === current.selectedId);
      store.set({ applying: true, error: null });
      applyWallpaper(null);
      const cfg = { enabled: false, selectedId: null };
      try {
        const result = await fetchJson(API + "/config", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(cfg)
        });
        if (!result || !result.ok) throw new Error(result && result.error ? result.error : "关闭壁纸失败");
        store.set({ applying: false, enabled: false, selectedId: null, draftId: null, error: null });
      } catch (err) {
        if (previous) applyWallpaper(previous.imageUrl);
        store.set({ applying: false, error: String((err && err.message) || err) });
      }
    }

    /* ================= 壁纸选择器 UI ================= */
    function WallpaperPickerView({ compact = false } = {}) {
      const [snap, setSnap] = React.useState(store.get());
      React.useEffect(() => store.subscribe(setSnap), []);
      const [tab, setTab] = React.useState("installed");
      const wallpapers = tab === "workshop"
        ? snap.wallpapers.filter((w) => w.source === "workshop")
        : snap.wallpapers;
      const hasDraft = snap.draftId !== null && (
        snap.draftId !== snap.selectedId
        || snap.draftTransparency !== snap.surfaceTransparency
      );

      return h("div", { className: "dswsk-page" + (compact ? " dswsk-modal-page" : "") }, [
        h("div", { className: "dswsk-header", key: "header" }, [
          h("div", { className: compact ? "dswsk-subtitle" : "dswsk-title", key: "title" }, compact ? "选择要应用的静态壁纸" : "壁纸皮肤（静态图片）"),
          h("div", { className: "dswsk-actions", key: "actions" }, [
            tab === "workshop" ? h("a", {
              className: "dswsk-link",
              href: "https://steamcommunity.com/app/431960/workshop/",
              target: "_blank",
              rel: "noreferrer",
              key: "workshop-link"
            }, "打开 Wallpaper Engine 创意工坊") : null,
            h("button", {
              className: "dswsk-btn" + (snap.enabled ? "" : " dswsk-btn-primary"),
              disabled: snap.applying,
              onClick: () => (snap.enabled ? disableWallpaper() : load()),
              key: "wallpaper-toggle"
            }, snap.enabled ? "关闭壁纸" : "扫描本地库")
          ])
        ]),
        h("div", { className: "dswsk-tabs", role: "tablist", "aria-label": "壁纸来源", key: "tabs" }, [
          h("button", { className: "dswsk-tab", role: "tab", "aria-selected": tab === "installed", onClick: () => setTab("installed"), key: "installed" }, "本地库"),
          h("button", { className: "dswsk-tab", role: "tab", "aria-selected": tab === "workshop", onClick: () => setTab("workshop"), key: "workshop" }, "Wallpaper Engine")
        ]),
        compact ? null : h("div", { className: "dswsk-subtitle", key: "description" }, tab === "workshop"
          ? "这里显示 Wallpaper Engine 创意工坊已经同步到本机的壁纸；新的壁纸请先在 Wallpaper Engine 中订阅。"
          : "先选中预览，确认后才会应用到 DSH。壁纸会作为半透明背景层显示，不会遮住工作区。"),
        h("div", { className: "dswsk-control", key: "transparency" }, [
          h("div", { className: "dswsk-control-head", key: "head" }, [
            h("label", { htmlFor: "dswsk-transparency", key: "label" }, "界面底色透明度"),
            h("output", { className: "dswsk-control-value", htmlFor: "dswsk-transparency", key: "value" }, snap.draftTransparency + "%")
          ]),
          h("input", {
            id: "dswsk-transparency",
            className: "dswsk-range",
            type: "range",
            min: 0,
            max: MAX_TRANSPARENCY,
            step: 1,
            value: snap.draftTransparency,
            "aria-label": "界面底色透明度",
            onChange: (event) => {
              const value = normalizeTransparency(event.target.value);
              applySurfaceTransparency(value);
              store.set({ draftTransparency: value, error: null });
            },
            key: "range"
          })
        ]),
        h("div", { className: "dswsk-status", key: "status" }, [
          snap.enabled && snap.selectedId
            ? h("span", { className: "dswsk-ok", key: "enabled" }, "当前已启用壁纸")
            : h("span", { className: "dswsk-hint", key: "disabled" }, "当前未启用壁纸"),
          hasDraft ? h("span", { className: "dswsk-hint", key: "draft" }, "设置已调整，等待确认") : null,
          snap.applying ? h("span", { className: "dswsk-hint", key: "applying" }, "正在应用…") : null,
          snap.loading ? h("span", { className: "dswsk-hint", key: "loading" }, "正在扫描 Wallpaper Engine…") : null,
          snap.error ? h("span", { className: "dswsk-error", key: "error" }, snap.error) : null
        ]),
        h("div", { className: "dswsk-subtitle", key: "count" }, "共 " + wallpapers.length + " 张可用的静态壁纸"),
        wallpapers.length === 0 ? h("div", { className: "dswsk-hint", key: "empty" }, tab === "workshop"
          ? "还没有同步到本机的创意工坊壁纸，请先在 Wallpaper Engine 中订阅后再扫描。"
          : "没有找到可用的本地壁纸。") : null,
        h("div", { className: "dswsk-grid", key: "grid" }, wallpapers.map((w) =>
          h("div", {
            key: w.id,
            className: "dswsk-card" + (snap.draftId === w.id ? " dswsk-selected" : "") + (snap.selectedId === w.id ? " dswsk-current" : ""),
            role: "button",
            tabIndex: 0,
            "aria-label": w.title,
            onClick: () => chooseWallpaper(w),
            onKeyDown: (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                chooseWallpaper(w);
              }
            }
          }, [
            h("img", { className: "dswsk-thumb", src: w.previewUrl, alt: w.title, loading: "lazy", key: "preview" }),
            h("div", { className: "dswsk-meta", key: "meta" }, [
              h("div", { className: "dswsk-name", key: "name" }, w.title),
              h("div", { className: "dswsk-type", key: "type" }, (snap.selectedId === w.id ? "当前 · " : "") + w.type + " · " + w.source)
            ])
          ])
        ))
      ]);
    }

    function WallpaperApplyFooter() {
      const [snap, setSnap] = React.useState(store.get());
      React.useEffect(() => store.subscribe(setSnap), []);
      const hasDraft = snap.draftId !== null && (
        snap.draftId !== snap.selectedId
        || snap.draftTransparency !== snap.surfaceTransparency
      );
      return h("div", { className: "dswsk-footer-actions" }, [
        h("button", {
          className: "dswsk-btn",
          disabled: snap.applying || !hasDraft,
          onClick: resetDraft,
          key: "reset"
        }, "恢复当前选择"),
        h("button", {
          className: "dswsk-btn dswsk-btn-primary",
          disabled: snap.applying || !hasDraft,
          onClick: confirmWallpaper,
          key: "apply"
        }, snap.applying ? "正在应用…" : "应用壁纸")
      ]);
    }

    function ExtensionCard() {
      const [open, setOpen] = React.useState(false);
      React.useEffect(() => {
        const onOpen = (event) => {
          const packageName = event && event.detail && event.detail.packageName;
          if (packageName === PACKAGE_NAME) {
            resetDraft();
            setOpen(true);
          }
        };
        window.addEventListener(EXTENSION_OPEN_EVENT, onOpen);
        return () => window.removeEventListener(EXTENSION_OPEN_EVENT, onOpen);
      }, []);
      const close = () => {
        resetDraft();
        setOpen(false);
      };
      return h(Modal, {
          open,
          onClose: close,
          title: "壁纸皮肤",
          closeLabel: "关闭",
          description: "从本地库或 Wallpaper Engine 创意工坊缓存中选择，确认后应用为 DSH 背景皮肤。",
          className: "dswsk-modal",
          contentClassName: "dswsk-modal-content",
          footer: h(WallpaperApplyFooter)
        }, h(WallpaperPickerView, { compact: true }));
    }

    /* ================= Cordis 插件入口 ================= */
    function apply(ctx) {
      ctx.effect(() => ctx.slots.inject("extensions.external.overlay", () => ctx.slots.register(
        { name: "extensions.external.overlay", id: "extensions-wallpaperskin", order: 30 },
        ExtensionCard
      )), "dsh-extensions-wallpaperskin: external overlay");

      ctx.effect(() => () => {
        styleEl.remove();
        backgroundEl.remove();
        document.body && document.body.classList.remove("dswsk-active");
        for (const v of ["--dswsk-image", "--dswsk-opacity", "--dswsk-base-color", "--dswsk-sidebar-color", "--dswsk-base-opacity", "--dswsk-sidebar-opacity"]) {
          rootStyle().removeProperty(v);
        }
      }, "dsh-extensions-wallpaperskin: cleanup");

      load();
    }

    exports.name = name;
    exports.inject = inject;
    exports.apply = apply;
    return module.exports;
  }
});
