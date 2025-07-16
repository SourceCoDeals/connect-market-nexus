
import { Link } from "react-router-dom";

export const PasswordResetLink = () => {
  return (
    <div className="text-center">
      <Link
        to="/forgot-password"
        className="text-sm text-primary hover:text-primary/80 transition-colors"
      >
        Forgot your password?
      </Link>
    </div>
  );
};
