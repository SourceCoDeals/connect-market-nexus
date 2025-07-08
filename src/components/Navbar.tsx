
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { List, LogOut, User } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";

const Navbar = () => {
  const { user, isLoading, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const handleLogout = async () => {
    try {
      await logout();
      navigate("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName?.charAt(0) || ""}${lastName?.charAt(0) || ""}`.toUpperCase();
  };

  // Determine where the logo should navigate to
  const getLogoDestination = () => {
    if (!user) return "/login";
    if (user.approval_status !== 'approved') return "/pending-approval";
    return "/marketplace";
  };

  return (
    <header className="bg-background border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to={getLogoDestination()} className="flex items-center">
              <img 
                src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
                alt="SourceCo Logo" 
                className="h-8 w-8 mr-2"
              />
              <span className="text-xl font-bold">SourceCo</span>
              <span className="text-xl text-muted-foreground ml-1 font-light">
                Marketplace
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {isLoading ? (
              <div className="flex items-center gap-4">
                {!isMobile && (
                  <>
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-20" />
                  </>
                )}
                <Skeleton className="h-9 w-9 rounded-full" />
              </div>
            ) : user ? (
              <>
                {!isMobile && user.approval_status === 'approved' && (
                  <nav className="flex items-center space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <Link to="/marketplace">
                        <img 
                          src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
                          alt="" 
                          className="h-4 w-4 mr-1"
                        />
                        Marketplace
                      </Link>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      asChild
                    >
                      <Link to="/my-requests">
                        <List className="h-4 w-4 mr-1" />
                        My Requests
                      </Link>
                    </Button>

                    {isAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-primary text-primary hover:bg-primary/5"
                        onClick={() => navigate("/admin")}
                      >
                        Admin Dashboard
                      </Button>
                    )}
                  </nav>
                )}

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="relative h-9 w-9 rounded-full"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback>
                          {getInitials(user?.first_name, user?.last_name)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {isMobile && user.approval_status === 'approved' && (
                      <>
                        <DropdownMenuItem asChild>
                          <Link to="/marketplace">
                            <img 
                              src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
                              alt="" 
                              className="mr-2 h-4 w-4"
                            />
                            <span>Marketplace</span>
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link to="/my-requests">
                            <List className="mr-2 h-4 w-4" />
                            <span>My Requests</span>
                          </Link>
                        </DropdownMenuItem>
                        {isAdmin && (
                          <DropdownMenuItem onSelect={() => navigate("/admin")}>
                            <img 
                              src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
                              alt="" 
                              className="mr-2 h-4 w-4"
                            />
                            <span>Admin Dashboard</span>
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuItem asChild>
                      <Link to="/profile">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log Out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center space-x-2">
                <Button variant="outline" asChild>
                  <Link to="/login">Log In</Link>
                </Button>
                <Button asChild>
                  <Link to="/signup">Sign Up</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
