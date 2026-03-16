window.addEventListener('message', (event) => {
  const { id, value, transform } = event.data;
  if (typeof id !== 'string' || typeof transform !== 'string') return;
  let result;
  try {
    // eslint-disable-next-line no-new-func
    result = { id, ok: true, result: String(new Function('value', `return (${transform})`)(value)) };
  } catch (e) {
    result = { id, ok: false, error: e.message };
  }
  event.source.postMessage(result, event.origin || '*');
});
