
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/ui/multi-select";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@/types";

const Profile = () => {
  const { user, updateUserProfile } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [formData, setFormData] = useState<Partial<User>>({
    first_name: user?.first_name || "",
    last_name: user?.last_name || "",
    company: user?.company || "",
    website: user?.website || "",
    linkedin_profile: user?.linkedin_profile || "",
    phone_number: user?.phone_number || "",
    buyer_type: user?.buyer_type || "corporate",
    bio: user?.bio || "",
    ideal_target_description: user?.ideal_target_description || "",
    business_categories: user?.business_categories || [],
    target_locations: user?.target_locations || "",
    revenue_range_min: user?.revenue_range_min || undefined,
    revenue_range_max: user?.revenue_range_max || undefined,
    specific_business_search: user?.specific_business_search || "",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectChange = (value: string | string[], name: string) => {
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleProfileUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    
    setIsLoading(true);
    try {
      await updateUserProfile(formData);
      toast({
        title: "Profile updated",
        description: "Your profile information has been successfully updated.",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Update failed",
        description: error.message || "Something went wrong while updating your profile.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    
    // Validate password inputs
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError("New passwords don't match");
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters");
      return;
    }
    
    setIsLoading(true);
    try {
      // Update password via Supabase
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });
      
      if (error) throw error;
      
      // Reset form and show success message
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordSuccess("Password updated successfully");
      
      toast({
        title: "Password updated",
        description: "Your password has been changed successfully.",
      });
    } catch (error: any) {
      console.error("Password update error:", error);
      setPasswordError(error.message || "Failed to update password");
      toast({
        variant: "destructive",
        title: "Password update failed",
        description: error.message || "Something went wrong while updating your password.",
      });
    } finally {
      setIsLoading(false);
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
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your profile information and preferences.
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                      id="email" 
                      name="email" 
                      value={user.email} 
                      disabled 
                      className="bg-muted/50"
                    />
                    <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="buyer_type">Buyer Type</Label>
                    <Select 
                      value={formData.buyer_type} 
                      onValueChange={(value) => handleSelectChange(value, "buyer_type")}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a buyer type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="corporate">Corporate</SelectItem>
                        <SelectItem value="privateEquity">Private Equity</SelectItem>
                        <SelectItem value="familyOffice">Family Office</SelectItem>
                        <SelectItem value="searchFund">Search Fund</SelectItem>
                        <SelectItem value="individual">Individual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="first_name">First Name</Label>
                    <Input 
                      id="first_name" 
                      name="first_name" 
                      value={formData.first_name} 
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input 
                      id="last_name" 
                      name="last_name" 
                      value={formData.last_name} 
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="company">Company</Label>
                    <Input 
                      id="company" 
                      name="company" 
                      value={formData.company} 
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="website">Website</Label>
                    <Input 
                      id="website" 
                      name="website" 
                      value={formData.website} 
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="linkedin_profile">LinkedIn Profile</Label>
                    <Input 
                      id="linkedin_profile" 
                      name="linkedin_profile" 
                      value={formData.linkedin_profile} 
                      onChange={handleInputChange}
                      placeholder="https://www.linkedin.com/in/yourprofile"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input 
                      id="phone_number" 
                      name="phone_number" 
                      value={formData.phone_number} 
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="target_locations">Target Locations</Label>
                    <Input 
                      id="target_locations" 
                      name="target_locations" 
                      value={formData.target_locations} 
                      onChange={handleInputChange}
                      placeholder="e.g. West Coast, Texas, International"
                    />
                  </div>
                  
                  {/* Additional fields based on buyer type */}
                  {(formData.buyer_type === "privateEquity" || formData.buyer_type === "familyOffice") && (
                    <div className="space-y-2">
                      <Label htmlFor="fund_size">Fund Size</Label>
                      <Input 
                        id="fund_size" 
                        name="fund_size" 
                        value={formData.fund_size || ""} 
                        onChange={handleInputChange}
                        placeholder="e.g. $100M-$500M"
                      />
                    </div>
                  )}
                  
                  {formData.buyer_type === "familyOffice" && (
                    <div className="space-y-2">
                      <Label htmlFor="aum">Assets Under Management</Label>
                      <Input 
                        id="aum" 
                        name="aum" 
                        value={formData.aum || ""} 
                        onChange={handleInputChange}
                        placeholder="e.g. $500M"
                      />
                    </div>
                  )}
                  
                  {formData.buyer_type === "corporate" && (
                    <div className="space-y-2">
                      <Label htmlFor="estimated_revenue">Estimated Revenue</Label>
                      <Input 
                        id="estimated_revenue" 
                        name="estimated_revenue" 
                        value={formData.estimated_revenue || ""} 
                        onChange={handleInputChange}
                        placeholder="e.g. $10M-$50M"
                      />
                    </div>
                  )}
                </div>
                
                <Separator />
                
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="ideal_target_description">Ideal Target Description</Label>
                    <Textarea 
                      id="ideal_target_description" 
                      name="ideal_target_description" 
                      value={formData.ideal_target_description || ""} 
                      onChange={handleInputChange}
                      placeholder="Describe your ideal acquisition target or investment criteria..."
                      className="min-h-[100px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="business_categories">Business Categories of Interest</Label>
                    <MultiSelect
                      options={[
                        { label: "Technology", value: "technology" },
                        { label: "Healthcare", value: "healthcare" },
                        { label: "Manufacturing", value: "manufacturing" },
                        { label: "Retail", value: "retail" },
                        { label: "Financial Services", value: "financial_services" },
                        { label: "Real Estate", value: "real_estate" },
                        { label: "Energy", value: "energy" },
                        { label: "Transportation", value: "transportation" },
                        { label: "Education", value: "education" },
                        { label: "Food & Beverage", value: "food_beverage" },
                        { label: "Construction", value: "construction" },
                        { label: "Media", value: "media" },
                        { label: "Hospitality", value: "hospitality" },
                        { label: "Agriculture", value: "agriculture" },
                        { label: "Professional Services", value: "professional_services" }
                      ]}
                      selected={formData.business_categories || []}
                      onSelectedChange={(value) => handleSelectChange(value, "business_categories")}
                      placeholder="Select business categories..."
                      className="w-full"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="revenue_range_min">Revenue Range (Min)</Label>
                      <Input 
                        id="revenue_range_min" 
                        name="revenue_range_min" 
                        type="number"
                        value={formData.revenue_range_min || ""} 
                        onChange={handleInputChange}
                        placeholder="1000000"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="revenue_range_max">Revenue Range (Max)</Label>
                      <Input 
                        id="revenue_range_max" 
                        name="revenue_range_max" 
                        type="number"
                        value={formData.revenue_range_max || ""} 
                        onChange={handleInputChange}
                        placeholder="10000000"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="specific_business_search">Specific Business Search</Label>
                    <Textarea 
                      id="specific_business_search" 
                      name="specific_business_search" 
                      value={formData.specific_business_search || ""} 
                      onChange={handleInputChange}
                      placeholder="Describe any specific types of businesses you're looking for..."
                      className="min-h-[80px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="bio">About Me / Bio</Label>
                    <Textarea 
                      id="bio" 
                      name="bio" 
                      value={formData.bio || ""} 
                      onChange={handleInputChange}
                      placeholder="Tell us about yourself and your investment interests..."
                      className="min-h-[120px]"
                    />
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>
                Update your password and security settings.
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-6">
                {passwordSuccess && (
                  <div className="flex items-center p-4 mb-4 text-sm text-green-800 border border-green-300 rounded-lg bg-green-50">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    <span>{passwordSuccess}</span>
                  </div>
                )}
                
                {passwordError && (
                  <div className="flex items-center p-4 mb-4 text-sm text-red-800 border border-red-300 rounded-lg bg-red-50">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    <span>{passwordError}</span>
                  </div>
                )}
                
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input 
                    id="currentPassword"
                    name="currentPassword"
                    type="password" 
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input 
                    id="newPassword"
                    name="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input 
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  />
                </div>
                
                <div className="flex justify-end">
                  <Button type="submit" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Change Password
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Profile;
