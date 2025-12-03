
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import bradDaughertyImage from '@/assets/brad-daugherty.png';
import sfcLogo from '@/assets/sfc-logo.png';

const Welcome = () => {
  const { user, authChecked } = useAuth();
  const navigate = useNavigate();

  // Redirect authenticated users away
  useEffect(() => {
    if (authChecked && user) {
      const redirectPath = user.is_admin ? "/admin" : "/";
      navigate(redirectPath, { replace: true });
    }
  }, [user, authChecked, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 min-h-screen items-center max-w-7xl mx-auto">
          
          {/* Left Column - Persona Selection */}
          <div className="flex flex-col justify-center space-y-8">
            {/* Brand Header */}
            <div className="flex items-center space-x-3 mb-2">
              <img 
                src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
                alt="SourceCo Logo" 
                className="h-8 w-8"
              />
              <div>
                <h1 className="text-xl font-semibold tracking-tight">SourceCo</h1>
                <p className="text-sm text-muted-foreground font-light">Marketplace</p>
              </div>
            </div>

            {/* Hero Section */}
            <div className="space-y-4">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground leading-tight">
                Access Off-Market Businesses
                <span className="block text-muted-foreground font-normal text-lg sm:text-xl mt-1">
                  $1M – $50M+ Revenue
                </span>
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                Skip the auction process. Connect directly with business owners considering 
                a sale—before they go to market.
              </p>
            </div>

            {/* Persona Selection Cards */}
            <div className="space-y-4">
              {/* Buyer Card */}
              <Link 
                to="/signup"
                className="group block"
              >
                <Card className="border border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1.5">
                        <h3 className="text-base font-medium text-foreground group-hover:text-primary transition-colors">
                          I'm Looking to Acquire
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
                          Access curated deal flow from our network of 2,000+ business owners. 
                          Pre-qualified opportunities with verified financials.
                        </p>
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>

              {/* Seller Card */}
              <Link 
                to="/sell"
                className="group block"
              >
                <Card className="border border-border/60 hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1.5">
                        <h3 className="text-base font-medium text-foreground group-hover:text-primary transition-colors">
                          I'm a Business Owner
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed max-w-sm">
                          Explore your options confidentially. Connect with vetted buyers 
                          who understand your industry and can close.
                        </p>
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        <div className="w-8 h-8 rounded-full bg-muted/50 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </div>

            {/* Bottom Link */}
            <div className="text-xs text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary font-medium hover:underline">
                Sign in
              </Link>
            </div>
          </div>

          {/* Right Column - Value Proposition & Testimonial */}
          <div className="hidden lg:flex flex-col justify-center space-y-8 pl-8">
            <div className="space-y-6">
              <div className="space-y-3">
                <h2 className="text-2xl font-semibold tracking-tight text-foreground">
                  Why SourceCo?
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-md">
                  We source off-market acquisition opportunities in the lower middle market, 
                  connecting serious buyers with business owners who aren't actively listed.
                </p>
              </div>

              <Card className="bg-gradient-to-br from-muted/30 to-muted/10 border border-border/50 shadow-sm">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex-shrink-0">
                      <img 
                        src={bradDaughertyImage} 
                        alt="Brad Daughterty"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="space-y-2 flex-1 relative">
                      <blockquote className="text-sm text-foreground leading-relaxed italic">
                        "SourceCo's technology-driven sourcing process consistently delivered a robust pipeline of qualified opportunities, resulting in multiple LOIs and a closed deal with more to come."
                      </blockquote>
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-foreground">
                          Brad Daughterty
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Chief Financial Officer, <a 
                            href="https://sportsfacilities.com/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:underline transition-all duration-200"
                          >
                            Sports Facilities Companies
                          </a>
                        </div>
                      </div>
                      <div className="absolute bottom-0 right-0">
                        <img 
                          src={sfcLogo} 
                          alt="Sports Facilities Companies"
                          className="h-6 w-auto opacity-70"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-4 text-xs text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                  <span>2,000+ business owners in our network</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                  <span>$1M – $50M+ revenue companies</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                  <span>Direct owner conversations, no brokers</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Welcome;
