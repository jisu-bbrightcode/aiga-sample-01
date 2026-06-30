import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type { DrizzleDB } from "@repo/drizzle";
import { InjectDrizzle } from "@repo/drizzle";
import {
  serviceDoctorCredentials,
  serviceDoctorHospitals,
  serviceDoctorSpecialties,
  serviceDoctors,
  serviceHospitalHours,
  serviceHospitalSpecialties,
  serviceHospitals,
  serviceRegions,
  serviceSpecialties,
} from "@repo/drizzle/schema";
import { AdminAuditService } from "@repo/features/_common";
import { and, asc, desc, eq, ilike, or, type SQL, sql } from "drizzle-orm";
import {
  type AdminDomainResourceDetail,
  toAdminDoctorDetail,
  toAdminHospitalDetail,
} from "../admin-resource-detail";
import {
  type AdminDomainResource,
  type AdminDomainResourceListResult,
  type AdminDomainResourceType,
  type AdminDomainSortKey,
  mergeResourcePage,
  type SortOrder,
  toAdminDomainResource,
  totalPages,
} from "../admin-resources";
import type {
  AdminDomainResourceQueryDto,
  CreateDoctorCredentialDto,
  CreateDoctorDto,
  CreateHospitalDto,
  CreateHospitalHoursDto,
  CreateHospitalSpecialtyDto,
  ListDoctorsQueryDto,
  ListHospitalsQueryDto,
  UpdateDoctorDto,
  UpdateHospitalDto,
} from "../dto";
import {
  type PublicDoctorDetail,
  type PublicHospitalDetail,
  toAdminDoctor,
  toAdminDoctorCredential,
  toAdminHospital,
  toAdminHospitalHours,
  toPublicDoctor,
  toPublicDoctorCredential,
  toPublicHospital,
  toPublicHospitalHours,
  toPublicRegion,
  toPublicSpecialty,
} from "../mappers";
import { resolveStatusChange, type ServicePublishStatus } from "../status";

/** Postgres unique-violation SQLSTATE — surfaced as a friendly 409. */
const PG_UNIQUE_VIOLATION = "23505";

const PUBLISHED: ServicePublishStatus = "published";
const DRAFT: ServicePublishStatus = "draft";
const ARCHIVED: ServicePublishStatus = "archived";

/**
 * Audit descriptors written to the shared `admin_audit_log` (append-only).
 * Covers the create (BBR-680) and archive/restore lifecycle (BBR-682) — the
 * admin mutations in this domain that leave a durable operator trail.
 */
export const ServiceDomainAuditAction = {
  archived: "service_domain.archived",
  restored: "service_domain.restored",
  doctorCreated: "domain.doctor.created",
  hospitalCreated: "domain.hospital.created",
} as const;
export type ServiceDomainAuditAction =
  (typeof ServiceDomainAuditAction)[keyof typeof ServiceDomainAuditAction];

/** Free-form `admin_audit_log.targetType` per resource kind. */
const RESOURCE_TARGET_TYPE: Record<AdminDomainResourceType, string> = {
  doctor: "service_doctor",
  hospital: "service_hospital",
};

/** Compact lifecycle result returned by archive/restore. */
export interface DomainResourceLifecycleResult {
  type: AdminDomainResourceType;
  id: string;
  name: string;
  slug: string;
  status: ServicePublishStatus;
  isDeleted: boolean;
}

/** The transaction handle drizzle hands to a `db.transaction(...)` callback. */
type ServiceDbTx = Parameters<Parameters<DrizzleDB["transaction"]>[0]>[0];

/** Shared options for the per-table admin resource queries. */
interface ResourceQueryOpts {
  status?: ServicePublishStatus;
  search?: string;
  sort: AdminDomainSortKey;
  order: SortOrder;
  limit: number;
  offset: number;
}

@Injectable()
export class ServiceDomainService {
  private readonly logger = new Logger(ServiceDomainService.name);

  constructor(
    @InjectDrizzle() private readonly db: DrizzleDB,
    private readonly audit: AdminAuditService,
  ) {}

  // =========================================================================
  // Taxonomy (public read-only reference data)
  // =========================================================================

