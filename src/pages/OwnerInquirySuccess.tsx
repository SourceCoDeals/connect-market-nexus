
import { Link } from "react-router-dom";
import { CheckCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const OwnerInquirySuccess = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col">
      {/* Header */}
      <header className="w-full py-6 px-6 border-b border-border/50">
        <div className="max-w-3xl mx-auto">
          <Link to="/welcome" className="flex items-center gap-3">
            <img 
              src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
              alt="SourceCo Logo" 
              className="h-8 w-8"
            />
            <div>
              <h1 className="text-lg font-bold text-foreground">SourceCo</h1>
            </div>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center">
          {/* Success Icon */}
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-success" />
          </div>

          {/* Success Message */}
          <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-4">
            Thank You for Reaching Out
          </h2>
          
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            We've received your inquiry and a member of our team will contact you within 
            <span className="font-medium text-foreground"> 24-48 hours</span> to discuss your goals and how we can help.
          </p>

          {/* What's Next */}
          <div className="bg-card border border-border rounded-xl p-6 mb-8 text-left shadow-sm">
            <h3 className="font-medium text-foreground mb-4 text-sm">What happens next?</h3>
            <ul className="space-y-3 text-xs text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-primary text-xs font-medium flex items-center justify-center">1</span>
                <span>Our team reviews your inquiry and business profile</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-primary text-xs font-medium flex items-center justify-center">2</span>
                <span>We'll reach out to schedule an introductory call</span>
              </li>
              <li className="flex gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-muted text-primary text-xs font-medium flex items-center justify-center">3</span>
                <span>Together, we'll explore the best path forward for your exit</span>
              </li>
            </ul>
          </div>

          {/* CTAs */}
          <div className="space-y-3">
            <Link to="/welcome">
              <Button variant="outline" className="w-full text-sm">
                Return to Home
              </Button>
            </Link>
            
            <p className="text-xs text-muted-foreground">
              Interested in browsing acquisition opportunities?{" "}
              <Link to="/signup" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
                Create a buyer account <ArrowRight className="h-3 w-3" />
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 px-6 border-t border-border/50">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} SourceCo. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default OwnerInquirySuccess;
