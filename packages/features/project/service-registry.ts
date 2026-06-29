import type { ProjectService } from "./service";

export let projectService: ProjectService;

export const setProjectService = (service: ProjectService) => {
  projectService = service;
};
