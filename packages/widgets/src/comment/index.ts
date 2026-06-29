// Connected Component
export { CommentSection } from "./comment-section";
export type { CommentFormProps, CommentItemProps } from "./components";
// Sub-components (for custom layouts)
export { CommentForm, CommentItem, CommentList } from "./components";
// Hooks
export {
  useCommentCount,
  useCommentReplies,
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
} from "./hooks";

// Types
export * from "./types";
