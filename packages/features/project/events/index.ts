/**
 * project event contracts — emitted by ProjectService, consumed by feature
 * modules via @OnEvent. `project.deleted` means
 * user intent to remove the project from active use, either archive or hard
 * delete.
 */

export const ProjectEvent = {
  CREATED: "project.created",
  DELETED: "project.deleted",
} as const;
export type ProjectEvent = (typeof ProjectEvent)[keyof typeof ProjectEvent];

export type ProjectCreatedPayload = {
  projectId: string;
  ownerId: string;
  organizationId: string;
  createdAt: Date;
};

export type ProjectDeletedPayload = {
  projectId: string;
  ownerId: string;
  organizationId: string;
  deletedAt: Date;
};
