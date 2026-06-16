import { Button, Space, Typography, Tooltip, Upload, Avatar } from 'antd';
import {
  FileOutlined,
  ToolOutlined,
  UploadOutlined,
  LogoutOutlined,
  UserOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

interface TopToolbarProps {
  leftCollapsed: boolean;
  onToggleLeft: () => void;
  rightCollapsed: boolean;
  onToggleRight: () => void;
  status: string;
  onUpload?: (file: File) => void;
  username?: string;
  onLogout?: () => void;
}

export default function TopToolbar({
  leftCollapsed,
  onToggleLeft,
  rightCollapsed,
  onToggleRight,
  status,
  onUpload,
  username,
  onLogout,
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
        <Tooltip title={leftCollapsed ? 'Show models tree' : 'Hide models tree'}>
          <Button type="text" icon={<AppstoreOutlined />} onClick={onToggleLeft} style={{ color: leftCollapsed ? '#999' : '#1890ff' }} />
        </Tooltip>
        <ToolOutlined style={{ color: '#1890ff', fontSize: 18 }} />
        <Text strong style={{ color: '#fff', fontSize: 14 }}>CDEViewer — Standalone BIM Viewer</Text>
      </Space>
      <Space>
        {username && (
          <Space style={{ marginRight: 8, borderRight: '1px solid #303030', paddingRight: 12 }}>
            <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#722ed1' }} />
            <Text style={{ color: '#fff', fontSize: 13 }}>{username}</Text>
            <Tooltip title="Sign Out">
              <Button type="text" danger icon={<LogoutOutlined />} onClick={onLogout} style={{ padding: '0 4px' }} />
            </Tooltip>
          </Space>
        )}
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
