'use client';

import { useEffect } from 'react';

/**
 * Site-wide pointer effects, attached once with delegated listeners:
 * - .btn: a ripple grows from the exact press point.
 * - .spotlight: --mx/--my follow the pointer so the card's glow tracks it.
 */
export default function Interactions() {
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    const onDown = (e: PointerEvent) => {
      const btn = (e.target as Element).closest<HTMLElement>('.btn');
      if (!btn || reduce.matches || btn.matches(':disabled')) return;
      const r = btn.getBoundingClientRect();
      const dot = document.createElement('span');
      dot.className = 'ripple';
      dot.style.left = `${e.clientX - r.left}px`;
      dot.style.top = `${e.clientY - r.top}px`;
      btn.appendChild(dot);
      dot.addEventListener('animationend', () => dot.remove());
    };

    const onMove = (e: PointerEvent) => {
      const card = (e.target as Element).closest<HTMLElement>('.spotlight');
      if (!card) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    };

    document.addEventListener('pointerdown', onDown);
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('pointermove', onMove);
    };
  }, []);

  return null;
}
