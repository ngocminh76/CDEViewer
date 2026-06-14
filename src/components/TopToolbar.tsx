import { Button, Space, Typography, Tooltip, Upload } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FileOutlined,
  ToolOutlined,
  UploadOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface TopToolbarProps {
  rightCollapsed: boolean;
  onToggleRight: () => void;
  status: string;
  onUpload?: (file: File) => void;
}

export default function TopToolbar({
  rightCollapsed, onToggleRight, status, onUpload,
}: TopToolbarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        height: 48,
        borderBottom: '1px solid #303030',
        background: '#1a1a2e',
      }}
    >
      <Space style={{ paddingLeft: 8 }}>
        <ToolOutlined style={{ color: '#1890ff', fontSize: 18 }} />
        <Text strong style={{ color: '#fff', fontSize: 14 }}>CDEViewer — Standalone BIM Viewer</Text>
      </Space>
      <Space>
        <Upload accept=".ifc" showUploadList={false} beforeUpload={(file) => { onUpload?.(file); return false; }}>
          <Tooltip title="Load IFC file">
            <Button type="text" icon={<UploadOutlined />} style={{ color: '#fff' }}>Load IFC</Button>
          </Tooltip>
        </Upload>
        <Text type="secondary" style={{ fontSize: 12 }}>{status}</Text>
        <Tooltip title={rightCollapsed ? 'Show properties' : 'Hide properties'}>
          <Button type="text" icon={<FileOutlined />} onClick={onToggleRight} style={{ color: rightCollapsed ? '#999' : '#1890ff' }} />
        </Tooltip>
      </Space>
    </div>
  );
}
