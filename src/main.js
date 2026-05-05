(() => {
  // Avoid injecting twice
  if (window.__AnyMenuHelperMainInjected) return;
  window.__AnyMenuHelperMainInjected = true;

  if (!window.AnyMenuHelperDebug?.mount) {
    console.warn("[AnyMenu Helper] debug.js not loaded; cannot mount debug panel.");
    return;
  }

  window.AnyMenuHelperDebug.mount();
})();

// example
document.body.style.border = "5px solid red";
