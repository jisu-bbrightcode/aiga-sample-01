import { relations } from "drizzle-orm";
import { serviceDoctors } from "../service-domain/doctors";
import { serviceRegions } from "../service-domain/regions";
import { serviceSpecialties } from "../service-domain/specialties";
import { serviceDoctorCollectionItems, serviceDoctorCollections } from "./collections";

/**
 * FR-004 명의 큐레이션 relations.
 *
 * Declares the curation-side edges only. The hub-side relations
 * (`serviceDoctorsRelations` etc.) are owned by PB-DATA-001 and are NOT
 * redefined here — a doctor's "featured in collections" reverse lookup is served
 * by `idx_doctor_collection_items_doctor` at the query layer.
 */

export const serviceDoctorCollectionsRelations = relations(
  serviceDoctorCollections,
  ({ one, many }) => ({
    specialty: one(serviceSpecialties, {
      fields: [serviceDoctorCollections.specialtyId],
      references: [serviceSpecialties.id],
    }),
    region: one(serviceRegions, {
      fields: [serviceDoctorCollections.regionId],
      references: [serviceRegions.id],
    }),
    items: many(serviceDoctorCollectionItems),
  }),
);

export const serviceDoctorCollectionItemsRelations = relations(
  serviceDoctorCollectionItems,
  ({ one }) => ({
    collection: one(serviceDoctorCollections, {
      fields: [serviceDoctorCollectionItems.collectionId],
      references: [serviceDoctorCollections.id],
    }),
    doctor: one(serviceDoctors, {
      fields: [serviceDoctorCollectionItems.doctorId],
      references: [serviceDoctors.id],
    }),
  }),
);
