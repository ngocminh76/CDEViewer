import fs from 'fs';
import WebIFC from 'web-ifc';

async function run() {
  console.log("Initializing WebIFC...");
  const ifcAPI = new WebIFC.IfcAPI();
  await ifcAPI.Init();
  
  console.log("Reading IFC file...");
  const fileBuffer = fs.readFileSync('public/models/SF3DSENDAI.ifc');
  
  console.log("Opening model...");
  const modelID = ifcAPI.OpenModel(new Uint8Array(fileBuffer));
  
  console.log("Getting spatial structure...");
  const spatialTree = await ifcAPI.properties.getSpatialStructure(modelID);
  
  console.log("Writing spatial tree to scratch/spatial_structure.json...");
  fs.writeFileSync('scratch/spatial_structure.json', JSON.stringify(spatialTree, null, 2));
  console.log("Done!");
  
  ifcAPI.CloseModel(modelID);
  process.exit(0);
}

run().catch(err => {
  console.error("Error:", err);
  process.exit(1);
});
