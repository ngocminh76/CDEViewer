import { useRef, useEffect } from 'react';

interface ViewportProps {
  onMount?: (container3D: HTMLDivElement, containerMapBox: HTMLDivElement) => void;
  mapboxEnabled: boolean;
}

export default function Viewport({ onMount, mapboxEnabled }: ViewportProps) {
  const container3D = useRef<HTMLDivElement>(null);
  const containerMapBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (container3D.current && containerMapBox.current && onMount) {
      onMount(container3D.current, containerMapBox.current);
    }
  }, [onMount]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        ref={container3D}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          display: mapboxEnabled ? 'none' : 'block',
        }}
      />
      <div
        ref={containerMapBox}
        style={{
          width: '100%',
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          display: mapboxEnabled ? 'block' : 'none',
        }}
      />
    </div>
  );
}

