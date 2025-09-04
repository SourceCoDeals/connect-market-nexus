import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Deal } from '@/hooks/admin/use-deals';
import { useUserConnectionRequests } from '@/hooks/admin/use-user-connection-requests';
import { formatCurrency, formatDate } from '@/lib/utils';
import { User, Building, MapPin, Phone, Mail, TrendingUp, Star, Eye, Heart } from 'lucide-react';

interface DealBuyerTabProps {
  deal: Deal;
}

export function DealBuyerTab({ deal }: DealBuyerTabProps) {
  // Get other connection requests for this buyer - using deal's buyer info instead
  const { data: connectionRequests } = useUserConnectionRequests(deal.buyer_id || '');

  const getBuyerTypeColor = (buyerType: string) => {
    switch (buyerType?.toLowerCase()) {
      case 'private equity':
      case 'pe':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'strategic':
      case 'corporate':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'independent sponsor':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'search fund':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'family office':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getConnectionStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'on_hold':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="p-8 space-y-6">
      {/* Buyer Profile */}
      <Card className="border-0 shadow-sm bg-gray-50">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <User className="h-5 w-5 text-gray-600" />
            Buyer Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {deal.buyer_name || 'Unknown Buyer'}
                </h2>
                <Badge className={`${getBuyerTypeColor(deal.buyer_type)} text-sm`}>
                  {deal.buyer_type}
                </Badge>
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-gray-700">
                    Score: {deal.buyer_priority_score || 0}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Company</p>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900">{deal.buyer_company || 'Not provided'}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Email</p>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900">{deal.buyer_email || 'Not provided'}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Phone</p>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900">{'Not provided'}</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-1">Website</p>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-900">{deal.user_website || 'Not provided'}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="border-gray-200"
                onClick={() => window.open(`mailto:${deal.user_email}`)}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
              {deal.user_phone_number && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-gray-200"
                  onClick={() => window.open(`tel:${deal.user_phone_number}`)}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Investment Criteria */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gray-600" />
            Investment Criteria
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">Target Deal Size</p>
              <p className="text-lg font-semibold text-gray-900">
                {deal.target_deal_size_min && deal.target_deal_size_max 
                  ? `${formatCurrency(deal.target_deal_size_min)} - ${formatCurrency(deal.target_deal_size_max)}`
                  : 'Not specified'
                }
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500 mb-2">Target Locations</p>
              <div className="flex flex-wrap gap-1">
                {deal.target_locations && Array.isArray(deal.target_locations) ? (
                  deal.target_locations.map((location, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {location}
                    </Badge>
                  ))
                ) : (
                  <span className="text-gray-900">Not specified</span>
                )}
              </div>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm font-medium text-gray-500 mb-2">Business Categories</p>
              <div className="flex flex-wrap gap-1">
                {deal.business_categories && Array.isArray(deal.business_categories) ? (
                  deal.business_categories.map((category, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {category}
                    </Badge>
                  ))
                ) : (
                  <span className="text-gray-900">Not specified</span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Other Connection Requests */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Eye className="h-5 w-5 text-gray-600" />
            Other Connection Requests
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {connectionRequests && connectionRequests.length > 0 ? (
            <div className="space-y-3">
              {connectionRequests.slice(0, 5).map((request) => (
                <div key={request.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{request.listing?.title}</p>
                    <p className="text-sm text-gray-600">
                      Requested {formatDate(request.created_at)}
                    </p>
                  </div>
                  <Badge className={`${getConnectionStatusColor(request.status)} text-xs`}>
                    {request.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
              {connectionRequests.length > 5 && (
                <p className="text-sm text-gray-500 text-center pt-2">
                  +{connectionRequests.length - 5} more requests
                </p>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <Eye className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">No other connection requests found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* User Activity Summary */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gray-600" />
            Activity Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full mx-auto mb-2">
                <Eye className="h-4 w-4 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {connectionRequests?.length || 0}
              </p>
              <p className="text-sm text-gray-600">Connections</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center w-8 h-8 bg-green-100 rounded-full mx-auto mb-2">
                <Heart className="h-4 w-4 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">0</p>
              <p className="text-sm text-gray-600">Saved Listings</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-center w-8 h-8 bg-purple-100 rounded-full mx-auto mb-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {deal.buyer_priority_score || 0}
              </p>
              <p className="text-sm text-gray-600">Priority Score</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
