import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { DealAlertsTab } from '@/components/deal-alerts/DealAlertsTab';
import { useToast } from '@/hooks/use-toast';
import { useProfileData } from './useProfileData';
import { ProfileForm } from './ProfileForm';
import { ProfileSecurity } from './ProfileSecurity';
import { ProfileDocuments } from './ProfileDocuments';
import { ProfileTeamMembers } from './ProfileTeamMembers';

const NOTIFICATIONS_STORAGE_KEY = 'sourceco_notification_preferences';

interface NotificationPreferences {
  emailFrequency: 'instant' | 'daily' | 'weekly';
  connectionRequestUpdates: boolean;
  newMessageAlerts: boolean;
  platformAnnouncements: boolean;
}

const defaultPreferences: NotificationPreferences = {
  emailFrequency: 'instant',
  connectionRequestUpdates: true,
  newMessageAlerts: true,
  platformAnnouncements: true,
};

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

  const { toast } = useToast();

  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(() => {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore parse errors
    }
    return defaultPreferences;
  });

  const handleSaveNotifications = () => {
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notificationPrefs));
      toast({
        title: 'Notification preferences saved',
        description: 'Your notification settings have been updated.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Save failed',
        description: 'Could not save notification preferences. Please try again.',
      });
    }
  };

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
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
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

        <TabsContent value="team">
          <ProfileTeamMembers />
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Choose how and when you want to be notified about activity on SourceCo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Email frequency for deal matches */}
              <div className="space-y-3">
                <Label className="text-base font-medium">Email frequency for deal matches</Label>
                <p className="text-sm text-muted-foreground">
                  How often should we email you about new deal matches?
                </p>
                <RadioGroup
                  value={notificationPrefs.emailFrequency}
                  onValueChange={(value) =>
                    setNotificationPrefs((prev) => ({
                      ...prev,
                      emailFrequency: value as NotificationPreferences['emailFrequency'],
                    }))
                  }
                  className="flex flex-col space-y-2 pt-1"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="instant" id="freq-instant" />
                    <Label htmlFor="freq-instant" className="font-normal cursor-pointer">
                      Instant — get notified as soon as a match is found
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="daily" id="freq-daily" />
                    <Label htmlFor="freq-daily" className="font-normal cursor-pointer">
                      Daily Digest — one email per day summarizing new matches
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="weekly" id="freq-weekly" />
                    <Label htmlFor="freq-weekly" className="font-normal cursor-pointer">
                      Weekly — a weekly roundup of new matches
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Toggle preferences */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Connection request updates</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive notifications when someone sends or responds to a connection request.
                    </p>
                  </div>
                  <Switch
                    checked={notificationPrefs.connectionRequestUpdates}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs((prev) => ({
                        ...prev,
                        connectionRequestUpdates: checked,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">New message alerts</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when you receive a new message.
                    </p>
                  </div>
                  <Switch
                    checked={notificationPrefs.newMessageAlerts}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs((prev) => ({
                        ...prev,
                        newMessageAlerts: checked,
                      }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-base font-medium">Platform announcements</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive emails about new features, updates, and platform news.
                    </p>
                  </div>
                  <Switch
                    checked={notificationPrefs.platformAnnouncements}
                    onCheckedChange={(checked) =>
                      setNotificationPrefs((prev) => ({
                        ...prev,
                        platformAnnouncements: checked,
                      }))
                    }
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={handleSaveNotifications}>Save Preferences</Button>
              </div>
            </CardContent>
          </Card>
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
