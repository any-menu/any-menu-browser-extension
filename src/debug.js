/**
 * 注入一个可拖拽的 Debug 面板，实时显示：
 * 
 * - 当前 URL
 * - 页面 metadata（title / author / created / description / canonical / og 等，尽可能提取）
 * - 当前选中内容（selection）
 * - 当前焦点元素信息（tag / id / class / name / role / aria-label / href 等）
 * - 鼠标悬停元素（可选，便于定位）
 * - 一组“打印按钮”：把当前收集到的对象更友好地打印到控制台（console.dir / console.table 等）
 * 
 * co-author GPT-5.2
 */

(() => {
  // 是否注入/启用
  {
    if (window.__AnyMenuHelperDebugMounted) return; // 避免重复注入

    if (typeof chrome !== 'undefined' && chrome.storage) { // 设置中是否启用
      chrome.storage.sync.get({ is_debug: false }, (res) => {
        if (res.is_debug) run();
      });
    } else { // 兼容非浏览器扩展环境（例如直接通过 <script> 引入测试）
      run();
    }

    window.__AnyMenuHelperDebugMounted = true;
  }

  // 启用
  function run() {
    // Exported API // 暂时不用
    // const API = {
    //   isMounted: () => !!window.__AnyMenuHelperDebugMounted,
    // };
    // window.AnyMenuHelperDebug = API;

    const state = {
      url: location.href,
      title: document.title,
      selectionText: "",
      selectionHtml: "",
      focusInfo: null,
      hoverInfo: null,
      meta: {},
      lastUpdatedAt: new Date().toISOString(),
    };

    // ---------- helpers ----------
    function $(sel, root = document) {
      return root.querySelector(sel);
    }

    function getMetaByNames(names) {
      for (const name of names) {
        const el =
          document.querySelector(`meta[name="${CSS.escape(name)}"]`) ||
          document.querySelector(`meta[property="${CSS.escape(name)}"]`) ||
          document.querySelector(`meta[itemprop="${CSS.escape(name)}"]`);
        if (el && el.content) return el.content;
      }
      return "";
    }

    function collectMetadata() {
      const canonical = $('link[rel="canonical"]')?.href || "";

      const author =
        getMetaByNames(["author", "article:author", "og:article:author"]) ||
        $('link[rel="author"]')?.href ||
        "";

      const created =
        getMetaByNames([
          "article:published_time",
          "published_time",
          "date",
          "pubdate",
          "og:published_time",
          "parsely-pub-date",
        ]) || "";

      const modified =
        getMetaByNames([
          "article:modified_time",
          "modified_time",
          "lastmod",
          "og:updated_time",
        ]) || "";

      const description =
        getMetaByNames(["description", "og:description", "twitter:description"]) || "";

      const ogTitle = getMetaByNames(["og:title", "twitter:title"]) || "";
      const ogType = getMetaByNames(["og:type"]) || "";
      const siteName = getMetaByNames(["og:site_name"]) || "";
      const keywords = getMetaByNames(["keywords"]) || "";

      const jsonLd = [];
      document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
        const text = (s.textContent || "").trim();
        if (!text) return;
        try {
          const data = JSON.parse(text);
          jsonLd.push(data);
        } catch {
          // ignore
        }
      });

      // Try to extract headline/author/date from JSON-LD
      let ldHeadline = "";
      let ldAuthor = "";
      let ldDatePublished = "";
      let ldDateModified = "";

      function scanLd(node) {
        if (!node) return;
        if (Array.isArray(node)) {
          node.forEach(scanLd);
          return;
        }
        if (typeof node !== "object") return;

        const headline = node.headline || node.name;
        const datePublished = node.datePublished;
        const dateModified = node.dateModified;

        if (!ldHeadline && typeof headline === "string") ldHeadline = headline;
        if (!ldDatePublished && typeof datePublished === "string") ldDatePublished = datePublished;
        if (!ldDateModified && typeof dateModified === "string") ldDateModified = dateModified;

        const author = node.author;
        if (!ldAuthor) {
          if (typeof author === "string") ldAuthor = author;
          else if (author && typeof author === "object") {
            if (typeof author.name === "string") ldAuthor = author.name;
            else if (Array.isArray(author)) {
              const a0 = author.find(
                (x) => x && typeof x === "object" && typeof x.name === "string"
              );
              if (a0) ldAuthor = a0.name;
            }
          }
        }

        for (const k of Object.keys(node)) scanLd(node[k]);
      }
      scanLd(jsonLd);

      state.meta = {
        title: document.title,
        url: location.href,
        canonical,
        description,
        keywords,
        author: author || ldAuthor,
        created: created || ldDatePublished,
        modified: modified || ldDateModified,
        ogTitle,
        ogType,
        siteName,
        jsonLdCount: jsonLd.length,
      };

      state.meta.__jsonLd = jsonLd;
      state.meta.__ldHeadline = ldHeadline;
    }

    function elementInfo(el) {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      const attrs = {};
      ["id", "class", "name", "role", "aria-label", "aria-labelledby", "href", "src", "alt", "title"].forEach(
        (k) => {
          const v = el.getAttribute?.(k);
          if (v) attrs[k] = v;
        }
      );

      return {
        tag: el.tagName,
        textPreview: (el.innerText || el.textContent || "").trim().slice(0, 120),
        attrs,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        },
      };
    }

    function collectSelection() {
      const sel = window.getSelection?.();
      if (!sel) return;

      state.selectionText = sel.toString() || "";
      state.selectionHtml = "";

      try {
        if (sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const div = document.createElement("div");
          div.appendChild(range.cloneContents());
          state.selectionHtml = div.innerHTML || "";
        }
      } catch {
        // ignore
      }
    }

    function collectFocus() {
      state.focusInfo = elementInfo(document.activeElement);
    }

    function updateUrl() {
      state.url = location.href;
      state.title = document.title;
    }

    function touchUpdatedAt() {
      state.lastUpdatedAt = new Date().toISOString();
    }

    
    // styleEl
    {
      const styleEl = document.createElement("style");
      styleEl.textContent = `
  #anymenu-helper-panel{
    position: fixed;
    top: 12px;
    right: 12px;
    width: 360px;
    max-height: 70vh;
    z-index: 2147483647;
    color: #e8e8e8;
    background: rgba(20, 20, 20, .92);
    border: 1px solid rgba(255,255,255,.15);
    border-radius: 10px;
    box-shadow: 0 8px 30px rgba(0,0,0,.35);
    font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    backdrop-filter: blur(6px);
  }
  #anymenu-helper-panel * { box-sizing: border-box; }
  #anymenu-helper-header{
    cursor: move;
    padding: 10px 10px 8px 10px;
    border-bottom: 1px solid rgba(255,255,255,.1);
    display:flex;
    align-items:center;
    justify-content: space-between;
    gap: 10px;
  }
  #anymenu-helper-title{
    font-weight: 700;
    font-size: 12px;
    white-space: nowrap;
  }
  #anymenu-helper-actions{
    display:flex; gap:6px; align-items:center;
  }
  .anymenu-btn{
    border: 1px solid rgba(255,255,255,.2);
    background: rgba(255,255,255,.08);
    color: #e8e8e8;
    padding: 3px 6px;
    border-radius: 6px;
    cursor:pointer;
  }
  .anymenu-btn:hover{ background: rgba(255,255,255,.14); }
  #anymenu-helper-body{
    padding: 10px;
    overflow: auto;
    max-height: calc(70vh - 44px);
  }
  .anymenu-section{ margin-bottom: 10px; }
  .anymenu-section h3{
    margin: 0 0 6px 0;
    font-size: 12px;
    color: #fff;
  }
  .anymenu-kv{
    display:grid;
    grid-template-columns: 84px 1fr;
    gap: 4px 8px;
  }
  .anymenu-kv .k{ color: #a9a9a9; }
  .anymenu-kv .v{
    color: #e8e8e8;
    word-break: break-word;
  }
  .anymenu-pre{
    margin: 0;
    padding: 6px;
    background: rgba(0,0,0,.35);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 8px;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .anymenu-row{ display:flex; gap:6px; flex-wrap: wrap; }
  .anymenu-muted{ color:#a9a9a9; }
      `;
      document.documentElement.appendChild(styleEl);
    }

    // 面板 - 总
    const root = document.createElement("div");
    root.id = "anymenu-helper-panel";
    root.innerHTML = `
      <div id="anymenu-helper-header">
        <div id="anymenu-helper-title">AnyMenu Helper · Debug Panel</div>
        <div id="anymenu-helper-actions">
          <button class="anymenu-btn" data-action="refresh">Refresh</button>
          <button class="anymenu-btn" data-action="toggleHover">Hover: On</button>
          <button class="anymenu-btn" data-action="hide">Hide</button>
        </div>
      </div>
      <div id="anymenu-helper-body"></div>
    `;
    document.documentElement.appendChild(root);

    const bodyEl = $("#anymenu-helper-body", root);
    const headerEl = $("#anymenu-helper-header", root);
    const toggleHoverBtn = root.querySelector('[data-action="toggleHover"]');

    let hoverEnabled = true;
    let hidden = false;

    // 面板 - 主体 (排除标题)
    function render() {
      // 避免html转义
      function escapeHtml(s) {
        return String(s ?? "")
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#039;");
      }

      // 定义如何文本形式显示对象
      function formatCompact(obj) {
        try {
          return JSON.stringify(obj, null, 2);
        } catch {
          return String(obj);
        }
      }

      const meta = state.meta || {};
      const focus = state.focusInfo || {};
      const hover = state.hoverInfo || {};
      const metaJsonLdInfo = `jsonLdCount=${meta.jsonLdCount || 0}`;

      bodyEl.innerHTML = `
        <div class="anymenu-section">
          <h3>Page</h3>
          <div class="anymenu-kv">
            <div class="k">url</div><div class="v">${escapeHtml(state.url)}</div>
            <div class="k">title</div><div class="v">${escapeHtml(state.title)}</div>
            <div class="k">updated</div><div class="v">${escapeHtml(state.lastUpdatedAt)}</div>
          </div>
          <div class="anymenu-row" style="margin-top:8px;">
            <button class="anymenu-btn" data-print="page">Print Page</button>
            <button class="anymenu-btn" data-print="meta">Print Meta</button>
            <button class="anymenu-btn" data-print="jsonld">Print JSON-LD</button>
          </div>
          <div class="anymenu-muted" style="margin-top:6px;">${escapeHtml(metaJsonLdInfo)}</div>
        </div>

        <div class="anymenu-section">
          <h3>Metadata (best effort)</h3>
          <div class="anymenu-kv">
            <div class="k">canonical</div><div class="v">${escapeHtml(meta.canonical || "")}</div>
            <div class="k">author</div><div class="v">${escapeHtml(meta.author || "")}</div>
            <div class="k">created</div><div class="v">${escapeHtml(meta.created || "")}</div>
            <div class="k">modified</div><div class="v">${escapeHtml(meta.modified || "")}</div>
            <div class="k">desc</div><div class="v">${escapeHtml(meta.description || "")}</div>
            <div class="k">keywords</div><div class="v">${escapeHtml(meta.keywords || "")}</div>
            <div class="k">og:title</div><div class="v">${escapeHtml(meta.ogTitle || "")}</div>
            <div class="k">og:type</div><div class="v">${escapeHtml(meta.ogType || "")}</div>
            <div class="k">site</div><div class="v">${escapeHtml(meta.siteName || "")}</div>
          </div>
        </div>

        <div class="anymenu-section">
          <h3>Selection</h3>
          <div class="anymenu-row">
            <button class="anymenu-btn" data-print="selection">Print Selection</button>
            <button class="anymenu-btn" data-action="copySelection">Copy Text</button>
          </div>
          <div style="margin-top:6px;">
            <div class="anymenu-muted">text</div>
            <pre class="anymenu-pre">${escapeHtml(state.selectionText || "")}</pre>
          </div>
        </div>

        <div class="anymenu-section">
          <h3>Focus Element</h3>
          <div class="anymenu-row">
            <button class="anymenu-btn" data-print="focus">Print Focus</button>
          </div>
          <pre class="anymenu-pre" style="margin-top:6px;">${escapeHtml(formatCompact(focus))}</pre>
        </div>

        <div class="anymenu-section">
          <h3>Hover Element</h3>
          <div class="anymenu-row">
            <button class="anymenu-btn" data-print="hover">Print Hover</button>
          </div>
          <pre class="anymenu-pre" style="margin-top:6px;">${escapeHtml(formatCompact(hover))}</pre>
        </div>
      `;
    }

    // 按钮
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      // 控制台中打印
      function printToConsole(type) {
        if (type === "page") {
          console.group("[AnyMenu Helper] Page");
          console.log("url:", state.url);
          console.log("title:", state.title);
          console.log("updatedAt:", state.lastUpdatedAt);
          console.groupEnd();
          return;
        }
        if (type === "meta") {
          console.group("[AnyMenu Helper] Meta");
          console.dir(state.meta);
          console.groupEnd();
          return;
        }
        if (type === "jsonld") {
          console.group("[AnyMenu Helper] JSON-LD");
          console.dir(state.meta?.__jsonLd || []);
          console.groupEnd();
          return;
        }
        if (type === "selection") {
          console.group("[AnyMenu Helper] Selection");
          console.log("text:", state.selectionText);
          console.log("html:", state.selectionHtml);
          console.groupEnd();
          return;
        }
        if (type === "focus") {
          console.group("[AnyMenu Helper] Focus");
          console.dir(state.focusInfo);
          console.groupEnd();
          return;
        }
        if (type === "hover") {
          console.group("[AnyMenu Helper] Hover");
          console.dir(state.hoverInfo);
          console.groupEnd();
          return;
        }
      }

      // 复制文本到剪贴板
      async function copyText(text) {
        try {
          await navigator.clipboard.writeText(text);
          console.log("[AnyMenu Helper] Copied selection text to clipboard");
        } catch (err) {
          console.warn("[AnyMenu Helper] Clipboard copy failed:", err);
        }
      }

      const action = btn.getAttribute("data-action");
      const printType = btn.getAttribute("data-print");

      if (printType) return void printToConsole(printType);

      if (action === "refresh") {
        updateAll();
        render();
        return;
      }
      if (action === "toggleHover") {
        hoverEnabled = !hoverEnabled;
        toggleHoverBtn.textContent = `Hover: ${hoverEnabled ? "On" : "Off"}`;
        return;
      }
      if (action === "hide") {
        hidden = !hidden;
        bodyEl.style.display = hidden ? "none" : "block";
        btn.textContent = hidden ? "Show" : "Hide";
        return;
      }
      if (action === "copySelection") {
        copyText(state.selectionText || "");
        return;
      }
    });

    // 追踪选区变化
    document.addEventListener(
      "selectionchange",
      () => {
        collectSelection();
        touchUpdatedAt();
        render();
      },
      true
    );

    // 追踪焦点变化
    window.addEventListener(
      "focusin",
      () => {
        collectFocus();
        touchUpdatedAt();
        render();
      },
      true
    );

    // 追踪悬停元素
    window.addEventListener(
      "mousemove",
      (e) => {
        if (!hoverEnabled) return;
        state.hoverInfo = elementInfo(e.target);
      },
      true
    );

    // 悬停更新的节流渲染定时器
    intervalId = window.setInterval(() => {
      if (!hoverEnabled) return;
      touchUpdatedAt();
      render();
    }, 200);

    // SPA 中的 URL 变化：通过 history 观察
    const _pushState = history.pushState;
    const _replaceState = history.replaceState;

    function onHistoryChange() {
      updateUrl();
      collectMetadata();
      touchUpdatedAt();
      render();
    }

    history.pushState = function (...args) {
      const ret = _pushState.apply(this, args);
      onHistoryChange();
      return ret;
    };
    history.replaceState = function (...args) {
      const ret = _replaceState.apply(this, args);
      onHistoryChange();
      return ret;
    };
    window.addEventListener("popstate", onHistoryChange);

    // 面板 - 标题，拖拽功能
    (() => {
      let dragging = false;
      let startX = 0,
        startY = 0;
      let startLeft = 0,
        startTop = 0;

      headerEl.addEventListener("mousedown", (e) => {
        dragging = true;
        const rect = root.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startLeft = rect.left;
        startTop = rect.top;

        root.style.right = "auto";
        root.style.left = `${startLeft}px`;
        root.style.top = `${startTop}px`;

        e.preventDefault();
      });

      window.addEventListener("mousemove", (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        root.style.left = `${startLeft + dx}px`;
        root.style.top = `${startTop + dy}px`;
      });

      window.addEventListener("mouseup", () => {
        dragging = false;
      });
    })();

    function updateAll() {
      updateUrl();
      collectMetadata();
      collectSelection();
      collectFocus();
      touchUpdatedAt();
    }

    // initial
    updateAll();
    render();

    console.log("[AnyMenu Helper] Debug panel mounted");
  }
})();
