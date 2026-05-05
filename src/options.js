// 恢复保存的设置
document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get({
    is_debug: false, // 默认 false
    is_bridge: true  // 默认 true
  }, (items) => {
    document.getElementById('is_debug').checked = items.is_debug;
    document.getElementById('is_bridge').checked = items.is_bridge;
  });
});

// 监听更改并自动保存
document.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
  checkbox.addEventListener('change', () => {
    const is_debug = document.getElementById('is_debug').checked;
    const is_bridge = document.getElementById('is_bridge').checked;

    chrome.storage.sync.set({
      is_debug: is_debug,
      is_bridge: is_bridge
    }, () => {
      const status = document.getElementById('status');
      status.textContent = '设置已保存，刷新页面生效。';
      setTimeout(() => { status.textContent = ''; }, 2000);
    });
  });
});
