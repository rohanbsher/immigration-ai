'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  User,
  Lock,
  Bell,
  CreditCard,
  Building2,
  Save,
  Loader2,
  Eye,
  EyeOff,
  Shield,
} from 'lucide-react';
import { useUser } from '@/hooks/use-user';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { profile, isLoading, refetch } = useUser();
  const { updatePassword } = useAuth();

  const [isSaving, setIsSaving] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Profile form state
  const [profileData, setProfileData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    firm_name: '',
    bar_number: '',
  });

  // Password form state
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  // Initialize profile data when loaded
  useState(() => {
    if (profile) {
      setProfileData({
        first_name: profile.first_name || '',
        last_name: profile.last_name || '',
        phone: profile.phone || '',
        firm_name: profile.firm_name || '',
        bar_number: profile.bar_number || '',
      });
    }
  });

  const handleProfileSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profileData),
      });

      if (!response.ok) {
        throw new Error('Failed to update profile');
      }

      toast.success('Profile updated successfully');
      refetch(); // Refresh user data
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.new_password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setIsSaving(true);
    try {
      await updatePassword(passwordData.new_password);
      toast.success('Password updated successfully');
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
    } catch (error) {
      toast.error('Failed to update password');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-600">Manage your account and preferences</p>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList>
          <TabsTrigger value="profile" className="gap-2">
            <User size={16} />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Lock size={16} />
            Security
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bell size={16} />
            Notifications
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-6">
          {/* Profile Photo */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Photo</CardTitle>
              <CardDescription>
                Your profile photo will be displayed across the application.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={profile?.avatar_url || undefined} />
                <AvatarFallback className="bg-blue-100 text-blue-700 text-2xl font-medium">
                  {profile?.first_name?.charAt(0) || 'U'}
                  {profile?.last_name?.charAt(0) || ''}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2">
                <Button variant="outline">Upload Photo</Button>
                <p className="text-xs text-slate-500">JPG, PNG, or GIF. Max size 2MB.</p>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Update your personal details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={profileData.first_name || profile?.first_name || ''}
                    onChange={(e) =>
                      setProfileData((prev) => ({ ...prev, first_name: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={profileData.last_name || profile?.last_name || ''}
                    onChange={(e) =>
                      setProfileData((prev) => ({ ...prev, last_name: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input id="email" value={profile?.email || ''} disabled />
                <p className="text-xs text-slate-500">
                  Email cannot be changed. Contact support if needed.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={profileData.phone || profile?.phone || ''}
                  onChange={(e) =>
                    setProfileData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="+1 (555) 123-4567"
                />
              </div>
            </CardContent>
          </Card>

          {/* Professional Information (for attorneys) */}
          {profile?.role === 'attorney' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 size={20} />
                  Professional Information
                </CardTitle>
                <CardDescription>Your law firm and bar details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="firm_name">Law Firm Name</Label>
                  <Input
                    id="firm_name"
                    value={profileData.firm_name || profile?.firm_name || ''}
                    onChange={(e) =>
                      setProfileData((prev) => ({ ...prev, firm_name: e.target.value }))
                    }
                    placeholder="Smith & Associates Law Firm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bar_number">Bar Number</Label>
                  <Input
                    id="bar_number"
                    value={profileData.bar_number || profile?.bar_number || ''}
                    onChange={(e) =>
                      setProfileData((prev) => ({ ...prev, bar_number: e.target.value }))
                    }
                    placeholder="123456"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex justify-end">
            <Button onClick={handleProfileSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-6">
          {/* Change Password */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock size={20} />
                Change Password
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="current_password">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current_password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordData.current_password}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        current_password: e.target.value,
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new_password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new_password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.new_password}
                    onChange={(e) =>
                      setPasswordData((prev) => ({
                        ...prev,
                        new_password: e.target.value,
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm New Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  value={passwordData.confirm_password}
                  onChange={(e) =>
                    setPasswordData((prev) => ({
                      ...prev,
                      confirm_password: e.target.value,
                    }))
                  }
                />
              </div>
              <Button
                onClick={handlePasswordChange}
                disabled={
                  isSaving ||
                  !passwordData.new_password ||
                  !passwordData.confirm_password
                }
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Two-Factor Authentication */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield size={20} />
                Two-Factor Authentication
              </CardTitle>
              <CardDescription>
                Add an extra layer of security to your account.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Authenticator App</p>
                  <p className="text-sm text-slate-500">
                    Use an authenticator app to generate one-time codes.
                  </p>
                </div>
                <Button variant="outline">Enable</Button>
              </div>
            </CardContent>
          </Card>

          {/* Active Sessions */}
          <Card>
            <CardHeader>
              <CardTitle>Active Sessions</CardTitle>
              <CardDescription>
                Manage your active sessions across devices.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">Current Session</p>
                    <p className="text-sm text-slate-500">
                      This device - Last active now
                    </p>
                  </div>
                  <span className="text-sm text-green-600 font-medium">Active</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>
                Choose what emails you want to receive.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Case Updates</p>
                  <p className="text-sm text-slate-500">
                    Receive notifications when case status changes.
                  </p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Document Uploads</p>
                  <p className="text-sm text-slate-500">
                    Get notified when clients upload documents.
                  </p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Deadline Reminders</p>
                  <p className="text-sm text-slate-500">
                    Receive reminders for upcoming deadlines.
                  </p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4" />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Marketing Emails</p>
                  <p className="text-sm text-slate-500">
                    Product updates and announcements.
                  </p>
                </div>
                <input type="checkbox" className="h-4 w-4" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
