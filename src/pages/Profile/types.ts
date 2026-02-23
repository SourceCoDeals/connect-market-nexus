import { User } from "@/types";

export interface ProfileFormData extends Partial<User> {}

export interface ProfileFormProps {
  user: User;
  formData: ProfileFormData;
  isLoading: boolean;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSelectChange: (value: string | string[] | boolean, name: string) => void;
  onLocationChange: (values: string[]) => void;
  onSetFormData: React.Dispatch<React.SetStateAction<ProfileFormData>>;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export interface ProfileSecurityProps {
  isLoading: boolean;
  passwordData: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  };
  passwordError: string;
  passwordSuccess: string;
  onPasswordDataChange: (data: { currentPassword: string; newPassword: string; confirmPassword: string }) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
}

export interface ProfileSettingsProps {
  formData: ProfileFormData;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSelectChange: (value: string | string[] | boolean, name: string) => void;
  onSetFormData: React.Dispatch<React.SetStateAction<ProfileFormData>>;
}
