/* eslint-disable @typescript-eslint/no-explicit-any */
import * as THREE from 'three';
import * as OBC from '@thatopen/components';
import { CAMERA_POSITION } from './config.ts';
import { setupFragments, setupIfcLoader } from './loader.ts';
import { MapBoxComponent } from './components/MapBoxComponent/index.ts';


// ---------------------------------------------------------------------------
// BIM Engine + Clipper + Hider + BoundingBoxer + Selection
// ---------------------------------------------------------------------------

export interface SelectionInfo {
  modelId: string;
  localId: number;
  attributes: Record<string, any>;
  propertySets: PropertySet[];
}

export interface PropertySet {
  name: string;
  properties: { name: string; value: string; unit?: string }[];
}

export interface TreeNodeData {
  key: string;
  title: string;
  icon?: string;
  children?: TreeNodeData[];
  modelIdMap?: Record<string, Set<number>>;
  modelId?: string;
  localId?: number;
}

export type ToolMode = 'select' | 'clip' | 'none';

export interface BimEngine {
  components: OBC.Components;
  world: OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>;
  fragments: OBC.FragmentsManager;
  ifcLoader: OBC.IfcLoader;
  classifier: OBC.Classifier;
  hider: OBC.Hider;
  clipper: OBC.Clipper;
  dispose: () => void;

  // Mapbox
  initMapbox: (container: HTMLDivElement) => void;
  setMapboxEnabled: (enabled: boolean) => void;
  updateMapboxGISParameters: (center: [number, number], elevation: number, heading: number, modelOrigin?: [number, number, number]) => void;

  // Selection
  setupSelection: (
    canvas: HTMLCanvasElement,
    onSelect: (info: SelectionInfo | null) => void,
  ) => () => void;

  // Tree
  buildTreeData: () => Promise<TreeNodeData[]>;

  // Highlight
  highlightItems: (modelIdMap: Record<string, Set<number>>) => Promise<void>;
  clearHighlight: () => Promise<void>;

  // Visibility
  setVisibility: (visible: boolean, modelIdMap?: Record<string, Set<number>>) => Promise<void>;
  isolateItems: (modelIdMap: Record<string, Set<number>>) => Promise<void>;
  showAll: () => Promise<void>;

  // Clipping
  setClipperEnabled: (enabled: boolean) => void;
  createClip: () => Promise<void>;
  deleteClip: () => Promise<void>;
  deleteAllClips: () => void;
  getClipCount: () => number;

  // Camera
  zoomToFit: () => Promise<void>;
  setCameraView: (view: 'top' | 'front' | 'right' | 'left' | 'back' | 'perspective') => void;

  // Tool mode
  setToolMode: (mode: ToolMode) => void;
  getToolMode: () => ToolMode;
}

