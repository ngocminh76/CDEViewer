import { Typography, Space } from 'antd';
import { CheckCircleOutlined, DatabaseOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface BottomBarProps {
  status: string;
  modelCount: number;
}

export default function BottomBar({ status, modelCount }: BottomBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        height: 28,
        borderTop: '1px solid #303030',
        background: '#1a1a2e',
        fontSize: 11,
      }}
    >
      <Space size={6}>
        <CheckCircleOutlined style={{ color: '#52c41a' }} />
        <Text type="secondary" style={{ fontSize: 11 }}>{status}</Text>
      </Space>
      <Space size={6}>
        <DatabaseOutlined style={{ color: '#1890ff' }} />
        <Text type="secondary" style={{ fontSize: 11 }}>Models: {modelCount}</Text>
      </Space>
    </div>
  );
}
