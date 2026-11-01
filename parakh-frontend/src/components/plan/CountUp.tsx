'use client';

import { useEffect, useRef, useState } from 'react';

/** "₹12,568/mo" → counts the first number up from 0 when it scrolls into view, keeping the text around it. */
export default function CountUp({ value, className }: { value: string; className?: string }) {
  const match = value.match(/\d[\d,]*(\.\d+)?/);
  const target = match ? parseFloat(match[0].replace(/,/g, '')) : 0;
  const decimals = match?.[1] ? match[1].length - 1 : 0;
  const [shown, setShown] = useState(match ? 0 : target);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!match || !el) return;
    let raf = 0;
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setShown(target);
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / 1100);
        setShown(target * (1 - Math.pow(1 - t, 4)));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [target, match?.[0]]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!match) return <span className={className}>{value}</span>;
  const locale = value.includes('₹') ? 'en-IN' : 'en-US';
  const num = shown.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return (
    <span ref={ref} className={`tabular-nums ${className ?? ''}`}>
      {value.slice(0, match.index)}
      {num}
      {value.slice((match.index ?? 0) + match[0].length)}
    </span>
  );
}
