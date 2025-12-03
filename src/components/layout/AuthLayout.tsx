import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import bradDaughertyImage from '@/assets/brad-daugherty.png';
import sfcLogo from '@/assets/sfc-logo.png';

interface AuthLayoutProps {
  children: React.ReactNode;
  rightContent?: React.ReactNode;
  showBackLink?: boolean;
  backLinkTo?: string;
  backLinkText?: string;
}

const AuthLayout = ({ 
  children, 
  rightContent,
  showBackLink = false,
  backLinkTo = "/welcome",
  backLinkText = "Back to selection"
}: AuthLayoutProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Centered Logo Header */}
      <header className="w-full py-6 px-4">
        <div className="max-w-5xl mx-auto flex justify-center">
          <Link to="/welcome" className="flex items-center space-x-2">
            <img 
              src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
              alt="SourceCo Logo" 
              className="h-8 w-8"
            />
            <div className="flex items-baseline">
              <span className="text-xl font-semibold tracking-tight">SourceCo</span>
              <span className="text-sm text-muted-foreground font-light ml-1.5">Marketplace</span>
            </div>
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 pb-12">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 min-h-[calc(100vh-120px)]">
            
            {/* Left Column - Main Content (white background) */}
            <div className="flex flex-col justify-center py-8 lg:py-12 lg:pr-12">
              {showBackLink && (
                <Link 
                  to={backLinkTo} 
                  className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit mb-6"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m15 18-6-6 6-6"/>
                  </svg>
                  {backLinkText}
                </Link>
              )}
              {children}
            </div>

            {/* Right Column - Value Proposition (warm accent background) */}
            <div className="hidden lg:flex flex-col justify-center py-12 pl-12 bg-sourceco-muted/50 rounded-2xl my-8">
              {rightContent || <DefaultRightContent />}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

const DefaultRightContent = () => (
  <div className="space-y-8 pr-8">
    {/* Welcome Header */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        Welcome to SourceCo
      </h2>
      <p className="text-sm text-muted-foreground leading-relaxed">
        SourceCo is a private marketplace connecting qualified acquirers with off-market 
        business opportunities in the $1M–$50M revenue range.
      </p>
      <p className="text-sm text-muted-foreground leading-relaxed">
        We source deals directly from owners considering an exit—before they go to brokers 
        or public listings. Whether you're looking to acquire a company or exploring what 
        your business might be worth, our network provides access without the noise.
      </p>
    </div>

    {/* Testimonial */}
    <Card className="bg-background/80 border border-border/50 shadow-sm">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-start space-x-3">
          <div className="w-9 h-9 rounded-full overflow-hidden bg-muted flex-shrink-0">
            <img 
              src={bradDaughertyImage} 
              alt="Brad Daughterty"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-2 flex-1 relative">
            <blockquote className="text-xs text-foreground leading-relaxed italic">
              "SourceCo's technology-driven sourcing process consistently delivered a 
              robust pipeline of qualified opportunities, resulting in multiple LOIs and 
              a closed deal with more to come."
            </blockquote>
            <div className="space-y-0.5">
              <div className="text-xs font-medium text-foreground">
                Brad Daughterty
              </div>
              <div className="text-[11px] text-muted-foreground">
                CFO, <a 
                  href="https://sportsfacilities.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Sports Facilities Companies
                </a>
              </div>
            </div>
            <div className="absolute bottom-0 right-0">
              <img 
                src={sfcLogo} 
                alt="Sports Facilities Companies"
                className="h-5 w-auto opacity-60"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>

    {/* Value Props */}
    <div className="space-y-3 text-xs text-muted-foreground">
      <div className="flex items-center space-x-2">
        <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
        <span>Off-market opportunities, no public listings</span>
      </div>
      <div className="flex items-center space-x-2">
        <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
        <span>Direct owner conversations, skip the brokers</span>
      </div>
      <div className="flex items-center space-x-2">
        <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
        <span>Vetted participants on both sides</span>
      </div>
    </div>
  </div>
);

export { AuthLayout, DefaultRightContent };
