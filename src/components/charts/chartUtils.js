import { useEffect, useRef, useState } from 'react';

/** Rounds an axis range out to friendly tick values (0, 500K, 1M ...). Always includes zero. */
export function niceScale(minValue, maxValue, targetTicks = 4) {
  let lo = Math.min(0, minValue);
  let hi = Math.max(0, maxValue);
  if (hi === lo) hi = lo + 1;
  const rough = (hi - lo) / targetTicks;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / pow;
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * pow;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return { min: lo, max: hi, ticks };
}

export function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Tracks an element's pixel width so SVG charts can draw 1:1 (text never gets
 * scaled up or down). Returns [ref, width]; width is 0 until first measured.
 */
export function useContainerWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}