export async function createBimEngine(
  viewportEl: HTMLElement,
  onStatus?: (msg: string) => void,
): Promise<BimEngine> {
  onStatus?.('Creating components...');

  const components = new OBC.Components();
  const worlds = components.get(OBC.Worlds);
  const world = worlds.create<
    OBC.SimpleScene,
    OBC.OrthoPerspectiveCamera,
    OBC.SimpleRenderer
  >();

  world.scene = new OBC.SimpleScene(components);
  world.renderer = new OBC.SimpleRenderer(components, viewportEl);
  world.renderer.showLogo = false;
  world.camera = new OBC.OrthoPerspectiveCamera(components);
  
  // Adjust camera controls for large models (e.g. kilometers long)
  world.camera.controls.maxDistance = 10000000;
  world.camera.controls.dollyToCursor = true; // Makes zooming more intuitive
  world.camera.controls.truckSpeed = 2; // Increase panning speed
  world.camera.controls.dollySpeed = 2; // Increase zoom speed

  // Adjust far plane to prevent clipping long models
  world.camera.threePersp.far = 1000000;
  world.camera.threePersp.updateProjectionMatrix();

  components.init();

  world.scene.setup();
  components.get(OBC.Grids).create(world);

  world.camera.controls.setLookAt(
    CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z,
    CAMERA_POSITION.tx, CAMERA_POSITION.ty, CAMERA_POSITION.tz,
  );

  // --- MapBoxComponent ---
  const mapBoxComponent = components.get(MapBoxComponent);

  onStatus?.('Setting up fragments...');
  const fragments = await setupFragments(components, world);

  onStatus?.('Setting up web-ifc...');
  const ifcLoader = await setupIfcLoader(components);

  const classifier = components.get(OBC.Classifier);
  const hider = components.get(OBC.Hider);

  // --- Clipper ---
  const clipper = components.get(OBC.Clipper);
  clipper.enabled = false;

  // --- BoundingBoxer ---
  const boxer = components.get(OBC.BoundingBoxer);

  // Start with empty scene as requested
  onStatus?.('Ready — upload your .ifc file to start');

  // --- Tool mode ---
  let toolMode: ToolMode = 'select';

  function setToolMode(mode: ToolMode) {
    toolMode = mode;
    clipper.enabled = mode === 'clip';
  }

  function getToolMode() {
    return toolMode;
  }

  // --- Mapbox actions ---
  function initMapbox(container: HTMLDivElement) {
    mapBoxComponent.container = container;
  }

  function setMapboxEnabled(enabled: boolean) {
    mapBoxComponent.enabled = enabled;
    if (enabled) {
      if (!mapBoxComponent.isSetup) {
        mapBoxComponent.setup();
      }
      // Move all loaded fragments/models to Mapbox scene
      for (const group of fragments.list.values()) {
        mapBoxComponent.scene.add(group.object);
        // Disable frustum culling for meshes with valid geometry
        // (Mapbox manually sets camera.projectionMatrix, making Three.js frustum check incorrect)
        group.object.traverse((child: any) => {
          if ((child.isMesh || child.isInstancedMesh) && child.geometry?.attributes?.position?.array) {
            child.frustumCulled = false;
          }
        });
      }
      mapBoxComponent.onResize();
      updateMapboxGISParameters(mapBoxComponent.coord.center, mapBoxComponent.coord.elevation, mapBoxComponent.coord.heading, mapBoxComponent.coord.modelOrigin);
    } else {
      // Move all loaded fragments/models back to local scene
      for (const group of fragments.list.values()) {
        world.scene.three.add(group.object);
        // Restore frustum culling for local scene
        group.object.traverse((child: any) => {
          if (child.isMesh || child.isInstancedMesh) {
            child.frustumCulled = true;
          }
        });
      }
    }
  }

  function updateMapboxGISParameters(center: [number, number], elevation: number, heading: number, modelOrigin: [number, number, number] = [0, 0, 0]) {
    mapBoxComponent.coord.center = center;
    mapBoxComponent.coord.elevation = elevation;
    mapBoxComponent.coord.heading = heading;
    mapBoxComponent.coord.modelOrigin = modelOrigin;
    if (mapBoxComponent.map) {
      mapBoxComponent.map.flyTo({
        center: center,
        zoom: 18,
        essential: true
      });
    }
  }

  // --- Build tree ---
  async function buildTreeData(): Promise<TreeNodeData[]> {
    const roots: TreeNodeData[] = [];
    
    for (const [modelId, model] of fragments.list.entries()) {
      try {
        const spatialTree = await model.getSpatialStructure();
        if (spatialTree) {
          const rootNode = buildSpatialNode(spatialTree, model, modelId);
          if (rootNode) {
            roots.push(rootNode);
          }
        }
      } catch (err) {
        console.warn(`[Build tree] Failed for model ${modelId}:`, err);
      }
    }
    
    if (roots.length === 0) {
      const categoryClass = classifier.list.get('Categories');
      if (categoryClass && categoryClass.size > 0) {
        const children: TreeNodeData[] = [];
        for (const [name, gd] of categoryClass) {
          const map = await gd.get();
          let count = 0;
          for (const ids of Object.values(map)) count += (ids as Set<number>).size;
          children.push({
            key: `cat-${name}`,
            title: `${name} (${count})`,
            icon: 'element',
            modelIdMap: cloneModelIdMap(map),
          });
        }
        children.sort((a, b) => a.title.localeCompare(b.title));
        roots.push({ key: 'root-categories', title: `Categories (${children.length})`, icon: 'category', children });
      }
    }

    return roots;
  }

  // --- Highlight ---
  const selectStyle = {
    color: new THREE.Color(1.0, 0.6, 0.0),
    opacity: 1,
    transparent: false,
    renderedFaces: 0,
  };

  let currentHighlightMap: Record<string, Set<number>> | null = null;

  async function highlightItems(modelIdMap: Record<string, Set<number>>) {
    if (currentHighlightMap) {
      await fragments.resetHighlight(currentHighlightMap);
    }
    currentHighlightMap = modelIdMap;
    await fragments.highlight(selectStyle as any, modelIdMap);
    await fragments.core.update(true);
  }

  async function clearHighlight() {
    if (currentHighlightMap) {
      await fragments.resetHighlight(currentHighlightMap);
      await fragments.core.update(true);
      currentHighlightMap = null;
    }
  }

  // --- Visibility ---
  async function setVisibility(visible: boolean, modelIdMap?: Record<string, Set<number>>) {
    await hider.set(visible, modelIdMap);
    await fragments.core.update(true);
  }

  async function isolateItems(modelIdMap: Record<string, Set<number>>) {
    await hider.isolate(modelIdMap);
    await fragments.core.update(true);
  }

  async function showAll() {
    await hider.set(true);
    await fragments.core.update(true);
  }

  // --- Clipping ---
  function setClipperEnabled(enabled: boolean) {
    clipper.enabled = enabled;
  }

  async function createClip() {
    await clipper.create(world);
  }

  async function deleteClip() {
    await clipper.delete(world);
  }

  function deleteAllClips() {
    clipper.deleteAll();
  }

  function getClipCount() {
    return clipper.list.size;
  }

  // --- Camera ---
  async function zoomToFit() {
    const modelIds = Array.from(fragments.list.keys()).map((id) => new RegExp(`^${id}$`));
    if (modelIds.length === 0) return;
    boxer.addFromModels(modelIds);
    const box = boxer.get();
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = maxDim * 1.5;

    await world.camera.controls.setLookAt(
      center.x + dist * 0.5, center.y + dist * 0.5, center.z + dist * 0.5,
      center.x, center.y, center.z,
      true,
    );
    boxer.dispose();
  }

  function setCameraView(view: 'top' | 'front' | 'right' | 'left' | 'back' | 'perspective') {
    const d = 25;
    const t = { x: 0, y: 3, z: 0 };
    switch (view) {
      case 'top':
        world.camera.controls.setLookAt(t.x, d, t.z, t.x, t.y, t.z, true);
        break;
      case 'front':
        world.camera.controls.setLookAt(t.x, t.y, d, t.x, t.y, t.z, true);
        break;
      case 'right':
        world.camera.controls.setLookAt(d, t.y, t.z, t.x, t.y, t.z, true);
        break;
      case 'left':
        world.camera.controls.setLookAt(-d, t.y, t.z, t.x, t.y, t.z, true);
        break;
      case 'back':
        world.camera.controls.setLookAt(t.x, t.y, -d, t.x, t.y, t.z, true);
        break;
      case 'perspective':
        world.camera.controls.setLookAt(
          CAMERA_POSITION.x, CAMERA_POSITION.y, CAMERA_POSITION.z,
          CAMERA_POSITION.tx, CAMERA_POSITION.ty, CAMERA_POSITION.tz,
          true,
        );
        break;
    }
  }

  // --- Selection (click in 3D) ---
  function setupSelection(
    canvas: HTMLCanvasElement,
    onSelect: (info: SelectionInfo | null) => void,
  ): () => void {
    const casters = components.get(OBC.Raycasters);
    const caster = casters.get(world);
    let selectMap: Record<string, Set<number>> | null = null;

    async function pickElement(): Promise<{ modelId: string; localId: number } | null> {
      try {
        const hit = await caster.castRay() as any;
        if (hit && hit.localId !== undefined && hit.fragments) {
          return { modelId: hit.fragments.modelId, localId: hit.localId };
        }
      } catch { /* ignore */ }
      return null;
    }

    async function handleClick() {
      if (toolMode === 'clip') return;

      if (selectMap) {
        try {
          await fragments.resetHighlight(selectMap);
          await fragments.core.update(true);
        } catch { /* ignore */ }
        selectMap = null;
      }

      const pick = await pickElement();
      if (!pick) {
        onSelect(null);
        return;
      }

      selectMap = { [pick.modelId]: new Set([pick.localId]) };
      try {
        await fragments.highlight(selectStyle as any, selectMap);
        await fragments.core.update(true);
      } catch { /* ignore */ }

      const model = fragments.list.get(pick.modelId);
      if (!model) return;
      const info = await getElementInfo(model, pick.modelId, pick.localId, components);
      onSelect(info);
    }

    canvas.addEventListener('click', handleClick);
    return () => {
      canvas.removeEventListener('click', handleClick);
      if (selectMap) fragments.resetHighlight(selectMap).catch(() => {});
    };
  }

  return {
    components, world, fragments, ifcLoader, classifier, hider, clipper,
    dispose: () => components.dispose(),
    setupSelection, buildTreeData,
    highlightItems, clearHighlight,
    setVisibility, isolateItems, showAll,
    setClipperEnabled, createClip, deleteClip, deleteAllClips, getClipCount,
    zoomToFit, setCameraView,
    setToolMode, getToolMode,
    initMapbox, setMapboxEnabled, updateMapboxGISParameters,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cloneModelIdMap(map: Record<string, Set<number>>): Record<string, Set<number>> {
  const result: Record<string, Set<number>> = {};
  for (const [key, val] of Object.entries(map)) result[key] = new Set(val);
  return result;
}

function buildSpatialNode(
  item: any,
  model: any,
  modelId: string,
): TreeNodeData | null {
  if (!item) return null;
  
  const localId = item.localId;
  const category = item.category || '';
  
  let name = '';
  if (localId !== null && model.properties) {
    const entity = model.properties[localId];
    if (entity) {
      name = unwrap(entity.LongName) || unwrap(entity.Name) || unwrap(entity.ObjectType) || '';
    }
  }
  
  let title = '';
  const formattedCategory = formatIfcEntityName(category);
  
  if (name) {
    title = `${formattedCategory} (${name})`;
  } else {
    title = localId !== null ? `${formattedCategory} #${localId}` : formattedCategory;
  }
  
  const children: TreeNodeData[] = [];
  if (item.children) {
    for (const child of item.children) {
      const childNode = buildSpatialNode(child, model, modelId);
      if (childNode) children.push(childNode);
    }
  }
  
  const modelIdMap: Record<string, Set<number>> = {};
  if (localId !== null) {
    modelIdMap[modelId] = new Set([localId]);
  }
  
  for (const child of children) {
    if (child.modelIdMap) {
      for (const [mid, ids] of Object.entries(child.modelIdMap)) {
        if (!modelIdMap[mid]) modelIdMap[mid] = new Set();
        for (const id of ids) {
          modelIdMap[mid].add(id);
        }
      }
    }
  }
  
  let icon = 'element';
  const catUpper = category.toUpperCase();
  if (catUpper.includes('PROJECT')) icon = 'building';
  else if (catUpper.includes('SITE')) icon = 'folder';
  else if (catUpper.includes('BUILDING') && !catUpper.includes('STOREY') && !catUpper.includes('ELEMENT')) icon = 'building';
  else if (catUpper.includes('STOREY')) icon = 'storey';
  else if (catUpper.includes('MODEL')) icon = 'model';
  
  return {
    key: `spatial-${modelId}-${localId || Math.random()}-${category}`,
    title,
    icon,
    children: children.length > 0 ? children : undefined,
    modelIdMap: Object.keys(modelIdMap).length > 0 ? modelIdMap : undefined,
    modelId,
    localId: localId !== null ? localId : undefined,
  };
}

export async function getElementInfo(model: any, modelId: string, localId: number, components?: OBC.Components): Promise<SelectionInfo> {
  const attributes: Record<string, any> = {};
  const propertySets: PropertySet[] = [];
  try {
    const deepConfig = {
      attributesDefault: true,
      relationsDefault: { attributes: true, relations: true },
    };
    let itemData: any = null;

    try {
      const dataArr = await model.getItemsData([localId], deepConfig);
      if (Array.isArray(dataArr) && dataArr.length > 0) {
        itemData = dataArr[0];
      } else if (dataArr instanceof Map) {
        itemData = dataArr.get(localId);
      } else {
        itemData = dataArr;
      }
    } catch (e) {
      const dataMap = await model.getItemsData([localId]);
      itemData = dataMap?.get?.(localId) ?? (Array.isArray(dataMap) ? dataMap[0] : dataMap);
    }

    console.group(`🔍 [Props] Element ${modelId}:${localId}`);
    let clone: any = null;
    try {
      clone = JSON.parse(JSON.stringify(itemData, (_, v) => {
        if (v instanceof Set) return [...v];
        if (v instanceof Map) return Object.fromEntries(v);
        return v;
      }));
      console.log('1. CÂY DỮ LIỆU THÔ (Raw JSON Tree):', clone);
      console.log('2. CHUỖI JSON ĐẸP (Pretty JSON String):\n', JSON.stringify(clone, null, 2));
    } catch (e) {
      console.log('Raw itemData:', itemData);
    }
    console.groupEnd();

    if (itemData && typeof itemData === 'object') {
      const projectUnits = getProjectUnits(model);
      parseItemDataToSections(itemData, attributes, propertySets, projectUnits, model);

      // --- TÍNH TOÁN CÁC THÔNG SỐ HÌNH HỌC KHÔNG GIAN NHƯ BIMVISION ---
      if (components) {
        try {
          const boxer = components.get(OBC.BoundingBoxer);
          const selectMap = { [modelId]: new Set([localId]) };
          
          // Thêm await vì addFromModelIdMap là một Async function trả về Promise!
          await boxer.addFromModelIdMap(selectMap);
          const box = boxer.get();
          boxer.dispose();

          if (!box.isEmpty()) {
            const center = new THREE.Vector3();
            const size = new THREE.Vector3();
            box.getCenter(center);
            box.getSize(size);

            // Three.js mặc định là mét (m), nhân 1000 đổi sang mm như BIMVision
            const toMM = 1000;
            const round3 = (v: number) => String((v * toMM).toFixed(3));

            // Truy vấn Spatial Structure để lấy tên Project và Building cha của cấu kiện
            let projectName = '';
            let buildingName = '';
            try {
              const spatialTree = await model.getSpatialStructure();
              const path: any[] = [];
              
              function findPath(node: any, targetId: number): boolean {
                if (!node) return false;
                path.push(node);
                if (node.expressID === targetId) return true;
                if (Array.isArray(node.children)) {
                  for (const child of node.children) {
                    if (findPath(child, targetId)) return true;
                  }
                }
                path.pop();
                return false;
              }
              
              if (findPath(spatialTree, localId)) {
                const projectNode = path.find(n => n.type === 'IFCPROJECT');
                const buildingNode = path.find(n => n.type === 'IFCBUILDING');
                const parentIds: number[] = [];
                if (projectNode) parentIds.push(projectNode.expressID);
                if (buildingNode) parentIds.push(buildingNode.expressID);
                
                if (parentIds.length > 0) {
                  const parentsData = await model.getItemsData(parentIds);
                  if (parentsData) {
                    if (projectNode) {
                      const projData = parentsData.get?.(projectNode.expressID) || parentsData[0];
                      projectName = unwrap(projData?.LongName) || unwrap(projData?.Name) || '';
                    }
                    if (buildingNode) {
                      const buildData = parentsData.get?.(buildingNode.expressID) || parentsData[1] || parentsData[0];
                      buildingName = unwrap(buildData?.LongName) || unwrap(buildData?.Name) || '';
                    }
                  }
                }
              }
            } catch (spatialErr) {
              console.warn('[Spatial Parents Query] Failed:', spatialErr);
            }

            const geometryProps = [
              { name: 'Has Own Geometry', value: 'Yes' },
              { name: 'Children Have Geometry', value: 'No' },
              { name: 'Global X', value: round3(center.x), unit: 'mm' },
              { name: 'Global Y', value: round3(center.y), unit: 'mm' },
              { name: 'Global Z', value: round3(center.z), unit: 'mm' },
              { name: 'Bounding Box Length', value: round3(size.x), unit: 'mm' },
              { name: 'Bounding Box Width', value: round3(size.y), unit: 'mm' },
              { name: 'Bounding Box Height', value: round3(size.z), unit: 'mm' },
            ];

            const locationProps = [
              { name: 'Top Elevation', value: round3(box.max.z), unit: 'mm' },
              { name: 'Bottom Elevation', value: round3(box.min.z), unit: 'mm' },
              { name: 'Global Top Elevation', value: round3(box.max.z), unit: 'mm' },
              { name: 'Global Bottom Elevation', value: round3(box.min.z), unit: 'mm' },
            ];

            // 1. Gộp locationProps vào nhóm Location hiện có (nếu có), hoặc tạo mới
            let locGroup = propertySets.find(p => p.name.includes('Location') || p.name.includes('📍'));
            if (!locGroup) {
              locGroup = { name: '📍 Location', properties: [] };
              propertySets.push(locGroup);
            }
            
            // BIMVision hiển thị: Project, Building, Storey, Elevations...
            // Chúng ta chèn Project và Building lên đầu danh sách Location
            const finalLocProps: { name: string; value: string; unit?: string }[] = [];
            finalLocProps.push({ name: 'Project', value: projectName || modelId });
            if (buildingName) {
              finalLocProps.push({ name: 'Building', value: buildingName });
            }
            
            // Giữ lại các thuộc tính cũ của Location (ví dụ Storey, Elevation tầng)
            if (locGroup.properties.length > 0) {
              // Lọc bỏ trùng lặp nếu trong properties cũ đã có Project/Building
              const oldProps = locGroup.properties.filter(op => op.name !== 'Project' && op.name !== 'Building');
              finalLocProps.push(...oldProps);
            }
            
            // Thêm các thuộc tính Elevations tính toán của BIMVision
            finalLocProps.push(...locationProps);
            
            locGroup.properties = finalLocProps;

            // 2. Thêm nhóm Geometry
            propertySets.push({ name: '📐 Geometry', properties: geometryProps });

            // 3. Trích xuất Layer từ dữ liệu liên kết nếu có và thêm vào nhóm Membership
            const layerVal = unwrap(itemData.PresentationLayer) || 
                             unwrap(itemData.Layer) || 
                             (Array.isArray(itemData.PresentationLayers) && itemData.PresentationLayers[0] ? unwrap(itemData.PresentationLayers[0].Name) : null);
            if (layerVal) {
              propertySets.push({
                name: '👥 Membership',
                properties: [{ name: 'Layer', value: String(layerVal) }]
              });
            }
          }
        } catch (bboxErr) {
          console.warn('[BBox Calc] Failed to compute geometry metrics:', bboxErr);
        }
      }

      // In thêm bảng thuộc tính đã được parser gom nhóm để dễ đối chiếu
      console.groupCollapsed(`📋 Các nhóm thuộc tính đã Parse (${propertySets.length})`);
      propertySets.forEach(pset => {
        console.group(`Nhóm: ${pset.name}`);
        console.table(pset.properties);
        console.groupEnd();
      });
      console.groupEnd();
    }
  } catch (err) {
    console.warn('[Props] getItemsData failed:', err);
  }

  if (Object.keys(attributes).length > 0) {
    const props: { name: string; value: string; unit?: string }[] = Object.entries(attributes)
      .filter(([k]) => !k.startsWith('_'))
      .map(([n, v]) => {
        let unit: string | undefined = undefined;
        if (n === 'Elevation') unit = 'mm';
        return { name: n, value: String(v), unit };
      });

    // 1. Thêm Guid (lấy từ GlobalId hoặc GlobalID)
    const guidVal = attributes.GlobalId || attributes.GlobalID || attributes._guid;
    if (guidVal && !props.some(p => p.name === 'Guid')) {
      props.push({ name: 'Guid', value: String(guidVal) });
    }

    // 2. Thêm IfcEntity (lấy từ _category hoặc type)
    const entityVal = attributes._category || attributes._type || attributes.type;
    if (entityVal && !props.some(p => p.name === 'IfcEntity')) {
      props.push({ name: 'IfcEntity', value: formatIfcEntityName(String(entityVal)) });
    }

    // 3. Sắp xếp lại theo đúng thứ tự BIMVision
    props.sort((a, b) => {
      const order = ['Guid', 'IfcEntity', 'Name', 'ObjectType', 'PredefinedType', 'Tag'];
      const idxA = order.indexOf(a.name);
      const idxB = order.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });

    if (props.length > 0) propertySets.unshift({ name: 'Element Specific', properties: props });
  }
  return { modelId, localId, attributes, propertySets };
}

function formatIfcEntityName(rawName: string): string {
  let entity = rawName.toUpperCase();
  if (!entity.startsWith('IFC')) {
    entity = 'IFC' + entity;
  }
  const mapping: Record<string, string> = {
    'IFCBUILDINGELEMENTPROXY': 'IfcBuildingElementProxy',
    'IFCWALLSTANDARDCASE': 'IfcWallStandardCase',
    'IFCWALL': 'IfcWall',
    'IFCSLAB': 'IfcSlab',
    'IFCBEAM': 'IfcBeam',
    'IFCCOLUMN': 'IfcColumn',
    'IFCFOOTING': 'IfcFooting',
    'IFCPILE': 'IfcPile',
    'IFCMEMBER': 'IfcMember',
    'IFCPLATE': 'IfcPlate',
    'IFCRAILING': 'IfcRailing',
    'IFCSYSTEM': 'IfcSystem',
    'IFCZONE': 'IfcZone',
    'IFCGROUP': 'IfcGroup',
    'IFCDOOR': 'IfcDoor',
    'IFCWINDOW': 'IfcWindow',
    'IFCDISTRIBUTIONELEMENT': 'IfcDistributionElement',
    'IFCFLOWTERMINAL': 'IfcFlowTerminal',
    'IFCBUILDINGSTOREY': 'IfcBuildingStorey',
    'IFCBUILDING': 'IfcBuilding',
    'IFCSITE': 'IfcSite',
    'IFCPROJECT': 'IfcProject',
  };
  if (mapping[entity]) return mapping[entity];
  let word = entity.slice(3).toLowerCase();
  const subWords = [
    'standard', 'case', 'element', 'proxy', 'storey', 'building', 'distribution', 'port',
    'fitting', 'segment', 'terminal', 'control', 'treatment', 'chamber', 'harness',
    'compressor', 'condenser', 'evaporator', 'burner', 'boiler', 'chiller', 'coil',
    'fan', 'pump', 'valve', 'damper', 'actuator', 'sensor', 'controller', 'alarm',
    'tank', 'filter', 'interceptor', 'electric', 'generator', 'motor', 'transformer',
    'junction', 'protector', 'cable', 'conductor', 'lamp', 'outlet', 'switch',
    'light', 'fixture', 'communication', 'appliance', 'audio', 'video',
    'transport', 'elevator', 'escalator', 'moving', 'walkway', 'furnishing',
    'system', 'furniture', 'common', 'shared', 'property', 'quantity', 'geometry',
    'structural', 'member', 'connection', 'point', 'curve', 'surface', 'solid',
    'representation', 'placement', 'coordinate', 'reference', 'classification',
    'material', 'layer', 'constituent', 'profile', 'arbitrary', 'derived', 'composite'
  ];
  let formatted = 'Ifc';
  let temp = word;
  while (temp.length > 0) {
    let matched = false;
    for (const sub of subWords) {
      if (temp.startsWith(sub)) {
        formatted += sub.charAt(0).toUpperCase() + sub.slice(1);
        temp = temp.slice(sub.length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      formatted += temp.charAt(0).toUpperCase() + temp.slice(1);
      break;
    }
  }
  return formatted;
}

interface ProjectUnits {
  length: string;
  area: string;
  volume: string;
}

function parseUnitEntity(unitEntity: any, model?: any): string | undefined {
  if (!unitEntity) return undefined;
  
  const typeName = String(unwrap(unitEntity._category) || unwrap(unitEntity.type) || '').toUpperCase();
  
  if (typeName.includes('SIUNIT')) {
    const name = String(unwrap(unitEntity.Name) || '').toUpperCase().replace(/\./g, '');
    const prefix = String(unwrap(unitEntity.Prefix) || '').toUpperCase().replace(/\./g, '');
    
    if (name === 'METRE') {
      if (prefix === 'MILLI') return 'mm';
      if (prefix === 'CENTI') return 'cm';
      if (prefix === 'DECI') return 'dm';
      return 'm';
    }
    if (name === 'SQUARE_METRE') return 'm2';
    if (name === 'CUBIC_METRE') return 'm3';
    if (name === 'GRAM' || name === 'KILOGRAM') return 'kg';
    if (name === 'SECOND') return 's';
    if (name === 'RADIAN') return 'rad';
    if (name === 'NEWTON') return 'N';
    if (name === 'PASCAL') return 'Pa';
    
    return (prefix && prefix !== 'NONE' ? prefix.toLowerCase() : '') + name.toLowerCase();
  }
  
  if (typeName.includes('CONVERSIONBASEDUNIT')) {
    const name = unwrap(unitEntity.Name);
    if (name) return String(name);
  }
  
  return undefined;
}

function getProjectUnits(model: any): ProjectUnits {
  const units: ProjectUnits = { length: 'mm', area: 'm2', volume: 'm3' };
  if (!model || !model.properties) return units;
  
  let unitAssignment: any = null;
  for (const entity of Object.values(model.properties) as any[]) {
    const category = String(entity._category || entity.type || '').toUpperCase();
    if (category === 'IFCUNITASSIGNMENT') {
      unitAssignment = entity;
      break;
    }
  }
  
  if (unitAssignment && Array.isArray(unitAssignment.Units)) {
    for (const unitRef of unitAssignment.Units) {
      const unitId = unwrap(unitRef);
      if (!unitId) continue;
      
      const unitEntity = model.properties[unitId];
      if (!unitEntity) continue;
      
      const unitType = String(unwrap(unitEntity.UnitType) || '').toUpperCase().replace(/\./g, '');
      const parsed = parseUnitEntity(unitEntity, model);
      if (parsed) {
        if (unitType === 'LENGTHUNIT') {
          units.length = parsed;
        } else if (unitType === 'AREAUNIT') {
          units.area = parsed;
        } else if (unitType === 'VOLUMEUNIT') {
          units.volume = parsed;
        }
      }
    }
  }
  return units;
}

function getUnitOfProperty(prop: any, name: string, projectUnits?: ProjectUnits, model?: any): string | undefined {
  const directUnit = unwrap(prop.Unit);
  if (directUnit) {
    if (typeof directUnit === 'number' && model && model.properties) {
      const unitEntity = model.properties[directUnit];
      if (unitEntity) {
        const parsed = parseUnitEntity(unitEntity, model);
        if (parsed) return parsed;
      }
    } else if (typeof directUnit === 'object') {
      const parsed = parseUnitEntity(directUnit, model);
      if (parsed) return parsed;
    }
  }
  
  const nomVal = prop.NominalValue;
  if (nomVal && typeof nomVal === 'object') {
    const typeLabel = String(nomVal.label || nomVal.type || '').toUpperCase();
    if (typeLabel.includes('LENGTH') || typeLabel.includes('LINEAR')) {
      return projectUnits?.length ?? 'mm';
    }
    if (typeLabel.includes('AREA')) {
      return projectUnits?.area ?? 'm2';
    }
    if (typeLabel.includes('VOLUME')) {
      return projectUnits?.volume ?? 'm3';
    }
  }
  
  const cleanName = name.toLowerCase().trim();
  
  if (cleanName.includes('volume') || cleanName.includes('thể tích') || cleanName.includes('the tich') || 
      cleanName.includes('khối lượng') || cleanName.includes('khoi luong') || cleanName.includes('khoiluong')) {
    return projectUnits?.volume ?? 'm3';
  }
  
  if (cleanName.includes('area') || cleanName.includes('diện tích') || cleanName.includes('dien tich') || cleanName.includes('dientich')) {
    return projectUnits?.area ?? 'm2';
  }
  
  if (cleanName.includes('width') || cleanName.includes('height') || cleanName.includes('length') || 
      cleanName.includes('thickness') || cleanName.includes('depth') || cleanName.includes('radius') || 
      cleanName.includes('elevation') || cleanName.includes('offset') || cleanName.includes('size') ||
      cleanName.includes('cao độ') || cleanName.includes('cao do') || cleanName.includes('kích thước') || cleanName.includes('kich thuoc') ||
      /^tru_/i.test(cleanName) || 
      /^be_/i.test(cleanName) || 
      /^a\d+/i.test(cleanName) || 
      /_h$/i.test(cleanName) || /_w$/i.test(cleanName) || /_l$/i.test(cleanName) || /_d$/i.test(cleanName) || /_r$/i.test(cleanName)
  ) {
    const val = Number(unwrap(prop.NominalValue) ?? unwrap(prop.Value) ?? 0);
    if (Math.abs(val) > 1 || val === 0 || isNaN(val)) {
      return projectUnits?.length ?? 'mm';
    }
  }
  
  return undefined;
}

function unwrap(val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && val.value !== undefined) return val.value;
  if (typeof val !== 'object') return val;
  return null;
}

function addUnwrapped(props: { name: string; value: string; unit?: string }[], obj: any, keys: string[]) {
  for (const k of keys) {
    const v = unwrap(obj[k]);
    if (v !== null && v !== undefined && v !== '') {
      let unit: string | undefined = undefined;
      if (['OverallWidth', 'OverallDepth', 'WebThickness', 'FlangeThickness', 'FilletRadius', 'Width', 'Depth', 'Radius', 'Thickness', 'Elevation'].includes(k)) {
        unit = 'mm';
      }
      props.push({ name: k, value: String(v), unit });
    }
  }
}

function parseItemDataToSections(
  data: Record<string, any>,
  attributes: Record<string, any>,
  propertySets: PropertySet[],
  projectUnits?: ProjectUnits,
  model?: any,
) {
  if (!data || typeof data !== 'object') return;

  for (const [key, val] of Object.entries(data)) {
    if (val === null || val === undefined) continue;
    if (Array.isArray(val)) continue;
    if (typeof val !== 'object') {
      attributes[key] = val;
    } else if (val.value !== undefined) {
      attributes[key] = val.value;
    }
  }

  const associations = data.HasAssociations;
  if (Array.isArray(associations)) {
    for (const assoc of associations) {
      if (!assoc || typeof assoc !== 'object') continue;
      const cat = unwrap(assoc._category);
      if (cat === 'IFCMATERIAL' || cat === 'IFCMATERIALLAYERSETUSAGE' || cat === 'IFCMATERIALLAYERSET' || cat === 'IFCMATERIALCONSTITUENTSET') {
        const materialProps: { name: string; value: string; unit?: string }[] = [];
        const matName = unwrap(assoc.Name);
        if (matName) materialProps.push({ name: 'Name', value: matName });
        const matDesc = unwrap(assoc.Description);
        if (matDesc) materialProps.push({ name: 'Description', value: matDesc });
        materialProps.push({ name: 'Type', value: cat.replace('IFC', '') });
        const matLocalId = unwrap(assoc._localId);
        if (matLocalId) materialProps.push({ name: 'LocalId', value: String(matLocalId) });

        if (Array.isArray(assoc.MaterialLayers)) {
          for (let i = 0; i < assoc.MaterialLayers.length; i++) {
            const layer = assoc.MaterialLayers[i];
            if (!layer) continue;
            const layerName = unwrap(layer.Name) || unwrap(layer.Material?.Name) || `Layer ${i + 1}`;
            const thickness = unwrap(layer.LayerThickness);
            if (layerName) materialProps.push({ name: `Layer[${i}]`, value: layerName });
            if (thickness) materialProps.push({ name: `Layer[${i}].Thickness`, value: String(thickness), unit: 'mm' });
          }
        }
        if (Array.isArray(assoc.MaterialConstituents)) {
          for (let i = 0; i < assoc.MaterialConstituents.length; i++) {
            const c = assoc.MaterialConstituents[i];
            if (!c) continue;
            const cName = unwrap(c.Name) || `Constituent ${i + 1}`;
            materialProps.push({ name: `Constituent[${i}]`, value: cName });
          }
        }

        if (materialProps.length > 0) {
          propertySets.push({ name: '🧱 Material', properties: materialProps });
        }
      } else if (cat === 'IFCCLASSIFICATIONREFERENCE' || cat === 'IFCCLASSIFICATION') {
        const classProps: { name: string; value: string; unit?: string }[] = [];
        addUnwrapped(classProps, assoc, ['Name', 'Description', 'ItemReference', 'Location', 'Identification']);
        if (classProps.length > 0) {
          propertySets.push({ name: '🏷️ Classification', properties: classProps });
        }
      }
    }
  }

  const definedBy = data.IsDefinedBy;
  if (Array.isArray(definedBy)) {
    for (const rel of definedBy) {
      if (!rel || typeof rel !== 'object') continue;
      const relCat = unwrap(rel._category);
      const relName = unwrap(rel.Name) || relCat || 'Properties';

      let displayName = relName;
      if (relName.startsWith('Pset_')) displayName = `📋 ${relName}`;
      else if (relName.startsWith('Qto_')) displayName = `📐 ${relName}`;
      else if (relCat === 'IFCPROPERTYSET') displayName = `📋 ${relName}`;
      else if (relCat === 'IFCELEMENTQUANTITY') displayName = `📐 ${relName}`;

      const psetProps: { name: string; value: string; unit?: string }[] = [];

      if (Array.isArray(rel.HasProperties)) {
        for (const prop of rel.HasProperties) {
          if (!prop || typeof prop !== 'object') continue;
          const propName = unwrap(prop.Name) || 'Unknown';
          const propValue = unwrap(prop.NominalValue) ?? unwrap(prop.Value) ?? '';
          const unit = getUnitOfProperty(prop, propName, projectUnits, model);
          psetProps.push({ name: propName, value: String(propValue), unit });
        }
      }

      if (Array.isArray(rel.Quantities)) {
        for (const q of rel.Quantities) {
          if (!q || typeof q !== 'object') continue;
          const qName = unwrap(q.Name) || 'Unknown';
          const qVal = unwrap(q.LengthValue) ?? unwrap(q.AreaValue) ??
                       unwrap(q.VolumeValue) ?? unwrap(q.WeightValue) ??
                       unwrap(q.CountValue) ?? unwrap(q.Value) ?? '';
          const qCat = unwrap(q._category) || '';
          let unit = '';
          if (qCat.includes('LENGTH')) unit = 'mm';
          else if (qCat.includes('AREA')) unit = 'm2';
          else if (qCat.includes('VOLUME')) unit = 'm3';
          else if (qCat.includes('WEIGHT')) unit = 'kg';
          psetProps.push({ name: qName, value: String(qVal), unit: unit || undefined });
        }
      }

      if (rel.Profile || relName.includes('Profile') || relCat === 'IFCISHAPEPROFILEDEF' ||
          relCat === 'IFCRECTANGLEPROFILEDEF' || relCat === 'IFCCIRCLEPROFILEDEF') {
        const profile = rel.Profile || rel;
        addUnwrapped(psetProps, profile, [
          'ProfileName', 'ProfileType',
          'OverallWidth', 'OverallDepth', 'WebThickness', 'FlangeThickness', 'FilletRadius',
          'Width', 'Depth', 'Radius',
          'TopFlangeWidth', 'BottomFlangeWidth',
          'TopFlangeThickness', 'BottomFlangeThickness',
        ]);
        if (!displayName.includes('Profile') && psetProps.some(p =>
          ['OverallWidth', 'OverallDepth', 'WebThickness', 'FilletRadius', 'Radius'].includes(p.name)
        )) {
          displayName = `📏 Profile`;
        }
      }

      if (psetProps.length === 0) {
        for (const [k, v] of Object.entries(rel)) {
          if (k.startsWith('_') || k === 'AssociatedTo' || k === 'RelatedObjects') continue;
          const uv = unwrap(v);
          if (uv !== null && uv !== undefined && typeof uv !== 'object') {
            psetProps.push({ name: k, value: String(uv) });
          }
        }
      }

      if (psetProps.length > 0) {
        propertySets.push({ name: displayName, properties: psetProps });
      }
    }
  }

  const containedIn = data.ContainedInStructure;
  if (Array.isArray(containedIn)) {
    const locProps: { name: string; value: string; unit?: string }[] = [];
    for (const struct of containedIn) {
      if (!struct || typeof struct !== 'object') continue;
      const structCat = unwrap(struct._category) || '';
      const structName = unwrap(struct.Name) || unwrap(struct.LongName) || '';
      if (structCat.includes('STOREY')) {
        locProps.push({ name: 'Storey', value: structName });
        const elevation = unwrap(struct.Elevation);
        if (elevation !== null && elevation !== undefined) {
          locProps.push({ name: 'Elevation', value: String(elevation), unit: 'mm' });
        }
      } else if (structCat.includes('BUILDING')) {
        locProps.push({ name: 'Building', value: structName });
      } else if (structCat.includes('SITE')) {
        locProps.push({ name: 'Site', value: structName });
      } else if (structName) {
        locProps.push({ name: structCat.replace('IFC', ''), value: structName });
      }
    }
    if (locProps.length > 0) {
      propertySets.push({ name: '📍 Location', properties: locProps });
    }
  }

  const typedBy = data.IsTypedBy;
  if (Array.isArray(typedBy)) {
    for (const typeRel of typedBy) {
      if (!typeRel || typeof typeRel !== 'object') continue;
      const typeProps: { name: string; value: string; unit?: string }[] = [];
      addUnwrapped(typeProps, typeRel, ['Name', 'Description', 'Tag', 'ElementType', 'PredefinedType']);
      const typeCat = unwrap(typeRel._category);
      if (typeCat) typeProps.push({ name: 'TypeCategory', value: typeCat.replace('IFC', '') });
      if (typeProps.length > 0) {
        propertySets.push({ name: '🔧 Type', properties: typeProps });
      }
    }
  }
}

export async function loadIfcFile(
  engine: BimEngine,
  file: File,
  onStatus?: (msg: string) => void,
): Promise<string> {
  onStatus?.(`Loading: ${file.name}...`);
  const buf = await file.arrayBuffer();
  const modelId = file.name.replace(/\.ifc$/i, '');
  await engine.ifcLoader.load(new Uint8Array(buf), true, modelId, {
    processData: {
      progressCallback: (p: number) => {
        onStatus?.(`Loading: ${file.name} (${Math.round(p * 100)}%)`);
      },
    },
  });
  onStatus?.('Classifying...');
  await engine.classifier.byIfcBuildingStorey();
  await engine.classifier.byCategory();
  await engine.classifier.byModel();
  onStatus?.(`Loaded: ${modelId}`);
  return modelId;
}
