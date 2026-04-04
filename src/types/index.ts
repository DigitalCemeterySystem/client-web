// ── Coordinate ────────────────────────────────────────────────────────────────
export interface CoordinateDTO {
  latitude: number;
  longitude: number;
}

// ── Cemetery ──────────────────────────────────────────────────────────────────
export interface CemeteryResponse {
  id: number;
  name: string;
  address: string;
  description: string;
  sectors: SectorResponse[];
  boundary: CoordinateDTO[];
}

export interface CemeteryRequest {
  name: string;
  address: string;
  description: string;
  boundary: CoordinateDTO[];
}

// ── Sector ────────────────────────────────────────────────────────────────────
export interface SectorResponse {
  id: number;
  name: string;
  cemeteryId: number;
  cemeteryName: string;
  burialCount: number;
  boundary: CoordinateDTO[];
}

export interface SectorRequest {
  name: string;
  cemeteryId: number;
  boundary: CoordinateDTO[];
}

// ── Burial ────────────────────────────────────────────────────────────────────
export type BiographyStatus = 'PENDING' | 'GENERATED' | 'FAILED' | 'NOT_REQUESTED';

export interface BurialResponse {
  id: number;
  fullName: string;
  birthDate: string | null;
  deathDate: string | null;
  latitude: number | null;
  longitude: number | null;
  photoUrl: string | null;
  sectorName: string;
  cemeteryName: string;
  biography: string | null;
  biographyStatus: BiographyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BurialRequest {
  fullName: string;
  birthDate: string | null;
  deathDate: string | null;
  latitude: number | null;
  longitude: number | null;
  photoUrl: string | null;
  sectorId: number;
}

// ── GeoJSON helpers ───────────────────────────────────────────────────────────
export type LngLatTuple = [number, number]; // [longitude, latitude]

export interface BurialMarker {
  id: number;
  fullName: string;
  lngLat: LngLatTuple;
}
