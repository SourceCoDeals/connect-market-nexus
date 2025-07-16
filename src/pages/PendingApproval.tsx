
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Clock, Mail, CheckCircle, XCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";

const PendingApproval = () => {
  const { user, logout } = useAuth();

  const getStatusIcon = () => {
    switch (user?.approval_status) {
      case 'pending':
        return <Clock className="h-8 w-8 text-yellow-600" />;
      case 'approved':
        return <CheckCircle className="h-8 w-8 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-8 w-8 text-red-600" />;
      default:
        return <Clock className="h-8 w-8 text-yellow-600" />;
    }
  };

  const getStatusTitle = () => {
    switch (user?.approval_status) {
      case 'pending':
        return 'Account Under Review';
      case 'approved':
        return 'Account Approved!';
      case 'rejected':
        return 'Account Not Approved';
      default:
        return 'Account Under Review';
    }
  };

  const getStatusDescription = () => {
    switch (user?.approval_status) {
      case 'pending':
        return 'Your account is currently being reviewed by our team. We\'ll notify you once the review is complete.';
      case 'approved':
        return 'Great news! Your account has been approved. You can now access the marketplace.';
      case 'rejected':
        return 'Unfortunately, your account application was not approved at this time.';
      default:
        return 'Your account is currently being reviewed by our team.';
    }
  };

  const getStatusColor = () => {
    switch (user?.approval_status) {
      case 'pending':
        return 'border-yellow-200 bg-yellow-50';
      case 'approved':
        return 'border-green-200 bg-green-50';
      case 'rejected':
        return 'border-red-200 bg-red-50';
      default:
        return 'border-yellow-200 bg-yellow-50';
    }
  };

  const getStatusTextColor = () => {
    switch (user?.approval_status) {
      case 'pending':
        return 'text-yellow-800';
      case 'approved':
        return 'text-green-800';
      case 'rejected':
        return 'text-red-800';
      default:
        return 'text-yellow-800';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-2 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
            {getStatusIcon()}
          </div>
          <CardTitle className="text-2xl font-bold">{getStatusTitle()}</CardTitle>
          <CardDescription>
            Hello {user?.first_name} {user?.last_name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className={getStatusColor()}>
            <AlertDescription className={getStatusTextColor()}>
              {getStatusDescription()}
            </AlertDescription>
          </Alert>

          {user?.approval_status === 'pending' && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground space-y-2">
                <p><strong>What happens next?</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Our team will review your application</li>
                  <li>You'll receive an email notification with the decision</li>
                  <li>Review typically takes 1-2 business days</li>
                </ul>
              </div>

              <Alert className="border-blue-200 bg-blue-50">
                <Mail className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Make sure to check your email regularly for updates on your application status.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {user?.approval_status === 'approved' && (
            <div className="space-y-4">
              <Button asChild className="w-full">
                <Link to="/dashboard">
                  Access Marketplace
                </Link>
              </Button>
            </div>
          )}

          {user?.approval_status === 'rejected' && (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                <p>If you believe this was an error or would like to appeal this decision, please contact our support team.</p>
              </div>
              
              <Button variant="outline" className="w-full">
                <Mail className="mr-2 h-4 w-4" />
                Contact Support
              </Button>
            </div>
          )}

          <div className="pt-4 border-t">
            <Button variant="ghost" onClick={logout} className="w-full">
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
