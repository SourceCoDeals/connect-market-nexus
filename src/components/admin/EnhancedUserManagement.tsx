import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User } from '@/types';
import { Search, Filter, Download, Users, UserCheck, UserX, AlertCircle } from 'lucide-react';

interface EnhancedUserManagementProps {
  users: User[];
  onApprove: (user: User) => void;
  onReject: (user: User) => void;
  onMakeAdmin: (user: User) => void;
  onRevokeAdmin: (user: User) => void;
  onDelete: (user: User) => void;
  isLoading: boolean;
}

export function EnhancedUserManagement({
  users,
  onApprove,
  onReject,
  onMakeAdmin,
  onRevokeAdmin,
  onDelete,
  isLoading
}: EnhancedUserManagementProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [buyerTypeFilter, setBuyerTypeFilter] = useState<string>('all');
  const [profileCompletionFilter, setProfileCompletionFilter] = useState<string>('all');
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);

  // Calculate profile completion score
  const calculateProfileCompletion = (user: User): number => {
    const requiredFields = [
      'first_name', 'last_name', 'company', 'phone_number', 'website',
      'linkedin_profile', 'ideal_target_description', 'business_categories'
    ];
    
    const buyerSpecificFields = {
      corporate: ['estimated_revenue'],
      privateEquity: ['fund_size', 'investment_size'],
      familyOffice: ['fund_size', 'aum'],
      searchFund: ['is_funded', 'target_company_size'],
      individual: ['funding_source']
    };

    const allFields = [
      ...requiredFields,
      ...(buyerSpecificFields[user.buyer_type as keyof typeof buyerSpecificFields] || [])
    ];

    const completedFields = allFields.filter(field => {
      const value = user[field as keyof User];
      if (field === 'business_categories') {
        return Array.isArray(value) && value.length > 0;
      }
      return value && value !== '';
    });

    return Math.round((completedFields.length / allFields.length) * 100);
  };

  // Enhanced filtering and analytics
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesSearch = searchQuery === '' || 
        user.first_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.last_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.company?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'all' || user.approval_status === statusFilter;
      const matchesBuyerType = buyerTypeFilter === 'all' || user.buyer_type === buyerTypeFilter;
      
      const profileCompletion = calculateProfileCompletion(user);
      const matchesCompletion = profileCompletionFilter === 'all' ||
        (profileCompletionFilter === 'complete' && profileCompletion >= 80) ||
        (profileCompletionFilter === 'incomplete' && profileCompletion < 80);

      return matchesSearch && matchesStatus && matchesBuyerType && matchesCompletion;
    });
  }, [users, searchQuery, statusFilter, buyerTypeFilter, profileCompletionFilter]);

  // Analytics calculations
  const analytics = useMemo(() => {
    const total = users.length;
    const pending = users.filter(u => u.approval_status === 'pending').length;
    const approved = users.filter(u => u.approval_status === 'approved').length;
    const rejected = users.filter(u => u.approval_status === 'rejected').length;
    
    const avgCompletion = users.reduce((acc, user) => 
      acc + calculateProfileCompletion(user), 0) / total;
    
    const incompleteProfiles = users.filter(u => 
      calculateProfileCompletion(u) < 80).length;
    
    const buyerTypeBreakdown = users.reduce((acc, user) => {
      acc[user.buyer_type || 'unknown'] = (acc[user.buyer_type || 'unknown'] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total,
      pending,
      approved,
      rejected,
      avgCompletion: Math.round(avgCompletion),
      incompleteProfiles,
      buyerTypeBreakdown
    };
  }, [users]);

  // Bulk actions
  const handleBulkApprove = () => {
    const usersToApprove = users.filter(u => 
      selectedUsers.includes(u.id) && u.approval_status === 'pending'
    );
    usersToApprove.forEach(onApprove);
    setSelectedUsers([]);
  };

  const handleBulkReject = () => {
    const usersToReject = users.filter(u => 
      selectedUsers.includes(u.id) && u.approval_status === 'pending'
    );
    usersToReject.forEach(onReject);
    setSelectedUsers([]);
  };

  const exportData = () => {
    const csvData = filteredUsers.map(user => ({
      // Basic Information
      'Name': `${user.first_name} ${user.last_name}`,
      'Email': user.email,
      'Phone': user.phone_number || '',
      'Company': user.company || '',
      'Website': user.website || '',
      'LinkedIn': user.linkedin_profile || '',
      
      // Account Status
      'Buyer Type': user.buyer_type || '',
      'Approval Status': user.approval_status,
      'Email Verified': user.email_verified ? 'Yes' : 'No',
      'Is Admin': user.is_admin ? 'Yes' : 'No',
      'Onboarding Complete': user.onboarding_completed ? 'Yes' : 'No',
      
      // Financial Details - ALL FIELDS
      'Estimated Revenue': user.estimated_revenue || '',
      'Fund Size': user.fund_size || '',
      'Investment Size': user.investment_size || '',
      'AUM': user.aum || '',
      'Target Company Size': user.target_company_size || '',
      
      // Funding & Financing - ALL FIELDS  
      'Funding Source': user.funding_source || '',
      'Is Funded': user.is_funded || '',
      'Funded By': user.funded_by || '',
      'Needs Loan': user.needs_loan || '',
      
      // Business Profile
      'Company Name': user.company_name || '',
      'Ideal Target': user.ideal_target || '',
      'Ideal Target Description': user.ideal_target_description || '',
      'Bio': user.bio || '',
      
      // Search Preferences
      'Business Categories': Array.isArray(user.business_categories) ? user.business_categories.join(';') : '',
      'Target Locations': user.target_locations || '',
      'Revenue Range Min': user.revenue_range_min || '',
      'Revenue Range Max': user.revenue_range_max || '',
      'Specific Business Search': user.specific_business_search || '',
      
      // Metadata
      'Profile Completion': `${calculateProfileCompletion(user)}%`,
      'Created Date': new Date(user.created_at).toLocaleDateString(),
      'Created Time': new Date(user.created_at).toLocaleTimeString(),
      'Last Updated': new Date(user.updated_at).toLocaleDateString()
    }));

    // Escape CSV values properly
    const escapeCSV = (value: string) => {
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };

    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).map(v => escapeCSV(String(v))).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `complete-users-export-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{analytics.total}</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Approval</p>
                <p className="text-2xl font-bold text-yellow-600">{analytics.pending}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">{analytics.approved}</p>
              </div>
              <UserCheck className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Profile Completion</p>
                <p className="text-2xl font-bold">{analytics.avgCompletion}%</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-medium">{analytics.avgCompletion}%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Manage user registrations, approvals, and profile completion
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <Label htmlFor="search">Search Users</Label>
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search by name, email, or company..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <div>
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Buyer Type</Label>
              <Select value={buyerTypeFilter} onValueChange={setBuyerTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="corporate">Corporate</SelectItem>
                  <SelectItem value="privateEquity">Private Equity</SelectItem>
                  <SelectItem value="familyOffice">Family Office</SelectItem>
                  <SelectItem value="searchFund">Search Fund</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Profile Completion</Label>
              <Select value={profileCompletionFilter} onValueChange={setProfileCompletionFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Profiles</SelectItem>
                  <SelectItem value="complete">Complete (80%+)</SelectItem>
                  <SelectItem value="incomplete">Incomplete (&lt;80%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedUsers.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">
                {selectedUsers.length} user{selectedUsers.length === 1 ? '' : 's'} selected
              </span>
              <div className="flex gap-2 ml-auto">
                <Button size="sm" onClick={handleBulkApprove} variant="outline">
                  <UserCheck className="h-4 w-4 mr-2" />
                  Bulk Approve
                </Button>
                <Button size="sm" onClick={handleBulkReject} variant="outline">
                  <UserX className="h-4 w-4 mr-2" />
                  Bulk Reject
                </Button>
              </div>
            </div>
          )}

          {/* Export and Data Status */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-muted-foreground">
              Showing {filteredUsers.length} of {users.length} users
              {analytics.incompleteProfiles > 0 && (
                <div className="mt-1 text-xs text-amber-600">
                  {analytics.incompleteProfiles} users with incomplete profiles (&lt;80% complete)
                </div>
              )}
            </div>
            <Button onClick={exportData} variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export All Fields (CSV)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Quality Insights */}
      {analytics.incompleteProfiles > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">Profile Completion Opportunity</p>
                <p className="text-sm text-amber-700">
                  {analytics.incompleteProfiles} users have profiles under 80% complete. 
                  Consider sending completion reminders to improve data quality.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}