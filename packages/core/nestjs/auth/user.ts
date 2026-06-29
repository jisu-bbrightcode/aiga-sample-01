/**
 * User type for authenticated HTTP requests.
 */
export interface User {
  id: string;
  email?: string;
  role?: string;
  roleIds?: string[];
  activeOrganizationId?: string | null;
}
