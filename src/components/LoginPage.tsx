import { useState } from 'react';
import { Card, Form, Input, Button, Typography, Space, message } from 'antd';
import { UserOutlined, LockOutlined, ToolOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface LoginPageProps {
  onLoginSuccess: (username: string) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [loading, setLoading] = useState(false);

  const onFinish = (values: any) => {
    setLoading(true);
    // Simulate API delay
    setTimeout(() => {
      setLoading(false);
      const { username, password } = values;
      // Accept the user's specific credentials or admin/admin fallback
      if (
        (username === 'minhbimtech@gmail.com' && password === 'minbeogao211222@') ||
        (username === 'admin' && password === 'admin')
      ) {
        message.success('Login successful!');
        onLoginSuccess(username);
      } else {
        message.error('Invalid credentials!');
      }
    }, 800);
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: 'radial-gradient(circle at 10% 20%, rgb(26, 20, 48) 0%, rgb(15, 15, 26) 90.1%)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Decorative blurred background shapes */}
      <div
        style={{
          position: 'absolute',
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'rgba(24, 144, 255, 0.15)',
          filter: 'blur(80px)',
          top: '20%',
          left: '20%',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'rgba(114, 46, 209, 0.15)',
          filter: 'blur(100px)',
          bottom: '20%',
          right: '20%',
        }}
      />

      <Card
        style={{
          width: 380,
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
          backdropFilter: 'blur(16px)',
          borderRadius: 12,
        }}
        bodyStyle={{ padding: '32px 24px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Space align="center" style={{ marginBottom: 12 }}>
            <ToolOutlined style={{ color: '#1890ff', fontSize: 32 }} />
            <Title level={3} style={{ margin: 0, color: '#fff', fontWeight: 700 }}>
              CDEViewer
            </Title>
          </Space>
          <div>
            <Text type="secondary" style={{ fontSize: 13, color: '#8c8c8c' }}>
              Common Data Environment BIM Viewer
            </Text>
          </div>
        </div>

        <Form name="login_form" layout="vertical" onFinish={onFinish} requiredMark={false}>
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Please input your Username!' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: 'rgba(255,255,255,0.45)' }} />}
              placeholder="Username or Email"
              style={{
                background: 'rgba(255,255,255,0.05)',
                borderColor: 'rgba(255,255,255,0.1)',
                color: '#fff',
                height: 40,
              }}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your Password!' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.45)' }} />}
              placeholder="Password"
              style={{
                background: 'rgba(255,255,255,0.05)',
                borderColor: 'rgba(255,255,255,0.1)',
                color: '#fff',
                height: 40,
              }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              style={{
                width: '100%',
                height: 40,
                fontSize: 14,
                fontWeight: 600,
                background: 'linear-gradient(135deg, #1890ff 0%, #722ed1 100%)',
                border: 'none',
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)',
              }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
