import { useState, useEffect } from 'react';
import { Descriptions, Table, Tag, Empty, Typography, Card, Tabs, Slider, InputNumber, Button, Select, Radio, Alert } from 'antd';
import type { SelectionInfo, PropertySet } from '../engine.ts';
import { vn2000ToWgs84 } from '../utils/coordination.ts';
import { VN2000_PROVINCES } from '../utils/vn2000-provinces.ts';


const { Text } = Typography;

interface RightPanelProps {
  selection: SelectionInfo | null;
  mapboxEnabled: boolean;
  mapboxCenter: [number, number];
  mapboxElevation: number;
  mapboxHeading: number;
  mapboxPitch: number;
  mapboxBearing: number;
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
  onUpdatePitch: (pitch: number) => void;
  onUpdateBearing: (bearing: number) => void;
}

export default function RightPanel({
  selection,
  mapboxEnabled,
  mapboxCenter,
  mapboxElevation,
  mapboxHeading,
  mapboxPitch,
  mapboxBearing,
  rawX,
  rawY,
  rawZ,
  ktt,
  zone3deg,
  onUpdateParams,
  onUpdatePitch,
  onUpdateBearing,
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
    
    // Check if the current selected province or custom value already matches the incoming ktt.
    // If it does, do not auto-detect again to prevent resetting the user's choice.
    if (selectedProvince === 'custom' && showCustomKtt && Math.abs(customKttVal - ktt) < 0.001) {
      return;
    }
    if (selectedProvince && selectedProvince !== 'custom') {
      const currentProvince = VN2000_PROVINCES.find(p => p.name === selectedProvince);
      if (currentProvince && Math.abs(currentProvince.ktt - ktt) < 0.001) {
        return;
      }
    }

    const propLat = mapboxCenter[1];

    // Auto-detect if KTT matches a province, prioritizing closest latitude to prevent North-South mismatch
    const matchingProvinces = VN2000_PROVINCES.filter(p => Math.abs(p.ktt - ktt) < 0.01);
    if (matchingProvinces.length > 0) {
      const provinceLatitudes: Record<string, number> = {
        // Múi 103.00
        'Lai Châu': 22.3,
        'Điện Biên': 21.4,
        // Múi 104.00
        'Sơn La': 21.2,
        // Múi 104.75
        'Lào Cai': 22.4,
        'Yên Bái': 21.7,
        'Phú Thọ': 21.3,
        'Nghệ An': 19.3,
        'An Giang': 10.5,
        // Múi 105.00
        'Vĩnh Phúc': 21.3,
        'Hà Nội': 21.0,
        'Hà Nam': 20.5,
        'Ninh Bình': 20.2,
        'Thanh Hóa': 20.0,
        'Đồng Tháp': 10.5,
        'Cần Thơ': 10.0,
        'Hậu Giang': 9.8,
        'Bạc Liêu': 9.3,
        // Múi 105.50
        'Hà Giang': 22.8,
        'Sóc Trăng': 9.6,
        'Trà Vinh': 9.7,
        'Vĩnh Long': 10.2,
        'Bắc Ninh': 21.1,
        'Hải Dương': 20.9,
        'Hưng Yên': 20.8,
        'Nam Định': 20.4,
        'Thái Bình': 20.4,
        'Hà Tĩnh': 18.3,
        'Tây Ninh': 11.3,
        // Múi 105.75
        'Bình Dương': 11.0,
        'Long An': 10.7,
        'Tiền Giang': 10.4,
        'Bến Tre': 10.2,
        'Hồ Chí Minh': 10.8,
        // Múi 106.00
        'Tuyên Quang': 21.8,
        'Hòa Bình': 20.7,
        'Quảng Bình': 17.5,
        // Múi 106.25
        'Quảng Trị': 16.7,
        'Bình Phước': 11.7,
        // Múi 106.50
        'Bắc Kạn': 22.3,
        'Thái Nguyên': 21.6,
        // Múi 107.00
        'Bắc Giang': 21.3,
        'Thừa Thiên Huế': 16.3,
        // Múi 107.75
        'Quảng Ninh': 21.0,
        'Đà Nẵng': 16.0,
        'Quảng Nam': 15.7,
        'Lâm Đồng': 11.8,
        'Đồng Nai': 11.0,
        'Bà Rịa – Vũng Tàu': 10.5,
        // Múi 108.25
        'Bình Định': 14.1,
        'Khánh Hòa': 12.3,
        'Ninh Thuận': 11.7,
        // Múi 108.50
        'Gia Lai': 13.8,
        'Đắk Lắk': 12.7,
        'Đắk Nông': 12.1,
        'Phú Yên': 13.1,
        'Bình Thuận': 11.1
      };
      
      let bestMatch = matchingProvinces[0];
      let minLatDiff = Math.abs((provinceLatitudes[bestMatch.name] || 16.0) - propLat);
      for (const p of matchingProvinces) {
        const pLat = provinceLatitudes[p.name] || 16.0;
        const diff = Math.abs(pLat - propLat);
        if (diff < minLatDiff) {
          minLatDiff = diff;
          bestMatch = p;
        }
      }
      setSelectedProvince(bestMatch.name);
      setShowCustomKtt(false);
    } else {
      setSelectedProvince('custom');
      setShowCustomKtt(true);
      setCustomKttVal(ktt);
    }
  }, [ktt, mapboxCenter]);

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
      const [newLng, newLat] = vn2000ToWgs84(localRawX, localRawY, activeKtt, localZone3deg, localRawZ || 0);
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

  const handleHeadingChange = (val: number) => {
    setHeading(val);
    onUpdateParams({ heading: val });
  };

  const handleElevationChange = (val: number) => {
    setElevation(val);
    onUpdateParams({ elevation: val });
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
              step={0.01}
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
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <InputNumber
                value={elevation}
                onChange={(v) => v !== null && handleElevationChange(v)}
                style={{ width: '100%', marginBottom: 4 }}
                step={0.5}
                precision={2}
              />
              <Slider
                min={-50}
                max={200}
                value={elevation}
                onChange={handleElevationChange}
                tooltip={{ formatter: (v) => `${v}m` }}
              />
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="Góc xoay (°)">
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
              <InputNumber
                value={heading}
                onChange={(v) => v !== null && handleHeadingChange(v)}
                style={{ width: '100%', marginBottom: 4 }}
                step={1}
                min={-180}
                max={180}
                precision={1}
              />
              <Slider
                min={-180}
                max={180}
                value={heading}
                onChange={handleHeadingChange}
                tooltip={{ formatter: (v) => `${v}°` }}
              />
            </div>
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

  const renderMapCameraCard = () => (
    <Card
      title="🎥 Điều khiển Camera Bản đồ"
      size="small"
      style={{ marginBottom: 12, background: '#1f1f2e', borderColor: '#303050' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Pitch (Góc nghiêng) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 11, color: '#aaa' }}>Góc nghiêng camera (Pitch):</span>
            <span style={{ fontSize: 11, color: '#1890ff', fontWeight: 'bold' }}>{Math.round(mapboxPitch)}°</span>
          </div>
          <Slider
            min={0}
            max={85}
            value={mapboxPitch}
            onChange={(v) => onUpdatePitch(v)}
            tooltip={{ formatter: (v) => `${v}°` }}
          />
        </div>

        {/* Bearing (Hướng xoay) */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
            <span style={{ fontSize: 11, color: '#aaa' }}>Hướng xoay bản đồ (Bearing):</span>
            <span style={{ fontSize: 11, color: '#1890ff', fontWeight: 'bold' }}>{Math.round(mapboxBearing)}°</span>
          </div>
          <Slider
            min={0}
            max={360}
            value={mapboxBearing}
            onChange={(v) => onUpdateBearing(v)}
            tooltip={{ formatter: (v) => `${v}°` }}
          />
        </div>
      </div>
    </Card>
  );


  if (!selection) {
    if (mapboxEnabled) {
      return (
        <div style={{ padding: 12, overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {renderGisCard()}
          {renderMapCameraCard()}
        </div>
      );
    }
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Click element to see properties" style={{ padding: '40px 16px' }} />;
  }

  const { modelId, localId, attributes, propertySets } = selection;

  // Lọc các nhóm thuộc tính cho các tab tương ứng (giống BIMVision)
  const locationPsets = propertySets.filter(p => p.name.includes('Location') || p.name.includes('📍'));
  const classificationPsets = propertySets.filter(p => p.name.includes('Classification') || p.name.includes('🏷️'));

  // Relations: gồm Type (🔧), Material (🧱) và các nhóm liên quan đến ObjectType của cấu kiện
  const relationPsets = propertySets.filter(p =>
    p.name.includes('Type') ||
    p.name.includes('🔧') ||
    p.name.includes('Material') ||
    p.name.includes('🧱') ||
    (attributes.ObjectType && p.name.includes(attributes.ObjectType))
  );

  // Properties: tất cả các nhóm còn lại
  const mainPropertiesPsets = propertySets.filter(p =>
    !locationPsets.includes(p) &&
    !classificationPsets.includes(p) &&
    !relationPsets.includes(p)
  );

  // Sắp xếp các nhóm trong Properties tab theo thứ tự bảng chữ cái A-Z (Element Specific luôn ở đầu)
  const sortedPropertiesPsets = [...mainPropertiesPsets].sort((a, b) => {
    if (a.name === 'Element Specific') return -1;
    if (b.name === 'Element Specific') return 1;

    // Loại bỏ các icon/ký tự đặc biệt ở đầu khi so sánh tên
    const nameA = a.name.replace(/^[📋📐🧱🏷️📍🔧👥]\s*/, '');
    const nameB = b.name.replace(/^[📋📐🧱🏷️📍🔧👥]\s*/, '');
    const cleanA = nameA.replace(/^[^\w\sÀ-ỹ]/g, '').trim();
    const cleanB = nameB.replace(/^[^\w\sÀ-ỹ]/g, '').trim();
    return cleanA.localeCompare(cleanB, 'vi', { sensitivity: 'base' });
  });

  const propertyColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: '50%',
      render: (text: string, record: any) => {
        const isGroup = record.children !== undefined;
        return (
          <span style={{
            color: isGroup ? '#90cdf4' : '#cbd5e0',
            fontSize: 11,
            fontWeight: isGroup ? 600 : 'normal'
          }}>
            {text}
          </span>
        );
      }
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      width: '35%',
      render: (text: string) => <span style={{ color: '#e2e8f0', fontSize: 11, fontWeight: 500 }}>{text}</span>
    },
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
      width: '15%',
      render: (text: string) => text ? <Tag color="default" style={{ fontSize: 9, margin: 0, padding: '0 4px', background: '#2d3748', borderColor: '#4a5568', color: '#cbd5e0' }}>{text}</Tag> : null
    },
  ];

  const renderPsetTable = (psets: PropertySet[]) => {
    if (psets.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<span style={{ color: '#718096', fontSize: 11 }}>Không có dữ liệu</span>}
          style={{ padding: '20px 0', margin: 0 }}
        />
      );
    }

    const dataSource = psets.map((pset, psetIndex) => ({
      key: `pset-${psetIndex}-${pset.name}`,
      name: pset.name,
      value: '',
      unit: '',
      children: pset.properties.map((prop, propIndex) => ({
        key: `prop-${psetIndex}-${propIndex}-${prop.name}`,
        name: prop.name,
        value: prop.value,
        unit: prop.unit,
      })),
    }));

    return (
      <Table
        key={`${localId}-${psets.length}`}
        dataSource={dataSource}
        columns={propertyColumns}
        size="small"
        pagination={false}
        expandable={{
          defaultExpandAllRows: true,
        }}
        bordered
        style={{ background: 'transparent' }}
        className="property-tree-table"
      />
    );
  };

  const tabItems = [
    {
      key: 'properties',
      label: <span style={{ fontSize: 11, fontWeight: 500 }}>Properties</span>,
      children: renderPsetTable(sortedPropertiesPsets),
    },
    {
      key: 'location',
      label: <span style={{ fontSize: 11, fontWeight: 500 }}>Location</span>,
      children: renderPsetTable(locationPsets),
    },
    {
      key: 'classification',
      label: <span style={{ fontSize: 11, fontWeight: 500 }}>Classification</span>,
      children: renderPsetTable(classificationPsets),
    },
    {
      key: 'relations',
      label: <span style={{ fontSize: 11, fontWeight: 500 }}>Relations</span>,
      children: renderPsetTable(relationPsets),
    },
  ];

  return (
    <div style={{ padding: 12, overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {mapboxEnabled && renderGisCard()}
      {mapboxEnabled && renderMapCameraCard()}

      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <Tag color="blue" style={{ margin: 0 }}>{modelId}</Tag>
        <Tag color="orange" style={{ margin: 0 }}>#{localId}</Tag>
      </div>

      <Descriptions bordered size="small" column={1} style={{ background: '#171725', borderRadius: 4, overflow: 'hidden' }}>
        {attributes.Name && (
          <Descriptions.Item label={<span style={{ fontSize: 11, color: '#a0aec0' }}>Name</span>}>
            <span style={{ fontSize: 11, color: '#e2e8f0', fontWeight: 500 }}>{attributes.Name}</span>
          </Descriptions.Item>
        )}
        {(attributes.type !== undefined || attributes._category !== undefined) && (
          <Descriptions.Item label={<span style={{ fontSize: 11, color: '#a0aec0' }}>Type</span>}>
            <Tag color="purple" style={{ fontSize: 10, margin: 0 }}>{String(attributes.type ?? attributes._category ?? '')}</Tag>
          </Descriptions.Item>
        )}
        {attributes.GlobalId && (
          <Descriptions.Item label={<span style={{ fontSize: 11, color: '#a0aec0' }}>GlobalId</span>}>
            <Text copyable style={{ fontSize: 10, color: '#cbd5e0' }}>{attributes.GlobalId}</Text>
          </Descriptions.Item>
        )}
        {attributes.Tag && (
          <Descriptions.Item label={<span style={{ fontSize: 11, color: '#a0aec0' }}>Tag</span>}>
            <span style={{ fontSize: 11, color: '#e2e8f0' }}>{attributes.Tag}</span>
          </Descriptions.Item>
        )}
      </Descriptions>

      <div style={{ flex: 1, minHeight: 0 }}>
        <Tabs
          defaultActiveKey="properties"
          items={tabItems}
          size="small"
          style={{ color: '#e2e8f0' }}
          tabBarStyle={{ marginBottom: 8 }}
        />
      </div>
    </div>
  );
}
