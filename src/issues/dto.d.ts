/** REST DTO contracts. Dates are serialized as ISO-8601 UTC strings. */
export type IssueStatus = "PENDING" | "RESOLVED";
export interface SelectedMember {
  memberId: number;
  role?: "MEMBER" | "APPROVER";
}
export interface CreateIssueRequest {
  title: string;
  description: string;
  locationOrMandalName: string;
  occurrenceDate: string;
  participants?: SelectedMember[];
  uploadIds: string[];
}
export type UpdateIssueRequest = Partial<CreateIssueRequest>;
export interface CommentRequest {
  text: string;
  uploadIds?: string[];
}
export interface ResolveIssueRequest {
  resolutionDate: string;
  description: string;
  memberIds: number[];
  uploadIds: string[];
}
export interface Person {
  id: number;
  name: string | null;
  avatar: string | null;
}
export interface Attachment {
  id: string;
  mimeType: "image/jpeg" | "image/png";
  bytes: number;
  width: number;
  height: number;
  url: string;
  thumbnailUrl: string;
}
export interface Participant {
  memberId: number;
  role: "MEMBER" | "APPROVER" | "RESOLVER";
  active: boolean;
  user: Person | null;
}
export interface Permissions {
  canEdit: boolean;
  canResolve: boolean;
  canDelete: boolean;
  canComment: boolean;
  canSupport: boolean;
  canDesignateApprovers: boolean;
}
export interface Resolution {
  id: number;
  resolutionDate: string;
  description: string;
  resolver: Person;
  solutionProviders: Participant[];
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}
export interface IssueCard {
  id: number;
  mandalId: number;
  title: string;
  description: string;
  shortDescription: string;
  locationOrMandalName: string;
  pincode: string;
  status: IssueStatus;
  occurrenceDate: string;
  publishedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  creator: Person;
  mandal: { id: number; name: string };
  supporterCount: number;
  commentCount: number;
  participants: Participant[];
  participantCount: number;
  attachments: Attachment[];
  totalAttachmentCount: number;
  isSupported: boolean;
  permissions: Permissions;
}
export interface IssueDetails extends IssueCard {
  supporterPreview: Person[];
  newCommentCount: number;
  resolution: Resolution | null;
}
export interface Comment {
  id: number;
  issueId: number;
  text: string;
  author: Person;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
  permissions: { canEdit: boolean; canDelete: boolean };
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
}
export interface Success<T> {
  success: true;
  data: T;
  serverTime: string;
}
export interface Failure {
  success: false;
  code: string;
  message: string;
  details?: Record<string, string>;
}
