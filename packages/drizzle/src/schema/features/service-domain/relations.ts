import { relations } from "drizzle-orm";
import {
  serviceDoctorHospitals,
  serviceDoctorSpecialties,
  serviceDoctors,
} from "./doctors";
import { serviceHospitals } from "./hospitals";
import { serviceRegions } from "./regions";
import { serviceSpecialties } from "./specialties";
import { serviceDoctorCredentials } from "./credentials";
import { serviceHospitalHours, serviceHospitalSpecialties } from "./hospital-details";

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
  credentials: many(serviceDoctorCredentials),
}));

export const serviceHospitalsRelations = relations(serviceHospitals, ({ one, many }) => ({
  region: one(serviceRegions, {
    fields: [serviceHospitals.regionId],
    references: [serviceRegions.id],
  }),
  doctors: many(serviceDoctorHospitals),
  specialties: many(serviceHospitalSpecialties),
  hours: many(serviceHospitalHours),
}));

export const serviceSpecialtiesRelations = relations(serviceSpecialties, ({ many }) => ({
  doctors: many(serviceDoctorSpecialties),
  hospitals: many(serviceHospitalSpecialties),
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

export const serviceDoctorCredentialsRelations = relations(serviceDoctorCredentials, ({ one }) => ({
  doctor: one(serviceDoctors, {
    fields: [serviceDoctorCredentials.doctorId],
    references: [serviceDoctors.id],
  }),
}));

export const serviceHospitalSpecialtiesRelations = relations(
  serviceHospitalSpecialties,
  ({ one }) => ({
    hospital: one(serviceHospitals, {
      fields: [serviceHospitalSpecialties.hospitalId],
      references: [serviceHospitals.id],
    }),
    specialty: one(serviceSpecialties, {
      fields: [serviceHospitalSpecialties.specialtyId],
      references: [serviceSpecialties.id],
    }),
  }),
);

export const serviceHospitalHoursRelations = relations(serviceHospitalHours, ({ one }) => ({
  hospital: one(serviceHospitals, {
    fields: [serviceHospitalHours.hospitalId],
    references: [serviceHospitals.id],
  }),
}));
