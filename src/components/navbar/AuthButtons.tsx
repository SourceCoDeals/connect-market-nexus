
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const AuthButtons = () => {
  return (
    <div className="flex items-center space-x-2">
      <Button variant="outline" asChild>
        <Link to="/login">Log In</Link>
      </Button>
      <Button asChild>
        <Link to="/welcome">Get Started</Link>
      </Button>
    </div>
  );
};

export default AuthButtons;