  async listSpecialties() {
    const rows = await this.db
      .select()
      .from(serviceSpecialties)
      .where(eq(serviceSpecialties.isActive, true))
      .orderBy(asc(serviceSpecialties.sortOrder), asc(serviceSpecialties.name));
    return rows.map(toPublicSpecialty);
  }

  async listRegions(parentId?: string) {
    const where = and(
      eq(serviceRegions.isActive, true),
      parentId ? eq(serviceRegions.parentId, parentId) : undefined,
    );
    const rows = await this.db
      .select()
      .from(serviceRegions)
      .where(where)
      .orderBy(asc(serviceRegions.sortOrder), asc(serviceRegions.name));
    return rows.map(toPublicRegion);
  }

  // =========================================================================
  // Doctors — public browse
  // =========================================================================

  async listDoctors(query: ListDoctorsQueryDto) {
    const { page, limit, specialtyId, regionId, featured, q } = query;
    // Public browse: only published, non-deleted records are ever visible.
    // Specialty filter uses the denormalized primary specialty (index-aligned
    // with idx_service_doctors_status_specialty); the full M:N set is exposed
    // on the detail endpoint.
    const where = and(
      eq(serviceDoctors.status, PUBLISHED),
      eq(serviceDoctors.isDeleted, false),
      specialtyId ? eq(serviceDoctors.primarySpecialtyId, specialtyId) : undefined,
      regionId ? eq(serviceDoctors.regionId, regionId) : undefined,
      featured === true ? eq(serviceDoctors.isFeatured, true) : undefined,
      q ? ilike(serviceDoctors.name, `%${q}%`) : undefined,
    );

    const orderBy = featured
      ? [asc(serviceDoctors.featuredRank), desc(serviceDoctors.ratingAvg)]
      : [desc(serviceDoctors.ratingAvg), desc(serviceDoctors.createdAt)];

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(serviceDoctors)
        .where(where)
        .orderBy(...orderBy)
        .limit(limit)
        .offset((page - 1) * limit),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(serviceDoctors)
        .where(where),
    ]);

    return { items: rows.map(toPublicDoctor), total: countRows[0]?.count ?? 0, page, limit };
  }

  async getDoctorBySlug(slug: string): Promise<PublicDoctorDetail> {
    const row = await this.db.query.serviceDoctors.findFirst({
      where: and(
        eq(serviceDoctors.slug, slug),
        eq(serviceDoctors.status, PUBLISHED),
        eq(serviceDoctors.isDeleted, false),
      ),
      with: {
        region: true,
        specialties: { with: { specialty: true } },
        hospitals: { with: { hospital: true } },
        credentials: true,
      },
    });

    if (!row) {
      throw new NotFoundException("의사를 찾을 수 없습니다.");
    }

    return {
      ...toPublicDoctor(row),
      region: row.region ? toPublicRegion(row.region) : null,
      specialties: row.specialties
        .filter((s) => s.specialty?.isActive)
        .map((s) => toPublicSpecialty(s.specialty)),
      // Never leak a non-published hospital through a doctor's affiliations.
      hospitals: row.hospitals
        .filter((h) => h.hospital && h.hospital.status === PUBLISHED && !h.hospital.isDeleted)
        .map((h) => ({
          hospital: toPublicHospital(h.hospital),
          role: h.role,
          isPrimary: h.isPrimary,
        })),
      // FR-005 profile: only visible entries, grouped by section then sort order.
      credentials: row.credentials
        .filter((c) => c.isVisible)
        .sort((a, b) => a.kind.localeCompare(b.kind) || a.sortOrder - b.sortOrder)
        .map(toPublicDoctorCredential),
    };
  }

  // =========================================================================
  // Hospitals — public browse
  // =========================================================================

  async listHospitals(query: ListHospitalsQueryDto) {
    const { page, limit, regionId, featured, q } = query;
    const where = and(
      eq(serviceHospitals.status, PUBLISHED),
      eq(serviceHospitals.isDeleted, false),
      regionId ? eq(serviceHospitals.regionId, regionId) : undefined,
      featured === true ? eq(serviceHospitals.isFeatured, true) : undefined,
      q ? ilike(serviceHospitals.name, `%${q}%`) : undefined,
    );

    const [rows, countRows] = await Promise.all([
      this.db
        .select()
        .from(serviceHospitals)
        .where(where)
        .orderBy(desc(serviceHospitals.ratingAvg), desc(serviceHospitals.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(serviceHospitals)
        .where(where),
    ]);

    return { items: rows.map(toPublicHospital), total: countRows[0]?.count ?? 0, page, limit };
  }

  async getHospitalBySlug(slug: string): Promise<PublicHospitalDetail> {
    const row = await this.db.query.serviceHospitals.findFirst({
      where: and(
        eq(serviceHospitals.slug, slug),
        eq(serviceHospitals.status, PUBLISHED),
        eq(serviceHospitals.isDeleted, false),
      ),
      with: {
        region: true,
        doctors: { with: { doctor: true } },
        specialties: { with: { specialty: true } },
        hours: true,
      },
    });

    if (!row) {
      throw new NotFoundException("병원을 찾을 수 없습니다.");
    }

    return {
      ...toPublicHospital(row),
      region: row.region ? toPublicRegion(row.region) : null,
      doctors: row.doctors
        .map((d) => d.doctor)
        .filter((d) => d && d.status === PUBLISHED && !d.isDeleted)
        .map(toPublicDoctor),
      // FR-005 병원 상세: department list (in display order) + weekly hours.
      specialties: row.specialties
        .filter((s) => s.specialty?.isActive)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => toPublicSpecialty(s.specialty)),
      hours: row.hours
        .slice()
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
        .map(toPublicHospitalHours),
    };
  }

  // =========================================================================
  // Doctors — admin CRUD + status
  // =========================================================================

  async createDoctor(actorId: string, dto: CreateDoctorDto) {
    const { specialtyIds, hospitals, ...fields } = dto;
    try {
      const created = await this.db.transaction(async (tx) => {
        const rows = await tx
          .insert(serviceDoctors)
          .values({
            ...fields,
            publishedAt: fields.status === PUBLISHED ? new Date() : null,
            createdBy: actorId,
            updatedBy: actorId,
          })
          .returning();
        const doctor = this.firstOrThrow(rows);
        await this.replaceDoctorAssociations(tx, doctor.id, specialtyIds, hospitals);
        return doctor;
      });
      const admin = toAdminDoctor(created);
      // 생성 작업은 감사 로그에 남는다 (BBR-680 AC). The record is created in its
      // initial lifecycle state (defaults to draft) and the operator action is
      // appended append-only to admin_audit_log.
      await this.audit.log({
        actorUserId: actorId,
        action: ServiceDomainAuditAction.doctorCreated,
        targetType: RESOURCE_TARGET_TYPE.doctor,
        targetId: created.id,
        payloadAfter: admin,
      });
      return admin;
    } catch (error) {
      throw this.mapWriteError(error, "의사");
    }
  }

  async updateDoctor(actorId: string, id: string, dto: UpdateDoctorDto) {
    const { specialtyIds, hospitals, ...fields } = dto;
    await this.requireDoctor(id);
    try {
      const updated = await this.db.transaction(async (tx) => {
        const rows = await tx
          .update(serviceDoctors)
          .set({ ...fields, updatedBy: actorId })
          .where(eq(serviceDoctors.id, id))
          .returning();
        if (specialtyIds !== undefined || hospitals !== undefined) {
          await this.replaceDoctorAssociations(tx, id, specialtyIds, hospitals);
        }
        return this.firstOrThrow(rows);
      });
      return toAdminDoctor(updated);
    } catch (error) {
      throw this.mapWriteError(error, "의사");
    }
  }

  async changeDoctorStatus(actorId: string, id: string, status: ServicePublishStatus) {
    const current = await this.requireDoctor(id);
    const patch = resolveStatusChange(status, new Date(), current.publishedAt);
    const updated = await this.db
      .update(serviceDoctors)
      .set({ ...patch, updatedBy: actorId })
      .where(eq(serviceDoctors.id, id))
      .returning();
    return toAdminDoctor(this.firstOrThrow(updated));
  }

  async deleteDoctor(actorId: string, id: string) {
    await this.requireDoctor(id);
    await this.db
      .update(serviceDoctors)
      .set({ isDeleted: true, deletedAt: new Date(), updatedBy: actorId })
      .where(eq(serviceDoctors.id, id));
    return { success: true, id };
  }

  // =========================================================================
  // Hospitals — admin CRUD + status
  // =========================================================================

  async createHospital(actorId: string, dto: CreateHospitalDto) {
    try {
      const rows = await this.db
        .insert(serviceHospitals)
        .values({
          ...dto,
          publishedAt: dto.status === PUBLISHED ? new Date() : null,
          createdBy: actorId,
          updatedBy: actorId,
        })
        .returning();
      const admin = toAdminHospital(this.firstOrThrow(rows));
      // 생성 작업은 감사 로그에 남는다 (BBR-680 AC).
      await this.audit.log({
        actorUserId: actorId,
        action: ServiceDomainAuditAction.hospitalCreated,
        targetType: RESOURCE_TARGET_TYPE.hospital,
        targetId: admin.id,
        payloadAfter: admin,
      });
      return admin;
    } catch (error) {
      throw this.mapWriteError(error, "병원");
    }
  }

  async updateHospital(actorId: string, id: string, dto: UpdateHospitalDto) {
    await this.requireHospital(id);
    try {
      const rows = await this.db
        .update(serviceHospitals)
        .set({ ...dto, updatedBy: actorId })
        .where(eq(serviceHospitals.id, id))
        .returning();
      return toAdminHospital(this.firstOrThrow(rows));
    } catch (error) {
      throw this.mapWriteError(error, "병원");
    }
  }

  async changeHospitalStatus(actorId: string, id: string, status: ServicePublishStatus) {
    const current = await this.requireHospital(id);
    const patch = resolveStatusChange(status, new Date(), current.publishedAt);
    const rows = await this.db
      .update(serviceHospitals)
      .set({ ...patch, updatedBy: actorId })
      .where(eq(serviceHospitals.id, id))
      .returning();
    return toAdminHospital(this.firstOrThrow(rows));
  }

  async deleteHospital(actorId: string, id: string) {
    await this.requireHospital(id);
    await this.db
      .update(serviceHospitals)
      .set({ isDeleted: true, deletedAt: new Date(), updatedBy: actorId })
      .where(eq(serviceHospitals.id, id));
    return { success: true, id };
  }

  // =========================================================================
  // Profile detail — admin create (FR-005 의사 프로필 / 병원 상세)
  // =========================================================================

  /** Create a 의사 프로필 이력 항목 (education/career/certification/award). */
  async createDoctorCredential(actorId: string, doctorId: string, dto: CreateDoctorCredentialDto) {
    await this.requireDoctor(doctorId);
    const rows = await this.db
      .insert(serviceDoctorCredentials)
      .values({ ...dto, doctorId })
      .returning();
    const created = this.firstOrThrow(rows);
    this.logger.log(`doctor-credential created id=${created.id} doctor=${doctorId} by=${actorId}`);
    return toAdminDoctorCredential(created);
  }

  /** Add a 병원 진료과 (hospital ↔ specialty department link). */
  async addHospitalSpecialty(actorId: string, hospitalId: string, dto: CreateHospitalSpecialtyDto) {
    await this.requireHospital(hospitalId);
    await this.requireSpecialty(dto.specialtyId);
    try {
      const rows = await this.db
        .insert(serviceHospitalSpecialties)
        .values({ hospitalId, specialtyId: dto.specialtyId, sortOrder: dto.sortOrder })
        .returning();
      const created = this.firstOrThrow(rows);
      this.logger.log(
        `hospital-specialty added hospital=${hospitalId} specialty=${dto.specialtyId} by=${actorId}`,
      );
      return {
        hospitalId: created.hospitalId,
        specialtyId: created.specialtyId,
        sortOrder: created.sortOrder,
      };
    } catch (error) {
      throw this.mapUniqueConflict(error, "이미 등록된 진료과입니다.", "병원 진료과");
    }
  }

  /** Add a 병원 운영시간 entry for a single weekday. */
  async addHospitalHours(actorId: string, hospitalId: string, dto: CreateHospitalHoursDto) {
    await this.requireHospital(hospitalId);
    try {
      const rows = await this.db
        .insert(serviceHospitalHours)
        .values({ ...dto, hospitalId })
        .returning();
      const created = this.firstOrThrow(rows);
      this.logger.log(
        `hospital-hours added hospital=${hospitalId} day=${dto.dayOfWeek} by=${actorId}`,
      );
      return toAdminHospitalHours(created);
    } catch (error) {
      throw this.mapUniqueConflict(
        error,
        "해당 요일의 운영시간이 이미 등록되어 있습니다.",
        "병원 운영시간",
      );
    }
  }

  // =========================================================================
  // Admin — unified domain resource list (PB-ADMIN-DOMAIN-API-001 / BBR-761)
  // =========================================================================

  /**
   * Admin console list across both catalog tables (의사 + 병원).
   *
   * Admin-only: surfaces every lifecycle state (draft/published/archived) and a
   * deliberately narrow projection — sensitive columns are never selected. When
   * `type` is omitted the result is a union of doctors + hospitals ordered by the
   * requested key across both tables.
   */
  async listAdminDomainResources(
    query: AdminDomainResourceQueryDto,
  ): Promise<AdminDomainResourceListResult> {
    const { page, limit, type, status, search, sort, order } = query;

    const wantDoctors = !type || type === "doctor";
    const wantHospitals = !type || type === "hospital";

    // For a single-table list the DB applies the page window directly. For the
    // union we must pull each table's first page*limit rows so the in-app merge
    // of the two sorted streams reproduces the correct global page window.
    const fetchLimit = type ? limit : page * limit;
    const fetchOffset = type ? (page - 1) * limit : 0;

    const [doctor, hospital] = await Promise.all([
      wantDoctors
        ? this.queryDoctorResources({
            status,
            search,
            sort,
            order,
            limit: fetchLimit,
            offset: fetchOffset,
          })
        : Promise.resolve<[AdminDomainResource[], number]>([[], 0]),
      wantHospitals
        ? this.queryHospitalResources({
            status,
            search,
            sort,
            order,
            limit: fetchLimit,
            offset: fetchOffset,
          })
        : Promise.resolve<[AdminDomainResource[], number]>([[], 0]),
    ]);

    const [doctorRows, doctorCount] = doctor;
    const [hospitalRows, hospitalCount] = hospital;
    const total = doctorCount + hospitalCount;

    let items: AdminDomainResource[];
    if (type === "doctor") {
      items = doctorRows;
    } else if (type === "hospital") {
      items = hospitalRows;
    } else {
      items = mergeResourcePage(doctorRows, hospitalRows, { sort, order, page, limit });
    }

    return { items, total, page, limit, totalPages: totalPages(total, limit) };
  }

  /**
   * Read one catalog resource for the admin detail screen
   * (PB-ADMIN-DOMAIN-READ-001 / BBR-679).
   *
   * Unlike the public detail (published-only), the admin view resolves a record
   * in ANY lifecycle state (draft/published/archived) and even after a soft
   * delete, so operators can inspect and recover it. The detail mapper masks
   * sensitive identifiers (면허번호/사업자등록번호) before they leave the service.
   */
  getAdminDomainResourceDetail(
    type: AdminDomainResourceType,
    id: string,
  ): Promise<AdminDomainResourceDetail> {
    return type === "doctor" ? this.getAdminDoctorDetail(id) : this.getAdminHospitalDetail(id);
  }

  // =========================================================================
  // Admin — archive / restore lifecycle (PB-ADMIN-DOMAIN-DELETE-001 / BBR-682)
  //
  // 도메인 리소스(의사·병원)를 실제 삭제하지 않고 비활성/archive 한다. 게시 상태만
  // 내려 공개/앱 노출을 차단하고, 연결 데이터(진료과·소속·이력·운영시간 등)와
  // 하위 이력/감사 참조는 행을 그대로 두어 보존한다. 물리 DELETE 는 발생하지 않는다.
  //
  //   archive  → status='archived', publishedAt=null : 공개/앱 노출 차단, 관리자엔 유지
  //   restore  → status='draft',    publishedAt=null : 안전한 비공개 draft 로 복구(자동 재게시 X)
  //
  // 노출 정책 (acceptance criteria #1): 공개 browse/detail 은 status='published'
  // AND isDeleted=false 만 노출하므로 archive 즉시 공개/앱에서 사라진다.
  // 모든 전이는 `admin_audit_log` 에 append-only 로 기록된다 (acceptance #2).
  // =========================================================================

  /** 노출 차단(archive): 게시를 내려 공개/앱 노출만 막고 관리 대상으로 유지한다. */
  async archiveDomainResource(
    actorId: string,
    type: AdminDomainResourceType,
    id: string,
  ): Promise<DomainResourceLifecycleResult> {
    const current = await this.requireResource(type, id);
    if (current.status === ARCHIVED) {
      // 멱등: 이미 archived 면 추가 write·감사 없이 현재 상태를 반환한다.
      return this.toLifecycleResult(type, current);
    }
    return this.transitionResourceStatus({ actorId, type, id, current, next: ARCHIVED });
  }

  /** 복구(restore): archive 된 리소스를 안전한 비공개 draft 로 되살린다. */
  async restoreDomainResource(
    actorId: string,
    type: AdminDomainResourceType,
    id: string,
  ): Promise<DomainResourceLifecycleResult> {
    const current = await this.requireResource(type, id);
    if (current.status !== ARCHIVED) {
      // 멱등: archive 상태가 아니면 게시 상태를 함부로 내리지 않고 그대로 반환한다.
      return this.toLifecycleResult(type, current);
    }
    return this.transitionResourceStatus({ actorId, type, id, current, next: DRAFT });
  }

  /**
   * Apply a status transition + write the audit trail. Shared by archive/restore.
   * `publishedAt` is recomputed via {@link resolveStatusChange} (both archived and
   * draft drop the publish stamp), so the record is no longer publicly visible.
   */
  private async transitionResourceStatus(opts: {
    actorId: string;
    type: AdminDomainResourceType;
    id: string;
    current: { status: ServicePublishStatus; publishedAt: Date | null };
    next: ServicePublishStatus;
  }): Promise<DomainResourceLifecycleResult> {
    const { actorId, type, id, current, next } = opts;
    const patch = resolveStatusChange(next, new Date(), current.publishedAt);
    const updated = await this.writeResourceStatus(type, id, { ...patch, updatedBy: actorId });
    await this.audit.log({
      actorUserId: actorId,
      action:
        next === ARCHIVED ? ServiceDomainAuditAction.archived : ServiceDomainAuditAction.restored,
      targetType: RESOURCE_TARGET_TYPE[type],
      targetId: id,
      payloadBefore: { status: current.status, publishedAt: current.publishedAt },
      payloadAfter: { status: updated.status, publishedAt: updated.publishedAt },
    });
    this.logger.log(`도메인 리소스 ${next} type=${type} id=${id} actor=${actorId}`);
    return this.toLifecycleResult(type, updated);
  }

  /** Load an active (non-deleted) catalog row in any lifecycle state, or 404. */
  private requireResource(type: AdminDomainResourceType, id: string) {
    return type === "doctor" ? this.requireDoctor(id) : this.requireHospital(id);
  }

  /** Write a status patch to the correct table and return the updated row. */
  private async writeResourceStatus(
    type: AdminDomainResourceType,
    id: string,
    patch: { status: ServicePublishStatus; publishedAt: Date | null; updatedBy: string },
  ) {
    if (type === "doctor") {
      const rows = await this.db
        .update(serviceDoctors)
        .set(patch)
        .where(eq(serviceDoctors.id, id))
        .returning();
      return this.firstOrThrow(rows);
    }
    const rows = await this.db
      .update(serviceHospitals)
      .set(patch)
      .where(eq(serviceHospitals.id, id))
      .returning();
    return this.firstOrThrow(rows);
  }

  private toLifecycleResult(
    type: AdminDomainResourceType,
    row: {
      id: string;
      name: string;
      slug: string;
      status: ServicePublishStatus;
      isDeleted: boolean;
    },
  ): DomainResourceLifecycleResult {
    return {
      type,
      id: row.id,
      name: row.name,
      slug: row.slug,
      status: row.status,
      isDeleted: row.isDeleted,
    };
  }

  private async getAdminDoctorDetail(id: string): Promise<AdminDomainResourceDetail> {
    const row = await this.db.query.serviceDoctors.findFirst({
      where: eq(serviceDoctors.id, id),
      with: {
        region: true,
        specialties: { with: { specialty: true } },
        hospitals: { with: { hospital: true } },
        credentials: true,
      },
    });
    if (!row) {
      throw new NotFoundException("의사를 찾을 수 없습니다.");
    }

    const specialties = row.specialties
      .map((s) => s.specialty)
      .filter((s): s is NonNullable<typeof s> => s != null);
    const primarySpecialty = row.primarySpecialtyId
      ? (specialties.find((s) => s.id === row.primarySpecialtyId) ?? null)
      : null;

    return toAdminDoctorDetail({
      doctor: row,
      region: row.region ?? null,
      primarySpecialty,
      specialties,
      hospitals: row.hospitals
        .filter((h) => h.hospital != null)
        .map((h) => ({ hospital: h.hospital, role: h.role, isPrimary: h.isPrimary })),
      // Group by section then display order — matches the public profile order.
      credentials: row.credentials
        .slice()
        .sort((a, b) => a.kind.localeCompare(b.kind) || a.sortOrder - b.sortOrder),
    });
  }

  private async getAdminHospitalDetail(id: string): Promise<AdminDomainResourceDetail> {
    const row = await this.db.query.serviceHospitals.findFirst({
      where: eq(serviceHospitals.id, id),
      with: {
        region: true,
        doctors: { with: { doctor: true } },
        specialties: { with: { specialty: true } },
        hours: true,
      },
    });
    if (!row) {
      throw new NotFoundException("병원을 찾을 수 없습니다.");
    }

    return toAdminHospitalDetail({
      hospital: row,
      region: row.region ?? null,
      specialties: row.specialties
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((s) => s.specialty)
        .filter((s): s is NonNullable<typeof s> => s != null),
      doctors: row.doctors
        .map((d) => d.doctor)
        .filter((d): d is NonNullable<typeof d> => d != null),
      hours: row.hours.slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek),
    });
  }

  private async queryDoctorResources(
    opts: ResourceQueryOpts,
  ): Promise<[AdminDomainResource[], number]> {
    const { status, search, sort, order, limit, offset } = opts;
    const where = and(
      eq(serviceDoctors.isDeleted, false),
      status ? eq(serviceDoctors.status, status) : undefined,
      search
        ? or(ilike(serviceDoctors.name, `%${search}%`), ilike(serviceDoctors.slug, `%${search}%`))
        : undefined,
    );
    const sortColumn = {
      name: serviceDoctors.name,
      status: serviceDoctors.status,
      updatedAt: serviceDoctors.updatedAt,
    }[sort];
    const dir = order === "asc" ? asc : desc;

    const [rows, countRows] = await Promise.all([
      this.db
        .select({
          id: serviceDoctors.id,
          name: serviceDoctors.name,
          slug: serviceDoctors.slug,
          status: serviceDoctors.status,
          regionName: serviceRegions.name,
          specialtyName: serviceSpecialties.name,
          isFeatured: serviceDoctors.isFeatured,
          updatedAt: serviceDoctors.updatedAt,
          createdAt: serviceDoctors.createdAt,
        })
        .from(serviceDoctors)
        .leftJoin(serviceRegions, eq(serviceDoctors.regionId, serviceRegions.id))
        .leftJoin(serviceSpecialties, eq(serviceDoctors.primarySpecialtyId, serviceSpecialties.id))
        .where(where)
        // secondary asc(id) mirrors the merge comparator's tiebreaker exactly.
        .orderBy(dir(sortColumn), asc(serviceDoctors.id))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(serviceDoctors)
        .where(where),
    ]);

    return [rows.map((row) => toAdminDomainResource(row, "doctor")), countRows[0]?.count ?? 0];
  }

  private async queryHospitalResources(
    opts: ResourceQueryOpts,
  ): Promise<[AdminDomainResource[], number]> {
    const { status, search, sort, order, limit, offset } = opts;
    const where = and(
      eq(serviceHospitals.isDeleted, false),
      status ? eq(serviceHospitals.status, status) : undefined,
      search
        ? or(
            ilike(serviceHospitals.name, `%${search}%`),
            ilike(serviceHospitals.slug, `%${search}%`),
          )
        : undefined,
    );
    const sortColumn = {
      name: serviceHospitals.name,
      status: serviceHospitals.status,
      updatedAt: serviceHospitals.updatedAt,
    }[sort];

    const [rows, countRows] = await Promise.all([
      this.db
        .select({
          id: serviceHospitals.id,
          name: serviceHospitals.name,
          slug: serviceHospitals.slug,
          status: serviceHospitals.status,
          regionName: serviceRegions.name,
          isFeatured: serviceHospitals.isFeatured,
          updatedAt: serviceHospitals.updatedAt,
          createdAt: serviceHospitals.createdAt,
        })
        .from(serviceHospitals)
        .leftJoin(serviceRegions, eq(serviceHospitals.regionId, serviceRegions.id))
        .where(where)
        .orderBy(this.direction(sortColumn, order), asc(serviceHospitals.id))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`cast(count(*) as int)` })
        .from(serviceHospitals)
        .where(where),
    ]);

    return [rows.map((row) => toAdminDomainResource(row, "hospital")), countRows[0]?.count ?? 0];
  }

  private direction(column: SQL | unknown, order: SortOrder) {
    return order === "asc" ? asc(column as never) : desc(column as never);
  }

  // =========================================================================
  // Internals
  // =========================================================================

  /** A create/update `.returning()` always yields one row; assert it for the type system. */
  private firstOrThrow<T>(rows: T[]): T {
    const row = rows[0];
    if (!row) {
      throw new Error("Write returned no row");
    }
    return row;
  }

  private async requireDoctor(id: string) {
    const [row] = await this.db
      .select()
      .from(serviceDoctors)
      .where(and(eq(serviceDoctors.id, id), eq(serviceDoctors.isDeleted, false)))
      .limit(1);
    if (!row) {
      throw new NotFoundException("의사를 찾을 수 없습니다.");
    }
    return row;
  }

  private async requireHospital(id: string) {
    const [row] = await this.db
      .select()
      .from(serviceHospitals)
      .where(and(eq(serviceHospitals.id, id), eq(serviceHospitals.isDeleted, false)))
      .limit(1);
    if (!row) {
      throw new NotFoundException("병원을 찾을 수 없습니다.");
    }
    return row;
  }

  private async requireSpecialty(id: string) {
    const [row] = await this.db
      .select()
      .from(serviceSpecialties)
      .where(and(eq(serviceSpecialties.id, id), eq(serviceSpecialties.isActive, true)))
      .limit(1);
    if (!row) {
      throw new NotFoundException("진료과를 찾을 수 없습니다.");
    }
    return row;
  }

  /** Replace-semantics for a doctor's M:N associations within a transaction. */
  private async replaceDoctorAssociations(
    tx: ServiceDbTx,
    doctorId: string,
    specialtyIds: string[] | undefined,
    hospitals: CreateDoctorDto["hospitals"],
  ) {
    if (specialtyIds !== undefined) {
      await tx
        .delete(serviceDoctorSpecialties)
        .where(eq(serviceDoctorSpecialties.doctorId, doctorId));
      if (specialtyIds.length > 0) {
        await tx
          .insert(serviceDoctorSpecialties)
          .values(specialtyIds.map((specialtyId) => ({ doctorId, specialtyId })));
      }
    }
    if (hospitals !== undefined) {
      await tx.delete(serviceDoctorHospitals).where(eq(serviceDoctorHospitals.doctorId, doctorId));
      if (hospitals.length > 0) {
        await tx.insert(serviceDoctorHospitals).values(
          hospitals.map((h) => ({
            doctorId,
            hospitalId: h.hospitalId,
            role: h.role,
            isPrimary: h.isPrimary ?? false,
          })),
        );
      }
    }
  }

  private mapWriteError(error: unknown, label: string): Error {
    if (typeof error === "object" && error !== null && "code" in error) {
      const code = (error as { code?: string }).code;
      if (code === PG_UNIQUE_VIOLATION) {
        return new ConflictException(
          `이미 사용 중인 slug입니다. 다른 ${label} slug를 사용해주세요.`,
        );
      }
    }
    this.logger.error(
      `${label} write failed`,
      error instanceof Error ? error.stack : String(error),
    );
    return error instanceof Error ? error : new Error(String(error));
  }

  /** Map a unique-violation to a 409 with a resource-specific message. */
  private mapUniqueConflict(error: unknown, message: string, label: string): Error {
    if (typeof error === "object" && error !== null && "code" in error) {
      if ((error as { code?: string }).code === PG_UNIQUE_VIOLATION) {
        return new ConflictException(message);
      }
    }
    this.logger.error(
      `${label} write failed`,
      error instanceof Error ? error.stack : String(error),
    );
    return error instanceof Error ? error : new Error(String(error));
  }
}
