export function hasBlockingLayer() {
  return Boolean(
    document.querySelector(
      '[role="dialog"]:not(.km-guide-content), [role="alertdialog"], [role="menu"][data-state="open"]',
    ),
  );
}
