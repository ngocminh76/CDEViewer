import fs from 'fs';

const data = JSON.parse(fs.readFileSync('scratch/spatial_structure.json', 'utf8'));

function inspect(node, indent = 0) {
  const localId = node.expressID ?? node.localId;
  const category = node.type || node.Type || node.category || '';
  const name = node.Name?.value || node.name || '';
  const prefix = ' '.repeat(indent);
  const numChildren = Array.isArray(node.children) ? node.children.length : 0;
  console.log(`${prefix}- ID: ${localId}, Cat: ${category}, Name: ${name}, Children: ${numChildren}`);
  
  if (Array.isArray(node.children)) {
    // Only go deeper if it's spatial or relation, or first few children of non-spatial to see them
    const isSpatial = ['IFCPROJECT', 'IFCSITE', 'IFCBUILDING', 'IFCBUILDINGSTOREY'].includes(category.toUpperCase());
    if (isSpatial || category.toUpperCase().startsWith('IFCREL') || category === '') {
      for (const child of node.children.slice(0, 10)) {
        inspect(child, indent + 2);
      }
      if (node.children.length > 10) {
        console.log(`${prefix}  ... and ${node.children.length - 10} more children`);
      }
    } else {
      // Non-spatial: print just counts and maybe the first child
      if (node.children.length > 0) {
        console.log(`${prefix}  [Non-spatial Children sample]:`);
        inspect(node.children[0], indent + 4);
      }
    }
  }
}

inspect(data);
