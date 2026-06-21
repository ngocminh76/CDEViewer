import { useState, useRef, useCallback, useEffect } from 'react';
import { Layout, ConfigProvider, theme } from 'antd';
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import TopToolbar from './TopToolbar.tsx';
import ToolPanel from './ToolPanel.tsx';
import Viewport from './Viewport.tsx';
import RightPanel from './RightPanel.tsx';
import BottomBar from './BottomBar.tsx';
import LoginPage from './LoginPage.tsx';
import ModelTree from './ModelTree.tsx';
import MapLayerSelector from './MapLayerSelector.tsx';
import DocumentViewer from './DocumentViewer.tsx';
import {
  createBimEngine,
  loadIfcFile,
  getElementInfo,
  type BimEngine,
  type SelectionInfo,
  type ToolMode,
  type TreeNodeData,
} from '../engine.ts';
import { vn2000ToWgs84 } from '../utils/coordination.ts';

const { Sider, Content } = Layout;

function parseIfcCoordinate(val: any): number | null {
  if (!val) return null;
  const arr = Array.isArray(val) ? val : (val.value && Array.isArray(val.value) ? val.value : null);
  
  let deg = 0, min = 0, sec = 0, microsec = 0;
  
  if (arr && arr.length > 0) {
    deg = Number(arr[0]) || 0;
    min = Number(arr[1]) || 0;
    sec = Number(arr[2]) || 0;
    microsec = Number(arr[3]) || 0;
  } else if (typeof val === 'string' || (val.value && typeof val.value === 'string')) {
    const str = typeof val === 'string' ? val : val.value;
    // Support formats like "10°25'24\"166714" or "10 25 24 166714"
    const match = str.match(/(-?\d+)[^\d]+(\d+)[^\d]+(\d+)[^\d]+(\d+)/);
    if (match) {
      deg = Number(match[1]) || 0;
      min = Number(match[2]) || 0;
      sec = Number(match[3]) || 0;
      microsec = Number(match[4]) || 0;
    } else {
      return null;
    }
  } else {
    return null;
  }
  
  const sign = deg < 0 ? -1 : 1;
  const absDeg = Math.abs(deg);
  const decimal = absDeg + min / 60 + (sec + microsec / 1000000) / 3600;
  return sign * decimal;
}

function parseIfcElevation(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && val.value !== undefined) return Number(val.value);
  if (typeof val !== 'object') return Number(val);
  return null;
}

