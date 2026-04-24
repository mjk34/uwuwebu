// Ambient shim — @types/three is not installed (would require dep-vet per the
// project Security tier). Loose typing is acceptable; runtime is exercised in
// the globe surface. Enumerates only the members this project uses.

/* eslint-disable @typescript-eslint/no-explicit-any */
declare module "three" {
  export const AmbientLight: any;
  export const BufferAttribute: any;
  export const BufferGeometry: any;
  export const CanvasTexture: any;
  export const CircleGeometry: any;
  export const DirectionalLight: any;
  export const DoubleSide: any;
  export const Float32BufferAttribute: any;
  export const Group: any;
  export const Line: any;
  export const LineBasicMaterial: any;
  export const LineSegments: any;
  export const Mesh: any;
  export const MeshBasicMaterial: any;
  export const PerspectiveCamera: any;
  export const Points: any;
  export const PointsMaterial: any;
  export const QuadraticBezierCurve3: any;
  export const RingGeometry: any;
  export const Scene: any;
  export const SphereGeometry: any;
  export const TorusGeometry: any;
  export const Vector2: any;
  export const Vector3: any;
  export const WebGLRenderer: any;
}
