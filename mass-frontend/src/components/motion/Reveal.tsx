'use client';

import { useEffect, useRef, type ElementType, type ComponentPropsWithoutRef } from 'react';

type Props<T extends ElementType> = { as?: T; self?: boolean } & ComponentPropsWithoutRef<T>;

/**
 * Fades children up as they scroll into view. Stagger by giving children style={{'--i': n}}.
 * `self` animates the element itself instead of its children.
 */
export default function Reveal<T extends ElementType = 'div'>({ as, self, ...rest }: Props<T>) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.setAttribute('data-in', '');
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -6% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Tag = (as || 'div') as ElementType;
  return <Tag ref={ref} {...(self ? { 'data-reveal-self': '' } : { 'data-reveal': '' })} {...rest} />;
}
