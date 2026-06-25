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

  readonly onMapMove: OBC.Event<{ pitch: number; bearing: number }> = new OBC.Event();

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
  clippingPlanes: THREE.Plane[] = [];


  constructor(components: OBC.Components) {
    super(components);
    this.components.add(MapBoxComponent.uuid, this);
  }

  async dispose() {
    this.isSetup = false;
    this.map?.remove();
    (this.map as any) = null;
    (this.container as any) = null;
    this.onMapMove.reset();
    this.onDisposed.trigger(this);
    this.onDisposed.reset();
    console.log("disposed MapBoxComponent");
  }

  setup = (config?: Partial<IMapBoxConfig> | undefined) => {
    if (!this.container) throw Error("Container was not initialized!");
    
    // SỬA LỖI MẤT TỌA ĐỘ KHI BẬT MAP SAU KHI ĐÃ LOAD MÔ HÌNH:
    // Nếu mô hình được load trước ở chế độ không map (no-map mode), các tham số tọa độ GIS thực tế
    // đã được phân tích từ tệp IFC và lưu vào `this.coord.center`.
    // Khi người dùng bật bản đồ sau đó, hàm `setup()` này chạy. Nếu chúng ta lấy `this.config.center` mặc định
    // (là Hà Nội) để ghi đè lên `this.coord.center`, tọa độ GIS thực tế của mô hình sẽ bị mất,
    // dẫn đến việc mô hình hiển thị sai vị trí hoặc bị ẩn hoàn toàn (do lệch ma trận chiếu).
    // Giải pháp: Ưu tiên chọn tọa độ center hiện có trong `this.coord.center` nếu nó khác tọa độ mặc định,
    // hoặc lấy từ config truyền vào trực tiếp.
    const currentCoordCenter = this.coord.center;
    const isDefaultCenter = currentCoordCenter && currentCoordCenter[0] === 105.804817 && currentCoordCenter[1] === 21.028511;
    const newCenter = config?.center || (currentCoordCenter && !isDefaultCenter ? currentCoordCenter : this.config.center);

    this.config = { ...this.config, ...config, center: newCenter };
    this.coord.center = newCenter;

    const token = import.meta.env.VITE_MAPBOX_TOKEN || localStorage.getItem("VITE_MAPBOX_TOKEN");
    if (!token || token.trim() === "") {
      throw new Error("TOKEN_MISSING");
    }

    this.map = new MAPBOX.Map({
      container: this.container,
      accessToken: token,
      ...this.config,
    });
    this.map.on("move", () => {
      if (this.map) {
        this.onMapMove.trigger({
          pitch: this.map.getPitch(),
          bearing: this.map.getBearing(),
        });
      }
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
    // SỬA LỖI MẤT MÔ HÌNH KHI THAY ĐỔI STYLE BẢN ĐỒ (SATELLITE, TERRAIN...):
    // Khi đổi style bản đồ, Mapbox kích hoạt lại sự kiện "style.load" và gọi lại hàm `onAdd()` này.
    // Nếu chúng ta khởi tạo lại `THREE.WebGLRenderer` mới mỗi lần đổi style, các tài nguyên WebGL cũ
    // của mô hình (Geometries, Materials, Shaders) đang được lưu cache trong GPU dưới context WebGL cũ
    // sẽ bị ngắt kết nối hoặc không tương thích với Renderer mới, dẫn tới mô hình bị ẩn/mất hiển thị.
    // Giải pháp: Chỉ khởi tạo đèn và WebGLRenderer duy nhất một lần (singleton). Các lần đổi style
    // tiếp theo sẽ tái sử dụng lại Renderer cũ để giữ nguyên cache GPU của mô hình, giúp hiển thị mượt mà.
    if (this.renderer) {
      console.log("[CDEViewer] Mapbox style reloaded. Reusing existing Three.js WebGLRenderer.");
      return;
    }

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

    // Đồng bộ camera từ Mapbox sang camera cục bộ (ThreeJS) để cập nhật culling/LOD
    if (this.map) {
      const freeCam = this.map.getFreeCameraOptions();
      const mercatorPos = freeCam.position;
      if (mercatorPos) {
        const mercatorVec = new THREE.Vector3(mercatorPos.x, mercatorPos.y, mercatorPos.z);
        const mapCameraInverse = new THREE.Matrix4().copy(this.coord.mapCamera).invert();
        const localPos = mercatorVec.applyMatrix4(mapCameraInverse);

        const worlds = this.components.get(OBC.Worlds);
        const world = worlds.list.values().next().value;
        if (world && world.camera && world.camera.three) {
          const localCam = world.camera.three;
          localCam.position.copy(localPos);
          localCam.projectionMatrix.copy(this.camera.projectionMatrix);
          localCam.matrixWorld.identity();
          localCam.matrixWorldInverse.identity();
        }
      }
    }

    // Cập nhật LOD/culling cho fragments core đồng bộ theo thời gian thực
    const fragments = this.components.get(OBC.FragmentsManager);
    if (fragments) {
      fragments.core.update(true);
    }

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
      const childNames = this.scene.children.map((c: any) => `${c.constructor.name || 'Object'}(uuid=${c.uuid.substring(0,6)}, children=${c.children?.length || 0})`);
      console.log(`[MapBox DEBUG] Frame ${this._debugFrameCount}: scene.children=${this.scene.children.length} [${childNames.join(', ')}], totalMeshes=${totalMeshes}, frustumCulled=${frustumCulledCount}, visible=${visibleCount}, invisible=${invisibleCount}`);
      console.log(`[MapBox DEBUG] coord: center=${JSON.stringify(this.coord.center)}, modelOrigin=${JSON.stringify(this.coord.modelOrigin)}, elevation=${this.coord.elevation}`);
      console.log(`[MapBox DEBUG] camera projection matrix elements:`, Array.from(this.camera.projectionMatrix.elements).map(n => Number(n.toFixed(6))));
    }

    this.renderer.clippingPlanes = this.clippingPlanes;
    this.renderer.resetState();
    
    try {
      this.renderer.render(this.scene, this.camera);
    } catch (e: any) {
      console.error("[MapBox Render Error] Error during WebGL render:", e);
      // Chẩn đoán lỗi: Duyệt toàn bộ mesh trong scene và tìm thuộc tính có array là undefined
      this.scene.traverse((child: any) => {
        if (child.isMesh || child.isInstancedMesh) {
          const geom = child.geometry;
          if (geom) {
            for (const key in geom.attributes) {
              const attr = geom.attributes[key];
              if (!attr.array) {
                console.warn(`[MapBox Render Error] Mesh [${child.constructor.name}] ${child.name || child.uuid} has attribute '${key}' with undefined array!`, attr);
              }
            }
            if (geom.index && !geom.index.array) {
              console.warn(`[MapBox Render Error] Mesh [${child.constructor.name}] ${child.name || child.uuid} has index attribute with undefined array!`, geom.index);
            }
          }
          if (child.isInstancedMesh && child.instanceMatrix && !child.instanceMatrix.array) {
            console.warn(`[MapBox Render Error] InstancedMesh ${child.name || child.uuid} has instanceMatrix with undefined array!`, child.instanceMatrix);
          }
        }
      });
      throw e;
    }
    
    // BỎ LỆNH TRIGERREPAINT VÔ HẠN (GIẢM TẢI GPU TỪ 100% XUỐNG MỨC TỐI THIỂU):
    // Mapbox sẽ tự vẽ lại khi người dùng dịch chuyển bản đồ. Khi thay đổi trạng thái mô hình
    // (như highlight hoặc ẩn/hiện), engine.ts sẽ kích hoạt triggerRepaint chủ động một lần.
    // this.map!.triggerRepaint();
  };

  private setupMap() {
    const customLayer = {
      id: "3d-model",
      type: "custom",
      renderingMode: "3d",
      onAdd: this.onAdd,
      render: this.render,
    };
    // GIẢI THÍCH VỀ VIỆC LOAD STYLE BẢN ĐỒ (SATELLITE, TERRAIN, DARK, STREETS...):
    // Khi người dùng đổi style bản đồ nền (dùng map.setStyle()), Mapbox sẽ xóa toàn bộ
    // các custom layer đang hiển thị trên bản đồ. Nếu sử dụng sự kiện "load" thông thường,
    // layer 3D của mô hình BIM sẽ bị mất vĩnh viễn sau lần chuyển style đầu tiên.
    // Giải pháp: Sử dụng sự kiện "style.load". Sự kiện này kích hoạt mỗi khi một style
    // bản đồ nền tải xong. Nhờ đó, customLayer vẽ mô hình BIM 3D sẽ tự động được re-add
    // và căn chỉnh lại đúng tọa độ GIS mà không bị biến mất hay sai lệch vị trí.
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
        
        // SỬA LỖI TRÁNH GÁN CAMERA ASPECT BẰNG NaN/0 KHI KÍCH THƯỚC DOM CHƯA SẴN SÀNG:
        // Nếu width hoặc height quá nhỏ (< 10px), việc tính camera.aspect sẽ cho giá trị không hợp lệ,
        // khiến ThreeJS bị hỏng ma trận chiếu và không vẽ mô hình nữa.
        if (width > 10 && height > 10) {
          this.labelRenderer.setSize(width, height);
          this.camera.aspect = width / height;
          this.camera.updateProjectionMatrix();
        }
      }
    }, 50); // Tăng thời gian chờ từ 1ms lên 50ms để đợi layout trình duyệt ổn định hơn
  };

  onResize = () => {
    if (!this.renderer || !this.container || !this.map) return;
    this.updateLabelRendererSize();
  };
}
