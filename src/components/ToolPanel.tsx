import { Button, Space, Tooltip, Divider, Badge } from 'antd';
import {
  ScissorOutlined,
  PlusOutlined,
  DeleteOutlined,
  ClearOutlined,
  ArrowUpOutlined,
  BorderOutlined,
  ArrowRightOutlined,
  ArrowLeftOutlined,
  ArrowDownOutlined,
  BlockOutlined,
  SelectOutlined,
  GlobalOutlined,
  FileImageOutlined,
} from '@ant-design/icons';
import type { ToolMode } from '../engine.ts';

interface ToolPanelProps {
  toolMode: ToolMode;
  onToolMode: (mode: ToolMode) => void;
  clipCount: number;
  onCreateClip: () => void;
  onDeleteClip: () => void;
  onDeleteAllClips: () => void;
  onCameraView: (view: 'top' | 'front' | 'right' | 'left' | 'back' | 'perspective') => void;
  mapboxEnabled: boolean;
  onToggleMapbox: () => void;
  docOpen: boolean;
  onToggleDoc: () => void;
}

export default function ToolPanel({
  toolMode,
  onToolMode,
  clipCount,
  onCreateClip,
  onDeleteClip,
  onDeleteAllClips,
  onCameraView,
  mapboxEnabled,
  onToggleMapbox,
  docOpen,
  onToggleDoc,
}: ToolPanelProps) {
  return (
    <div
      className="cde-tool-dock"
      style={{
        position: 'absolute',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 40,
        height: 48,
      }}
    >
      {/* Mode Toggles */}
      <Space size={4}>
        <Tooltip title="Chế độ Chọn vật thể">
          <Button
            shape="circle"
            type={toolMode === 'select' ? 'primary' : 'text'}
            style={{ color: toolMode === 'select' ? '#fff' : '#cbd5e0' }}
            icon={<SelectOutlined style={{ fontSize: 16 }} />}
            onClick={() => onToolMode('select')}
          />
        </Tooltip>
        
        <Tooltip title="Mặt phẳng Cắt (Double-click để tạo nhanh)">
          <Badge count={clipCount} size="small" offset={[-2, 2]}>
            <Button
              shape="circle"
              type={toolMode === 'clip' ? 'primary' : 'text'}
              style={{ color: toolMode === 'clip' ? '#fff' : '#cbd5e0' }}
              icon={<ScissorOutlined style={{ fontSize: 16 }} />}
              onClick={() => onToolMode(toolMode === 'clip' ? 'select' : 'clip')}
            />
          </Badge>
        </Tooltip>

        <Tooltip title={mapboxEnabled ? "Chế độ Mô hình nội bộ (Local)" : "Chế độ Bản đồ Vệ tinh (Mapbox)"}>
          <Button
            shape="circle"
            type={mapboxEnabled ? 'primary' : 'text'}
            style={{ color: mapboxEnabled ? '#fff' : '#cbd5e0' }}
            icon={<GlobalOutlined style={{ fontSize: 16 }} />}
            onClick={onToggleMapbox}
          />
        </Tooltip>
        
        <Tooltip title="Mở Bản vẽ Kỹ thuật 2D">
          <Button
            shape="circle"
            type={docOpen ? 'primary' : 'text'}
            style={{ color: docOpen ? '#fff' : '#cbd5e0' }}
            icon={<FileImageOutlined style={{ fontSize: 16 }} />}
            onClick={onToggleDoc}
          />
        </Tooltip>
      </Space>

      {/* Conditional Divider for Clip Actions */}
      {toolMode === 'clip' && (
        <>
          <Divider type="vertical" style={{ borderColor: 'rgba(255, 255, 255, 0.15)', height: 20 }} />
          <Space size={4}>
            <Tooltip title="Tạo mặt cắt">
              <Button shape="circle" type="text" style={{ color: '#e2e8f0' }} icon={<PlusOutlined />} onClick={onCreateClip} />
            </Tooltip>
            <Tooltip title="Xóa mặt cắt tại con trỏ">
              <Button shape="circle" type="text" style={{ color: '#e2e8f0' }} icon={<DeleteOutlined />} onClick={onDeleteClip} />
            </Tooltip>
            <Tooltip title="Xóa tất cả mặt cắt">
              <Button shape="circle" type="text" danger icon={<ClearOutlined />} onClick={onDeleteAllClips} />
            </Tooltip>
          </Space>
        </>
      )}

      <Divider type="vertical" style={{ borderColor: 'rgba(255, 255, 255, 0.15)', height: 20 }} />

      {/* Camera Angle Views */}
      <Space size={4}>
        <Tooltip title="Nhìn từ Trên (Top)">
          <Button shape="circle" type="text" style={{ color: '#e2e8f0' }} icon={<ArrowUpOutlined />} onClick={() => onCameraView('top')} />
        </Tooltip>
        <Tooltip title="Nhìn từ Trước (Front)">
          <Button shape="circle" type="text" style={{ color: '#e2e8f0' }} icon={<BorderOutlined />} onClick={() => onCameraView('front')} />
        </Tooltip>
        <Tooltip title="Nhìn từ Phải (Right)">
          <Button shape="circle" type="text" style={{ color: '#e2e8f0' }} icon={<ArrowRightOutlined />} onClick={() => onCameraView('right')} />
        </Tooltip>
        <Tooltip title="Nhìn từ Trái (Left)">
          <Button shape="circle" type="text" style={{ color: '#e2e8f0' }} icon={<ArrowLeftOutlined />} onClick={() => onCameraView('left')} />
        </Tooltip>
        <Tooltip title="Nhìn từ Sau (Back)">
          <Button shape="circle" type="text" style={{ color: '#e2e8f0' }} icon={<ArrowDownOutlined />} onClick={() => onCameraView('back')} />
        </Tooltip>
        <Tooltip title="Phối cảnh (Perspective)">
          <Button shape="circle" type="text" style={{ color: '#cbd5e0' }} icon={<BlockOutlined />} onClick={() => onCameraView('perspective')} />
        </Tooltip>
      </Space>
    </div>
  );
}
