import { siteConfig } from "@/config/site.config";
import { absoluteUrl } from "./seo";
import type { PublicDoctorDetail, PublicHospitalDetail } from "./service-api";

/**
 * Domain structured data (schema.org JSON-LD). Builders return plain objects so
 * pages can compose them; `<JsonLd>` serialises one or many graphs into a
 * single, XSS-safe `application/ld+json` script.
 */

type JsonLdGraph = Record<string, unknown>;

/** Serialise JSON-LD, escaping `<` so the payload cannot break out of the tag. */
export function JsonLd({ data }: { data: JsonLdGraph | JsonLdGraph[] }) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD must be injected as a raw script per the schema.org/Next convention; the payload is machine-built and `<` is escaped above, so it cannot break out of the tag.
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />;
}

/** Brand-level MedicalOrganization — emitted once in the root layout. */
export function organizationJsonLd(): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalOrganization",
    "@id": `${absoluteUrl("/")}#organization`,
    name: siteConfig.name,
    url: absoluteUrl("/"),
    description: siteConfig.seo.description,
    slogan: siteConfig.seo.tagline,
  };
}

/** WebSite node with a search action pointing at the doctor catalog. */
export function websiteJsonLd(): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${absoluteUrl("/")}#website`,
    name: siteConfig.name,
    url: absoluteUrl("/"),
    inLanguage: siteConfig.locale,
    publisher: { "@id": `${absoluteUrl("/")}#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${absoluteUrl("/doctors")}?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export interface Crumb {
  name: string;
  path: string;
}

export function breadcrumbJsonLd(crumbs: Crumb[]): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };
}

/** ItemList for catalog (list) pages — improves rich-result eligibility. */
export function itemListJsonLd(items: Array<{ name: string; path: string }>): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absoluteUrl(item.path),
    })),
  };
}

function aggregateRating(ratingAvg: number, reviewCount: number): JsonLdGraph | undefined {
  if (reviewCount <= 0 || ratingAvg <= 0) return undefined;
  return {
    "@type": "AggregateRating",
    ratingValue: ratingAvg,
    reviewCount,
    bestRating: 5,
    worstRating: 1,
  };
}

export function physicianJsonLd(doctor: PublicDoctorDetail): JsonLdGraph {
  const path = `/doctors/${doctor.slug}`;
  const primaryHospital =
    doctor.hospitals.find((entry) => entry.isPrimary)?.hospital ?? doctor.hospitals[0]?.hospital;

  const node: JsonLdGraph = {
    "@context": "https://schema.org",
    "@type": "Physician",
    "@id": `${absoluteUrl(path)}#physician`,
    name: doctor.name,
    url: absoluteUrl(path),
    ...(doctor.title ? { jobTitle: doctor.title } : {}),
    ...(doctor.photoUrl ? { image: doctor.photoUrl } : {}),
    ...((doctor.shortBio ?? doctor.biography)
      ? { description: doctor.shortBio ?? doctor.biography }
      : {}),
    ...(doctor.specialties.length
      ? { medicalSpecialty: doctor.specialties.map((specialty) => specialty.name) }
      : {}),
  };

  if (primaryHospital) {
    node.worksFor = {
      "@type": "MedicalClinic",
      name: primaryHospital.name,
      url: absoluteUrl(`/hospitals/${primaryHospital.slug}`),
      ...(primaryHospital.addressLine
        ? { address: { "@type": "PostalAddress", streetAddress: primaryHospital.addressLine } }
        : {}),
    };
  }

  const rating = aggregateRating(doctor.ratingAvg, doctor.reviewCount);
  if (rating) node.aggregateRating = rating;

  return node;
}

export function medicalClinicJsonLd(hospital: PublicHospitalDetail): JsonLdGraph {
  const path = `/hospitals/${hospital.slug}`;
  const node: JsonLdGraph = {
    "@context": "https://schema.org",
    "@type": "MedicalClinic",
    "@id": `${absoluteUrl(path)}#clinic`,
    name: hospital.name,
    url: absoluteUrl(path),
    ...((hospital.summary ?? hospital.description)
      ? { description: hospital.summary ?? hospital.description }
      : {}),
    ...(hospital.photoUrl ? { image: hospital.photoUrl } : {}),
    ...(hospital.phone ? { telephone: hospital.phone } : {}),
    ...(hospital.websiteUrl ? { sameAs: [hospital.websiteUrl] } : {}),
  };

  if (hospital.addressLine) {
    node.address = {
      "@type": "PostalAddress",
      streetAddress: hospital.addressLine,
      addressCountry: "KR",
      ...(hospital.region ? { addressRegion: hospital.region.name } : {}),
    };
  }

  const rating = aggregateRating(hospital.ratingAvg, hospital.reviewCount);
  if (rating) node.aggregateRating = rating;

  return node;
}
