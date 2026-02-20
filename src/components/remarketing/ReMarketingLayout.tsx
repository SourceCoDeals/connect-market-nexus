import { Outlet } from "react-router-dom";
import { GlobalActivityStatusBar } from "./GlobalActivityStatusBar";
import { ActivityCompletionDialog } from "./ActivityCompletionDialog";

/**
 * ReMarketingLayout is now a thin wrapper that only adds the
 * GlobalActivityStatusBar and ActivityCompletionDialog.
 * The sidebar and outer shell come from AdminLayout (parent route).
 */
export function ReMarketingLayout() {
  return (
    <>
      <GlobalActivityStatusBar />
      <ActivityCompletionDialog />
      <Outlet />
    </>
  );
}
