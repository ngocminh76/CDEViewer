import { Descriptions, Collapse, Table, Tag, Empty, Typography } from 'antd';
import type { SelectionInfo } from '../engine.ts';

const { Text } = Typography;

interface RightPanelProps {
  selection: SelectionInfo | null;
}

export default function RightPanel({ selection }: RightPanelProps) {
  if (!selection) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Click element to see properties" style={{ padding: '40px 16px' }} />;
  }

  const { modelId, localId, attributes, propertySets } = selection;

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      <div style={{ marginBottom: 12 }}>
        <Tag color="blue">{modelId}</Tag>
        <Tag color="orange">#{localId}</Tag>
      </div>
      <Descriptions bordered size="small" column={1} style={{ marginBottom: 12 }}>
        {attributes.Name && <Descriptions.Item label="Name">{attributes.Name}</Descriptions.Item>}
        {(attributes.type !== undefined || attributes._category !== undefined) && (
          <Descriptions.Item label="Type">
            <Tag>{String(attributes.type ?? attributes._category ?? '')}</Tag>
          </Descriptions.Item>
        )}
        {attributes.GlobalId && <Descriptions.Item label="GlobalId"><Text copyable style={{ fontSize: 11 }}>{attributes.GlobalId}</Text></Descriptions.Item>}
        {attributes.Tag && <Descriptions.Item label="Tag">{attributes.Tag}</Descriptions.Item>}
      </Descriptions>
      {propertySets.length > 0 && (
        <Collapse
          size="small"
          defaultActiveKey={propertySets.map((_, i) => String(i))}
          items={propertySets.map((pset, i) => ({
            key: String(i),
            label: <span>{pset.name} <Tag style={{ marginLeft: 4 }}>{pset.properties.length}</Tag></span>,
            children: (
              <Table
                dataSource={pset.properties}
                columns={[
                  { title: 'Property', dataIndex: 'name', key: 'name', width: '40%' },
                  { title: 'Value', dataIndex: 'value', key: 'value' },
                ]}
                size="small"
                pagination={false}
                rowKey="name"
              />
            ),
          }))}
        />
      )}
    </div>
  );
}
