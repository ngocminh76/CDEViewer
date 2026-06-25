import fs from 'fs';

// Helper to format category names like IfcWallStandardCase -> Wall Standard Case
function formatIfcEntityName(raw) {
  if (!raw) return '';
  let name = raw.replace(/^Ifc/i, '');
  // Insert spaces before capital letters
  name = name.replace(/([A-Z])/g, ' $1').trim();
  return name;
}

function getPluralCategoryName(rawCategory) {
  let formatted = formatIfcEntityName(rawCategory);
  if (formatted.endsWith('y')) {
    return formatted.slice(0, -1) + 'ies';
  }
  if (formatted.endsWith('s') || formatted.endsWith('x') || formatted.endsWith('ch') || formatted.endsWith('sh')) {
    return formatted + 'es';
  }
  return formatted + 's';
}

// Clean spatial tree to prune duplicates and relationship wrapper nodes
function cleanSpatialTree(node) {
  if (!node) return null;
  
  const localId = node.expressID ?? node.localId;

  if (Array.isArray(node.children)) {
    const newChildren = [];
    for (const child of node.children) {
      const childId = child.expressID ?? child.localId;
      const childCat = (child.type || child.Type || child.category || '').toUpperCase();
      
      const isDuplicate = (childId !== undefined && childId !== null && childId === localId);
      const isRelation = childCat.startsWith('IFCREL') || childCat === 'IFCUNKNOWN' || !childCat;
      
      if (isDuplicate || isRelation) {
        if (Array.isArray(child.children)) {
          for (const gchild of child.children) {
            const processed = cleanSpatialTree(gchild);
            if (processed) newChildren.push(processed);
          }
        }
      } else {
        const processed = cleanSpatialTree(child);
        if (processed) newChildren.push(processed);
      }
    }
    node.children = newChildren;
  }
  return node;
}

// 2. hasGeometry from engine.ts
function hasGeometry(node, expressIds) {
  if (!node) return false;
  const localId = (node.expressID !== undefined && node.expressID !== null)
    ? node.expressID
    : ((node.localId !== undefined && node.localId !== null) ? node.localId : null);
  if (localId !== null && expressIds.has(localId)) {
    return true;
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (hasGeometry(child, expressIds)) return true;
    }
  }
  return false;
}

// Mock unwrap
function unwrap(val) {
  if (val && typeof val === 'object' && 'value' in val) return val.value;
  return val;
}

