/**
 * Orders tour stops into a short open path (no return leg): nearest-neighbour from every
 * possible start, keep the shortest, then improve it with 2-opt. Exact for small N in
 * practice, and N here is at most ~12.
 */

export interface Point {
  lat: number;
  lng: number;
}

const R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: Point, b: Point): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

export function pathLengthKm(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineKm(points[i - 1], points[i]);
  return total;
}

function nearestNeighbour<T extends Point>(points: T[], start: number): T[] {
  const remaining = points.filter((_, i) => i !== start);
  const path = [points[start]];
  while (remaining.length) {
    const last = path[path.length - 1];
    let best = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (haversineKm(last, remaining[i]) < haversineKm(last, remaining[best])) best = i;
    }
    path.push(remaining.splice(best, 1)[0]);
  }
  return path;
}

function twoOpt<T extends Point>(path: T[]): T[] {
  let best = path;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = [...best.slice(0, i), ...best.slice(i, j + 1).reverse(), ...best.slice(j + 1)];
        if (pathLengthKm(candidate) + 1e-9 < pathLengthKm(best)) {
          best = candidate;
          improved = true;
        }
      }
    }
  }
  return best;
}

export function orderRoute<T extends Point>(points: T[]): T[] {
  if (points.length <= 2) return [...points];
  let best: T[] = [];
  let bestLen = Infinity;
  for (let s = 0; s < points.length; s++) {
    const path = twoOpt(nearestNeighbour(points, s));
    const len = pathLengthKm(path);
    if (len < bestLen) {
      best = path;
      bestLen = len;
    }
  }
  return best;
}
