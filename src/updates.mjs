export function startUpdates({window, document, navigator, MutationObserver, MessageChannel}) {
  if (!('serviceWorker' in navigator)) return;
  const current = document.querySelector('meta[name="subs-build"]')?.content;
  let registration, checking = false, pending = false, reloading = false;

  function refresh() {
    if (!pending || reloading || document.visibilityState !== 'visible' || navigator.onLine === false) return;
    // Saving writes localStorage before the dialog closes. Never discard a draft.
    if (document.querySelector('dialog[open]') || document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')) return;
    reloading = true;
    window.location.reload();
  }
  function receive(version) {
    if (current && version && version !== current) pending = true;
    refresh();
  }
  function inspect() {
    const worker = navigator.serviceWorker.controller;
    if (!worker) return;
    const channel = new MessageChannel();
    const timeout = window.setTimeout(()=>channel.port1.close(), 3000);
    channel.port1.onmessage = event => {
      window.clearTimeout(timeout);
      channel.port1.close();
      receive(event.data?.version);
    };
    worker.postMessage({type:'SUBS_VERSION'}, [channel.port2]);
  }
  async function check() {
    refresh();
    if (checking || reloading || document.visibilityState !== 'visible' || navigator.onLine === false) return;
    checking = true;
    try {
      registration ||= await navigator.serviceWorker.register('/sw.js', {updateViaCache:'none'});
      await registration.update();
      inspect();
    }
    catch { /* Offline or an incomplete deploy: keep the working release. */ }
    finally { checking = false; }
  }

  navigator.serviceWorker.addEventListener('message', event => {
    if (event.data?.type !== 'SUBS_UPDATE') return;
    receive(event.data.version);
  });
  navigator.serviceWorker.addEventListener('controllerchange', inspect);
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  window.addEventListener('pageshow', check);
  window.addEventListener('online', check);
  document.addEventListener('focusout', ()=>window.setTimeout(refresh, 0));
  new MutationObserver(refresh).observe(document.body, {subtree:true,childList:true,attributes:true,attributeFilter:['open']});
  window.setInterval(check, 60000);
  check();
}
