# ianhogers.dev

## Embedding a game or project in an iframe

The site draws its own cursor (`static/cursor.js`). A cross-origin iframe swallows pointer events, so the cursor freezes at the frame's edge unless the embedded page posts its pointer position back. Any game or project you add to `src/lib/data/games.ts` (or frame anywhere else) must include this snippet, verbatim, in its own source:

```js
if (window.self !== window.top) {
  const st = document.createElement("style");
  st.textContent = "*, *::before, *::after { cursor: none !important; }";
  document.head.appendChild(st);
  const post = (kind, e) => {
    const t = e && e.target instanceof Element ? e.target : null;
    top.postMessage({
      type: "pixel-cursor", kind,
      x: e ? e.clientX : 0, y: e ? e.clientY : 0,
      clickable: !!(t && t.closest("a, button, [role=button], input, select, textarea, label")),
      draggable: !!(t && t.closest("[draggable=true]")),
    }, "*");
  };
  document.addEventListener("mousemove", e => post("move", e), { passive: true });
  document.addEventListener("mousedown", e => post("down", e), { passive: true });
  document.addEventListener("mouseup",   e => post("up", e),   { passive: true });
  document.addEventListener("mouseleave", () => post("leave"));
}
```

Reference implementation: https://github.com/SaintPepsi/clank-lit/pull/2. The host side is the `message` listener in `static/cursor.js`. Frames without the snippet still work; the cursor just hides over them.
