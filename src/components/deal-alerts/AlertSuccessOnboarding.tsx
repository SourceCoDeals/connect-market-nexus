import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, Bell, Users, Zap } from 'lucide-react';

interface AlertSuccessOnboardingProps {
  onClose: () => void;
  onCreateAnother: () => void;
}

export function AlertSuccessOnboarding({ onClose, onCreateAnother }: AlertSuccessOnboardingProps) {
  return (
    <Card className="border-green-200 bg-green-50/50">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle className="h-6 w-6 text-green-600" />
        </div>
        <CardTitle className="text-green-900">🎉 Your Deal Alert is Live!</CardTitle>
        <p className="text-sm text-green-700">
          You'll be among the first to know when new opportunities match your criteria.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-white rounded-lg border border-green-200">
            <Bell className="h-5 w-5 text-green-600 mx-auto mb-1" />
            <p className="text-xs font-medium text-green-900">Instant Notifications</p>
            <p className="text-xs text-green-700">Get alerts as soon as deals are posted</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-green-200">
            <Users className="h-5 w-5 text-green-600 mx-auto mb-1" />
            <p className="text-xs font-medium text-green-900">First Access</p>
            <p className="text-xs text-green-700">See opportunities before others</p>
          </div>
          <div className="p-3 bg-white rounded-lg border border-green-200">
            <Zap className="h-5 w-5 text-green-600 mx-auto mb-1" />
            <p className="text-xs font-medium text-green-900">Perfect Matches</p>
            <p className="text-xs text-green-700">Only deals meeting your criteria</p>
          </div>
        </div>
        
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onCreateAnother} className="flex-1">
            Create Another Alert
          </Button>
          <Button onClick={onClose} className="flex-1">
            Browse Marketplace
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}