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
}: ToolPanelProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 10,
        background: 'rgba(30, 30, 50, 0.92)',
        borderRadius: 8,
        padding: '8px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        border: '1px solid #303050',
        backdropFilter: 'blur(8px)',
      }}
    >
      {/* Tool mode */}
      <Space size={4}>
        <Tooltip title="Select mode" placement="right">
          <Button
            size="small"
            type={toolMode === 'select' ? 'primary' : 'default'}
            icon={<SelectOutlined />}
            onClick={() => onToolMode('select')}
          />
        </Tooltip>
        <Tooltip title="Clip mode (double-click to create)" placement="right">
          <Badge count={clipCount} size="small" offset={[-4, 0]}>
            <Button
              size="small"
              type={toolMode === 'clip' ? 'primary' : 'default'}
              icon={<ScissorOutlined />}
              onClick={() => onToolMode(toolMode === 'clip' ? 'select' : 'clip')}
            />
          </Badge>
        </Tooltip>
        <Tooltip title={mapboxEnabled ? "Switch to Local View" : "Switch to Mapbox View"} placement="right">
          <Button
            size="small"
            type={mapboxEnabled ? 'primary' : 'default'}
            icon={<GlobalOutlined />}
            onClick={onToggleMapbox}
          />
        </Tooltip>
      </Space>

      {/* Clip actions */}
      {toolMode === 'clip' && (
        <>
          <Divider style={{ margin: '4px 0', borderColor: '#444' }} />
          <Space size={4}>
            <Tooltip title="Create clip plane" placement="right">
              <Button size="small" icon={<PlusOutlined />} onClick={onCreateClip} />
            </Tooltip>
            <Tooltip title="Delete clip under cursor" placement="right">
              <Button size="small" icon={<DeleteOutlined />} onClick={onDeleteClip} />
            </Tooltip>
            <Tooltip title="Delete all clips" placement="right">
              <Button size="small" danger icon={<ClearOutlined />} onClick={onDeleteAllClips} />
            </Tooltip>
          </Space>
        </>
      )}

      <Divider style={{ margin: '4px 0', borderColor: '#444' }} />

      {/* Camera views */}
      <Space size={4} wrap style={{ maxWidth: 70 }}>
        <Tooltip title="Top" placement="right">
          <Button size="small" icon={<ArrowUpOutlined />} onClick={() => onCameraView('top')} />
        </Tooltip>
        <Tooltip title="Front" placement="right">
          <Button size="small" icon={<BorderOutlined />} onClick={() => onCameraView('front')} />
        </Tooltip>
        <Tooltip title="Right" placement="right">
          <Button size="small" icon={<ArrowRightOutlined />} onClick={() => onCameraView('right')} />
        </Tooltip>
        <Tooltip title="Left" placement="right">
          <Button size="small" icon={<ArrowLeftOutlined />} onClick={() => onCameraView('left')} />
        </Tooltip>
        <Tooltip title="Back" placement="right">
          <Button size="small" icon={<ArrowDownOutlined />} onClick={() => onCameraView('back')} />
        </Tooltip>
        <Tooltip title="Perspective" placement="right">
          <Button size="small" icon={<BlockOutlined />} onClick={() => onCameraView('perspective')} />
        </Tooltip>
      </Space>
    </div>
  );
}
