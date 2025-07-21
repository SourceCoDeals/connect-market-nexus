import { EnhancedFeedbackManagement } from "./EnhancedFeedbackManagement";

export function AdminFeedbackTab() {
  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-3xl font-bold">Feedback Management</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Manage user feedback, responses, and templates
        </p>
      </div>
      <EnhancedFeedbackManagement />
    </div>
  );
}