
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { Building2, TrendingUp, ArrowRight, Shield, Users, Zap } from "lucide-react";

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
    <div className="min-h-screen bg-sourceco-background flex flex-col">
      {/* Header */}
      <header className="w-full py-4 sm:py-6 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <img 
              src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
              alt="SourceCo Logo" 
              className="h-8 w-8 sm:h-10 sm:w-10"
            />
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground">SourceCo</h1>
              <p className="text-xs sm:text-sm text-muted-foreground font-light -mt-0.5">Marketplace</p>
            </div>
          </div>
          <Link 
            to="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12">
        <div className="max-w-4xl w-full">
          {/* Hero Section */}
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-light text-foreground tracking-tight mb-3 sm:mb-4">
              The Marketplace for
              <span className="block font-medium">Off-Market Acquisitions</span>
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto px-2">
              Connect with serious buyers and sellers in the lower middle market. 
              Curated deal flow, trusted relationships.
            </p>
          </div>

          {/* Persona Selection Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto">
            {/* Owner/Seller Card */}
            <Link 
              to="/sell"
              className="group relative bg-card border border-border rounded-xl p-6 sm:p-8 hover:border-sourceco-primary/50 hover:shadow-lg transition-all duration-300 active:scale-[0.98]"
            >
              <div className="flex flex-col h-full">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-sourceco-muted flex items-center justify-center mb-4 sm:mb-6">
                  <Building2 className="h-6 w-6 sm:h-7 sm:w-7 text-sourceco-primary" />
                </div>
                
                <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-3">
                  I'm a Business Owner
                </h3>
                
                <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 flex-1">
                  Connect with our team to explore your exit strategy and find the right buyer for your business.
                </p>
                
                <div className="flex items-center text-sourceco-primary font-medium group-hover:gap-3 gap-2 transition-all text-sm sm:text-base">
                  <span>Talk to our team</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            {/* Buyer Card */}
            <Link 
              to="/signup"
              className="group relative bg-card border border-border rounded-xl p-6 sm:p-8 hover:border-sourceco-primary/50 hover:shadow-lg transition-all duration-300 active:scale-[0.98]"
            >
              <div className="flex flex-col h-full">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-sourceco-muted flex items-center justify-center mb-4 sm:mb-6">
                  <TrendingUp className="h-6 w-6 sm:h-7 sm:w-7 text-sourceco-primary" />
                </div>
                
                <h3 className="text-lg sm:text-xl font-semibold text-foreground mb-2 sm:mb-3">
                  I'm Looking to Acquire
                </h3>
                
                <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 flex-1">
                  Join our buyer network to access curated, off-market business opportunities in the lower middle market.
                </p>
                
                <div className="flex items-center text-sourceco-primary font-medium group-hover:gap-3 gap-2 transition-all text-sm sm:text-base">
                  <span>Create an account</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </div>

          {/* Trust Signals */}
          <div className="mt-10 sm:mt-16 grid grid-cols-3 gap-4 sm:gap-8 max-w-2xl mx-auto text-center">
            <div className="flex flex-col items-center">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground mb-2" />
              <span className="text-xs sm:text-sm text-muted-foreground">Confidential</span>
            </div>
            <div className="flex flex-col items-center">
              <Users className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground mb-2" />
              <span className="text-xs sm:text-sm text-muted-foreground">Vetted Buyers</span>
            </div>
            <div className="flex flex-col items-center">
              <Zap className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground mb-2" />
              <span className="text-xs sm:text-sm text-muted-foreground">Direct Access</span>
            </div>
          </div>

          {/* Bottom Link */}
          <div className="text-center mt-8 sm:mt-10">
            <p className="text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-sourceco-primary font-medium hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 sm:py-6 px-4 sm:px-6 border-t border-border/50">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} SourceCo. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Welcome;
