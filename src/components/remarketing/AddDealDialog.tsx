import { useState, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Link2, Upload, X, FileText, Search, Building2, MapPin, DollarSign, Check, Users, ChevronDown, ChevronUp, ExternalLink, Globe, ArrowRight } from "lucide-react";
import { toast } from "sonner";

interface AddDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDealCreated?: () => void;
}

const SUPPORTED_EXTENSIONS = ['txt', 'vtt', 'srt', 'pdf', 'doc', 'docx'];
const TEXT_EXTENSIONS = ['txt', 'vtt', 'srt'];
const DOC_EXTENSIONS = ['pdf', 'doc', 'docx'];

const normalizeName = (name: string) => name.trim().toLowerCase().replace(/\.[^.]+$/, '');
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const formatCurrency = (value: number | null) => {
  if (!value) return null;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
};

export const AddDealDialog = ({
  open,
  onOpenChange,
  onDealCreated,
}: AddDealDialogProps) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const transcriptFilesRef = useRef<File[]>([]);
  const [activeTab, setActiveTab] = useState<"marketplace" | "new">("marketplace");
  const [searchQuery, setSearchQuery] = useState("");
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addingToRemarketing, setAddingToRemarketing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    website: "",
    location: "",
    revenue: "",
    ebitda: "",
    description: "",
    transcriptLink: "",
    mainContactName: "",
    mainContactEmail: "",
    mainContactPhone: "",
    mainContactTitle: "",
  });
  const [transcriptFiles, setTranscriptFiles] = useState<File[]>([]);

  const updateFiles = (files: File[]) => {
    setTranscriptFiles(files);
    transcriptFilesRef.current = files;
  };

  const PAGE_SIZE = 50;

  // Search marketplace listings with infinite scroll
  const {
    data: marketplaceData,
    isLoading: searchLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['marketplace-search', searchQuery],
    queryFn: async ({ pageParam = 0 }) => {
      let query = supabase
        .from('listings')
        .select('id, title, internal_company_name, location, revenue, ebitda, website, category, status, is_internal_deal, description, executive_summary, created_at')
        .is('deleted_at', null)
        .eq('is_internal_deal', false)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + PAGE_SIZE - 1);

      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,internal_company_name.ilike.%${searchQuery}%,location.ilike.%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length * PAGE_SIZE;
    },
    enabled: open && activeTab === "marketplace",
  });

  const marketplaceListings = marketplaceData?.pages.flat() ?? [];

  // Infinite scroll sentinel callback
  const observerRef = useRef<IntersectionObserver | null>(null);
  const lastItemRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });
      if (node) observerRef.current.observe(node);
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage],
  );

  // Check which listings are already remarketing deals
  const { data: existingDealIds } = useQuery({
    queryKey: ['existing-remarketing-deal-ids'],
    queryFn: async () => {
      // Get all listing IDs that have scores or are internal deals
      const { data } = await supabase
        .from('listings')
        .select('id')
        .eq('is_internal_deal', true);
      return new Set((data || []).map(d => d.id));
    },
    enabled: open && activeTab === "marketplace",
  });

  const handleAddFromMarketplace = async (listing: any) => {
    setAddingToRemarketing(listing.id);
    try {
      const { error } = await supabase
        .from('listings')
        .update({ is_internal_deal: true } as any)
        .eq('id', listing.id);

      if (error) throw error;

      setAddedIds(prev => new Set(prev).add(listing.id));
      toast.success(`"${listing.title || listing.internal_company_name}" added to remarketing`);
      queryClient.invalidateQueries({ queryKey: ['remarketing', 'deals'] });
      queryClient.invalidateQueries({ queryKey: ['listings'] });
      queryClient.invalidateQueries({ queryKey: ['existing-remarketing-deal-ids'] });
    } catch (err: any) {
      toast.error(`Failed to add: ${err.message}`);
    } finally {
      setAddingToRemarketing(null);
    }
  };

  // Background transcript upload
  const uploadTranscriptsInBackground = async (
    listingId: string,
    userId: string,
    files: File[],
    transcriptLink: string,
  ) => {
    if (transcriptLink) {
      try {
        await supabase.from('deal_transcripts').insert({
          listing_id: listingId,
          transcript_url: transcriptLink,
          transcript_text: "Pending text extraction from link",
          title: "Linked Transcript",
          created_by: userId,
          source: 'link',
        } as any);
      } catch (err) {
        console.error("Transcript link error:", err);
      }
    }

    if (files.length === 0) return;

    const toastId = `transcripts-${listingId}`;
    toast.info(`Uploading 0/${files.length} transcripts...`, { id: toastId, duration: Infinity });
    let uploaded = 0;

    for (const file of files) {
      try {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'txt';
        const filePath = `${listingId}/${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from('deal-transcripts')
          .upload(filePath, file);

        if (uploadError) {
          console.error(`Upload error for ${file.name}:`, uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('deal-transcripts')
          .getPublicUrl(filePath);

        let transcriptText = "";
        if (TEXT_EXTENSIONS.includes(fileExt)) {
          transcriptText = await file.text();
        } else if (DOC_EXTENSIONS.includes(fileExt)) {
          try {
            const parseFormData = new FormData();
            parseFormData.append('file', file);
            const { data: parseResult, error: parseError } = await supabase.functions.invoke(
              'parse-transcript-file',
              { body: parseFormData }
            );
            if (parseError) {
              transcriptText = "Pending text extraction";
            } else {
              transcriptText = parseResult?.text || "Pending text extraction";
            }
          } catch (parseErr) {
            transcriptText = "Pending text extraction";
          }
        }

        await supabase.from('deal_transcripts').insert({
          listing_id: listingId,
          transcript_url: publicUrl,
          transcript_text: transcriptText || "Pending text extraction",
          title: file.name,
          created_by: userId,
          source: 'file_upload',
        } as any);

        uploaded++;
        toast.info(`Uploading ${uploaded}/${files.length} transcripts...`, { id: toastId, duration: Infinity });

        if (uploaded < files.length) {
          await sleep(2000);
        }
      } catch (err) {
        console.error(`Transcript handling error for ${file.name}:`, err);
      }
    }

    toast.success(`${uploaded} transcript${uploaded > 1 ? 's' : ''} uploaded`, { id: toastId });
    queryClient.invalidateQueries({ queryKey: ["listings"] });
    queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
  };

  const createDealMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();

      const insertData: Record<string, any> = {
        title: formData.title,
        website: formData.website || null,
        location: formData.location || null,
        revenue: formData.revenue ? parseFloat(formData.revenue.replace(/[^0-9.]/g, '')) : null,
        ebitda: formData.ebitda ? parseFloat(formData.ebitda.replace(/[^0-9.]/g, '')) : null,
        description: formData.description || null,
        category: "Other",
        status: "active",
        is_internal_deal: true,
        main_contact_name: formData.mainContactName || null,
        main_contact_email: formData.mainContactEmail || null,
        main_contact_phone: formData.mainContactPhone || null,
        main_contact_title: formData.mainContactTitle || null,
      };

      const { data: listing, error } = await supabase
        .from("listings")
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;
      return { listing, userId: user?.id };
    },
    onSuccess: ({ listing, userId }) => {
      queryClient.invalidateQueries({ queryKey: ["listings"] });
      queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
      toast.success(`Created "${listing.title}" successfully`);

      const filesToUpload = [...transcriptFilesRef.current];
      const linkToSave = formData.transcriptLink;

      setFormData({ title: "", website: "", location: "", revenue: "", ebitda: "", description: "", transcriptLink: "", mainContactName: "", mainContactEmail: "", mainContactPhone: "", mainContactTitle: "" });
      updateFiles([]);
      onDealCreated?.();
      onOpenChange(false);
      navigate(`/admin/remarketing/deals/${listing.id}`);

      if (userId && (filesToUpload.length > 0 || linkToSave)) {
        uploadTranscriptsInBackground(listing.id, userId, filesToUpload, linkToSave);
      }

      if (listing.website) {
        toast.info("Enriching deal with AI...", { id: `enrich-${listing.id}` });
        supabase.functions.invoke("enrich-deal", {
          body: { dealId: listing.id },
        }).then(({ data, error }) => {
          if (error) {
            toast.error("Enrichment failed", { id: `enrich-${listing.id}` });
          } else if (data?.success) {
            toast.success(`Enriched with ${data.fieldsUpdated?.length || 0} fields`, { id: `enrich-${listing.id}` });
            queryClient.invalidateQueries({ queryKey: ["listings"] });
            queryClient.invalidateQueries({ queryKey: ["remarketing", "deals"] });
          }
        });
      }
    },
    onError: (error) => {
      console.error("Failed to create deal:", error);
      toast.error(`Failed to create deal: ${error.message}`);
    },
  });

  const handleFormChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (newFiles.length === 0) return;

    const existingNames = new Set(transcriptFilesRef.current.map(f => normalizeName(f.name)));
    const uniqueNew = newFiles.filter(f => !existingNames.has(normalizeName(f.name)));

    if (uniqueNew.length < newFiles.length) {
      const skipped = newFiles.length - uniqueNew.length;
      toast.info(`${skipped} duplicate file${skipped > 1 ? 's' : ''} skipped`);
    }

    if (uniqueNew.length > 0) {
      updateFiles([...transcriptFilesRef.current, ...uniqueNew]);
      setFormData(prev => ({ ...prev, transcriptLink: "" }));
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    updateFiles(transcriptFilesRef.current.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Deal</DialogTitle>
          <DialogDescription>
            Add an existing marketplace listing or create a new deal
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="marketplace">From Marketplace</TabsTrigger>
            <TabsTrigger value="new">Create New</TabsTrigger>
          </TabsList>

          {/* Marketplace Tab */}
          <TabsContent value="marketplace" className="flex-1 overflow-hidden flex flex-col mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex-1 max-h-[50vh] overflow-y-auto border rounded-md">
              <div className="space-y-2 p-2">
                {searchLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                        <div className="h-3 w-24 bg-muted animate-pulse rounded" />
                      </div>
                    </div>
                  ))
                ) : !marketplaceListings?.length ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">
                      {searchQuery ? "No listings match your search" : "No marketplace listings found"}
                    </p>
                  </div>
                ) : (
                  marketplaceListings.map((listing, index) => {
                    const displayName = listing.internal_company_name || listing.title || "Untitled";
                    const isAlreadyAdded = addedIds.has(listing.id);
                    const isLast = index === marketplaceListings.length - 1;
                    const isExpanded = expandedId === listing.id;
                    const isAdding = addingToRemarketing === listing.id;

                    return (
                      <div
                        key={listing.id}
                        ref={isLast ? lastItemRef : undefined}
                        className={`border rounded-lg transition-colors ${isExpanded ? 'bg-accent/30 border-primary/30' : 'hover:bg-accent/50'}`}
                      >
                        {/* Collapsed row */}
                        <div
                          className="flex items-center gap-3 p-3 cursor-pointer"
                          onClick={() => setExpandedId(isExpanded ? null : listing.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm truncate">{displayName}</p>
                              {listing.category && (
                                <Badge variant="secondary" className="text-xs shrink-0">
                                  {listing.category}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              {listing.location && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {listing.location}
                                </span>
                              )}
                              {listing.revenue != null && (
                                <span className="flex items-center gap-1">
                                  <DollarSign className="h-3 w-3" />
                                  {formatCurrency(listing.revenue)} Rev
                                </span>
                              )}
                              {listing.ebitda != null && (
                                <span>{formatCurrency(listing.ebitda)} EBITDA</span>
                              )}
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </div>

                        {/* Expanded details */}
                        {isExpanded && (
                          <div className="px-3 pb-3 space-y-3 border-t border-border/50 pt-3">
                            {listing.executive_summary && (
                              <p className="text-xs text-muted-foreground line-clamp-3">
                                {listing.executive_summary}
                              </p>
                            )}
                            {!listing.executive_summary && listing.description && (
                              <p className="text-xs text-muted-foreground line-clamp-3">
                                {listing.description}
                              </p>
                            )}

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              {listing.revenue != null && (
                                <div className="bg-muted/50 rounded p-2">
                                  <span className="text-muted-foreground">Revenue</span>
                                  <p className="font-medium">{formatCurrency(listing.revenue)}</p>
                                </div>
                              )}
                              {listing.ebitda != null && (
                                <div className="bg-muted/50 rounded p-2">
                                  <span className="text-muted-foreground">EBITDA</span>
                                  <p className="font-medium">{formatCurrency(listing.ebitda)}</p>
                                </div>
                              )}
                              {listing.revenue != null && listing.ebitda != null && listing.revenue > 0 && (
                                <div className="bg-muted/50 rounded p-2">
                                  <span className="text-muted-foreground">Margin</span>
                                  <p className="font-medium">{((listing.ebitda / listing.revenue) * 100).toFixed(0)}%</p>
                                </div>
                              )}
                              {listing.website && (
                                <div className="bg-muted/50 rounded p-2">
                                  <span className="text-muted-foreground">Website</span>
                                  <p className="font-medium truncate flex items-center gap-1">
                                    <Globe className="h-3 w-3" />
                                    {listing.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                  </p>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddFromMarketplace(listing);
                                }}
                                disabled={isAlreadyAdded || isAdding}
                                className="flex-1"
                              >
                                {isAdding ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                                    Adding...
                                  </>
                                ) : isAlreadyAdded ? (
                                  <>
                                    <Check className="h-3.5 w-3.5 mr-1" />
                                    Added to Remarketing
                                  </>
                                ) : (
                                  <>
                                    <ArrowRight className="h-3.5 w-3.5 mr-1" />
                                    Add to Remarketing
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenChange(false);
                                  navigate(`/admin/remarketing/deals/${listing.id}`);
                                }}
                              >
                                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                                Open
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                {isFetchingNextPage && (
                  <div className="flex justify-center py-3">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {hasNextPage && !isFetchingNextPage && marketplaceListings.length > 0 && (
                  <div className="flex justify-center py-2">
                    <Button variant="ghost" size="sm" onClick={() => fetchNextPage()}>
                      Load more listings...
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Create New Tab */}
          <TabsContent value="new" className="flex-1 overflow-auto mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Company Name *</Label>
                <Input
                  id="title"
                  placeholder="Enter company name"
                  value={formData.title}
                  onChange={(e) => handleFormChange("title", e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website *</Label>
                <Input
                  id="website"
                  placeholder="https://example.com"
                  value={formData.website}
                  onChange={(e) => handleFormChange("website", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Required for AI enrichment to extract company data
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="City, State"
                  value={formData.location}
                  onChange={(e) => handleFormChange("location", e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="revenue">Revenue</Label>
                  <Input
                    id="revenue"
                    placeholder="$0"
                    value={formData.revenue}
                    onChange={(e) => handleFormChange("revenue", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ebitda">EBITDA</Label>
                  <Input
                    id="ebitda"
                    placeholder="$0"
                    value={formData.ebitda}
                    onChange={(e) => handleFormChange("ebitda", e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of the business..."
                  value={formData.description}
                  onChange={(e) => handleFormChange("description", e.target.value)}
                  rows={3}
                />
              </div>

              {/* Main Contact Section */}
              <div className="space-y-3 border-t pt-4">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Main Contact
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="mainContactName" className="text-xs">Name</Label>
                    <Input
                      id="mainContactName"
                      placeholder="Contact name"
                      value={formData.mainContactName}
                      onChange={(e) => handleFormChange("mainContactName", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="mainContactEmail" className="text-xs">Email</Label>
                    <Input
                      id="mainContactEmail"
                      type="email"
                      placeholder="email@example.com"
                      value={formData.mainContactEmail}
                      onChange={(e) => handleFormChange("mainContactEmail", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="mainContactPhone" className="text-xs">Phone</Label>
                    <Input
                      id="mainContactPhone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={formData.mainContactPhone}
                      onChange={(e) => handleFormChange("mainContactPhone", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="mainContactTitle" className="text-xs">Title</Label>
                    <Input
                      id="mainContactTitle"
                      placeholder="CEO, CFO, Owner..."
                      value={formData.mainContactTitle}
                      onChange={(e) => handleFormChange("mainContactTitle", e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Used to find Fireflies transcripts automatically
                </p>
              </div>

              {/* Transcript Section */}
              <div className="space-y-3 border-t pt-4">
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Call Transcripts (Optional)
                </Label>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <Input
                      id="transcriptLink"
                      placeholder="Fireflies, Otter.ai, or other transcript link..."
                      value={formData.transcriptLink}
                      onChange={(e) => handleFormChange("transcriptLink", e.target.value)}
                      disabled={transcriptFiles.length > 0}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex-1 border-t" />
                  <span>or</span>
                  <div className="flex-1 border-t" />
                </div>

                <div className="space-y-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.vtt,.srt,.pdf,.doc,.docx"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                    id="transcript-file"
                  />

                  {transcriptFiles.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground font-medium">
                        {transcriptFiles.length} file{transcriptFiles.length > 1 ? 's' : ''} selected
                      </p>
                      {transcriptFiles.map((file, index) => (
                        <div key={`${file.name}-${index}`} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                          <FileText className="h-4 w-4 shrink-0 text-primary" />
                          <span className="text-sm flex-1 truncate">{file.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {(file.size / 1024).toFixed(0)}KB
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="h-6 w-6 p-0 shrink-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={!!formData.transcriptLink}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {transcriptFiles.length > 0 ? 'Add More Files' : 'Upload Transcript Files'}
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    Supports .txt, .vtt, .srt, .pdf, .doc, .docx — select multiple files at once
                  </p>
                </div>
              </div>

              <Button
                onClick={() => createDealMutation.mutate()}
                disabled={!formData.title || !formData.website || createDealMutation.isPending}
                className="w-full"
              >
                {createDealMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Deal
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AddDealDialog;