// 3. buildSpatialNode from engine.ts
function buildSpatialNode(item, model, modelId, modelExpressIDs) {
  if (!item) return null;
  
  const localId = (item.expressID !== undefined && item.expressID !== null)
    ? item.expressID
    : ((item.localId !== undefined && item.localId !== null) ? item.localId : null);

  const category = item.type || item.Type || item.category || '';
  const catUpper = category.toUpperCase();
  
  let name = '';
  let description = '';
  if (localId !== null && model.properties) {
    const entity = model.properties[localId];
    if (entity) {
      name = unwrap(entity.LongName) || unwrap(entity.Name) || unwrap(entity.ObjectType) || '';
      description = unwrap(entity.Description) || '';
    }
  }
  
  let title = '';
  const formattedCategory = formatIfcEntityName(category);
  
  if (name) {
    title = name;
  } else {
    title = localId !== null ? `#${localId}` : formattedCategory;
  }
  
  const children = [];
  
  if (item.children) {
    const isSpatial = catUpper === 'IFCPROJECT' || catUpper === 'IFCSITE' || catUpper === 'IFCBUILDING' || catUpper === 'IFCBUILDINGSTOREY' || catUpper === 'IFCSPACE' || catUpper === '';
    
    if (isSpatial) {
      const spatialChildren = [];
      const physicalChildren = [];
      
      for (const child of item.children) {
        const childCat = String(child.type || child.Type || child.category || '').toUpperCase();
        if (childCat === 'IFCPROJECT' || childCat === 'IFCSITE' || childCat === 'IFCBUILDING' || childCat === 'IFCBUILDINGSTOREY' || childCat === 'IFCSPACE') {
          spatialChildren.push(child);
        } else {
          if (hasGeometry(child, modelExpressIDs)) {
            physicalChildren.push(child);
          }
        }
      }
      
      for (const child of spatialChildren) {
        const childNode = buildSpatialNode(child, model, modelId, modelExpressIDs);
        if (childNode) children.push(childNode);
      }
      
      if (physicalChildren.length > 0) {
        const groups = new Map();
        for (const child of physicalChildren) {
          const cat = child.type || child.Type || child.category || 'Unknown';
          if (!groups.has(cat)) groups.set(cat, []);
          groups.get(cat).push(child);
        }
        
        for (const [cat, items] of groups.entries()) {
          const folderChildren = [];
          for (const child of items) {
            const childNode = buildSpatialNode(child, model, modelId, modelExpressIDs);
            if (childNode) folderChildren.push(childNode);
          }
          
          const pluralCategory = getPluralCategoryName(cat);
          const folderModelIdMap = {};
          for (const childNode of folderChildren) {
            if (childNode.modelIdMap) {
              for (const [mid, ids] of Object.entries(childNode.modelIdMap)) {
                if (!folderModelIdMap[mid]) folderModelIdMap[mid] = new Set();
                for (const id of ids) folderModelIdMap[mid].add(id);
              }
            }
          }
          
          // Convert Sets to arrays for JSON serialization
          const serializableMap = {};
          for (const [mid, ids] of Object.entries(folderModelIdMap)) {
            serializableMap[mid] = Array.from(ids);
          }
          
          children.push({
            key: `group-folder-${modelId}-${cat}-${Math.random()}`,
            title: pluralCategory,
            icon: 'category',
            children: folderChildren,
            modelIdMap: Object.keys(serializableMap).length > 0 ? serializableMap : undefined,
            rawCategory: pluralCategory,
            rawName: '',
          });
        }
      }
    } else {
      // Non-spatial elements: list all child items directly
      for (const child of item.children) {
        const childNode = buildSpatialNode(child, model, modelId, modelExpressIDs);
        if (childNode) children.push(childNode);
      }
    }
  }
  
  const modelIdMap = {};
  if (localId !== null) {
    modelIdMap[modelId] = new Set([localId]);
  }
  
  for (const child of children) {
    if (child.modelIdMap) {
      const childMap = child.modelIdMap;
      for (const [mid, ids] of Object.entries(childMap)) {
        if (!modelIdMap[mid]) modelIdMap[mid] = new Set();
        const idsSet = ids instanceof Set ? ids : new Set(ids);
        for (const id of idsSet) modelIdMap[mid].add(id);
      }
    }
  }
  
  let icon = 'element';
  if (catUpper.includes('PROJECT')) icon = 'building';
  else if (catUpper.includes('SITE')) icon = 'folder';
  else if (catUpper.includes('BUILDING') && !catUpper.includes('STOREY') && !catUpper.includes('ELEMENT')) icon = 'building';
  else if (catUpper.includes('STOREY')) icon = 'storey';
  
  // Convert modelIdMap sets to arrays for serialization
  const serializableMap = {};
  for (const [mid, ids] of Object.entries(modelIdMap)) {
    serializableMap[mid] = Array.from(ids);
  }
  
  return {
    key: `spatial-${modelId}-${localId || Math.random()}-${category}`,
    title,
    icon,
    children: children.length > 0 ? children : undefined,
    modelIdMap: Object.keys(serializableMap).length > 0 ? serializableMap : undefined,
    modelId,
    localId: localId !== null ? localId : undefined,
    rawCategory: formattedCategory.replace(/^Ifc/, ''),
    rawName: name,
    description: description || undefined,
  };
}

// 4. Run test
async function run() {
  console.log("Loading spatial structure JSON...");
  const rawTree = JSON.parse(fs.readFileSync('scratch/spatial_structure.json', 'utf8'));
  
  // Let's collect all express IDs from the tree to mock modelExpressIDs
  const modelExpressIDs = new Set();
  function collectIDs(node) {
    if (node) {
      const id = node.expressID ?? node.localId;
      // Mock: treat columns, slabs, etc. as having geometry
      const type = (node.type || node.Type || node.category || '').toUpperCase();
      if (id !== undefined && id !== null && !type.includes('PROJECT') && !type.includes('SITE') && !type.includes('BUILDING') && !type.includes('STOREY')) {
        modelExpressIDs.add(id);
      }
      if (Array.isArray(node.children)) {
        for (const c of node.children) collectIDs(c);
      }
    }
  }
  collectIDs(rawTree);
  console.log(`Collected ${modelExpressIDs.size} potential physical element IDs.`);
  
  // Mock model properties
  const model = {
    properties: {} // empty properties for simplicity
  };
  
  console.log("Flattening tree...");
  // Clone rawTree to prevent in-place modification of raw file
  const treeClone = JSON.parse(JSON.stringify(rawTree));
  const flattened = cleanSpatialTree(treeClone);
  
  console.log("Building spatial nodes...");
  const rootNode = buildSpatialNode(flattened, model, 'SF3DSENDAI', modelExpressIDs);
  
  console.log("Writing built tree to scratch/output_tree.json...");
  fs.writeFileSync('scratch/output_tree.json', JSON.stringify(rootNode, null, 2));
  console.log("Done!");
}

run().catch(console.error);
