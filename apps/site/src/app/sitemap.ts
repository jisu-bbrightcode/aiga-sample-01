import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";
import { listDoctors, listHospitals } from "@/lib/service-api";

/** Rebuild the sitemap hourly so newly published profiles appear for crawlers. */
export const revalidate = 3600;

const STATIC_ROUTES: Array<{
  path: string;
  priority: number;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
}> = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/doctors", priority: 0.9, changeFrequency: "daily" },
  { path: "/hospitals", priority: 0.9, changeFrequency: "daily" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.6, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const base: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const [doctors, hospitals] = await Promise.all([
    listDoctors({ limit: 100 }),
    listHospitals({ limit: 100 }),
  ]);

  const doctorRoutes: MetadataRoute.Sitemap = doctors.items.map((doctor) => ({
    url: absoluteUrl(`/doctors/${doctor.slug}`),
    lastModified: doctor.updatedAt ? new Date(doctor.updatedAt) : now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const hospitalRoutes: MetadataRoute.Sitemap = hospitals.items.map((hospital) => ({
    url: absoluteUrl(`/hospitals/${hospital.slug}`),
    lastModified: hospital.updatedAt ? new Date(hospital.updatedAt) : now,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...base, ...doctorRoutes, ...hospitalRoutes];
}
