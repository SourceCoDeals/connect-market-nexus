import { UseFormReturn } from "react-hook-form";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BasicInfoSection } from "./sections/BasicInfoSection";
import { DescriptionSection } from "./sections/DescriptionSection";
import { InvestmentSection } from "./sections/InvestmentSection";
import { VisualsSection } from "./sections/VisualsSection";
import { InternalSection } from "./sections/InternalSection";

interface EditorMainPanelProps {
  form: UseFormReturn<any>;
  activeSection: string;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  imagePreview: string | null;
  setImagePreview: (preview: string | null) => void;
}

export function EditorMainPanel({
  form,
  activeSection,
  imageFile,
  setImageFile,
  imagePreview,
  setImagePreview,
}: EditorMainPanelProps) {
  const renderSection = () => {
    switch (activeSection) {
      case "overview":
        return <BasicInfoSection form={form} />;
      case "description":
        return <DescriptionSection form={form} />;
      case "investment":
        return <InvestmentSection form={form} />;
      case "visuals":
        return <VisualsSection form={form} imageFile={imageFile} setImageFile={setImageFile} imagePreview={imagePreview} setImagePreview={setImagePreview} />;
      case "internal":
        return <InternalSection form={form} />;
      default:
        return <BasicInfoSection form={form} />;
    }
  };

  return (
    <ScrollArea className="h-full bg-background/50">
      <div className="max-w-4xl mx-auto px-8 py-8">
        {renderSection()}
      </div>
    </ScrollArea>
  );
}
