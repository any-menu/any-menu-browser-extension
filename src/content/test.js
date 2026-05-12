/**
 * AnyMenu Helper Main
 */
(() => {
  // 避免重复注入
  if (window.__AnyMenuHelperTestInjected) return;
  window.__AnyMenuHelperTestInjected = true;

  // example
  document.body.style.border = "5px solid red";
  console.log("[AnyMenu Test] Script injected.");
})();
