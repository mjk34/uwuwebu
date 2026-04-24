// Topology helpers for the world-atlas TopoJSON feed consumed by NewsGlobe.
// All functions are pure aside from `createLandMask`, which allocates an
// offscreen canvas (browser-only — callers must run in the client).

import * as THREE from "three";

type LngLat = [number, number];
type Ring = LngLat[];

type TopoTransform = { scale: [number, number]; translate: [number, number] };
// Topojson geometry `arcs` shape depends on `type` — too variable to type
// precisely without pulling in @types/topojson-specification. We pass through.
type TopoGeometry = { type: string; arcs: unknown };
export type Topology = {
  transform: TopoTransform;
  arcs: [number, number][][];
  objects: { countries: { geometries: TopoGeometry[] } };
};

export type Poly = {
  ext: Ring;
  holes: Ring[];
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
  /** Spans the antimeridian — needs dual-pass rasterization. */
  wide: boolean;
};

/** Project lat/lng onto a sphere of radius `r`. Returns a THREE.Vector3. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ll3(lat: number, lng: number, r: number): any {
  const p = ((90 - lat) * Math.PI) / 180;
  const t = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -r * Math.sin(p) * Math.cos(t),
    r * Math.cos(p),
    r * Math.sin(p) * Math.sin(t),
  );
}

/** Delta-decode all topojson arcs into absolute lng/lat coordinate rings. */
export function decodeTopo(topo: Topology): Ring[] {
  const { scale, translate } = topo.transform;
  return topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
      x += dx;
      y += dy;
      return [x * scale[0] + translate[0], y * scale[1] + translate[1]] as LngLat;
    });
  });
}

function getArc(decoded: Ring[], i: number): Ring {
  return i >= 0 ? decoded[i] : [...decoded[~i]].reverse();
}

function getRing(decoded: Ring[], indices: number[]): Ring {
  let c: Ring = [];
  indices.forEach((i) => {
    const a = getArc(decoded, i);
    c = c.concat(c.length ? a.slice(1) : a);
  });
  return c;
}

/** Flatten the topojson countries collection to per-polygon outer+holes rings. */
export function extractPolys(topo: Topology, decoded: Ring[]): Poly[] {
  const polys: Poly[] = [];
  topo.objects.countries.geometries.forEach((g) => {
    const add = (a: number[][]) => {
      const ext = getRing(decoded, a[0]);
      const holes = a.slice(1).map((x) => getRing(decoded, x));
      const lngs = ext.map((c) => c[0]);
      const lats = ext.map((c) => c[1]);
      polys.push({
        ext,
        holes,
        minLng: Math.min(...lngs),
        maxLng: Math.max(...lngs),
        minLat: Math.min(...lats),
        maxLat: Math.max(...lats),
        wide: Math.max(...lngs) - Math.min(...lngs) > 180,
      });
    };
    if (g.type === "Polygon") add(g.arcs as number[][]);
    else if (g.type === "MultiPolygon") (g.arcs as number[][][]).forEach(add);
  });
  return polys;
}

/**
 * Rasterize country polygons onto an MW × MH ImageData bitmap — land is
 * white, ocean is black. Used as a fast point-in-polygon lookup via
 * `maskLookup`. Antimeridian-crossing polygons render in two shifted passes.
 */
export function createLandMask(
  polys: Poly[],
  MW = 2048,
  MH = 1024,
): ImageData {
  const c = document.createElement("canvas");
  c.width = MW;
  c.height = MH;
  const ctx = c.getContext("2d");
  if (!ctx) {
    // Degrade gracefully — caller wraps in .catch(()=>{}) and a throw would
    // silently kill the whole world map render. Return an all-ocean mask so
    // the globe still shows dots (oceans) and the caller proceeds.
    console.warn("[topology] 2d context unavailable, returning empty mask");
    return new ImageData(MW, MH);
  }

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, MW, MH);

  const lngToX = (lng: number) => ((lng + 180) / 360) * MW;
  const latToY = (lat: number) => ((90 - lat) / 180) * MH;

  const drawFilled = (ext: Ring, holes: Ring[]) => {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ext.forEach(([lng, lat], i) => {
      const x = lngToX(lng);
      const y = latToY(lat);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (holes.length) {
      ctx.fillStyle = "#000";
      holes.forEach((hole) => {
        ctx.beginPath();
        hole.forEach(([lng, lat], i) => {
          const x = lngToX(lng);
          const y = latToY(lat);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
      });
    }
  };

  polys.forEach((p) => {
    if (!p.wide) {
      drawFilled(p.ext, p.holes);
      return;
    }
    // Antimeridian-crossing: shift negative lngs east, then positive lngs west.
    const extA = p.ext.map(([ln, la]) => [ln < 0 ? ln + 360 : ln, la] as LngLat);
    const holesA = p.holes.map((h) =>
      h.map(([ln, la]) => [ln < 0 ? ln + 360 : ln, la] as LngLat),
    );
    drawFilled(extA, holesA);
    const extB = p.ext.map(([ln, la]) => [ln > 0 ? ln - 360 : ln, la] as LngLat);
    const holesB = p.holes.map((h) =>
      h.map(([ln, la]) => [ln > 0 ? ln - 360 : ln, la] as LngLat),
    );
    drawFilled(extB, holesB);
  });

  return ctx.getImageData(0, 0, MW, MH);
}

/** Sample the land mask at a given lat/lng. Polar caps are skipped. */
export function maskLookup(
  lat: number,
  lng: number,
  mask: ImageData,
  MW = 2048,
  MH = 1024,
): boolean {
  if (lat < -62 || lat > 84) return false;
  const x = Math.floor(((lng + 180) / 360) * MW) % MW;
  const y = Math.floor(((90 - lat) / 180) * MH);
  if (x < 0 || x >= MW || y < 0 || y >= MH) return false;
  return mask.data[(y * MW + x) * 4] > 128;
}

/**
 * Fibonacci-sphere distribution of `n` points, emitting only those on land
 * (or ocean when `invert`). Returned as a flat Float32Array of xyz triples
 * suitable for a THREE.Points BufferAttribute.
 */
export function genDots(n: number, mask: ImageData, invert = false): Float32Array {
  const GR = (1 + Math.sqrt(5)) / 2;
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const th = Math.acos(1 - (2 * (i + 0.5)) / n);
    const ph = (2 * Math.PI * i) / GR;
    const lat = 90 - (th * 180) / Math.PI;
    const lng = ((ph * 180) / Math.PI) % 360 - 180;
    if (lat < -62 || lat > 84) continue;
    const isLand = maskLookup(lat, lng, mask);
    const show = invert ? !isLand : isLand;
    if (show) {
      const p = ll3(lat, lng, 1.0);
      pts.push(p.x, p.y, p.z);
    }
  }
  return new Float32Array(pts);
}
