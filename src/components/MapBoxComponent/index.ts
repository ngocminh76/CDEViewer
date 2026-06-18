import * as OBC from "@thatopen/components";
import * as THREE from "three";
import * as MAPBOX from "mapbox-gl";
import { MapBoxCoord } from "./src";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";

export interface IMapBoxConfig {
  pitch: number;
  bearing: number;
  zoom: number;
  center: [number, number];
  style: string;
  antialias: boolean;
  maxZoom: number;
  minZoom: number;
  maxPitch: number;
  minPitch: number;
}

export class MapBoxComponent
  extends OBC.Component
  implements OBC.Disposable
{
  static readonly uuid = "abf957d2-2dcf-455c-bce1-bddbfd6eefc0" as const;

  enabled = false;

  readonly onDisposed: OBC.Event<any> = new OBC.Event();

  readonly coord = new MapBoxCoord();

  isSetup = false;

  onSetup: OBC.Event<any> = new OBC.Event();

  config: Required<IMapBoxConfig> = {
    pitch: 60,
    bearing: -300,
    zoom: 18,
    center: this.coord.center,
    style: "mapbox://styles/mapbox/streets-v12",
    antialias: true,
    maxZoom: 60,
    minZoom: 3,
    maxPitch: 85,
    minPitch: 0,
  };
  map!: MAPBOX.Map | null;

  container!: HTMLDivElement;
  camera: THREE.PerspectiveCamera = new THREE.PerspectiveCamera();
  renderer!: THREE.WebGLRenderer;
  labelRenderer: CSS2DRenderer = new CSS2DRenderer();
  readonly scene: THREE.Scene = new THREE.Scene();

  constructor(components: OBC.Components) {
    super(components);
    this.components.add(MapBoxComponent.uuid, this);
  }

  async dispose() {
    this.isSetup = false;
    this.map?.remove();
    (this.map as any) = null;
    (this.container as any) = null;
    this.onDisposed.trigger(this);
    this.onDisposed.reset();
    console.log("disposed MapBoxComponent");
  }

  setup = (config?: Partial<IMapBoxConfig> | undefined) => {
    if (!this.container) throw Error("Container was not initialized!");
    this.config = { ...this.config, ...config };
    const { center } = this.config;
    this.coord.center = center;

    const token = import.meta.env.VITE_MAPBOX_TOKEN || localStorage.getItem("VITE_MAPBOX_TOKEN");
    if (!token || token.trim() === "") {
      throw new Error("TOKEN_MISSING");
    }

    this.map = new MAPBOX.Map({
      container: this.container,
      accessToken: token,
      ...this.config,
    });
    this.map.rotateTo(Math.PI / 2);
    this.addDefaultLayer();
    this.setupMap();
    this.isSetup = true;
    this.onSetup.trigger();
  };

  private addDefaultLayer() {
    this.map!.on("load", () => {
      const layers = this.map?.getStyle()!.layers as any[];
      const labelLayerId = layers.find(
        (layer) => layer.type === "symbol" && layer.layout["text-field"]
      )?.id;

      this.map!.addLayer(
        {
          id: "add-3d-buildings",
          source: "composite",
          "source-layer": "building",
          filter: ["==", "extrude", "true"],
          type: "fill-extrusion",
          minzoom: 15,
          paint: {
            "fill-extrusion-color": "#aaa",
            "fill-extrusion-height": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              15.05,
              ["get", "height"],
            ],
            "fill-extrusion-base": [
              "interpolate",
              ["linear"],
              ["zoom"],
              15,
              0,
              15.05,
              ["get", "min_height"],
            ],
            "fill-extrusion-opacity": 0.6,
          },
        },
        labelLayerId
      );
    });
  }

  private onAdd = (map: any, gl: any) => {
    const directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(0, -70, 100).normalize();
    this.scene.add(directionalLight);
    const directionalLight2 = new THREE.DirectionalLight(0xffffff);
    directionalLight2.position.set(0, 70, 100).normalize();
    this.scene.add(directionalLight2);

    const canvas = map.getCanvas() as HTMLCanvasElement;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      context: gl,
      antialias: true,
    });
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = "srgb";
    this.renderer.localClippingEnabled = true;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.VSMShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.autoClearStencil = false;
    this.initializeLabelRenderer();
  };

  private _debugFrameCount = 0;
  private render = (_gl: any, matrix: number[]) => {
    const m = new THREE.Matrix4().fromArray(matrix);
    this.camera.projectionMatrix = m.multiply(this.coord.mapCamera);

    // Debug: log once every 120 frames
    this._debugFrameCount++;
    if (this._debugFrameCount === 1 || this._debugFrameCount % 120 === 0) {
      let totalMeshes = 0;
      let frustumCulledCount = 0;
      let visibleCount = 0;
      let invisibleCount = 0;
      this.scene.traverse((child: any) => {
        if (child.isMesh || child.isInstancedMesh) {
          totalMeshes++;
          if (child.frustumCulled) frustumCulledCount++;
          if (child.visible) visibleCount++;
          else invisibleCount++;
        }
      });
      console.log(`[MapBox DEBUG] Frame ${this._debugFrameCount}: scene.children=${this.scene.children.length}, totalMeshes=${totalMeshes}, frustumCulled=${frustumCulledCount}, visible=${visibleCount}, invisible=${invisibleCount}`);
      console.log(`[MapBox DEBUG] coord: center=${JSON.stringify(this.coord.center)}, modelOrigin=${JSON.stringify(this.coord.modelOrigin)}, elevation=${this.coord.elevation}`);
    }

    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.map!.triggerRepaint();
  };

  private setupMap() {
    const customLayer = {
      id: "3d-model",
      type: "custom",
      renderingMode: "3d",
      onAdd: this.onAdd,
      render: this.render,
    };
    this.map!.on("style.load", () => {
      //@ts-ignore
      this.map!.addLayer(customLayer);
      this.map!.resize();
    });
    this.map!.addControl(
      new MAPBOX.NavigationControl({
        visualizePitch: true,
      }),
      "bottom-right"
    );
  }

  private initializeLabelRenderer() {
    this.labelRenderer.domElement.style.position = "absolute";
    this.labelRenderer.domElement.style.top = "0px";
    this.labelRenderer.domElement.style.zIndex = "1";
    this.labelRenderer.setSize(
      this.renderer.domElement.clientWidth,
      this.renderer.domElement.clientHeight
    );
    this.renderer?.domElement.parentElement?.appendChild(
      this.labelRenderer.domElement
    );
  }

  private updateLabelRendererSize = () => {
    setTimeout(() => {
      if (!this.map) return;
      this.map.resize();
      const canvas = this.map.getCanvas() as HTMLCanvasElement;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      if (this.renderer?.domElement) {
        const { width, height } =
          this.renderer.domElement.getBoundingClientRect();
        this.labelRenderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
      }
    }, 1);
  };

  onResize = () => {
    if (!this.renderer || !this.container || !this.map) return;
    this.updateLabelRendererSize();
  };
}
