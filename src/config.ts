export const WASM_CONFIG = {
  path: 'https://unpkg.com/web-ifc@0.0.77/',
  absolute: true,
} as const;

// Sử dụng đường dẫn tương đối trỏ tới thư mục /public/ của dự án để hỗ trợ chạy Offline hoàn toàn
export const WORKER_URL = '/worker.mjs';

export const IFC_SAMPLE = {
  name: 'small',
  url: 'https://thatopen.github.io/engine_components/resources/small.ifc',
} as const;

export const CAMERA_POSITION = {
  x: 12, y: 8, z: 12,
  tx: 0, ty: 0, tz: 0,
} as const;
