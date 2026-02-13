import { Outlet } from "react-router-dom";
import { ReMarketingSidebar } from "./ReMarketingSidebar";
import { GlobalActivityStatusBar } from "./GlobalActivityStatusBar";
import { ActivityCompletionDialog } from "./ActivityCompletionDialog";
import Navbar from "@/components/Navbar";

export function ReMarketingLayout() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <GlobalActivityStatusBar />
      <ActivityCompletionDialog />
      <div className="flex flex-1 overflow-hidden">
        <ReMarketingSidebar />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
