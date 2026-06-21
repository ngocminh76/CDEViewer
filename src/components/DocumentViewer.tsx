import { useState, useRef, useEffect } from 'react';
import { Button, Tooltip, Select, Tag, Space, Divider } from 'antd';
import {
  ZoomInOutlined,
  ZoomOutOutlined,
  ExpandOutlined,
  CloseOutlined,
  FilePdfOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';

interface DocumentViewerProps {
  selectedNode: { title: string; category?: string; localId?: number } | null;
  onClose: () => void;
}

interface Sheet {
  id: string;
  name: string;
  code: string;
  type: 'plan' | 'elevation' | 'detail';
}

const SHEETS: Sheet[] = [
  { id: 'plan-1', name: 'Mặt bằng kết cấu Tầng 1 (L1)', code: 'A-101', type: 'plan' },
  { id: 'plan-2', name: 'Mặt bằng kết cấu Tầng 2 (L2)', code: 'A-102', type: 'plan' },
  { id: 'elev-a', name: 'Mặt đứng trục A-B', code: 'A-201', type: 'elevation' },
  { id: 'detail-col', name: 'Chi tiết cốt thép Cột điển hình', code: 'A-501', type: 'detail' },
];

export default function DocumentViewer({ selectedNode, onClose }: DocumentViewerProps) {
  const [selectedSheetId, setSelectedSheetId] = useState<string>('plan-1');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // TỰ ĐỘNG ĐỔI BẢN VẼ THEO ĐỐI TƯỢNG ĐANG CHỌN (SELECTION SYNC):
  // Mỗi khi người dùng bấm chọn cấu kiện mới (hoặc chọn tầng trên Model Tree),
  // component sẽ bắt sự kiện này để đổi trang bản vẽ tương ứng:
  // - Nếu chọn Tầng 2 hoặc IFC Storey 2 -> Chuyển sang Mặt bằng kết cấu Tầng 2.
  // - Nếu chọn các Tầng khác -> Chuyển sang Mặt bằng kết cấu Tầng 1.
  // - Nếu chọn Cột (IFCCOLUMN) hoặc click cột 3D -> Chuyển sang Bản vẽ chi tiết cốt thép Cột.
  useEffect(() => {
    if (selectedNode) {
      const nodeName = selectedNode.title.toLowerCase();
      if (nodeName.includes('storey') || nodeName.includes('tầng')) {
        if (nodeName.includes('2') || nodeName.includes('storey 2') || selectedNode.localId === 44) {
          setSelectedSheetId('plan-2');
        } else {
          setSelectedSheetId('plan-1');
        }
      } else if (selectedNode.category === 'IFCCOLUMN' || selectedNode.title.includes('Column')) {
        setSelectedSheetId('detail-col');
      }
    }
  }, [selectedNode]);

  const activeSheet = SHEETS.find((s) => s.id === selectedSheetId) || SHEETS[0];

  // Dragging / Panning handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Render vector SVG blueprint drawing content depending on selected sheet
  const renderSVGContent = () => {
    // Columns highlight state
    const isColumnsSelected = selectedNode?.category === 'IFCCOLUMN' || selectedNode?.title.includes('Column');
    const isBeamsSelected = selectedNode?.category === 'IFCBEAM' || selectedNode?.title.includes('Beam');

    if (activeSheet.type === 'plan') {
      const isLevel2 = activeSheet.id === 'plan-2';
      return (
        <svg width="600" height="500" viewBox="0 0 600 500" style={{ pointerEvents: 'none' }}>
          {/* Grid lines */}
          <line x1="50" y1="50" x2="550" y2="50" stroke="#4a5568" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="50" y1="180" x2="550" y2="180" stroke="#4a5568" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="50" y1="310" x2="550" y2="310" stroke="#4a5568" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="50" y1="440" x2="550" y2="440" stroke="#4a5568" strokeWidth="1" strokeDasharray="4 4" />

          <line x1="50" y1="50" x2="50" y2="440" stroke="#4a5568" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="216" y1="50" x2="216" y2="440" stroke="#4a5568" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="382" y1="50" x2="382" y2="440" stroke="#4a5568" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="550" y1="50" x2="550" y2="440" stroke="#4a5568" strokeWidth="1" strokeDasharray="4 4" />

          {/* Grid labels */}
          <circle cx="28" cy="50" r="12" fill="#1e2430" stroke="#4a5568" />
          <text x="28" y="53" fill="#a0aec0" fontSize="10" textAnchor="middle">1</text>
          <circle cx="28" cy="180" r="12" fill="#1e2430" stroke="#4a5568" />
          <text x="28" y="183" fill="#a0aec0" fontSize="10" textAnchor="middle">2</text>
          <circle cx="28" cy="310" r="12" fill="#1e2430" stroke="#4a5568" />
          <text x="28" y="313" fill="#a0aec0" fontSize="10" textAnchor="middle">3</text>
          <circle cx="28" cy="440" r="12" fill="#1e2430" stroke="#4a5568" />
          <text x="28" y="443" fill="#a0aec0" fontSize="10" textAnchor="middle">4</text>

          <circle cx="50" cy="465" r="12" fill="#1e2430" stroke="#4a5568" />
          <text x="50" y="468" fill="#a0aec0" fontSize="10" textAnchor="middle">A</text>
          <circle cx="216" cy="465" r="12" fill="#1e2430" stroke="#4a5568" />
          <text x="216" y="468" fill="#a0aec0" fontSize="10" textAnchor="middle">B</text>
          <circle cx="382" cy="465" r="12" fill="#1e2430" stroke="#4a5568" />
          <text x="382" y="468" fill="#a0aec0" fontSize="10" textAnchor="middle">C</text>
          <circle cx="550" cy="465" r="12" fill="#1e2430" stroke="#4a5568" />
          <text x="550" y="468" fill="#a0aec0" fontSize="10" textAnchor="middle">D</text>

          {/* Slabs / Outer Walls outline */}
          <rect x="50" y="50" width="500" height="390" fill="none" stroke="#2d3748" strokeWidth="3" />

          {/* Beams (Lines) */}
          <line x1="50" y1="50" x2="550" y2="50" stroke={isBeamsSelected ? '#fa8c16' : '#2b6cb0'} strokeWidth={isBeamsSelected ? 4 : 2} />
          <line x1="50" y1="180" x2="550" y2="180" stroke={isBeamsSelected ? '#fa8c16' : '#2b6cb0'} strokeWidth={isBeamsSelected ? 4 : 2} />
          <line x1="50" y1="310" x2="550" y2="310" stroke={isBeamsSelected ? '#fa8c16' : '#2b6cb0'} strokeWidth={isBeamsSelected ? 4 : 2} />
          <line x1="50" y1="440" x2="550" y2="440" stroke={isBeamsSelected ? '#fa8c16' : '#2b6cb0'} strokeWidth={isBeamsSelected ? 4 : 2} />

          {/* Columns (Circles/Squares at intersections) */}
          {[50, 216, 382, 550].map((x) =>
            [50, 180, 310, 440].map((y) => (
              <rect
                key={`col-${x}-${y}`}
                x={x - 8}
                y={y - 8}
                width="16"
                height="16"
                fill={isColumnsSelected ? '#1890ff' : '#4a5568'}
                stroke={isColumnsSelected ? '#00e5ff' : '#cbd5e0'}
                strokeWidth="1.5"
                filter={isColumnsSelected ? 'drop-shadow(0 0 6px #1890ff)' : 'none'}
              />
            ))
          )}

          {/* Staircase representation */}
          <g transform="translate(230, 200)">
            <rect width="120" height="90" fill="none" stroke="#4a5568" strokeWidth="1.5" />
            <line x1="60" y1="0" x2="60" y2="90" stroke="#4a5568" strokeWidth="1" />
            {Array.from({ length: 9 }).map((_, idx) => (
              <line key={`stair-${idx}`} x1="0" y1={10 * idx} x2="60" y2={10 * idx} stroke="#4a5568" strokeWidth="0.8" />
            ))}
            {Array.from({ length: 9 }).map((_, idx) => (
              <line key={`stair2-${idx}`} x1="60" y1={90 - 10 * idx} x2="120" y2={90 - 10 * idx} stroke="#4a5568" strokeWidth="0.8" />
            ))}
            <text x="60" y="50" fill="#718096" fontSize="8" textAnchor="middle">STAIRCASE</text>
          </g>

          {/* Room names */}
          <text x="130" y="115" fill="#a0aec0" fontSize="11" fontWeight="600" textAnchor="middle">OFFICE A</text>
          <text x="130" y="130" fill="#718096" fontSize="8" textAnchor="middle">S = 18.2 m²</text>

          <text x="460" y="115" fill="#a0aec0" fontSize="11" fontWeight="600" textAnchor="middle">LOBBY</text>
          <text x="460" y="130" fill="#718096" fontSize="8" textAnchor="middle">S = 22.5 m²</text>

          <text x="133" y="380" fill="#a0aec0" fontSize="11" fontWeight="600" textAnchor="middle">{isLevel2 ? 'MEETING ROOM' : 'RECEPTION'}</text>
          <text x="133" y="395" fill="#718096" fontSize="8" textAnchor="middle">S = 24.8 m²</text>

          <text x="460" y="380" fill="#a0aec0" fontSize="11" fontWeight="600" textAnchor="middle">CORRIDOR</text>

          {/* North arrow */}
          <g transform="translate(530, 90)">
            <circle r="16" fill="none" stroke="#718096" strokeWidth="1" />
            <polygon points="0,-14 -5,2 0,-2 5,2" fill="#fa8c16" />
            <polygon points="0,14 -5,2 0,-2 5,2" fill="#4a5568" />
            <text x="0" y="-19" fill="#fa8c16" fontSize="8" fontWeight="700" textAnchor="middle">N</text>
          </g>
        </svg>
      );
    }

    if (activeSheet.type === 'elevation') {
      return (
        <svg width="600" height="500" viewBox="0 0 600 500" style={{ pointerEvents: 'none' }}>
          {/* Ground Line */}
          <line x1="30" y1="400" x2="570" y2="400" stroke="#718096" strokeWidth="3" />
          <line x1="30" y1="405" x2="570" y2="405" stroke="#4a5568" strokeWidth="1" />

          {/* Structure grid lines */}
          <line x1="100" y1="100" x2="100" y2="400" stroke="#4a5568" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="300" y1="100" x2="300" y2="400" stroke="#4a5568" strokeWidth="1" strokeDasharray="3 3" />
          <line x1="500" y1="100" x2="500" y2="400" stroke="#4a5568" strokeWidth="1" strokeDasharray="3 3" />

          {/* Level indicators */}
          <line x1="80" y1="260" x2="520" y2="260" stroke="#4a5568" strokeWidth="1" strokeDasharray="4 4" />
          <line x1="80" y1="120" x2="520" y2="120" stroke="#4a5568" strokeWidth="1" strokeDasharray="4 4" />

          {/* Level labels */}
          <text x="530" y="404" fill="#a0aec0" fontSize="9">▼ GL ±0.00</text>
          <text x="530" y="264" fill="#a0aec0" fontSize="9">▼ LEVEL 1 +3.60</text>
          <text x="530" y="124" fill="#a0aec0" fontSize="9">▼ LEVEL 2 +7.20</text>

          {/* Building profile outlines */}
          <rect x="100" y="120" width="400" height="280" fill="none" stroke="#2d3748" strokeWidth="3" />
          <polygon points="100,120 300,50 500,120" fill="none" stroke="#2d3748" strokeWidth="3" />

          {/* Windows / Doors */}
          {/* Level 1 doors */}
          <rect x="260" y="300" width="80" height="100" fill="none" stroke="#4a5568" strokeWidth="1.5" />
          <line x1="300" y1="300" x2="300" y2="400" stroke="#4a5568" strokeWidth="1.5" />

          {/* Windows L1 */}
          <rect x="140" y="320" width="60" height="50" fill="none" stroke="#4a5568" strokeWidth="1.5" />
          <rect x="400" y="320" width="60" height="50" fill="none" stroke="#4a5568" strokeWidth="1.5" />

          {/* Windows L2 */}
          <rect x="140" y="180" width="60" height="50" fill="none" stroke="#4a5568" strokeWidth="1.5" />
          <rect x="270" y="180" width="60" height="50" fill="none" stroke="#4a5568" strokeWidth="1.5" />
          <rect x="400" y="180" width="60" height="50" fill="none" stroke="#4a5568" strokeWidth="1.5" />

          {/* Roof details */}
          <line x1="300" y1="50" x2="300" y2="120" stroke="#4a5568" strokeWidth="1" strokeDasharray="3 3" />

          <text x="300" y="440" fill="#718096" fontSize="10" textAnchor="middle">AXIS A-B ELEVATION</text>
        </svg>
      );
    }

    if (activeSheet.type === 'detail') {
      return (
        <svg width="600" height="500" viewBox="0 0 600 500" style={{ pointerEvents: 'none' }}>
          {/* Column Profile cross section */}
          <rect x="150" y="100" width="300" height="300" fill="none" stroke="#2d3748" strokeWidth="4" />
          <rect x="162" y="112" width="276" height="276" fill="none" stroke="#4a5568" strokeWidth="2.5" /> {/* Stirrup */}

          {/* Concrete Hatch */}
          <path d="M152,102 L172,112 M448,102 L428,112 M152,398 L172,388 M448,398 L428,388" stroke="#4a5568" strokeWidth="1" />

          {/* Main rebars (corner and mid circles) */}
          {[162, 300, 438].map((x) =>
            [162, 300, 438].map((y) => (
              <circle
                key={`rebar-${x}-${y}`}
                cx={x}
                cy={y}
                r="10"
                fill="#fa8c16"
                stroke="#d87a00"
                strokeWidth="1"
                filter="drop-shadow(0 0 4px rgba(250, 140, 22, 0.4))"
              />
            ))
          )}

          {/* Stirrup Hooks details */}
          <path d="M162,112 L178,135 M162,112 L185,123" stroke="#4a5568" strokeWidth="2" strokeLinecap="round" />

          {/* Rebar labels / dimensions */}
          <line x1="280" y1="80" x2="300" y2="152" stroke="#fa8c16" strokeWidth="1" />
          <circle cx="280" cy="80" r="3" fill="#fa8c16" />
          <text x="270" y="83" fill="#fa8c16" fontSize="10" fontWeight="600" textAnchor="end">8x DB25 MAIN REBARS</text>

          <line x1="438" y1="230" x2="470" y2="230" stroke="#718096" strokeWidth="1" />
          <line x1="438" y1="112" x2="470" y2="112" stroke="#718096" strokeWidth="1" />
          <path d="M465,112 L465,230" stroke="#718096" strokeWidth="1" />
          <polygon points="465,112 462,118 468,118" fill="#718096" />
          <polygon points="465,230 462,224 468,224" fill="#718096" />
          <text x="475" y="176" fill="#a0aec0" fontSize="9" textAnchor="start">s = 150 mm</text>

          {/* Dimensions */}
          <line x1="150" y1="415" x2="450" y2="415" stroke="#a0aec0" strokeWidth="1" />
          <polygon points="150,415 156,412 156,418" fill="#a0aec0" />
          <polygon points="450,415 444,412 444,418" fill="#a0aec0" />
          <text x="300" y="430" fill="#e2e8f0" fontSize="11" fontWeight="600" textAnchor="middle">B = 600 mm</text>

          <line x1="125" y1="100" x2="125" y2="400" stroke="#a0aec0" strokeWidth="1" />
          <polygon points="125,100 122,106 128,106" fill="#a0aec0" />
          <polygon points="125,400 122,394 128,394" fill="#a0aec0" />
          <text x="110" y="253" fill="#e2e8f0" fontSize="11" fontWeight="600" textAnchor="middle" transform="rotate(-90 110 253)">H = 600 mm</text>

          <text x="300" y="465" fill="#718096" fontSize="10" textAnchor="middle">COLUMN SECTION (600x600)</text>
        </svg>
      );
    }
  };

  return (
    <div className="svg-blueprint-container">
      {/* Top Header Controls */}
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(20, 24, 30, 0.4)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Space size={8}>
          <FilePdfOutlined style={{ fontSize: 16, color: '#fa8c16' }} />
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 13 }}>Bản vẽ kỹ thuật</span>
          <Tag color="orange" style={{ margin: 0, fontSize: 10 }}>2D CDE</Tag>
        </Space>

        <Space size={4}>
          <Select
            size="small"
            value={selectedSheetId}
            onChange={setSelectedSheetId}
            style={{ width: 220 }}
            options={SHEETS.map((s) => ({ value: s.id, label: `${s.code} - ${s.name}` }))}
            dropdownStyle={{ background: '#1e2430', border: '1px solid #303030' }}
          />
          <Tooltip title="Zoom In">
            <Button size="small" icon={<ZoomInOutlined />} onClick={() => setZoom((z) => Math.min(z + 0.2, 3))} />
          </Tooltip>
          <Tooltip title="Zoom Out">
            <Button size="small" icon={<ZoomOutOutlined />} onClick={() => setZoom((z) => Math.max(z - 0.2, 0.5))} />
          </Tooltip>
          <Tooltip title="Reset View">
            <Button size="small" icon={<ExpandOutlined />} onClick={handleReset} />
          </Tooltip>
          <Divider type="vertical" style={{ borderColor: 'rgba(255,255,255,0.1)', height: 16, margin: '0 4px' }} />
          <Button size="small" type="text" icon={<CloseOutlined style={{ color: '#a0aec0' }} />} onClick={onClose} />
        </Space>
      </div>

      {/* SVG Canvas Viewport */}
      <div
        ref={containerRef}
        className="svg-blueprint-content"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* Transform container */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
            pointerEvents: 'none',
          }}
        >
          {renderSVGContent()}
        </div>

        {/* Floating Zoom Label */}
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            background: 'rgba(0, 0, 0, 0.6)',
            padding: '2px 8px',
            borderRadius: 4,
            fontSize: 10,
            color: '#a0aec0',
          }}
        >
          Tỷ lệ: {Math.round(zoom * 100)}%
        </div>

        {/* Sync Status Banner */}
        {selectedNode && (
          <div
            style={{
              position: 'absolute',
              top: 12,
              right: 12,
              background: 'rgba(24, 144, 255, 0.15)',
              border: '1px solid rgba(24, 144, 255, 0.3)',
              padding: '4px 8px',
              borderRadius: 6,
              fontSize: 10,
              color: '#00e5ff',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <InfoCircleOutlined />
            <span>Đồng bộ: {selectedNode.title}</span>
          </div>
        )}
      </div>

      {/* Blueprint Title Block (Bottom-Right corner) */}
      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          width: 180,
          background: 'rgba(15, 18, 22, 0.9)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          padding: '8px 10px',
          fontFamily: 'monospace',
          fontSize: 9,
          color: '#a0aec0',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 4, marginBottom: 4, fontWeight: 'bold', color: '#fff' }}>
          PROJECT: SF3D SENDAI
        </div>
        <div>MÃ: {activeSheet.code}</div>
        <div>BẢN VẼ: {activeSheet.name.split(' (')[0]}</div>
        <div>TRẠNG THÁI: APPROVED</div>
      </div>
    </div>
  );
}
