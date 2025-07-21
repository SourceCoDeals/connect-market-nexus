
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import { FeedbackWidget } from "./feedback/FeedbackWidget";

export interface MainLayoutProps {
  children?: React.ReactNode;
}

const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">
        {children || <Outlet />}
      </main>
      <FeedbackWidget />
    </div>
  );
};

export default MainLayout;
