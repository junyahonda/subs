const KEY = 'subs.navigation.v1';
const overview = () => ({tab:'overview',modal:null});
const depth = view => Number(view.tab !== 'overview') + Number(!!view.modal);
const validView = view => view && ['overview','subscriptions','reminders'].includes(view.tab) &&
  (view.modal === null || view.modal && ['form','settings'].includes(view.modal.type) &&
    (view.modal.id === undefined || typeof view.modal.id === 'string'));

// Keep an Overview entry underneath tabs and a tab entry underneath each sheet.
// Only navigation IDs go in history, never subscription details or form drafts.
export function createNavigation(history, onChange) {
  const saved = history.state?.[KEY];
  const session = typeof saved?.session === 'string' ? saved.session : crypto.randomUUID();
  let view = validView(saved?.view) ? saved.view : overview();
  let pending = null;
  const state = next => ({...history.state,[KEY]:{session,view:next}});
  history.replaceState(state(view),'');
  onChange(view);

  function navigate(next) {
    if (pending) { pending=next; return; }
    if (JSON.stringify(next) === JSON.stringify(view)) return;
    const difference = depth(next) - depth(view);
    if (difference < 0) {
      // Let popstate finish the close; do not leave a phantom sheet entry behind.
      pending=next;
      history.go(difference);
      return;
    }
    history[difference > 0 ? 'pushState' : 'replaceState'](state(next),'');
    view=next;
    onChange(view);
  }

  return {
    setTab: tab => navigate({tab,modal:null}),
    setModal: modal => navigate({tab:view.tab,modal}),
    onPop(nextState) {
      const entry=nextState?.[KEY];
      view=entry?.session === session && validView(entry.view) ? entry.view : overview();
      onChange(view);
      const target=pending;
      pending=null;
      if (target) navigate(target);
    }
  };
}
