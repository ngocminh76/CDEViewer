/**
 * Conversion utility from VN-2000 Coordinate System (Transverse Mercator)
 * to WGS84 Geodetic coordinates (Latitude / Longitude).
 */
export function vn2000ToWgs84(
  easting: number,
  northing: number,
  centralMeridianDeg: number,
  zone3deg: boolean = true
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

  // Latitude calculation
  const latRad =
    phi1 -
    ((nu1 * Math.tan(phi1)) / rho1) *
      ((D * D) / 2.0 -
        ((5.0 + 3.0 * T1 + 10.0 * C1 - 4.0 * C1 * C1 - 9.0 * ePrime2) * Math.pow(D, 4)) / 24.0 +
        ((61.0 + 90.0 * T1 + 298.0 * C1 + 45.0 * T1 * T1 - 252.0 * ePrime2 - 3.0 * C1 * C1) *
          Math.pow(D, 6)) /
          720.0);

  // Longitude calculation
  const lonRad =
    (D -
      ((1.0 + 2.0 * T1 + C1) * Math.pow(D, 3)) / 6.0 +
      ((5.0 - 2.0 * C1 + 28.0 * T1 - 3.0 * C1 * C1 + 8.0 * ePrime2 + 24.0 * T1 * T1) *
        Math.pow(D, 5)) /
        120.0) /
    Math.cos(phi1);

  const lat = (latRad * 180.0) / Math.PI;
  const lon = centralMeridianDeg + (lonRad * 180.0) / Math.PI;

  return [lon, lat];
}
