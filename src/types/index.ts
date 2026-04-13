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
  sectorId: number | null;
  sectorName: string;
  cemeteryId: number | null;
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

export type ChangeRequestTargetType = 'BURIAL' | 'CEMETERY';
export type ChangeRequestOperationType = 'ADD' | 'EDIT';
export type ChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type BurialChangeFieldKey =
  | 'PHOTO_URL'
  | 'FULL_NAME'
  | 'BIRTH_DATE'
  | 'DEATH_DATE'
  | 'LATITUDE'
  | 'LONGITUDE'
  | 'BIOGRAPHY'
  | 'CEMETERY_NAME'
  | 'SECTOR_NAME';

export interface BurialChangeDraftRequest {
  fullName?: string;
  birthDate?: string | null;
  deathDate?: string | null;
  clearBirthDate?: boolean;
  clearDeathDate?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  photoUrl?: string | null;
  biography?: string | null;
  clearPhotoUrl?: boolean;
  clearBiography?: boolean;
}

export interface ChangeRequestFieldResponse {
  fieldKey: BurialChangeFieldKey;
  fieldLabel: string;
  beforeValue: string | null;
  afterValue: string | null;
}

export interface ChangeRequestResponse {
  id: number;
  targetType: ChangeRequestTargetType;
  operationType: ChangeRequestOperationType;
  status: ChangeRequestStatus;
  authorUserId: number;
  authorUsername: string;
  authorRole: UserRole;
  burialId: number | null;
  burialLabel: string | null;
  previewLatitude: number | null;
  previewLongitude: number | null;
  rejectionReason: string | null;
  reviewedByUserId: number | null;
  reviewedByUsername: string | null;
  reviewedByRole: UserRole | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  fields: ChangeRequestFieldResponse[];
}

// ── GeoJSON helpers ───────────────────────────────────────────────────────────
export type LngLatTuple = [number, number]; // [longitude, latitude]

export interface BurialMarker {
  id: number;
  fullName: string;
  lngLat: LngLatTuple;
}

export type UserRole = 'USER' | 'MODERATOR' | 'ADMIN';
export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'DISABLED';

export interface UserProfileResponse {
  id: number;
  email: string;
  username: string;
  avatarUrl: string | null;
  bio: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebSessionResponse {
  tokenType: string;
  expiresIn: number;
  user: UserProfileResponse;
}

export interface RegisterRequest {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

export interface LoginRequest {
  emailOrUsername: string;
  password: string;
}

export interface UpdateProfileRequest {
  username?: string;
  avatarUrl?: string;
  bio?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}
