/**
 * File-upload feature — schema barrel.
 *
 * Capability: `file-upload.data-model` (PB-FILE-DATA-001 / BBR-547).
 * EXTEND of the base file-upload (Vercel Blob) capability. See
 * doc/data/PB-FILE-DATA-001-file-assets-data-model.md for the field/visibility
 * map and the source-of-truth contract.
 */
export * from "./enums";
export * from "./file-assets";
export * from "./relations";
