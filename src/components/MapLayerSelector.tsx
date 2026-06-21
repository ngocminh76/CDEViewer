import { useState } from 'react';
import { GlobalOutlined } from '@ant-design/icons';

interface MapLayerSelectorProps {
  currentStyle: string;
  onStyleChange: (styleUrl: string) => void;
}

interface MapLayerOption {
  name: string;
  url: string;
  gradient: string;
  gridColor: string;
}

const LAYER_OPTIONS: MapLayerOption[] = [
  {
    name: 'Mặc định',
    url: 'mapbox://styles/mapbox/streets-v12',
    gradient: 'linear-gradient(135deg, #4f4f4f 0%, #a8a8a8 100%)',
    gridColor: 'rgba(255, 255, 255, 0.15)',
  },
  {
    name: 'Vệ tinh',
    url: 'mapbox://styles/mapbox/satellite-streets-v12',
    gradient: 'linear-gradient(135deg, #122c4f 0%, #0a4f5c 100%)',
    gridColor: 'rgba(0, 255, 255, 0.2)',
  },
  {
    name: 'Địa hình',
    url: 'mapbox://styles/mapbox/outdoors-v12',
    gradient: 'linear-gradient(135deg, #1e3f20 0%, #7d8f4e 100%)',
    gridColor: 'rgba(255, 255, 255, 0.1)',
  },
  {
    name: 'Bản đồ tối',
    url: 'mapbox://styles/mapbox/dark-v11',
    gradient: 'linear-gradient(135deg, #111317 0%, #20252b 100%)',
    gridColor: 'rgba(24, 144, 255, 0.25)',
  },
];

export default function MapLayerSelector({ currentStyle, onStyleChange }: MapLayerSelectorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const activeOption = LAYER_OPTIONS.find((opt) => opt.url === currentStyle) || LAYER_OPTIONS[0];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 20,
        left: 20,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
      }}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Expanded options */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          background: 'rgba(15, 18, 22, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 12,
          padding: 6,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
          opacity: isExpanded ? 1 : 0,
          transform: isExpanded ? 'translateX(0)' : 'translateX(-20px)',
          pointerEvents: isExpanded ? 'auto' : 'none',
          transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
          overflow: 'hidden',
          maxWidth: isExpanded ? '500px' : '0px',
        }}
      >
        {LAYER_OPTIONS.map((opt) => {
          const isActive = opt.url === currentStyle;
          return (
            <button
              key={opt.url}
              onClick={() => onStyleChange(opt.url)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                textAlign: 'center',
                outline: 'none',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 8,
                  background: opt.gradient,
                  border: isActive ? '2px solid #1890ff' : '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: isActive ? '0 0 10px rgba(24, 144, 255, 0.4)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  transition: 'all 0.2s',
                }}
              >
                {/* Visual street grid pattern simulation */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundImage: `linear-gradient(${opt.gridColor} 1px, transparent 1px), linear-gradient(90deg, ${opt.gridColor} 1px, transparent 1px)`,
                    backgroundSize: '14px 14px',
                  }}
                />

                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: '#1890ff',
                      boxShadow: '0 0 6px #1890ff',
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: isActive ? '#1890ff' : '#cbd5e0',
                  fontWeight: isActive ? 600 : 500,
                  marginTop: 4,
                  width: 56,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {opt.name}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Trigger (collapsed view showing active style) */}
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 12,
          background: activeOption.gradient,
          border: '2px solid rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `linear-gradient(${activeOption.gridColor} 1px, transparent 1px), linear-gradient(90deg, ${activeOption.gridColor} 1px, transparent 1px)`,
            backgroundSize: '16px 16px',
            opacity: 0.7,
          }}
        />
        <GlobalOutlined style={{ fontSize: 18, color: '#fff', zIndex: 1, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }} />
        <span
          style={{
            fontSize: 9,
            color: '#fff',
            fontWeight: 600,
            marginTop: 2,
            zIndex: 1,
            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
          }}
        >
          {activeOption.name}
        </span>
      </div>
    </div>
  );
}
