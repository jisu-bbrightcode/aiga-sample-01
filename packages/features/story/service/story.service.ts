import { Injectable } from "@nestjs/common";
import type {
  CreateCharacterDto,
  CreateCodexDto,
  CreateDraftDto,
  CreateFactionDto,
  CreateLocationDto,
  CreateRelationDto,
  CreateTagDto,
  CreateWorldDto,
  UpdateCharacterDto,
  UpdateCodexDto,
  UpdateDraftDto,
  UpdateFactionDto,
  UpdateLocationDto,
  UpdateWorldDto,
} from "../dto";
import { StoryCharacterService } from "./character.service";
import { StoryCodexService } from "./codex.service";
import { StoryDraftService } from "./draft.service";
import { StoryEntityPropertyService } from "./entity-property.service";
import { StoryEntityTagService } from "./entity-tag.service";
import { StoryFactionService } from "./faction.service";
import type { SortBy } from "./internal/order-by";
import { StoryLocationService } from "./location.service";
import { StoryRelationService } from "./relation.service";
import { StoryTagService } from "./tag.service";
import { StoryWorldService } from "./world.service";

/**
 * StoryService — thin facade preserving the 42-method public surface that
 * controllers + tRPC routers consume. The actual logic lives in 10 typed
 * sub-services (`world.service.ts`, `character.service.ts`, …) so each
 * domain is self-contained and individually testable.
 *
 * Adding a new method: extend the right sub-service, then surface a
 * one-liner delegate here. Adding a new domain: drop a `<name>.service.ts`,
 * register it in `story.module.ts`, inject it here, delegate.
 */
type StoryEntityType = "world" | "character" | "location" | "faction" | "codex" | "draft";

@Injectable()
export class StoryService {
  constructor(
    private readonly worldsSvc: StoryWorldService,
    private readonly charactersSvc: StoryCharacterService,
    private readonly locationsSvc: StoryLocationService,
    private readonly factionsSvc: StoryFactionService,
    private readonly codexSvc: StoryCodexService,
    private readonly draftsSvc: StoryDraftService,
    private readonly tagsSvc: StoryTagService,
    private readonly entityTagsSvc: StoryEntityTagService,
    private readonly entityPropsSvc: StoryEntityPropertyService,
    private readonly relationsSvc: StoryRelationService,
  ) {}

  // ── Worlds ────────────────────────────────────────────────────────────
  listWorlds(projectId: string, ownerId: string, search?: string, sortBy?: SortBy) {
    return this.worldsSvc.listWorlds(projectId, ownerId, search, sortBy);
  }
  getWorld(id: string, ownerId: string) {
    return this.worldsSvc.getWorld(id, ownerId);
  }
  createWorld(ownerId: string, data: CreateWorldDto) {
    return this.worldsSvc.createWorld(ownerId, data);
  }
  updateWorld(id: string, ownerId: string, data: UpdateWorldDto) {
    return this.worldsSvc.updateWorld(id, ownerId, data);
  }
  deleteWorld(id: string, ownerId: string) {
    return this.worldsSvc.deleteWorld(id, ownerId);
  }

  // ── Characters ───────────────────────────────────────────────────────
  listCharacters(projectId: string, ownerId: string, search?: string, sortBy?: SortBy) {
    return this.charactersSvc.listCharacters(projectId, ownerId, search, sortBy);
  }
  getCharacter(id: string, ownerId: string) {
    return this.charactersSvc.getCharacter(id, ownerId);
  }
  createCharacter(ownerId: string, data: CreateCharacterDto) {
    return this.charactersSvc.createCharacter(ownerId, data);
  }
  updateCharacter(id: string, ownerId: string, data: UpdateCharacterDto) {
    return this.charactersSvc.updateCharacter(id, ownerId, data);
  }
  deleteCharacter(id: string, ownerId: string) {
    return this.charactersSvc.deleteCharacter(id, ownerId);
  }

  // ── Locations ────────────────────────────────────────────────────────
  listLocations(projectId: string, ownerId: string, search?: string, sortBy?: SortBy) {
    return this.locationsSvc.listLocations(projectId, ownerId, search, sortBy);
  }
  getLocation(id: string, ownerId: string) {
    return this.locationsSvc.getLocation(id, ownerId);
  }
  createLocation(ownerId: string, data: CreateLocationDto) {
    return this.locationsSvc.createLocation(ownerId, data);
  }
  updateLocation(id: string, ownerId: string, data: UpdateLocationDto) {
    return this.locationsSvc.updateLocation(id, ownerId, data);
  }
  deleteLocation(id: string, ownerId: string) {
    return this.locationsSvc.deleteLocation(id, ownerId);
  }

