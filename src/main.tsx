import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import BimLayout from './components/BimLayout.tsx';
import 'mapbox-gl/dist/mapbox-gl.css';


const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <BimLayout />
  );
}
