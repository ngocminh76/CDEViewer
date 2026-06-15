import { useState, useEffect } from 'react';
import { Descriptions, Collapse, Table, Tag, Empty, Typography, Card, InputNumber, Button } from 'antd';
import type { SelectionInfo } from '../engine.ts';

const { Text } = Typography;

interface RightPanelProps {
  selection: SelectionInfo | null;
  mapboxEnabled: boolean;
  mapboxCenter: [number, number];
  mapboxElevation: number;
  mapboxHeading: number;
  onUpdateCenter: (center: [number, number], elevation: number, heading: number) => void;
}

export default function RightPanel({
  selection,
  mapboxEnabled,
  mapboxCenter,
  mapboxElevation,
  mapboxHeading,
  onUpdateCenter,
}: RightPanelProps) {
  const [lng, setLng] = useState(mapboxCenter[0]);
  const [lat, setLat] = useState(mapboxCenter[1]);
  const [elevation, setElevation] = useState(mapboxElevation);
  const [heading, setHeading] = useState(mapboxHeading);

  useEffect(() => {
    setLng(mapboxCenter[0]);
    setLat(mapboxCenter[1]);
  }, [mapboxCenter]);

  useEffect(() => {
    setElevation(mapboxElevation);
  }, [mapboxElevation]);

  useEffect(() => {
    setHeading(mapboxHeading);
  }, [mapboxHeading]);

  const renderGisCard = () => (
    <Card
      title="📍 Định vị GIS dự án"
      size="small"
      style={{ marginBottom: 12, background: '#1f1f2e', borderColor: '#303050' }}
    >
      <Descriptions column={1} size="small" style={{ marginBottom: 8 }}>
        <Descriptions.Item label="Kinh độ (Lng)">
          <InputNumber
            value={lng}
            onChange={(v) => v !== null && setLng(v)}
            style={{ width: '100%' }}
            step={0.000001}
            precision={7}
          />
        </Descriptions.Item>
        <Descriptions.Item label="Vĩ độ (Lat)">
          <InputNumber
            value={lat}
            onChange={(v) => v !== null && setLat(v)}
            style={{ width: '100%' }}
            step={0.000001}
            precision={7}
          />
        </Descriptions.Item>
        <Descriptions.Item label="Cao độ (m)">
          <InputNumber
            value={elevation}
            onChange={(v) => v !== null && setElevation(v)}
            style={{ width: '100%' }}
            step={0.1}
            precision={2}
          />
        </Descriptions.Item>
        <Descriptions.Item label="Góc xoay (°)">
          <InputNumber
            value={heading}
            onChange={(v) => v !== null && setHeading(v)}
            style={{ width: '100%' }}
            step={1}
            min={-180}
            max={180}
            precision={1}
          />
        </Descriptions.Item>
      </Descriptions>
      <Button
        type="primary"
        onClick={() => onUpdateCenter([lng, lat], elevation, heading)}
        style={{ width: '100%' }}
      >
        Cập nhật & Bay tới
      </Button>
    </Card>
  );

  if (!selection) {
    if (mapboxEnabled) {
      return (
        <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
          {renderGisCard()}
        </div>
      );
    }
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Click element to see properties" style={{ padding: '40px 16px' }} />;
  }

  const { modelId, localId, attributes, propertySets } = selection;

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%' }}>
      {mapboxEnabled && renderGisCard()}

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
