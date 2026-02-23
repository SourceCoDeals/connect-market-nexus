import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { DealAlertsTab } from "@/components/deal-alerts/DealAlertsTab";
import { useProfileData } from "./useProfileData";
import { ProfileForm } from "./ProfileForm";
import { ProfileSecurity } from "./ProfileSecurity";
import { ProfileDocuments } from "./ProfileDocuments";

const Profile = () => {
  const {
    user,
    isLoading,
    formData,
    setFormData,
    passwordData,
    setPasswordData,
    passwordError,
    passwordSuccess,
    handleInputChange,
    handleSelectChange,
    handleLocationChange,
    handleProfileUpdate,
    handlePasswordChange,
  } = useProfileData();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <h1 className="text-3xl font-bold mb-6">My Profile</h1>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="profile">Profile Information</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="deal-alerts">Deal Alerts</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <ProfileForm
            user={user}
            formData={formData}
            isLoading={isLoading}
            onInputChange={handleInputChange}
            onSelectChange={handleSelectChange}
            onLocationChange={handleLocationChange}
            onSetFormData={setFormData}
            onSubmit={handleProfileUpdate}
          />
        </TabsContent>

        <TabsContent value="documents">
          <ProfileDocuments />
        </TabsContent>

        <TabsContent value="deal-alerts">
          <DealAlertsTab />
        </TabsContent>

        <TabsContent value="security">
          <ProfileSecurity
            isLoading={isLoading}
            passwordData={passwordData}
            passwordError={passwordError}
            passwordSuccess={passwordSuccess}
            onPasswordDataChange={setPasswordData}
            onSubmit={handlePasswordChange}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Profile;
