export interface ProfileData {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateProfileData {
  name: string;
  avatar?: string | null;
}