  // ── Factions ────────────────────────────────────────────────────────
  listFactions(projectId: string, ownerId: string, search?: string, sortBy?: SortBy) {
    return this.factionsSvc.listFactions(projectId, ownerId, search, sortBy);
  }
  getFaction(id: string, ownerId: string) {
    return this.factionsSvc.getFaction(id, ownerId);
  }
  createFaction(ownerId: string, data: CreateFactionDto) {
    return this.factionsSvc.createFaction(ownerId, data);
  }
  updateFaction(id: string, ownerId: string, data: UpdateFactionDto) {
    return this.factionsSvc.updateFaction(id, ownerId, data);
  }
  deleteFaction(id: string, ownerId: string) {
    return this.factionsSvc.deleteFaction(id, ownerId);
  }

  // ── Codex ────────────────────────────────────────────────────────────
  listCodex(projectId: string, ownerId: string, search?: string, sortBy?: SortBy) {
    return this.codexSvc.listCodex(projectId, ownerId, search, sortBy);
  }
  getCodexEntry(id: string, ownerId: string) {
    return this.codexSvc.getCodexEntry(id, ownerId);
  }
  createCodexEntry(ownerId: string, data: CreateCodexDto) {
    return this.codexSvc.createCodexEntry(ownerId, data);
  }
  updateCodexEntry(id: string, ownerId: string, data: UpdateCodexDto) {
    return this.codexSvc.updateCodexEntry(id, ownerId, data);
  }
  deleteCodexEntry(id: string, ownerId: string) {
    return this.codexSvc.deleteCodexEntry(id, ownerId);
  }

  // ── Drafts ────────────────────────────────────────────────────────────
  listDrafts(projectId: string, ownerId: string, search?: string, sortBy?: SortBy) {
    return this.draftsSvc.listDrafts(projectId, ownerId, search, sortBy);
  }
  getDraft(id: string, ownerId: string) {
    return this.draftsSvc.getDraft(id, ownerId);
  }
  createDraft(ownerId: string, data: CreateDraftDto) {
    return this.draftsSvc.createDraft(ownerId, data);
  }
  updateDraft(id: string, ownerId: string, data: UpdateDraftDto) {
    return this.draftsSvc.updateDraft(id, ownerId, data);
  }
  deleteDraft(id: string, ownerId: string) {
    return this.draftsSvc.deleteDraft(id, ownerId);
  }

  // ── Tags ─────────────────────────────────────────────────────────────
  listTags(projectId: string) {
    return this.tagsSvc.listTags(projectId);
  }
  createTag(data: CreateTagDto) {
    return this.tagsSvc.createTag(data);
  }
  deleteTag(id: string) {
    return this.tagsSvc.deleteTag(id);
  }

  // ── Entity Tags ──────────────────────────────────────────────────────
  addEntityTag(entityId: string, entityType: string, tagId: string, id?: string) {
    return this.entityTagsSvc.addEntityTag(entityId, entityType, tagId, id);
  }
  removeEntityTag(id: string) {
    return this.entityTagsSvc.removeEntityTag(id);
  }
  getEntityTags(entityId: string, entityType: string) {
    return this.entityTagsSvc.getEntityTags(entityId, entityType);
  }

  // ── Entity Properties ───────────────────────────────────────────────
  getEntityProperties(entityId: string, entityType: StoryEntityType, ownerId: string) {
    return this.entityPropsSvc.getEntityProperties(entityId, entityType, ownerId);
  }
  upsertEntityProperty(input: Parameters<StoryEntityPropertyService["upsertEntityProperty"]>[0]) {
    return this.entityPropsSvc.upsertEntityProperty(input);
  }
  uploadEntityImageSmall(
    input: Parameters<StoryEntityPropertyService["uploadEntityImageSmall"]>[0],
  ) {
    return this.entityPropsSvc.uploadEntityImageSmall(input);
  }

  // ── Relations ────────────────────────────────────────────────────────
  listRelations(entityId: string, entityType: string) {
    return this.relationsSvc.listRelations(entityId, entityType);
  }
  createRelation(data: CreateRelationDto) {
    return this.relationsSvc.createRelation(data);
  }
  deleteRelation(id: string) {
    return this.relationsSvc.deleteRelation(id);
  }
}
