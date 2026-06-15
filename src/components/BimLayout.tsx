import { useState, useRef, useCallback, useEffect } from 'react';
import { Layout, ConfigProvider, theme } from 'antd';
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
        setModelCount(engine.fragments.list.size);
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

  const handleUpdateMapboxCenterAndElevation = useCallback((center: [number, number], elevation: number) => {
    if (engineRef.current) {
      engineRef.current.updateMapboxCenterAndElevation(center, elevation);
      setMapboxCenter(center);
      setMapboxElevation(elevation);
    }
  }, []);

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
                onUpdateCenter={handleUpdateMapboxCenterAndElevation}
              />
            )}
          </Sider>
        </Layout>

        <BottomBar status={status} modelCount={modelCount} />
      </Layout>
    </ConfigProvider>
  );
}
