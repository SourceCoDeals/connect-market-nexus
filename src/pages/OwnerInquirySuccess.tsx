import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/layout/AuthLayout";

const CalendarRightContent = () => {
  const [calendarLoaded, setCalendarLoaded] = useState(false);

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-2">
          Schedule a Call Now
        </h2>
        <p className="text-sm text-muted-foreground">
          Book a 30-minute introductory call with our team.
        </p>
      </div>

      <div className="flex-1 relative min-h-[400px] rounded-lg overflow-hidden bg-background/50">
        {!calendarLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Loading calendar...</span>
            </div>
          </div>
        )}
        <iframe
          src="https://tidycal.com/tomosmughan/30-minute-meeting"
          className={`w-full h-full min-h-[400px] border-0 transition-opacity duration-300 ${
            calendarLoaded ? "opacity-100" : "opacity-0"
          }`}
          onLoad={() => setCalendarLoaded(true)}
          title="Schedule a call"
        />
      </div>

      <div className="mt-4 text-center">
        <Link 
          to="/welcome" 
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </Link>
      </div>
    </div>
  );
};

const OwnerInquirySuccess = () => {
  return (
    <AuthLayout rightContent={<CalendarRightContent />}>
      <div className="max-w-md">
        <h1 className="text-xl font-semibold text-foreground mb-3">
          We've received your inquiry
        </h1>
        
        <p className="text-sm text-muted-foreground mb-8">
          Our team will reach out within{" "}
          <span className="text-foreground">4 hours</span> to connect you with qualified, institutional buyers.
        </p>

        <div className="mb-8">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground mb-4">
            What happens next
          </h2>
          <ul className="space-y-3">
            <li className="flex items-start gap-3">
              <span className="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0" />
              <span className="text-sm text-muted-foreground">
                We review your business and understand your goals
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0" />
              <span className="text-sm text-muted-foreground">
                We introduce you to pre-qualified buyers with verified financials
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0" />
              <span className="text-sm text-muted-foreground">
                You meet with serious acquirers, not tire-kickers
              </span>
            </li>
          </ul>
        </div>

        <div className="space-y-4">
          <Link 
            to="/welcome" 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Return home
          </Link>
          
          <p className="text-xs text-muted-foreground">
            Looking to buy instead?{" "}
            <Link 
              to="/signup" 
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              Create a buyer account <ArrowRight className="h-3 w-3" />
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
};

export default OwnerInquirySuccess;
