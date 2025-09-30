import { useState, useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ContentOutline } from "./ContentOutline";
import { EditorMainPanel } from "./EditorMainPanel";
import { LivePreviewPanel } from "./LivePreviewPanel";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";

interface PremiumListingEditorProps {
  form: UseFormReturn<any>;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  imagePreview: string | null;
  setImagePreview: (preview: string | null) => void;
  isEditMode: boolean;
}

export function PremiumListingEditor({
  form,
  imageFile,
  setImageFile,
  imagePreview,
  setImagePreview,
  isEditMode,
}: PremiumListingEditorProps) {
  const [activeSection, setActiveSection] = useState("overview");
  const [showPreview, setShowPreview] = useState(true);
  
  const formValues = form.watch();

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] bg-gradient-to-br from-background via-background to-muted/5">
      {/* Premium Header */}
      <div className="border-b bg-card/50 backdrop-blur-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {isEditMode ? "Edit Listing" : "Create New Listing"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Investment-grade marketplace presentation
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <Tabs value={showPreview ? "preview" : "focus"} onValueChange={(v) => setShowPreview(v === "preview")}>
              <TabsList className="bg-muted/50">
                <TabsTrigger value="focus" className="text-xs">Focus Mode</TabsTrigger>
                <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Three-Panel Layout */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left Panel - Content Outline */}
        <ResizablePanel defaultSize={20} minSize={15} maxSize={25}>
          <ContentOutline 
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            formValues={formValues}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Center Panel - Main Editor */}
        <ResizablePanel defaultSize={showPreview ? 50 : 80} minSize={40}>
          <EditorMainPanel
            form={form}
            activeSection={activeSection}
            imageFile={imageFile}
            setImageFile={setImageFile}
            imagePreview={imagePreview}
            setImagePreview={setImagePreview}
          />
        </ResizablePanel>

        {/* Right Panel - Live Preview */}
        {showPreview && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={30} minSize={25} maxSize={40}>
              <LivePreviewPanel formValues={formValues} imagePreview={imagePreview} />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
