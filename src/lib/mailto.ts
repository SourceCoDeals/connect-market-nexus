export const openMailto = (mailtoLink: string) => {
  // Try multiple strategies to maximize success inside iframes/sandboxes
  try {
    // 1) Invisible anchor click (preferred)
    const a = document.createElement('a');
    a.href = mailtoLink;
    a.rel = 'noreferrer noopener';
    a.target = '_self';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (_) {
    // ignore
  }

  // 2) Direct navigation
  try {
    window.location.href = mailtoLink;
    return;
  } catch (_) {}

  // 3) Attempt top-level navigation (escape preview iframe)
  try {
    if (window.top && window.top !== window) {
      (window.top as Window).location.href = mailtoLink;
      return;
    }
  } catch (_) {}

  // 4) Hidden iframe fallback
  try {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = mailtoLink;
    document.body.appendChild(iframe);
    setTimeout(() => {
      try { document.body.removeChild(iframe); } catch {}
    }, 2000);
  } catch (e) {
    // Last-resort: log a warning for diagnostics
    console.warn('All mailto fallbacks failed', e);
  }
};