import { useState, useEffect } from 'react';
import { Descriptions, Collapse, Table, Tag, Empty, Typography, Card, InputNumber, Button, Select, Radio, Alert } from 'antd';
import type { SelectionInfo } from '../engine.ts';
import { vn2000ToWgs84 } from '../utils/coordination.ts';
import { VN2000_PROVINCES } from '../utils/vn2000-provinces.ts';

const { Text } = Typography;

interface RightPanelProps {
  selection: SelectionInfo | null;
  mapboxEnabled: boolean;
  mapboxCenter: [number, number];
  mapboxElevation: number;
  mapboxHeading: number;
  rawX: number | null;
  rawY: number | null;
  rawZ: number | null;
  ktt: number;
  zone3deg: boolean;
  onUpdateParams: (params: {
    center?: [number, number];
    elevation?: number;
    heading?: number;
    ktt?: number;
    zone3deg?: boolean;
    rawX?: number | null;
    rawY?: number | null;
    rawZ?: number | null;
  }) => void;
}

export default function RightPanel({
  selection,
  mapboxEnabled,
  mapboxCenter,
  mapboxElevation,
  mapboxHeading,
  rawX,
  rawY,
  rawZ,
  ktt,
  zone3deg,
  onUpdateParams,
}: RightPanelProps) {
  const [lng, setLng] = useState(mapboxCenter[0]);
  const [lat, setLat] = useState(mapboxCenter[1]);
  const [elevation, setElevation] = useState(mapboxElevation);
  const [heading, setHeading] = useState(mapboxHeading);

  // Local KTT and Zone states to allow UI interaction before saving
  const [localKtt, setLocalKtt] = useState(ktt);
  const [localZone3deg, setLocalZone3deg] = useState(zone3deg);
  const [showCustomKtt, setShowCustomKtt] = useState(false);
  const [customKttVal, setCustomKttVal] = useState(ktt);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

  // Local VN-2000 raw coordinates states
  const [localRawX, setLocalRawX] = useState<number | null>(rawX);
  const [localRawY, setLocalRawY] = useState<number | null>(rawY);
  const [localRawZ, setLocalRawZ] = useState<number | null>(rawZ);

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

  useEffect(() => {
    setLocalKtt(ktt);
    // Auto-detect if KTT matches a province, otherwise show custom
    const matchedProvince = VN2000_PROVINCES.find(p => p.ktt === ktt);
    if (matchedProvince) {
      setSelectedProvince(matchedProvince.name);
      setShowCustomKtt(false);
    } else {
      setSelectedProvince('custom');
      setShowCustomKtt(true);
      setCustomKttVal(ktt);
    }
  }, [ktt]);

  useEffect(() => {
    setLocalZone3deg(zone3deg);
  }, [zone3deg]);

  useEffect(() => {
    setLocalRawX(rawX);
  }, [rawX]);

  useEffect(() => {
    setLocalRawY(rawY);
  }, [rawY]);

  useEffect(() => {
    setLocalRawZ(rawZ);
  }, [rawZ]);

  // Recalculate WGS84 center when KTT, Zone, or raw coordinates change locally
  useEffect(() => {
    if (localRawX !== null && localRawY !== null) {
      const activeKtt = showCustomKtt ? customKttVal : localKtt;
      const [newLng, newLat] = vn2000ToWgs84(localRawX, localRawY, activeKtt, localZone3deg);
      setLng(newLng);
      setLat(newLat);
      if (localRawZ !== null) {
        setElevation(localRawZ);
      }
    }
  }, [localKtt, localZone3deg, showCustomKtt, customKttVal, localRawX, localRawY, localRawZ]);

  const handleApply = () => {
    const activeKtt = showCustomKtt ? customKttVal : localKtt;
    onUpdateParams({
      center: [lng, lat],
      elevation,
      heading,
      ktt: activeKtt,
      zone3deg: localZone3deg,
      rawX: localRawX,
      rawY: localRawY,
      rawZ: localRawZ,
    });
  };

  const handleKttSelectChange = (val: string) => {
    setSelectedProvince(val);
    if (val === 'custom') {
      setShowCustomKtt(true);
    } else {
      setShowCustomKtt(false);
      const province = VN2000_PROVINCES.find(p => p.name === val);
      if (province) {
        setLocalKtt(province.ktt);
      }
    }
  };

  const renderGisCard = () => (
    <Card
      title="📍 Định vị GIS dự án (VN-2000)"
      size="small"
      style={{ marginBottom: 12, background: '#1f1f2e', borderColor: '#303050' }}
    >
      <div style={{ marginBottom: 12 }}>
        {rawX !== null ? (
          <Alert
            message="Đã nhận tọa độ VN-2000 từ mô hình"
            type="success"
            showIcon
            style={{ fontSize: 11, padding: '4px 8px', marginBottom: 8 }}
          />
        ) : (
          <Alert
            message="Không nhận được tọa độ từ mô hình. Bạn hãy nhập thủ công:"
            type="warning"
            showIcon
            style={{ fontSize: 11, padding: '4px 8px', marginBottom: 8 }}
          />
        )}
        
        {/* Raw VN-2000 fields */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 10, color: '#aaa', display: 'block', marginBottom: 2 }}>VN2000 X (m):</span>
            <InputNumber
              value={localRawX}
              onChange={(v) => setLocalRawX(v)}
              style={{ width: '100%' }}
              placeholder="Ví dụ: 552120"
              precision={3}
            />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 10, color: '#aaa', display: 'block', marginBottom: 2 }}>VN2000 Y (m):</span>
            <InputNumber
              value={localRawY}
              onChange={(v) => setLocalRawY(v)}
              style={{ width: '100%' }}
              placeholder="Ví dụ: 1098450"
              precision={3}
            />
          </div>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 10, color: '#aaa', display: 'block', marginBottom: 2 }}>VN2000 Z (m):</span>
            <InputNumber
              value={localRawZ}
              onChange={(v) => setLocalRawZ(v)}
              style={{ width: '100%' }}
              placeholder="Cao độ"
              precision={3}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <span style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 4 }}>Tỉnh/Thành phố (Tự động tra KTT):</span>
          <Select
            value={selectedProvince || 'custom'}
            onChange={handleKttSelectChange}
            showSearch
            style={{ width: '100%', marginBottom: showCustomKtt ? 6 : 0 }}
            options={[
              ...VN2000_PROVINCES.map(p => ({
                value: p.name,
                label: `${p.name} (KTT: ${p.ktt.toFixed(2)}°)`
              })),
              { value: 'custom', label: 'Khác (Nhập thủ công)...' }
            ]}
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
          />
          {showCustomKtt && (
            <InputNumber
              value={customKttVal}
              onChange={(v) => v !== null && setCustomKttVal(v)}
              style={{ width: '100%' }}
              step={0.1}
              precision={2}
              placeholder="Nhập KTT của dự án..."
            />
          )}
        </div>

        <div>
          <span style={{ fontSize: 12, color: '#aaa', display: 'block', marginBottom: 4 }}>Múi chiếu:</span>
          <Radio.Group
            value={localZone3deg}
            onChange={(e) => setLocalZone3deg(e.target.value)}
            style={{ width: '100%' }}
          >
            <Radio.Button value={true} style={{ width: '50%', textAlign: 'center', fontSize: 12 }}>3° (k=0.9999)</Radio.Button>
            <Radio.Button value={false} style={{ width: '50%', textAlign: 'center', fontSize: 12 }}>6° (k=0.9996)</Radio.Button>
          </Radio.Group>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid #303040', margin: '4px 0' }} />

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
          onClick={handleApply}
          style={{ width: '100%', marginTop: 4 }}
        >
          Cập nhật & Bay tới
        </Button>
      </div>
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
