/**
 * Conversion utility from VN-2000 Coordinate System (Transverse Mercator)
 * to WGS84 Geodetic coordinates (Latitude / Longitude) using the official
 * 7-parameter Helmert datum transformation (Decision 973/2001/QĐ-TCĐC).
 */
export function vn2000ToWgs84(
  easting: number,
  northing: number,
  centralMeridianDeg: number,
  zone3deg: boolean = true,
  height: number = 0
): [number, number] {
  // Ellipsoid parameters for WGS84 / VN2000
  const a = 6378137.0; // semi-major axis
  const f = 1.0 / 298.257223563; // flattening
  const b = a * (1.0 - f);

  const k0 = zone3deg ? 0.9999 : 0.9996; // scale factor
  const fe = 500000.0; // false easting
  const fn = 0.0; // false northing

  const e2 = (a * a - b * b) / (a * a); // first eccentricity squared
  const ePrime2 = (a * a - b * b) / (b * b); // second eccentricity squared

  const x = easting - fe;
  const y = northing - fn;

  // Calculate footprint latitude
  const m = y / k0;
  const mu = m / (a * (1.0 - e2 / 4.0 - (3.0 * e2 * e2) / 64.0 - (5.0 * e2 * e2 * e2) / 256.0));

  const e1 = (1.0 - Math.sqrt(1.0 - e2)) / (1.0 + Math.sqrt(1.0 - e2));

  const phi1 =
    mu +
    ((3.0 * e1) / 2.0 - (27.0 * e1 * e1 * e1) / 32.0) * Math.sin(2.0 * mu) +
    ((21.0 * e1 * e1) / 16.0 - (55.0 * e1 * e1 * e1 * e1) / 32.0) * Math.sin(4.0 * mu) +
    ((151.0 * e1 * e1 * e1) / 96.0) * Math.sin(6.0 * mu) +
    ((1097.0 * e1 * e1 * e1 * e1) / 512.0) * Math.sin(8.0 * mu);

  const C1 = ePrime2 * Math.cos(phi1) * Math.cos(phi1);
  const T1 = Math.tan(phi1) * Math.tan(phi1);

  const rho1 = (a * (1.0 - e2)) / Math.pow(1.0 - e2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
  const nu1 = a / Math.sqrt(1.0 - e2 * Math.sin(phi1) * Math.sin(phi1));

  const D = x / (nu1 * k0);

  // Latitude calculation on VN-2000 ellipsoid
  const latRad =
    phi1 -
    ((nu1 * Math.tan(phi1)) / rho1) *
      ((D * D) / 2.0 -
        ((5.0 + 3.0 * T1 + 10.0 * C1 - 4.0 * C1 * C1 - 9.0 * ePrime2) * Math.pow(D, 4)) / 24.0 +
        ((61.0 + 90.0 * T1 + 298.0 * C1 + 45.0 * T1 * T1 - 252.0 * ePrime2 - 3.0 * C1 * C1) *
          Math.pow(D, 6)) /
          720.0);

  // Longitude calculation on VN-2000 ellipsoid
  const lonRad =
    (D -
      ((1.0 + 2.0 * T1 + C1) * Math.pow(D, 3)) / 6.0 +
      ((5.0 - 2.0 * C1 + 28.0 * T1 - 3.0 * C1 * C1 + 8.0 * ePrime2 + 24.0 * T1 * T1) *
        Math.pow(D, 5)) /
        120.0) /
    Math.cos(phi1);

  const latVn = latRad;
  const lonVn = (centralMeridianDeg * Math.PI) / 180.0 + lonRad;

  // Convert VN-2000 Geodetic (lat, lon, height) to Geocentric Cartesian (X, Y, Z)
  const sinLat = Math.sin(latVn);
  const cosLat = Math.cos(latVn);
  const sinLon = Math.sin(lonVn);
  const cosLon = Math.cos(lonVn);

  const N = a / Math.sqrt(1.0 - e2 * sinLat * sinLat);
  const X_vn = (N + height) * cosLat * cosLon;
  const Y_vn = (N + height) * cosLat * sinLon;
  const Z_vn = (N * (1.0 - e2) + height) * sinLat;

  // 7-parameter Helmert transformation from VN-2000 to WGS-84
  const dx = -191.9; // meters
  const dy = -39.3;  // meters
  const dz = -111.5; // meters
  const wx = -0.0093 * Math.PI / (180.0 * 3600.0); // radians (from arcseconds)
  const wy = -0.0104 * Math.PI / (180.0 * 3600.0); // radians (from arcseconds)
  const wz = -0.0115 * Math.PI / (180.0 * 3600.0); // radians (from arcseconds)
  const ds = -0.1299e-6; // scale factor change

  const X_wgs = dx + (1.0 + ds) * (X_vn - wz * Y_vn + wy * Z_vn);
  const Y_wgs = dy + (1.0 + ds) * (wz * X_vn + Y_vn - wx * Z_vn);
  const Z_wgs = dz + (1.0 + ds) * (-wy * X_vn + wx * Y_vn + Z_vn);

  // Convert WGS-84 Geocentric Cartesian (X, Y, Z) back to WGS-84 Geodetic (lat, lon)
  // Using Bowring's method
  const p = Math.sqrt(X_wgs * X_wgs + Y_wgs * Y_wgs);
  const theta = Math.atan2(Z_wgs * a, p * b);
  
  const latWgsRad = Math.atan2(
    Z_wgs + ePrime2 * b * Math.pow(Math.sin(theta), 3),
    p - e2 * a * Math.pow(Math.cos(theta), 3)
  );
  const lonWgsRad = Math.atan2(Y_wgs, X_wgs);

  const latWgs = (latWgsRad * 180.0) / Math.PI;
  const lonWgs = (lonWgsRad * 180.0) / Math.PI;

  return [lonWgs, latWgs];
}

