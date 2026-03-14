// XPath element picker — injected into the inspected page
(function () {
  if (window.__crawlerPicker) return;
  window.__crawlerPicker = true;

  const highlight = document.createElement('div');
  highlight.style.cssText = 'position:fixed;pointer-events:none;background:rgba(99,155,255,0.2);outline:2px solid rgba(99,155,255,0.9);border-radius:2px;box-sizing:border-box;z-index:2147483646;display:none;';
  document.documentElement.appendChild(highlight);

  const tooltip = document.createElement('div');
  tooltip.style.cssText = 'position:fixed;pointer-events:none;background:#1c1c24;color:#639bff;font:11px/1.4 monospace;padding:3px 8px;border-radius:4px;border:1px solid rgba(99,155,255,0.3);z-index:2147483647;display:none;max-width:420px;word-break:break-all;';
  document.documentElement.appendChild(tooltip);

  function getXPath(node) {
    if (node.nodeType !== 1) return '';
    if (node.id) return '//' + node.tagName.toLowerCase() + '[@id="' + node.id + '"]';
    if (node === document.body) return '/html/body';
    const parent = node.parentNode;
    if (!parent) return '';
    const siblings = Array.from(parent.children).filter(function(c) { return c.tagName === node.tagName; });
    const idx = siblings.indexOf(node) + 1;
    const part = node.tagName.toLowerCase() + (siblings.length > 1 ? '[' + idx + ']' : '');
    return getXPath(parent) + '/' + part;
  }

  function cleanup() {
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKey, true);
    highlight.remove();
    tooltip.remove();
    window.__crawlerPicker = false;
  }

  function onMouseMove(e) {
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === highlight || el === tooltip) return;
    var r = el.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.left = r.left + 'px';
    highlight.style.top = r.top + 'px';
    highlight.style.width = r.width + 'px';
    highlight.style.height = r.height + 'px';
    var xpath = getXPath(el);
    tooltip.textContent = xpath;
    tooltip.style.display = 'block';
    var tx = Math.min(e.clientX + 12, window.innerWidth - tooltip.offsetWidth - 8);
    var ty = (e.clientY + 20 + tooltip.offsetHeight > window.innerHeight) ? (e.clientY - tooltip.offsetHeight - 8) : (e.clientY + 20);
    tooltip.style.left = tx + 'px';
    tooltip.style.top = ty + 'px';
  }

  function onClick(e) {
    e.preventDefault();
    e.stopPropagation();
    var el = document.elementFromPoint(e.clientX, e.clientY);
    var xpath = el ? getXPath(el) : '';
    cleanup();
    chrome.runtime.sendMessage({ type: 'pickedXPath', xpath: xpath });
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      cleanup();
      chrome.runtime.sendMessage({ type: 'pickedXPath', xpath: null });
    }
  }

  document.addEventListener('mousemove', onMouseMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
}());
