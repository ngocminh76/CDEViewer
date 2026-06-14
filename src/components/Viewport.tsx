import { useRef, useEffect } from 'react';

interface ViewportProps {
  onMount?: (el: HTMLDivElement) => void;
}

export default function Viewport({ onMount }: ViewportProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current && onMount) {
      onMount(ref.current);
    }
  }, [onMount]);

  return (
    <div
      ref={ref}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    />
  );
}
