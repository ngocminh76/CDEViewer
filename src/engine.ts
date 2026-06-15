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
  properties: { name: string; value: string }[];
}

export interface TreeNodeData {
  key: string;
  title: string;
  icon?: string;
  children?: TreeNodeData[];
  modelIdMap?: Record<string, Set<number>>;
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
  updateMapboxGISParameters: (center: [number, number], elevation: number, heading: number) => void;

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
      }
      mapBoxComponent.onResize();
      updateMapboxGISParameters(mapBoxComponent.coord.center, mapBoxComponent.coord.elevation, mapBoxComponent.coord.heading);
    } else {
      // Move all loaded fragments/models back to local scene
      for (const group of fragments.list.values()) {
        world.scene.three.add(group.object);
      }
    }
  }

  function updateMapboxGISParameters(center: [number, number], elevation: number, heading: number) {
    mapBoxComponent.coord.center = center;
    mapBoxComponent.coord.elevation = elevation;
    mapBoxComponent.coord.heading = heading;
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

    const storeyClass = classifier.list.get('Storeys');
    if (storeyClass && storeyClass.size > 0) {
      const children: TreeNodeData[] = [];
      for (const [name, gd] of storeyClass) {
        const map = await gd.get();
        children.push({
          key: `storey-${name}`,
          title: name || 'Unnamed Storey',
          icon: 'storey',
          modelIdMap: cloneModelIdMap(map),
        });
      }
      roots.push({ key: 'root-storeys', title: `Storeys (${children.length})`, icon: 'building', children });
    }

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

    const modelClass = classifier.list.get('Models');
    if (modelClass && modelClass.size > 0) {
      const children: TreeNodeData[] = [];
      for (const [name, gd] of modelClass) {
        const map = await gd.get();
        children.push({
          key: `model-${name}`,
          title: name || 'Unnamed Model',
          icon: 'model',
          modelIdMap: cloneModelIdMap(map),
        });
      }
      roots.push({ key: 'root-models', title: `Models (${children.length})`, icon: 'folder', children });
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
      const info = await getElementInfo(model, pick.modelId, pick.localId);
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

async function getElementInfo(model: any, modelId: string, localId: number): Promise<SelectionInfo> {
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
    try {
      const clone = JSON.parse(JSON.stringify(itemData, (_, v) => {
        if (v instanceof Set) return [...v];
        if (v instanceof Map) return Object.fromEntries(v);
        return v;
      }));
      console.log('FULL DATA TREE:', clone);
    } catch (e) { console.log('Raw itemData:', itemData); }
    console.groupEnd();

    if (itemData && typeof itemData === 'object') {
      parseItemDataToSections(itemData, attributes, propertySets);
    }
  } catch (err) {
    console.warn('[Props] getItemsData failed:', err);
  }

  if (Object.keys(attributes).length > 0) {
    const props = Object.entries(attributes)
      .filter(([k]) => !k.startsWith('_'))
      .map(([n, v]) => ({ name: n, value: String(v) }));
    if (props.length > 0) propertySets.unshift({ name: 'Element Specific', properties: props });
  }
  return { modelId, localId, attributes, propertySets };
}

function unwrap(val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && val.value !== undefined) return val.value;
  if (typeof val !== 'object') return val;
  return null;
}

function addUnwrapped(props: { name: string; value: string }[], obj: any, keys: string[]) {
  for (const k of keys) {
    const v = unwrap(obj[k]);
    if (v !== null && v !== undefined && v !== '') {
      props.push({ name: k, value: String(v) });
    }
  }
}

function parseItemDataToSections(
  data: Record<string, any>,
  attributes: Record<string, any>,
  propertySets: PropertySet[],
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
        const materialProps: { name: string; value: string }[] = [];
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
            if (thickness) materialProps.push({ name: `Layer[${i}].Thickness`, value: String(thickness) });
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
        const classProps: { name: string; value: string }[] = [];
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

      const psetProps: { name: string; value: string }[] = [];

      if (Array.isArray(rel.HasProperties)) {
        for (const prop of rel.HasProperties) {
          if (!prop || typeof prop !== 'object') continue;
          const propName = unwrap(prop.Name) || 'Unknown';
          const propValue = unwrap(prop.NominalValue) ?? unwrap(prop.Value) ?? '';
          const unit = unwrap(prop.Unit);
          const valStr = unit ? `${propValue} ${unit}` : String(propValue);
          psetProps.push({ name: propName, value: valStr });
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
          else if (qCat.includes('AREA')) unit = 'm²';
          else if (qCat.includes('VOLUME')) unit = 'm³';
          else if (qCat.includes('WEIGHT')) unit = 'kg';
          psetProps.push({ name: qName, value: unit ? `${qVal} ${unit}` : String(qVal) });
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
    const locProps: { name: string; value: string }[] = [];
    for (const struct of containedIn) {
      if (!struct || typeof struct !== 'object') continue;
      const structCat = unwrap(struct._category) || '';
      const structName = unwrap(struct.Name) || unwrap(struct.LongName) || '';
      if (structCat.includes('STOREY')) {
        locProps.push({ name: 'Storey', value: structName });
        const elevation = unwrap(struct.Elevation);
        if (elevation !== null && elevation !== undefined) locProps.push({ name: 'Elevation', value: `${elevation} mm` });
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
      const typeProps: { name: string; value: string }[] = [];
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
