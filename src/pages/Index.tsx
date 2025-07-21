
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

const Index = () => {
  const { user, isAdmin } = useAuth();

  // If user is logged in, redirect to marketplace
  if (user) {
    return <Navigate to="/marketplace" replace />;
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1">
        {/* Hero Section */}
        <section className="relative bg-gradient-to-b from-white to-blue-50">
          <div className="container mx-auto px-4 py-16 md:py-24">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
                Connect with Off-Market
                <span className="text-primary block">Business Opportunities</span>
              </h1>
              <p className="mt-6 text-xl text-muted-foreground">
                A curated marketplace of exclusive business listings for qualified buyers.
                Browse confidential opportunities not available to the public.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
                {user ? (
                  <Button asChild size="lg" className="px-8">
                    <Link to="/marketplace">
                      Browse Marketplace
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild size="lg" className="px-8">
                      <Link to="/signup">
                        Create Account
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="lg">
                      <Link to="/login">
                        Sign In
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Pattern decoration */}
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQ0MCIgaGVpZ2h0PSI0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMCAyMGMxMDAgMTAgMjAwIDEwIDMwMCAwczIwMC0xMCAzMDAgMCAyMDAgMTAgMzAwIDAgMjAwLTEwIDMwMCAwIDIwMCAxMCAzMDAgMCkiIHN0cm9rZT0icmdiYSgyMTQsMjE5LDIzMCwwLjUpIiBzdHJva2Utd2lkdGg9IjIiLz48L3N2Zz4=')]"></div>
        </section>
        
        {/* Features section */}
        <section className="py-16 md:py-24">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h2 className="text-3xl font-bold">How It Works</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Our private marketplace connects qualified buyers with exclusive business opportunities
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
              <div className="flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
                    <line x1="16" x2="16" y1="2" y2="6"></line>
                    <line x1="8" x2="8" y1="2" y2="6"></line>
                    <line x1="3" x2="21" y1="10" y2="10"></line>
                    <path d="m9 16 2 2 4-4"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-medium mb-2">Apply for Membership</h3>
                <p className="text-muted-foreground">
                  Register and complete your buyer profile to get approved for our exclusive marketplace.
                </p>
              </div>
              
              <div className="flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="M22 12V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h16a2 2 0 0 0 2-2v-4"></path>
                    <rect x="6" y="9" width="12" height="6" rx="2"></rect>
                  </svg>
                </div>
                <h3 className="text-xl font-medium mb-2">Browse Opportunities</h3>
                <p className="text-muted-foreground">
                  Explore our curated collection of off-market businesses looking for the right buyer.
                </p>
              </div>
              
              <div className="flex flex-col items-center text-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                    <path d="M17 18a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2"></path>
                    <rect width="18" height="18" x="3" y="4" rx="2"></rect>
                    <circle cx="12" cy="10" r="2"></circle>
                    <line x1="8" x2="8" y1="2" y2="4"></line>
                    <line x1="16" x2="16" y1="2" y2="4"></line>
                  </svg>
                </div>
                <h3 className="text-xl font-medium mb-2">Connect & Transact</h3>
                <p className="text-muted-foreground">
                  Request connections to opportunities that match your criteria and engage with owners.
                </p>
              </div>
            </div>
          </div>
        </section>
        
        {/* CTA section */}
        <section className="bg-primary/5 py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto rounded-xl bg-white shadow-sm border p-8 md:p-12">
              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex-1">
                  <h2 className="text-2xl md:text-3xl font-bold">Ready to find your next opportunity?</h2>
                  <p className="mt-4 text-muted-foreground">
                    Join our network of qualified buyers and get access to exclusive listings not available on the public market.
                  </p>
                </div>
                <div className="shrink-0">
                  {user ? (
                    <Button asChild size="lg">
                      <Link to="/marketplace">Browse Listings</Link>
                    </Button>
                  ) : (
                    <Button asChild size="lg">
                      <Link to="/signup">Create Account</Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
      
      {/* Footer */}
      <footer className="bg-muted/30 border-t border-border">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-sm text-muted-foreground">
                © 2025 ConnectMarket. All rights reserved.
              </p>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Terms
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Privacy
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
