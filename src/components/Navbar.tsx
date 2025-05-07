
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, User, LogOut, Settings, ClipboardList } from "lucide-react";

const Navbar = () => {
  const { user, logout, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full bg-white border-b border-border">
      <div className="container flex h-16 items-center justify-between px-4 md:px-6">
        <div className="flex items-center space-x-4">
          <Link to="/" className="flex items-center space-x-2">
            <span className="text-xl font-bold">ConnectMarket</span>
          </Link>
          <nav className="hidden md:flex items-center space-x-6">
            <Link to="/marketplace" className="text-sm font-medium transition-colors hover:text-primary">
              Marketplace
            </Link>
            <Link to="/my-requests" className="text-sm font-medium transition-colors hover:text-primary">
              My Requests
            </Link>
          </nav>
        </div>
        
        <div className="flex items-center space-x-4">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <User className="h-5 w-5" />
                  <span className="sr-only">User menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/my-requests" className="flex w-full cursor-pointer items-center">
                    <ClipboardList className="mr-2 h-4 w-4" />
                    <span>My Requests</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex w-full cursor-pointer items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin/dashboard" className="flex w-full cursor-pointer items-center">
                      <span className="mr-2 h-4 w-4 bg-primary rounded-sm text-white text-[10px] flex items-center justify-center font-medium">A</span>
                      <span>Admin Portal</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => logout()} className="cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden md:flex items-center gap-3">
              <Button asChild variant="outline">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">Sign up</Link>
              </Button>
            </div>
          )}
          
          <button
            className="md:hidden flex items-center justify-center w-8 h-8"
            onClick={() => setIsOpen(!isOpen)}
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </button>
        </div>
      </div>
      
      {/* Mobile navigation */}
      <div
        className={cn(
          "fixed inset-0 top-16 z-50 bg-white border-t border-border md:hidden transition-transform duration-300 transform",
          isOpen ? "translate-y-0" : "translate-y-full",
        )}
      >
        <div className="container py-4 px-4">
          <nav className="flex flex-col gap-4">
            <Link
              to="/marketplace"
              onClick={() => setIsOpen(false)}
              className="py-2 text-base font-medium"
            >
              Marketplace
            </Link>
            <Link
              to="/my-requests"
              onClick={() => setIsOpen(false)}
              className="py-2 text-base font-medium"
            >
              My Requests
            </Link>
            
            {user ? (
              <>
                <div className="h-px bg-border my-2"></div>
                
                <div className="py-2">
                  <div className="flex items-center mb-2">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </div>
                
                {isAdmin && (
                  <Link
                    to="/admin/dashboard"
                    onClick={() => setIsOpen(false)}
                    className="py-2 text-base font-medium flex items-center"
                  >
                    <span className="mr-2 h-5 w-5 bg-primary rounded-sm text-white text-[11px] flex items-center justify-center font-medium">A</span>
                    Admin Portal
                  </Link>
                )}
                
                <Link
                  to="/profile"
                  onClick={() => setIsOpen(false)}
                  className="py-2 text-base font-medium flex items-center"
                >
                  <Settings className="mr-2 h-5 w-5" />
                  Profile
                </Link>
                
                <button
                  onClick={() => {
                    logout();
                    setIsOpen(false);
                  }}
                  className="py-2 text-base font-medium flex items-center text-red-500"
                >
                  <LogOut className="mr-2 h-5 w-5" />
                  Log out
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-3 mt-2">
                <Button asChild>
                  <Link to="/login" onClick={() => setIsOpen(false)}>
                    Sign in
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/signup" onClick={() => setIsOpen(false)}>
                    Sign up
                  </Link>
                </Button>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
