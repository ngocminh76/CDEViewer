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
    model.useCamera(world.camera.three);

    const mapBoxComponent = components.get(MapBoxComponent);
    if (mapBoxComponent && mapBoxComponent.enabled) {
      mapBoxComponent.scene.add(model.object);
      console.log(`[Loader DEBUG] Model added to MAPBOX scene.`);
    } else {
      world.scene.three.add(model.object);
      console.log(`[Loader DEBUG] Model added to LOCAL scene.`);
    }

    // Count meshes and fix frustum culling (delayed to allow mesh loading)
    setTimeout(() => {
      let meshCount = 0;
      let instancedMeshCount = 0;
      model.object.traverse((child: any) => {
        if (child.isInstancedMesh) instancedMeshCount++;
        else if (child.isMesh) meshCount++;
      });
      console.log(`[Loader DEBUG] Model meshes (after 3s): ${meshCount} Mesh + ${instancedMeshCount} InstancedMesh = ${meshCount + instancedMeshCount} total`);

      // If Mapbox is enabled, disable frustum culling for valid meshes
      const mbComp = components.get(MapBoxComponent);
      if (mbComp && mbComp.enabled) {
        model.object.traverse((child: any) => {
          if ((child.isMesh || child.isInstancedMesh) && child.geometry?.attributes?.position?.array) {
            child.frustumCulled = false;
          }
        });
        console.log(`[Loader DEBUG] Disabled frustumCulled for Mapbox meshes.`);
      }
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
