
import { Link } from "react-router-dom";

interface NavbarLogoProps {
  destination: string;
}

const NavbarLogo = ({ destination }: NavbarLogoProps) => {
  return (
    <Link to={destination} className="flex items-center group">
      <img 
        src="/lovable-uploads/b879fa06-6a99-4263-b973-b9ced4404acb.png" 
        alt="SourceCo Logo" 
        className="h-10 w-10 transition-transform duration-200 group-hover:scale-105"
      />
      <div className="ml-3">
        <span className="text-xl font-semibold text-sourceco-text tracking-tight">
          SourceCo
        </span>
        <span className="text-lg text-sourceco-text/60 ml-1.5 font-light tracking-wide">
          Marketplace
        </span>
      </div>
    </Link>
  );
};

export default NavbarLogo;
