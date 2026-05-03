import type { BurialResponse, CemeteryResponse, CoordinateDTO, SectorResponse } from '@/types';
import testBoundaries from '@/demo-data/TEST_cemetery_boundaries.json';
import yuzhnoeBoundaries from '@/demo-data/YUZHNOE_cemetery_boundaries.json';
import gravesData from '@/demo-data/graves_data.json';

type BoundaryFile = {
  cemeteryBoundary: CoordinateDTO[];
  quarterBoundaries: Record<string, CoordinateDTO[]>;
};

type GraveRecord = {
  fullName?: string;
  birthDate?: string;
  deathDate?: string;
  latitude?: number;
  longitude?: number;
  photo?: string;
  shortInfo?: string;
};

type GravesFile = {
  graves: GraveRecord[];
};

type Point = {
  latitude: number;
  longitude: number;
};

const now = '2026-05-03T00:00:00.000Z';

function normalizeCoordinate(point: CoordinateDTO): CoordinateDTO {
  if (Math.abs(point.latitude) > 90 && Math.abs(point.longitude) <= 90) {
    return {
      latitude: point.longitude,
      longitude: point.latitude,
    };
  }

  return point;
}

function normalizeBoundary(boundary: CoordinateDTO[] = []) {
  return boundary.map(normalizeCoordinate);
}

export function pointInPolygon(point: Point, boundary: CoordinateDTO[]) {
  if (!boundary?.length) return false;

  let inside = false;
  const x = point.longitude;
  const y = point.latitude;

  for (let i = 0, j = boundary.length - 1; i < boundary.length; j = i++) {
    const xi = boundary[i].longitude;
    const yi = boundary[i].latitude;
    const xj = boundary[j].longitude;
    const yj = boundary[j].latitude;
    const denominator = yj - yi || Number.EPSILON;
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / denominator + xi;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function parseSeedDate(value?: string | null) {
  if (!value || value === 'null') return null;
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) return null;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function makeSectors(cemeteryId: number, cemeteryName: string, boundaries: BoundaryFile) {
  return Object.entries(boundaries.quarterBoundaries ?? {}).map(([name, boundary], index) => ({
    id: cemeteryId * 1000 + index + 1,
    name,
    cemeteryId,
    cemeteryName,
    burialCount: 0,
    boundary: normalizeBoundary(boundary),
  })) satisfies SectorResponse[];
}

const cemeterySeeds: Array<{
  id: number;
  name: string;
  address: string;
  description: string;
  boundaries: BoundaryFile;
}> = [
  {
    id: 1,
    name: 'Тестовое',
    address: 'Новосибирск, демонстрационный полигон',
    description: 'Тестовое кладбище для проверки отображения границ, кварталов и сценариев работы с картой.',
    boundaries: testBoundaries as BoundaryFile,
  },
  {
    id: 2,
    name: 'Южное',
    address: 'Новосибирск, Южное кладбище',
    description: 'Основное демонстрационное кладбище с реальными координатами участков и захоронений из seed-файлов проекта.',
    boundaries: yuzhnoeBoundaries as BoundaryFile,
  },
];

function buildDemoData() {
  const cemeteries: CemeteryResponse[] = cemeterySeeds.map((seed) => ({
    id: seed.id,
    name: seed.name,
    address: seed.address,
    description: seed.description,
    boundary: normalizeBoundary(seed.boundaries.cemeteryBoundary),
    sectors: makeSectors(seed.id, seed.name, seed.boundaries),
  }));

  const burials: BurialResponse[] = ((gravesData as GravesFile).graves ?? []).flatMap((grave, index) => {
    const latitude = Number(grave.latitude);
    const longitude = Number(grave.longitude);
    const fullName = grave.fullName?.trim();
    if (!fullName || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return [];
    }

    const point = { latitude, longitude };
    const cemetery = cemeteries.find((item) => pointInPolygon(point, item.boundary ?? [])) ?? null;
    const sector = cemetery?.sectors.find((item) => pointInPolygon(point, item.boundary ?? [])) ?? null;

    return [
      {
        id: index + 1,
        fullName,
        birthDate: parseSeedDate(grave.birthDate),
        deathDate: parseSeedDate(grave.deathDate),
        latitude,
        longitude,
        photoUrl: grave.photo?.trim() || null,
        sectorId: sector?.id ?? null,
        sectorName: sector?.name ?? '',
        cemeteryId: cemetery?.id ?? null,
        cemeteryName: cemetery?.name ?? '',
        biography: grave.shortInfo?.trim() || null,
        biographyStatus: grave.shortInfo?.trim() ? 'GENERATED' : 'NOT_REQUESTED',
        createdAt: now,
        updatedAt: now,
      },
    ] satisfies BurialResponse[];
  });

  const burialCountBySector = new Map<number, number>();
  for (const burial of burials) {
    if (burial.sectorId == null) continue;
    burialCountBySector.set(burial.sectorId, (burialCountBySector.get(burial.sectorId) ?? 0) + 1);
  }

  return {
    cemeteries: cemeteries.map((cemetery) => ({
      ...cemetery,
      sectors: cemetery.sectors.map((sector) => ({
        ...sector,
        burialCount: burialCountBySector.get(sector.id) ?? 0,
      })),
    })),
    burials,
  };
}

const demoData = buildDemoData();

export function getDemoCemeteries() {
  return demoData.cemeteries;
}

export function getDemoCemetery(id: number) {
  return demoData.cemeteries.find((cemetery) => cemetery.id === id) ?? null;
}

export function getDemoBurials(cemeteryId?: number | null) {
  if (cemeteryId == null) return demoData.burials;
  return demoData.burials.filter((burial) => burial.cemeteryId === cemeteryId);
}

export function getDemoBurial(id: number) {
  return demoData.burials.find((burial) => burial.id === id) ?? null;
}

export function searchDemoBurials(name: string) {
  const query = name.trim().toLocaleLowerCase('ru');
  if (!query) return [];
  return demoData.burials.filter((burial) => burial.fullName.toLocaleLowerCase('ru').includes(query));
}

export function findNearbyDemoBurials(latitude: number, longitude: number, radiusMeters = 100) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  return demoData.burials.filter((burial) => {
    if (burial.latitude == null || burial.longitude == null) return false;
    const dLat = toRadians(burial.latitude - latitude);
    const dLon = toRadians(burial.longitude - longitude);
    const lat1 = toRadians(latitude);
    const lat2 = toRadians(burial.latitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const distance = 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return distance <= radiusMeters;
  });
}

export function resolveDemoPlacement(latitude: number | null | undefined, longitude: number | null | undefined) {
  if (latitude == null || longitude == null) {
    return { cemetery: null, sector: null };
  }

  const point = { latitude, longitude };
  const cemetery = demoData.cemeteries.find((item) => pointInPolygon(point, item.boundary ?? [])) ?? null;
  const sector = cemetery?.sectors.find((item) => pointInPolygon(point, item.boundary ?? [])) ?? null;
  return { cemetery, sector };
}

