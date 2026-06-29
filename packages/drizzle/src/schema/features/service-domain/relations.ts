import { relations } from "drizzle-orm";
import {
  serviceDoctorHospitals,
  serviceDoctorSpecialties,
  serviceDoctors,
} from "./doctors";
import { serviceHospitals } from "./hospitals";
import { serviceRegions } from "./regions";
import { serviceSpecialties } from "./specialties";

/**
 * AIGA service-domain relations.
 *
 * Enables the drizzle relational query API across the catalog hub. Kept in a
 * dedicated file so table modules stay free of cross-table circular wiring.
 */

export const serviceDoctorsRelations = relations(serviceDoctors, ({ one, many }) => ({
  primarySpecialty: one(serviceSpecialties, {
    fields: [serviceDoctors.primarySpecialtyId],
    references: [serviceSpecialties.id],
  }),
  primaryHospital: one(serviceHospitals, {
    fields: [serviceDoctors.primaryHospitalId],
    references: [serviceHospitals.id],
  }),
  region: one(serviceRegions, {
    fields: [serviceDoctors.regionId],
    references: [serviceRegions.id],
  }),
  specialties: many(serviceDoctorSpecialties),
  hospitals: many(serviceDoctorHospitals),
}));

export const serviceHospitalsRelations = relations(serviceHospitals, ({ one, many }) => ({
  region: one(serviceRegions, {
    fields: [serviceHospitals.regionId],
    references: [serviceRegions.id],
  }),
  doctors: many(serviceDoctorHospitals),
}));

export const serviceSpecialtiesRelations = relations(serviceSpecialties, ({ many }) => ({
  doctors: many(serviceDoctorSpecialties),
}));

export const serviceRegionsRelations = relations(serviceRegions, ({ one, many }) => ({
  parent: one(serviceRegions, {
    fields: [serviceRegions.parentId],
    references: [serviceRegions.id],
    relationName: "region_parent",
  }),
  children: many(serviceRegions, { relationName: "region_parent" }),
}));

export const serviceDoctorSpecialtiesRelations = relations(serviceDoctorSpecialties, ({ one }) => ({
  doctor: one(serviceDoctors, {
    fields: [serviceDoctorSpecialties.doctorId],
    references: [serviceDoctors.id],
  }),
  specialty: one(serviceSpecialties, {
    fields: [serviceDoctorSpecialties.specialtyId],
    references: [serviceSpecialties.id],
  }),
}));

export const serviceDoctorHospitalsRelations = relations(serviceDoctorHospitals, ({ one }) => ({
  doctor: one(serviceDoctors, {
    fields: [serviceDoctorHospitals.doctorId],
    references: [serviceDoctors.id],
  }),
  hospital: one(serviceHospitals, {
    fields: [serviceDoctorHospitals.hospitalId],
    references: [serviceHospitals.id],
  }),
}));
