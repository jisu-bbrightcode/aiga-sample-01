/**
 * Domain (의사/병원 큐레이션) Admin Feature Constants
 *
 * Capability: `admin.domain.list` (PB-ADMIN-DOMAIN-LIST-001 / BBR-678).
 * The "도메인 리소스" are the core editorial catalog records of the AIGA
 * service domain — 의사(doctors) and 병원(hospitals) — owned by PB-DATA-001
 * (service_doctors / service_hospitals). This admin surface lets operators
 * search, filter, sort and paginate those records and see operational state
 * (lifecycle status + most-recent edit).
 */

/** Admin route for the domain resource list/search console. */
export const DOMAIN_ADMIN_PATH = "/domain";

/** Default page size for the admin list. */
export const DOMAIN_ADMIN_DEFAULT_PAGE_SIZE = 20;
