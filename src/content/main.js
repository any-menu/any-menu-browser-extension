/**
 * AnyMenu Helper Main
 */
(() => {
  // 避免重复注入
  if (window.__AnyMenuHelperMainInjected) return;
  window.__AnyMenuHelperMainInjected = true;

  // example
  document.body.style.border = "5px solid red";
  console.log("[AnyMenu Main] Script injected.");
})();
