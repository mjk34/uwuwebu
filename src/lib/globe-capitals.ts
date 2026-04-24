// Capital-city markers rendered on the world news globe. Top-N economies plus
// hotspots referenced by the CONFLICTS list below. Hover to reveal name.

export type Capital = {
  name: string;
  lat: number;
  lng: number;
};

export const CAPITALS: Capital[] = [
  { name: "Washington, D.C.", lat: 38.91, lng: -77.04 },
  { name: "Beijing", lat: 39.90, lng: 116.41 },
  { name: "Tokyo", lat: 35.68, lng: 139.65 },
  { name: "Berlin", lat: 52.52, lng: 13.41 },
  { name: "New Delhi", lat: 28.61, lng: 77.21 },
  { name: "London", lat: 51.51, lng: -0.13 },
  { name: "Paris", lat: 48.86, lng: 2.35 },
  { name: "Rome", lat: 41.90, lng: 12.50 },
  { name: "Brasília", lat: -15.80, lng: -47.89 },
  { name: "Moscow", lat: 55.76, lng: 37.62 },
  { name: "Ottawa", lat: 45.42, lng: -75.70 },
  { name: "Mexico City", lat: 19.43, lng: -99.13 },
  { name: "Abu Dhabi", lat: 24.45, lng: 54.65 },
  { name: "Tehran", lat: 35.69, lng: 51.39 },
  { name: "Canberra", lat: -35.28, lng: 149.13 },
  { name: "Seoul", lat: 37.57, lng: 126.98 },
  { name: "Jerusalem", lat: 31.77, lng: 35.23 },
  { name: "Cairo", lat: 30.04, lng: 31.24 },
  { name: "Nuuk", lat: 64.17, lng: -51.74 },
  { name: "Algiers", lat: 36.75, lng: 3.06 },
  { name: "Tripoli", lat: 32.90, lng: 13.18 },
  { name: "Khartoum", lat: 15.50, lng: 32.56 },
  { name: "Kyiv", lat: 50.45, lng: 30.52 },
  { name: "Ulaanbaatar", lat: 47.92, lng: 106.91 },
  { name: "Astana", lat: 51.17, lng: 71.43 },
  { name: "Buenos Aires", lat: -34.60, lng: -58.38 },
  { name: "Caracas", lat: 10.48, lng: -66.90 },
  { name: "Havana", lat: 23.11, lng: -82.37 },
  { name: "Santiago", lat: -33.45, lng: -70.67 },
  { name: "Lima", lat: -12.05, lng: -77.04 },
  { name: "Panama City", lat: 8.98, lng: -79.52 },
  { name: "Kabul", lat: 34.53, lng: 69.17 },
  { name: "Sana'a", lat: 15.37, lng: 44.19 },
  { name: "Baghdad", lat: 33.31, lng: 44.37 },
  { name: "Ankara", lat: 39.93, lng: 32.86 },
  { name: "Islamabad", lat: 33.68, lng: 73.05 },
];

// Cities currently marker-colored orange (active conflict zones).
export const WARRING = new Set<string>([
  "Moscow",
  "Kyiv",
  "Washington, D.C.",
  "Tehran",
  "Jerusalem",
  "Islamabad",
  "Kabul",
]);

export type Conflict = {
  from: string;
  to: string;
  color: number;
};

// Directed attack arcs between capitals, animated as traveling projectiles.
export const CONFLICTS: Conflict[] = [
  // Russia–Ukraine war (bidirectional)
  { from: "Kyiv", to: "Moscow", color: 0xff3322 },
  { from: "Moscow", to: "Kyiv", color: 0xff3322 },
  // US + Israel vs Iran
  { from: "Washington, D.C.", to: "Tehran", color: 0xff5522 },
  { from: "Jerusalem", to: "Tehran", color: 0xff5522 },
  { from: "Tehran", to: "Washington, D.C.", color: 0xff5522 },
  { from: "Tehran", to: "Jerusalem", color: 0xff5522 },
  // Pakistan–Afghanistan (bidirectional)
  { from: "Islamabad", to: "Kabul", color: 0xff4422 },
  { from: "Kabul", to: "Islamabad", color: 0xff4422 },
];
