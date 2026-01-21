export { profilesService } from './profiles';
export type { Profile, UpdateProfileData } from './profiles';

export { clientsService } from './clients';
export type {
  Client,
  ClientWithCases,
  CreateClientData,
  UpdateClientData,
} from './clients';

export { casesService } from './cases';
export type {
  Case,
  CaseWithRelations,
  CreateCaseData,
  UpdateCaseData,
  CaseFilters,
  PaginationOptions,
} from './cases';

export { documentsService } from './documents';
export type {
  Document,
  DocumentWithUploader,
  CreateDocumentData,
  UpdateDocumentData,
} from './documents';

export { formsService } from './forms';
export type {
  Form,
  FormWithReviewer,
  CreateFormData,
  UpdateFormData,
} from './forms';

export { activitiesService } from './activities';
export type { Activity, ActivityWithUser, CreateActivityData } from './activities';

export { notificationsService } from './notifications';
export type {
  Notification,
  NotificationType,
  CreateNotificationData,
} from './notifications';
