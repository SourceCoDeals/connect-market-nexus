
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useEffect } from "react";
import { Building2, TrendingUp, ArrowRight } from "lucide-react";

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
      <header className="w-full py-6 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
              alt="SourceCo Logo" 
              className="h-10 w-10"
            />
            <div>
              <h1 className="text-xl font-bold text-foreground">SourceCo</h1>
              <p className="text-sm text-muted-foreground font-light -mt-0.5">Marketplace</p>
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
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-4xl w-full">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-light text-foreground tracking-tight mb-4">
              The Marketplace for
              <span className="block font-medium">Off-Market Acquisitions</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Connect with serious buyers and sellers in the lower middle market. 
              Curated deal flow, trusted relationships.
            </p>
          </div>

          {/* Persona Selection Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {/* Owner/Seller Card */}
            <Link 
              to="/sell"
              className="group relative bg-card border border-border rounded-xl p-8 hover:border-sourceco-primary/50 hover:shadow-lg transition-all duration-300"
            >
              <div className="flex flex-col h-full">
                <div className="w-14 h-14 rounded-xl bg-sourceco-muted flex items-center justify-center mb-6">
                  <Building2 className="h-7 w-7 text-sourceco-primary" />
                </div>
                
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  I'm a Business Owner
                </h3>
                
                <p className="text-muted-foreground mb-6 flex-1">
                  Connect with our team to explore your exit strategy and find the right buyer for your business.
                </p>
                
                <div className="flex items-center text-sourceco-primary font-medium group-hover:gap-3 gap-2 transition-all">
                  <span>Talk to our team</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>

            {/* Buyer Card */}
            <Link 
              to="/signup"
              className="group relative bg-card border border-border rounded-xl p-8 hover:border-sourceco-primary/50 hover:shadow-lg transition-all duration-300"
            >
              <div className="flex flex-col h-full">
                <div className="w-14 h-14 rounded-xl bg-sourceco-muted flex items-center justify-center mb-6">
                  <TrendingUp className="h-7 w-7 text-sourceco-primary" />
                </div>
                
                <h3 className="text-xl font-semibold text-foreground mb-3">
                  I'm Looking to Acquire
                </h3>
                
                <p className="text-muted-foreground mb-6 flex-1">
                  Join our buyer network to access curated, off-market business opportunities in the lower middle market.
                </p>
                
                <div className="flex items-center text-sourceco-primary font-medium group-hover:gap-3 gap-2 transition-all">
                  <span>Create an account</span>
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </Link>
          </div>

          {/* Bottom Link */}
          <div className="text-center mt-10">
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

export default Welcome;
