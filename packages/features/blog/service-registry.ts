import type { BlogService } from "./service";

export let blogService: BlogService;

export const setBlogService = (service: BlogService) => {
  blogService = service;
};
