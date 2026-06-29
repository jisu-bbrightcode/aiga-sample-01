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
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import type {
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

/** The transaction handle drizzle hands to a `db.transaction(...)` callback. */
type ServiceDbTx = Parameters<Parameters<DrizzleDB["transaction"]>[0]>[0];

@Injectable()
export class ServiceDomainService {
  private readonly logger = new Logger(ServiceDomainService.name);

  constructor(@InjectDrizzle() private readonly db: DrizzleDB) {}

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
      return toAdminDoctor(created);
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
      return toAdminHospital(this.firstOrThrow(rows));
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
