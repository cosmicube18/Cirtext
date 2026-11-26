export const CENTER_VIEW_EVENT = 'cirtext:center-view';

export function requestCenterView(): void {
  window.dispatchEvent(new Event(CENTER_VIEW_EVENT));
}