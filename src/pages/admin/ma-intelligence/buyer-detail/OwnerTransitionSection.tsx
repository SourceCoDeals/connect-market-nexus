import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BuyerDataSection } from "@/components/ma-intelligence/BuyerDataSection";
import type { BuyerSectionProps } from "./types";

export function OwnerTransitionSection({
  buyer,
  isEditing,
  formData,
  onEdit,
  onSave,
  onCancel,
  onSetFormData,
}: BuyerSectionProps) {
  return (
    <BuyerDataSection
      title="Owner Transition"
      description="Owner requirements and transition preferences"
      isEditing={isEditing}
      onEdit={onEdit}
      onSave={onSave}
      onCancel={onCancel}
    >
      {isEditing ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Owner Roll Requirement</Label>
            <Textarea
              value={formData.owner_roll_requirement || ""}
              onChange={(e) =>
                onSetFormData({
                  ...formData,
                  owner_roll_requirement: e.target.value,
                })
              }
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Owner Transition Goals</Label>
            <Textarea
              value={formData.owner_transition_goals || ""}
              onChange={(e) =>
                onSetFormData({
                  ...formData,
                  owner_transition_goals: e.target.value,
                })
              }
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Employee Owner</Label>
            <Input
              value={formData.employee_owner || ""}
              onChange={(e) =>
                onSetFormData({ ...formData, employee_owner: e.target.value })
              }
            />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <div className="text-sm font-medium mb-1">Owner Roll Requirement</div>
            <div className="text-sm text-muted-foreground">
              {buyer.owner_roll_requirement || "\u2014"}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Owner Transition Goals</div>
            <div className="text-sm text-muted-foreground">
              {buyer.owner_transition_goals || "\u2014"}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-1">Employee Owner</div>
            <div className="text-sm text-muted-foreground">
              {buyer.employee_owner || "\u2014"}
            </div>
          </div>
        </div>
      )}
    </BuyerDataSection>
  );
}
