import * as OBC from '@thatopen/components';
import * as THREE from 'three';
import { WASM_CONFIG, WORKER_URL } from './config.ts';

import { MapBoxComponent } from './components/MapBoxComponent/index.ts';

// ---------------------------------------------------------------------------
// Setup FragmentsManager + IfcLoader (pattern tái sử dụng)
// ---------------------------------------------------------------------------

export async function setupFragments(
  components: OBC.Components,
  world: OBC.SimpleWorld<OBC.SimpleScene, any, OBC.SimpleRenderer>,
): Promise<OBC.FragmentsManager> {
  const fetchedUrl = await fetch(WORKER_URL);
  const workerBlob = await fetchedUrl.blob();
  const workerFile = new File([workerBlob], 'worker.mjs', {
    type: 'text/javascript',
  });
  const workerUrl = URL.createObjectURL(workerFile);

  const fragments = components.get(OBC.FragmentsManager);
  fragments.init(workerUrl);

  world.camera.controls.addEventListener('update', () =>
    fragments.core.update(),
  );

  fragments.list.onItemSet.add(({ value: model }) => {
    const mapBoxComponent = components.get(MapBoxComponent);
    if (mapBoxComponent && mapBoxComponent.enabled) {
      model.useCamera(world.camera.three);
      mapBoxComponent.scene.add(model.object);
      console.log(`[Loader DEBUG] Model added to MAPBOX scene.`);
      
      // Vô hiệu hóa frustum culling ngay lập tức cho các mesh đã sẵn sàng
      model.object.traverse((child: any) => {
        if ((child.isMesh || child.isInstancedMesh) && child.geometry?.attributes?.position?.array) {
          child.frustumCulled = false;
        }
      });
      
      // Buộc Mapbox vẽ lại mô hình mới nạp
      setTimeout(() => {
        if (mapBoxComponent.map) {
          mapBoxComponent.map.triggerRepaint();
        }
      }, 100);
    } else {
      model.useCamera(world.camera.three);
      world.scene.three.add(model.object);
      console.log(`[Loader DEBUG] Model added to LOCAL scene.`);
    }

    // Count meshes and log info (delayed to allow mesh loading from worker)
    setTimeout(() => {
      let meshCount = 0;
      let instancedMeshCount = 0;
      model.object.traverse((child: any) => {
        if (child.isInstancedMesh) instancedMeshCount++;
        else if (child.isMesh) meshCount++;
      });
      console.log(`[Loader DEBUG] Model meshes (after 3s): ${meshCount} Mesh + ${instancedMeshCount} InstancedMesh = ${meshCount + instancedMeshCount} total`);
    }, 3000);

    fragments.core.update(true);
  });

  fragments.core.models.materials.list.onItemSet.add(
    ({ value: material }) => {
      if (!('isLodMaterial' in material && material.isLodMaterial)) {
        material.polygonOffset = true;
        material.polygonOffsetUnits = 1;
        material.polygonOffsetFactor = Math.random();
      }
    },
  );

  return fragments;
}

export async function setupIfcLoader(
  components: OBC.Components,
): Promise<OBC.IfcLoader> {
  const ifcLoader = components.get(OBC.IfcLoader);
  await ifcLoader.setup({
    autoSetWasm: false,
    wasm: {
      path: WASM_CONFIG.path,
      absolute: WASM_CONFIG.absolute,
    },
  });
  return ifcLoader;
}
