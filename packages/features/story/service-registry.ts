import type { StoryService } from "./service";

export let storyService: StoryService;

export const setStoryService = (service: StoryService): void => {
  storyService = service;
};
