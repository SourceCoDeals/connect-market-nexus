export const openMailto = (mailtoLink: string) => {
  try {
    // Prefer a programmatic anchor click to avoid popup blockers/iframe issues
    const a = document.createElement('a');
    a.href = mailtoLink;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch {
    try {
      // Fallback
      window.location.href = mailtoLink;
    } catch (e) {
      console.error('Failed to open mail client', e);
    }
  }
};
