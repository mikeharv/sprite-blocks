// Tablet detection, so the editor can give the block workspace more of a smaller screen.

/**
 * True on a tablet: an iPad (iPadOS reports itself as a Mac, but with touch points), an Android tablet, or any
 * touch-first screen at least 600 pixels on its short side. Desktops with touch screens keep a fine pointer.
 */
export function isTablet(): boolean {
  const ua = navigator.userAgent;
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return true;
  if (/Android/.test(ua) && !/Mobile/.test(ua)) return true;
  return matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) >= 600;
}

/** True on a touch-first device (a phone or tablet), where the game needs on-screen controls. */
export function hasTouch(): boolean {
  return navigator.maxTouchPoints > 0 && (matchMedia('(pointer: coarse)').matches || isTablet());
}
