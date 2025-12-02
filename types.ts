
export interface RoadData {
  id: number;
  name: string;
  capacity: number;
  currentVehicles: number;
  vocs: number;
  gateStatus: 'open' | 'closed';
  location: string;
  coordinates: [number, number]; // Center point for the label
  path: [number, number][]; // Array of coordinates to draw the road line
  avgGreenTime?: number; // Added for emergency detection
  sensors?: any;
}

export interface AppState {
  view: 'dashboard' | 'map';
}
