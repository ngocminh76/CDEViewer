import { useState, useRef, useCallback, useEffect } from 'react';
import { Layout, ConfigProvider, theme } from 'antd';
import * as THREE from 'three';
import TopToolbar from './TopToolbar.tsx';
import ToolPanel from './ToolPanel.tsx';
import Viewport from './Viewport.tsx';
import RightPanel from './RightPanel.tsx';
import BottomBar from './BottomBar.tsx';
import LoginPage from './LoginPage.tsx';
import {
  createBimEngine,
  loadIfcFile,
  type BimEngine,
  type SelectionInfo,
  type ToolMode,
} from '../engine.ts';
import { vn2000ToWgs84 } from '../utils/coordination.ts';

const { Sider, Content } = Layout;

export default function BimLayout() {
  const [username, setUsername] = useState<string | null>(() => {
    return localStorage.getItem('cde_viewer_user');
  });
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [modelCount, setModelCount] = useState(0);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [toolMode, setToolModeState] = useState<ToolMode>('select');
  const [clipCount, setClipCount] = useState(0);
  const [mapboxEnabled, setMapboxEnabledState] = useState(false);
  const [mapboxCenter, setMapboxCenter] = useState<[number, number]>([105.804817, 21.028511]);
  const [mapboxElevation, setMapboxElevation] = useState<number>(0);
  const [mapboxHeading, setMapboxHeading] = useState<number>(0);

  // VN-2000 coordination states
  const [rawX, setRawX] = useState<number | null>(null);
  const [rawY, setRawY] = useState<number | null>(null);
  const [rawZ, setRawZ] = useState<number | null>(null);
  const [ktt, setKtt] = useState<number>(105.5); // Default to 105.5 (105°30')
  const [zone3deg, setZone3deg] = useState<boolean>(true); // Default to 3-degree zone


  const kttRef = useRef(ktt);
  const zone3degRef = useRef(zone3deg);
  const mapboxHeadingRef = useRef(mapboxHeading);

  useEffect(() => {
    kttRef.current = ktt;
  }, [ktt]);

  useEffect(() => {
    zone3degRef.current = zone3deg;
  }, [zone3deg]);

  useEffect(() => {
    mapboxHeadingRef.current = mapboxHeading;
  }, [mapboxHeading]);

  const engineRef = useRef<BimEngine | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const refreshClipCount = useCallback(() => {
    if (engineRef.current) setClipCount(engineRef.current.getClipCount());
  }, []);

  const handleMount = useCallback(async (container3D: HTMLDivElement, containerMapBox: HTMLDivElement) => {
    try {
      const engine = await createBimEngine(container3D, setStatus);
      engineRef.current = engine;
      engine.initMapbox(containerMapBox);
      setModelCount(engine.fragments.list.size);

      const canvas = engine.world.renderer!.three.domElement;
      cleanupRef.current = engine.setupSelection(canvas, (info) => {
        setSelection(info);
      });

      // Track clip changes
      engine.clipper.list.onItemSet.add(() => refreshClipCount());
      engine.clipper.list.onItemDeleted.add(() => refreshClipCount());

      engine.fragments.list.onItemSet.add(() => {
        const size = engine.fragments.list.size;
        setModelCount(size);
        if (size === 1) {
          const matrix = engine.fragments.baseCoordinationMatrix;
          const pos = new THREE.Vector3();
          pos.setFromMatrixPosition(matrix);
          // Check if coordinate offset is a large UTM/VN-2000 coordinate
          if (Math.abs(pos.x) > 10000 && Math.abs(pos.y) > 10000) {
            console.log('Georeference base point detected:', pos);
            setRawX(pos.x);
            setRawY(pos.y);
            setRawZ(pos.z);
            // Convert to WGS84
            const [lng, lat] = vn2000ToWgs84(pos.x, pos.y, kttRef.current, zone3degRef.current);
            setMapboxCenter([lng, lat]);
            setMapboxElevation(pos.z);
            engine.updateMapboxGISParameters([lng, lat], pos.z, mapboxHeadingRef.current);
          }
        }
      });

      engine.fragments.list.onItemDeleted.add(() => {
        const size = engine.fragments.list.size;
        setModelCount(size);
        if (size === 0) {
          setRawX(null);
          setRawY(null);
          setRawZ(null);
        }
      });
    } catch (err) {
      console.error('Engine init failed:', err);
      setStatus('Init failed');
    }
  }, [refreshClipCount]);

  const handleToggleMapbox = useCallback(() => {
    const engine = engineRef.current;
    if (!engine) return;

    const nextState = !mapboxEnabled;
    try {
      engine.setMapboxEnabled(nextState);
      setMapboxEnabledState(nextState);
    } catch (err: any) {
      if (err.message === 'TOKEN_MISSING') {
        const token = prompt('Bạn chưa cấu hình mã truy cập Mapbox (VITE_MAPBOX_TOKEN).\nVui lòng nhập mã Token của bạn vào đây để chạy thử:');
        if (token && token.trim() !== '') {
          localStorage.setItem('VITE_MAPBOX_TOKEN', token.trim());
          try {
            engine.setMapboxEnabled(nextState);
            setMapboxEnabledState(nextState);
          } catch (retryErr: any) {
            alert('Lỗi khởi tạo Mapbox với Token vừa nhập: ' + retryErr.message);
          }
        }
      } else {
        alert('Lỗi khởi tạo bản đồ Mapbox: ' + err.message);
      }
    }
  }, [mapboxEnabled]);

  const handleUpdateParams = useCallback((params: {
    center?: [number, number];
    elevation?: number;
    heading?: number;
    ktt?: number;
    zone3deg?: boolean;
  }) => {
    const engine = engineRef.current;
    if (!engine) return;

    let nextCenter = mapboxCenter;
    let nextElevation = mapboxElevation;
    let nextHeading = mapboxHeading;
    let nextKtt = ktt;
    let nextZone = zone3deg;

    if (params.ktt !== undefined) {
      nextKtt = params.ktt;
      setKtt(nextKtt);
    }
    if (params.zone3deg !== undefined) {
      nextZone = params.zone3deg;
      setZone3deg(nextZone);
    }
    if (params.elevation !== undefined) {
      nextElevation = params.elevation;
      setMapboxElevation(nextElevation);
    }
    if (params.heading !== undefined) {
      nextHeading = params.heading;
      setMapboxHeading(nextHeading);
    }

    if (rawX !== null && rawY !== null && (params.ktt !== undefined || params.zone3deg !== undefined)) {
      // Recalculate center based on KTT/Zone changes
      const [lng, lat] = vn2000ToWgs84(rawX, rawY, nextKtt, nextZone);
      nextCenter = [lng, lat];
      setMapboxCenter(nextCenter);
    } else if (params.center !== undefined) {
      nextCenter = params.center;
      setMapboxCenter(nextCenter);
    }

    engine.updateMapboxGISParameters(nextCenter, nextElevation, nextHeading);
  }, [mapboxCenter, mapboxElevation, mapboxHeading, ktt, zone3deg, rawX, rawY]);

  useEffect(() => {
    return () => {
      cleanupRef.current?.();
      engineRef.current?.dispose();
    };
  }, []);

  // --- Tool mode ---
  const handleToolMode = useCallback((mode: ToolMode) => {
    setToolModeState(mode);
    engineRef.current?.setToolMode(mode);
  }, []);

  // --- Clip actions ---
  const handleCreateClip = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.createClip();
      refreshClipCount();
    }
  }, [refreshClipCount]);

  const handleDeleteClip = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.deleteClip();
      refreshClipCount();
    }
  }, [refreshClipCount]);

  const handleDeleteAllClips = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.deleteAllClips();
      refreshClipCount();
    }
  }, [refreshClipCount]);

  // --- Camera ---
  const handleCameraView = useCallback((view: 'top' | 'front' | 'right' | 'left' | 'back' | 'perspective') => {
    if (engineRef.current) engineRef.current.setCameraView(view);
  }, []);

  // --- Upload ---
  const handleUpload = useCallback(async (file: File) => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      await loadIfcFile(engine, file, setStatus);
      setModelCount(engine.fragments.list.size);
      // Auto zoom to fit loaded model
      setTimeout(async () => {
        await engine.zoomToFit();
      }, 100);
    } catch (err) {
      console.error('Upload failed:', err);
      setStatus('Upload failed');
    }
  }, []);

  const handleLoginSuccess = (name: string) => {
    localStorage.setItem('cde_viewer_user', name);
    setUsername(name);
  };

  const handleLogout = () => {
    localStorage.removeItem('cde_viewer_user');
    setUsername(null);
  };

  if (!username) {
    return (
      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
      <Layout style={{ height: '100%', background: '#141414' }}>
        <TopToolbar
          rightCollapsed={rightCollapsed}
          onToggleRight={() => setRightCollapsed(!rightCollapsed)}
          status={status}
          onUpload={handleUpload}
          username={username}
          onLogout={handleLogout}
        />

        <Layout style={{ flex: 1 }}>
          {/* Viewport + floating ToolPanel */}
          <Content style={{ position: 'relative' }}>
            <Viewport onMount={handleMount} mapboxEnabled={mapboxEnabled} />
            <ToolPanel
              toolMode={toolMode}
              onToolMode={handleToolMode}
              clipCount={clipCount}
              onCreateClip={handleCreateClip}
              onDeleteClip={handleDeleteClip}
              onDeleteAllClips={handleDeleteAllClips}
              onCameraView={handleCameraView}
              mapboxEnabled={mapboxEnabled}
              onToggleMapbox={handleToggleMapbox}
            />
          </Content>

          {/* Right — Properties */}
          <Sider
            width={320}
            collapsible
            collapsed={rightCollapsed}
            collapsedWidth={0}
            trigger={null}
            style={{ background: '#1f1f1f', borderLeft: '1px solid #303030', overflow: 'auto' }}
          >
            {!rightCollapsed && (
              <RightPanel
                selection={selection}
                mapboxEnabled={mapboxEnabled}
                mapboxCenter={mapboxCenter}
                mapboxElevation={mapboxElevation}
                mapboxHeading={mapboxHeading}
                rawX={rawX}
                rawY={rawY}
                rawZ={rawZ}
                ktt={ktt}
                zone3deg={zone3deg}
                onUpdateParams={handleUpdateParams}
              />
            )}
          </Sider>
        </Layout>

        <BottomBar status={status} modelCount={modelCount} />
      </Layout>
    </ConfigProvider>
  );
}
