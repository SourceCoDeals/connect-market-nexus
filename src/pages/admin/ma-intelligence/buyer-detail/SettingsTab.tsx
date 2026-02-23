import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Archive, Trash2 } from "lucide-react";
import type { SettingsTabProps } from "./types";

export function SettingsTab({
  buyer,
  percentage,
  onArchive,
  onDelete,
}: SettingsTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
        <CardDescription>Buyer settings and data management</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-sm font-medium mb-2">Data Management</h4>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">
              Last enriched: {buyer.data_last_updated || "Never"}
            </div>
            <div className="text-sm text-muted-foreground">
              Created: {new Date(buyer.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        <div>
          <h4 className="text-sm font-medium mb-2">Data Completeness</h4>
          <div className="text-sm text-muted-foreground">{percentage}% complete</div>
        </div>
        <div>
          <h4 className="text-sm font-medium mb-2">Actions</h4>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onArchive}>
              <Archive className="w-4 h-4 mr-2" />
              Archive Buyer
            </Button>
            <Button variant="destructive" onClick={onDelete}>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Buyer
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