export default function BimLayout() {
  const [username, setUsername] = useState<string | null>(() => localStorage.getItem('cde_viewer_user'));

  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [rightWidth, setRightWidth] = useState(360); // Resizable right panel width
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [leftWidth, setLeftWidth] = useState(300);   // Resizable left panel width
  const [treeData, setTreeData] = useState<TreeNodeData[]>([]);

  const [status, setStatus] = useState('Initializing...');
  const [modelCount, setModelCount] = useState(0);
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [toolMode, setToolModeState] = useState<ToolMode>('select');
  const [clipCount, setClipCount] = useState(0);
  const [mapboxEnabled, setMapboxEnabledState] = useState(false);
  const [mapboxCenter, setMapboxCenter] = useState<[number, number]>([105.804817, 21.028511]);
  const [mapboxElevation, setMapboxElevation] = useState<number>(0);
  const [mapboxHeading, setMapboxHeading] = useState<number>(0);
  const [mapboxPitch, setMapboxPitch] = useState<number>(60);
  const [mapboxBearing, setMapboxBearing] = useState<number>(60); // -300 is 60

  const [mapboxStyle, setMapboxStyleState] = useState<string>('mapbox://styles/mapbox/streets-v12');
  const [docOpen, setDocOpen] = useState<boolean>(false);
  const [selectedNode, setSelectedNode] = useState<{ title: string; category?: string; localId?: number } | null>(null);

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

  const handleSelectElement = useCallback(async (modelId: string, localId: number) => {
    if (!engineRef.current) return;
    const model = engineRef.current.fragments.list.get(modelId);
    if (!model) return;
    
    try {
      const info = await getElementInfo(model, modelId, localId, engineRef.current.components);
      setSelection(info);
    } catch (err) {
      console.warn('[handleSelectElement] Failed to load element info:', err);
    }
  }, []);

  // LIÊN KẾT GÓC NHÌN 3D VÀ BẢN VẼ 2D (SPLIT-SCREEN INTERACTIVE DOCK):
  // Hook này đồng bộ hóa phần tử đang chọn trong mô hình 3D (selection)
  // với cấu trúc bản vẽ 2D trong DocumentViewer.
  // 1. Khi người dùng click chọn 1 đối tượng 3D (Cột, Dầm, Sàn, Tường...), ta lấy thông tin category/localId.
  // 2. Tự động mở khung bản vẽ 2D (setDocOpen(true)) khi cấu kiện kết cấu được chọn.
  // 3. DocumentViewer sẽ nhận selectedNode này và tự động chuyển sang trang bản vẽ tương ứng (ví dụ:
  //    chọn Cột thì mở bản vẽ Chi tiết Cột, chọn cấu kiện Tầng 2 thì chuyển sang Mặt bằng Tầng 2),
  //    đồng thời tô màu highlight đỏ phần tử tương ứng trên bản vẽ vector SVG.
  useEffect(() => {
    if (selection) {
      const nameAttr = selection.attributes.LongName || selection.attributes.Name || selection.attributes.ObjectType || `#${selection.localId}`;
      const objType = selection.attributes.ObjectType || '';
      setSelectedNode({
        title: nameAttr,
        category: objType,
        localId: selection.localId,
      });
      // Tự động mở cửa sổ bản vẽ 2D nếu đối tượng chọn là cấu kiện kết cấu chịu lực
      const cat = objType.toUpperCase();
      if (cat.includes('COLUMN') || cat.includes('BEAM') || cat.includes('WALL') || cat.includes('SLAB') || cat.includes('PLATE')) {
        setDocOpen(true);
      }
    } else {
      setSelectedNode(null);
    }
  }, [selection]);

  const handleMapboxStyleChange = useCallback((styleUrl: string) => {
    setMapboxStyleState(styleUrl);
    if (engineRef.current) {
      engineRef.current.setMapboxStyle(styleUrl);
    }
  }, []);

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

      // Lắng nghe sự kiện di chuyển map để cập nhật các thanh trượt Pitch/Bearing trong thời gian thực
      engine.mapBoxComponent.onMapMove.add(({ pitch, bearing }) => {
        setMapboxPitch(pitch);
        const normalizedBearing = (bearing % 360 + 360) % 360;
        setMapboxBearing(normalizedBearing);
      });

      // Track clip changes
      engine.clipper.list.onItemSet.add(() => refreshClipCount());
      engine.clipper.list.onItemDeleted.add(() => refreshClipCount());

      engine.fragments.list.onItemSet.add(async (event) => {
        const size = engine.fragments.list.size;
        setModelCount(size);
        const model = event.value;

        // NGUYÊN TẮC LIÊN KẾT TỌA ĐỘ GIS KHI TẢI NHIỀU MÔ HÌNH (MULTI-MODEL):
        // Khi tải mô hình đầu tiên, ta sẽ trích xuất tọa độ VN-2000 / GIS để căn chỉnh
        // bản đồ Mapbox về đúng vị trí địa lý của dự án.
        // Tuy nhiên, kể từ mô hình thứ hai trở đi, ta KHÔNG được cập nhật lại tâm bản đồ Mapbox
        // hay thay đổi tham số GIS nữa. Bởi vì tất cả các mô hình tiếp theo đều đã được đặt vào
        // cùng một không gian toạ độ cục bộ Three.js của mô hình đầu tiên. Nếu ta cập nhật GIS parameters
        // theo mô hình thứ hai, toàn bộ mô hình trong không gian 3D sẽ bị lệch khỏi bản đồ Mapbox.
        if (size > 1) {
          console.log('[CDEViewer] Additional model loaded. Skipping Mapbox georeferencing to preserve relative coordinates.');
          return;
        }
        
        // CHỜ HÌNH HỌC MÔ HÌNH ĐƯỢC LOAD XONG TỪ WORKERS:
        // Do meshes hình học được tải bất đồng bộ ở luồng Worker khác, ta cần đợi cho đến khi
        // tiến trình này hoàn tất (model.isBusy = false), tránh việc tính toán Bounding Box sai lệch.
        let loadRetries = 0;
        while (loadRetries < 30 && (model as any).isBusy) {
          loadRetries++;
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
        
        let foundGeoreference = false;
        let isCentered = true;
        let bboxCenter = new THREE.Vector3();

        // KIỂM TRA MÔ HÌNH CÓ ĐƯỢC TỰ ĐỘNG CĂN TÂM (CENTERED):
        // Nếu Bounding Box của mô hình chứa giá trị X, Z rất lớn (> 10000), chứng tỏ loader
        // KHÔNG căn tâm mô hình về gốc toạ độ (0,0,0) trong Three.js, mà giữ nguyên tọa độ gốc
        // VN-2000. Nếu là trường hợp này, ta cần truyền tọa độ gốc thực tế cho modelOrigin trong Mapbox.
        try {
          const bboxer = engine.components.get(OBC.BoundingBoxer);
          bboxer.addFromModels([new RegExp(`^${model.modelId}$`)]);
          const box = bboxer.get();
          box.getCenter(bboxCenter);
          bboxer.dispose();

          if (Math.abs(bboxCenter.x) > 10000 && Math.abs(bboxCenter.z) > 10000) {
            isCentered = false;
          }
        } catch (e) {
          console.warn('[CDEViewer] Failed to compute BoundingBox:', e);
        }
        
        // BƯỚC 1: Lấy tọa độ trắc địa CRS từ thuộc tính getCRS() của mô hình IFC.
        // Đây là phương án chính xác nhất thường được xuất từ các phần mềm BIM như Revit (Shared Coordinates).
        try {
          const crs = await model.getCRS();
          console.log('[CDEViewer] Model CRS data:', crs);
          if (crs && crs.mapConversion) {
            const east = crs.mapConversion.eastings;
            const north = crs.mapConversion.northings;
            const height = crs.mapConversion.orthogonalHeight;
            
            if (Math.abs(east) > 10000 && Math.abs(north) > 10000) {
              console.log('[CDEViewer] Georeference base point detected from getCRS():', east, north, height);
              const absoluteEast = Math.abs(east);
              const absoluteNorth = Math.abs(north);
              
              setRawX(absoluteEast);
              setRawY(absoluteNorth);
              setRawZ(height);
              
              // Chuyển đổi tọa độ VN-2000 của Việt Nam sang tọa độ địa lý WGS84 (Kinh độ/Vĩ độ)
              const [lng, lat] = vn2000ToWgs84(absoluteEast, absoluteNorth, kttRef.current, zone3degRef.current);
              setMapboxCenter([lng, lat]);
              setMapboxElevation(height);
              
              // Nếu mô hình được căn tâm, gốc Three.js sẽ là (0,0,0). Nếu không, nó là [east, height, -north].
              const mOrigin = isCentered ? [0, 0, 0] : [east, height, -north];
              engine.updateMapboxGISParameters([lng, lat], height, mapboxHeadingRef.current, mOrigin as [number,number,number], true);
              foundGeoreference = true;
            }
          }
        } catch (crsErr) {
          console.warn('[CDEViewer] Failed to query model.getCRS():', crsErr);
        }
        
        // BƯỚC 2: Dự phòng lấy tọa độ trắc địa từ Ma trận Định vị liên kết (Coordination Matrix) của IFC.
        if (!foundGeoreference) {
          try {
            const matrix = await model.getCoordinationMatrix();
            const pos = new THREE.Vector3();
            pos.setFromMatrixPosition(matrix);
            console.log(`[CDEViewer] Model loaded. Base point coordinates:`, pos);
            
            if (Math.abs(pos.x) > 10000 && Math.abs(pos.z) > 10000) {
              console.log('[CDEViewer] Georeference base point detected from coordination matrix:', pos);
              const absoluteX = Math.abs(pos.x);
              const absoluteY = Math.abs(pos.z);
              
              setRawX(absoluteX);
              setRawY(absoluteY);
              setRawZ(pos.y);
              
              // Chuyển đổi VN-2000 sang WGS84
              const [lng, lat] = vn2000ToWgs84(absoluteX, absoluteY, kttRef.current, zone3degRef.current);
              setMapboxCenter([lng, lat]);
              setMapboxElevation(pos.y);
              const mOrigin = isCentered ? [0, 0, 0] : [pos.x, pos.y, pos.z];
              engine.updateMapboxGISParameters([lng, lat], pos.y, mapboxHeadingRef.current, mOrigin as [number,number,number], true);
              foundGeoreference = true;
            }
          } catch (matrixErr) {
            console.warn('[CDEViewer] Failed to query model.getCoordinationMatrix():', matrixErr);
          }
        }

        // BƯỚC 3: Dự phòng tính từ tâm Bounding Box nếu mô hình không được căn tâm và các bước trước thất bại
        if (!foundGeoreference && !isCentered) {
          console.log('[CDEViewer] Georeference base point detected from BoundingBox:', bboxCenter);
          const absoluteEast = Math.abs(bboxCenter.x);
          const absoluteNorth = Math.abs(bboxCenter.z);
          
          setRawX(absoluteEast);
          setRawY(absoluteNorth);
          setRawZ(bboxCenter.y);
          const [lng, lat] = vn2000ToWgs84(absoluteEast, absoluteNorth, kttRef.current, zone3degRef.current);
          setMapboxCenter([lng, lat]);
          setMapboxElevation(bboxCenter.y);
          engine.updateMapboxGISParameters([lng, lat], bboxCenter.y, mapboxHeadingRef.current, [bboxCenter.x, bboxCenter.y, bboxCenter.z], true);
          foundGeoreference = true;
        }
        
        // BƯỚC 4: Dự phòng lấy tọa độ địa lý kinh độ/vĩ độ trực tiếp từ thực thể IfcSite (RefLatitude, RefLongitude).
        if (!foundGeoreference) {
          try {
            const classifier = engine.classifier;
            const categoryMap = classifier.list.get('Categories');
            const siteClass = categoryMap?.get('IFCSITE');
            if (siteClass) {
              const map = await siteClass.get();
              const expressIds = map[model.modelId];
              if (expressIds && expressIds.size > 0) {
                const siteId = Array.from(expressIds)[0];
                const dataArr = await model.getItemsData([siteId]);
                const siteData = Array.isArray(dataArr) && dataArr.length > 0 ? dataArr[0] : null;
                
                if (siteData) {
                  console.log('[CDEViewer] IfcSite properties loaded:', siteData);
                  const latVal = siteData.RefLatitude;
                  const lngVal = siteData.RefLongitude;
                  const elevVal = siteData.RefElevation;
                  
                  const parsedLat = parseIfcCoordinate(latVal);
                  const parsedLng = parseIfcCoordinate(lngVal);
                  const parsedElev = parseIfcElevation(elevVal);
                  
                  if (parsedLat !== null && parsedLng !== null && (Math.abs(parsedLat) > 0.1 || Math.abs(parsedLng) > 0.1)) {
                    console.log(`[CDEViewer] Georeference coordinates detected from IfcSite: Lat=${parsedLat}, Lng=${parsedLng}, Elev=${parsedElev}`);
                    setMapboxCenter([parsedLng, parsedLat]);
                    const elevationValue = parsedElev !== null ? parsedElev : 0;
                    setMapboxElevation(elevationValue);
                    
                    setRawX(null);
                    setRawY(null);
                    setRawZ(elevationValue);
                    
                    engine.updateMapboxGISParameters([parsedLng, parsedLat], elevationValue, mapboxHeadingRef.current, [bboxCenter.x, bboxCenter.y, bboxCenter.z], true);
                    foundGeoreference = true;
                  }
                }
              }
            }
          } catch (siteErr) {
            console.error('[CDEViewer] Failed to query site georeferencing:', siteErr);
          }
        }
        
        if (!foundGeoreference) {
          console.log('[CDEViewer] No georeferencing information (VN-2000 or IfcSite) found in the model.');
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
        engine.buildTreeData().then(setTreeData);
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
    rawX?: number | null;
    rawY?: number | null;
    rawZ?: number | null;
  }) => {
    const engine = engineRef.current;
    if (!engine) return;

    let nextCenter = mapboxCenter;
    let nextElevation = mapboxElevation;
    let nextHeading = mapboxHeading;
    let nextKtt = ktt;
    let nextZone = zone3deg;
    let nextRawX = rawX;
    let nextRawY = rawY;
    let nextRawZ = rawZ;

    if (params.rawX !== undefined) {
      nextRawX = params.rawX;
      setRawX(nextRawX);
    }
    if (params.rawY !== undefined) {
      nextRawY = params.rawY;
      setRawY(nextRawY);
    }
    if (params.rawZ !== undefined) {
      nextRawZ = params.rawZ;
      setRawZ(nextRawZ);
    }

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

    if (nextRawX !== null && nextRawY !== null) {
      // Recalculate center based on VN-2000 coordinates and KTT/Zone
      const [lng, lat] = vn2000ToWgs84(nextRawX, nextRawY, nextKtt, nextZone);
      nextCenter = [lng, lat];
      setMapboxCenter(nextCenter);
      if (nextRawZ !== null && params.elevation === undefined) {
        nextElevation = nextRawZ;
        setMapboxElevation(nextElevation);
      }
    } else if (params.center !== undefined) {
      nextCenter = params.center;
      setMapboxCenter(nextCenter);
    }

    engine.updateMapboxGISParameters(nextCenter, nextElevation, nextHeading, undefined, true);
  }, [mapboxCenter, mapboxElevation, mapboxHeading, ktt, zone3deg, rawX, rawY, rawZ]);

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

  // --- Pitch / Bearing updates ---
  const handleUpdatePitch = useCallback((pitch: number) => {
    const engine = engineRef.current;
    if (engine && engine.mapBoxComponent && engine.mapBoxComponent.map) {
      engine.mapBoxComponent.map.setPitch(pitch);
      setMapboxPitch(pitch);
    }
  }, []);

  const handleUpdateBearing = useCallback((bearing: number) => {
    const engine = engineRef.current;
    if (engine && engine.mapBoxComponent && engine.mapBoxComponent.map) {
      engine.mapBoxComponent.map.setBearing(bearing);
      setMapboxBearing(bearing);
    }
  }, []);

  // --- Upload ---
  const handleUpload = useCallback(async (file: File) => {
    const engine = engineRef.current;
    if (!engine) return;
    try {
      await loadIfcFile(engine, file, setStatus);
      setModelCount(engine.fragments.list.size);
      
      // Update Tree Data after classifier finishes
      engine.buildTreeData().then(setTreeData);

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
          leftCollapsed={leftCollapsed}
          onToggleLeft={() => setLeftCollapsed(!leftCollapsed)}
          rightCollapsed={rightCollapsed}
          onToggleRight={() => setRightCollapsed(!rightCollapsed)}
          status={status}
          onUpload={handleUpload}
          username={username}
          onLogout={handleLogout}
        />

        <Layout style={{ flex: 1 }}>
          {/* Left - Model Tree */}
          <Sider
            width={leftWidth}
            collapsible
            collapsed={leftCollapsed}
            collapsedWidth={0}
            trigger={null}
            className="glass-panel-left"
            style={{ background: 'transparent', overflow: 'hidden', position: 'relative' }}
          >
            {/* Drag handle for left panel */}
            {!leftCollapsed && (
              <div
                style={{
                  width: '6px',
                  cursor: 'col-resize',
                  position: 'absolute',
                  right: 0,
                  top: 0,
                  bottom: 0,
                  zIndex: 100,
                  background: 'rgba(255, 255, 255, 0.05)',
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#1890ff'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startWidth = leftWidth;
                  
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const newWidth = startWidth + (moveEvent.clientX - startX);
                    if (newWidth >= 240 && newWidth <= 600) {
                      setLeftWidth(newWidth);
                    }
                  };
                  
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };
                  
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
              />
            )}
            {!leftCollapsed && (
              <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #303030', color: '#fff', fontWeight: 600 }}>
                  Project Models
                </div>
                <div style={{ flex: 1, padding: 8, overflow: 'auto' }}>
                  <ModelTree
                    treeData={treeData}
                    onHighlight={(m) => engineRef.current?.highlightItems(m)}
                    onClearHighlight={() => engineRef.current?.clearHighlight()}
                    onHide={(m) => engineRef.current?.setVisibility(false, m)}
                    onShow={(m) => engineRef.current?.setVisibility(true, m)}
                    onIsolate={(m) => engineRef.current?.isolateItems(m)}
                    onShowAll={() => engineRef.current?.showAll()}
                    onSelectElement={handleSelectElement}
                    selection={selection}
                  />
                </div>
              </div>
            )}
          </Sider>

          {/* Viewport + floating ToolPanel + split-screen DocumentViewer */}
          <Content style={{ display: 'flex', position: 'relative', height: '100%', overflow: 'hidden' }}>
            {/* 3D Viewport Pane */}
            <div style={{ flex: docOpen ? 1 : 2, position: 'relative', height: '100%' }}>
              <Viewport onMount={handleMount} mapboxEnabled={mapboxEnabled} />
              
              {mapboxEnabled && (
                <MapLayerSelector currentStyle={mapboxStyle} onStyleChange={handleMapboxStyleChange} />
              )}
              
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
                docOpen={docOpen}
                onToggleDoc={() => setDocOpen(!docOpen)}
              />
            </div>
            
            {/* 2D Document Pane */}
            {docOpen && (
              <div 
                className="glass-panel" 
                style={{ 
                  width: '45%', 
                  height: '100%', 
                  borderLeft: '1px solid rgba(255, 255, 255, 0.1)', 
                  position: 'relative',
                  zIndex: 30,
                }}
              >
                <DocumentViewer selectedNode={selectedNode} onClose={() => setDocOpen(false)} />
              </div>
            )}
          </Content>

          {/* Right — Properties */}
          <Sider
            width={rightWidth}
            collapsible
            collapsed={rightCollapsed}
            collapsedWidth={0}
            trigger={null}
            className="glass-panel-right"
            style={{ background: 'transparent', overflow: 'hidden', position: 'relative' }}
          >
            {/* Drag handle to resize panel */}
            {!rightCollapsed && (
              <div
                style={{
                  width: '6px',
                  cursor: 'col-resize',
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  zIndex: 100,
                  background: 'rgba(255, 255, 255, 0.05)',
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => e.currentTarget.style.background = '#1890ff'}
                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startWidth = rightWidth;
                  
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const newWidth = startWidth - (moveEvent.clientX - startX);
                    if (newWidth >= 280 && newWidth <= 800) {
                      setRightWidth(newWidth);
                    }
                  };
                  
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };
                  
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
              />
            )}
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
                mapboxPitch={mapboxPitch}
                mapboxBearing={mapboxBearing}
                onUpdatePitch={handleUpdatePitch}
                onUpdateBearing={handleUpdateBearing}
              />
            )}
          </Sider>
        </Layout>

        <BottomBar status={status} modelCount={modelCount} />
      </Layout>
    </ConfigProvider>
  );
}
