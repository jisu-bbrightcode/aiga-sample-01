/**
 * Server-side reader for the public service-domain catalog API
 * (`@repo/features/service-domain` → NestJS `/service/*`). Every route is
 * unauthenticated and returns only published, non-deleted records, so these
 * fetchers run in React Server Components without any auth header.
 *
 * The shapes mirror the public response DTOs exactly. They are declared here
 * (rather than imported from the server package) so the Next build stays
 * decoupled from the Nest runtime; the OpenAPI codegen client is a separate
 * follow-up. All fetchers fail soft — a down/unset API yields empty results so
 * public pages still render their value proposition and metadata.
 *
 * The API base is read straight from the env (no import of the auth-headers
 * client helper) so this module stays server-safe: pulling in `@repo/core/auth`
 * would drag client-only hooks into the RSC graph.
 */

/** Public API base (NestJS server), inlined by Next at build (`NEXT_PUBLIC_*`). */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

export interface PublicSpecialty {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sortOrder: number;
}

export interface PublicRegion {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
}

export interface PublicHospital {
  id: string;
  name: string;
  slug: string;
  summary: string | null;
  description: string | null;
  regionId: string | null;
  addressLine: string | null;
  phone: string | null;
  websiteUrl: string | null;
  photoUrl: string | null;
  ratingAvg: number;
  reviewCount: number;
  isFeatured: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PublicDoctor {
  id: string;
  name: string;
  slug: string;
  title: string | null;
  primarySpecialtyId: string | null;
  primaryHospitalId: string | null;
  regionId: string | null;
  shortBio: string | null;
  biography: string | null;
  photoUrl: string | null;
  yearsExperience: number | null;
  ratingAvg: number;
  reviewCount: number;
  isFeatured: boolean;
  featuredRank: number | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface PublicDoctorDetail extends PublicDoctor {
  region: PublicRegion | null;
  specialties: PublicSpecialty[];
  hospitals: Array<{ hospital: PublicHospital; role: string | null; isPrimary: boolean }>;
}

export interface PublicHospitalDetail extends PublicHospital {
  region: PublicRegion | null;
  doctors: PublicDoctor[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

const EMPTY_PAGE: Paginated<never> = { items: [], total: 0, page: 1, limit: 0 };

/** Revalidate public catalog reads every 5 minutes (ISR). */
const REVALIDATE_SECONDS = 300;

async function getJson<T>(path: string): Promise<T | null> {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}${path}`, {
      headers: { accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    // API unreachable/unset — public pages degrade gracefully to empty state.
    return null;
  }
}

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export interface ListDoctorsParams {
  page?: number;
  limit?: number;
  specialtyId?: string;
  regionId?: string;
  featured?: boolean;
  q?: string;
}

export async function listDoctors(
  params: ListDoctorsParams = {},
): Promise<Paginated<PublicDoctor>> {
  const data = await getJson<Paginated<PublicDoctor>>(
    `/service/doctors${buildQuery({ ...params })}`,
  );
  return data ?? { ...EMPTY_PAGE, limit: params.limit ?? 0 };
}

export function getDoctor(slug: string): Promise<PublicDoctorDetail | null> {
  return getJson<PublicDoctorDetail>(`/service/doctors/${encodeURIComponent(slug)}`);
}

export interface ListHospitalsParams {
  page?: number;
  limit?: number;
  regionId?: string;
  featured?: boolean;
  q?: string;
}

export async function listHospitals(
  params: ListHospitalsParams = {},
): Promise<Paginated<PublicHospital>> {
  const data = await getJson<Paginated<PublicHospital>>(
    `/service/hospitals${buildQuery({ ...params })}`,
  );
  return data ?? { ...EMPTY_PAGE, limit: params.limit ?? 0 };
}

export function getHospital(slug: string): Promise<PublicHospitalDetail | null> {
  return getJson<PublicHospitalDetail>(`/service/hospitals/${encodeURIComponent(slug)}`);
}

export async function listSpecialties(): Promise<PublicSpecialty[]> {
  return (await getJson<PublicSpecialty[]>("/service/specialties")) ?? [];
}

export async function listRegions(parentId?: string): Promise<PublicRegion[]> {
  return (await getJson<PublicRegion[]>(`/service/regions${buildQuery({ parentId })}`)) ?? [];
}
