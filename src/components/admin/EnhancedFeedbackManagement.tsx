import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { 
  MessageCircle, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Filter, 
  User, 
  Mail, 
  Phone, 
  Building, 
  ExternalLink,
  Reply,
  Eye,
  Menu,
  Search,
  Send
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { FeedbackMetricsOverview } from "./FeedbackMetricsOverview";
import { FeedbackResponseTemplates } from "./FeedbackResponseTemplates";
import { toast } from "@/hooks/use-toast";
import { useEnhancedFeedback, FeedbackMessageWithUser } from "@/hooks/use-enhanced-feedback";
import { Input } from "@/components/ui/input";

interface EnhancedFeedbackManagementProps {
  className?: string;
}

export function EnhancedFeedbackManagement({ className }: EnhancedFeedbackManagementProps) {
  const [feedbackMessages, setFeedbackMessages] = useState<FeedbackMessageWithUser[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<FeedbackMessageWithUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<FeedbackMessageWithUser | null>(null);
  const [adminResponse, setAdminResponse] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
  
  const { getFeedbackWithUserDetails } = useEnhancedFeedback();
  
  const [metrics, setMetrics] = useState({
    totalFeedback: 0,
    unreadCount: 0,
    responseRate: 0,
    averageResponseTime: 0,
    categoryBreakdown: {} as { [key: string]: number },
    priorityBreakdown: {} as { [key: string]: number }
  });

  useEffect(() => {
    fetchFeedbackMessages();
    
    // Set up real-time subscription
    const channel = supabase
      .channel("feedback-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback_messages" },
        (payload) => {
          console.log("Feedback real-time update:", payload);
          fetchFeedbackMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    filterMessages();
  }, [feedbackMessages, statusFilter, categoryFilter, priorityFilter, searchQuery]);

  const fetchFeedbackMessages = async () => {
    try {
      const data = await getFeedbackWithUserDetails();
      setFeedbackMessages(data);
      calculateMetrics(data);
    } catch (error) {
      console.error("Error fetching feedback messages:", error);
      toast({
        title: "Error",
        description: "Failed to fetch feedback messages",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateMetrics = (messages: FeedbackMessageWithUser[]) => {
    const totalFeedback = messages.length;
    const unreadCount = messages.filter(m => m.status === "unread").length;
    const respondedCount = messages.filter(m => m.status === "responded").length;
    const responseRate = totalFeedback > 0 ? (respondedCount / totalFeedback) * 100 : 0;
    
    const averageResponseTime = 45; // minutes (placeholder)
    
    const categoryBreakdown = messages.reduce((acc, msg) => {
      acc[msg.category || "general"] = (acc[msg.category || "general"] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    
    const priorityBreakdown = messages.reduce((acc, msg) => {
      acc[msg.priority || "normal"] = (acc[msg.priority || "normal"] || 0) + 1;
      return acc;
    }, {} as { [key: string]: number });
    
    setMetrics({
      totalFeedback,
      unreadCount,
      responseRate,
      averageResponseTime,
      categoryBreakdown,
      priorityBreakdown
    });
  };

  const filterMessages = () => {
    let filtered = feedbackMessages;

    if (statusFilter !== "all") {
      filtered = filtered.filter((msg) => msg.status === statusFilter);
    }

    if (categoryFilter !== "all") {
      filtered = filtered.filter((msg) => msg.category === categoryFilter);
    }

    if (priorityFilter !== "all") {
      filtered = filtered.filter((msg) => msg.priority === priorityFilter);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((msg) => 
        msg.message.toLowerCase().includes(query) ||
        msg.user_email.toLowerCase().includes(query) ||
        msg.user_first_name.toLowerCase().includes(query) ||
        msg.user_last_name.toLowerCase().includes(query) ||
        (msg.user_company && msg.user_company.toLowerCase().includes(query))
      );
    }

    setFilteredMessages(filtered);
  };

  const updateFeedbackStatus = async (messageId: string, newStatus: string, response?: string) => {
    setIsResponding(true);
    try {
      const { error } = await supabase
        .from("feedback_messages")
        .update({
          status: newStatus,
          admin_response: response || null,
          admin_id: newStatus === "responded" ? (await supabase.auth.getUser()).data.user?.id : null,
          read_by_admin: true,
        })
        .eq("id", messageId);

      if (error) throw error;
      
      await fetchFeedbackMessages();
      setSelectedMessage(null);
      setAdminResponse("");
      
      toast({
        title: "Success",
        description: newStatus === "responded" ? "Response sent successfully" : "Status updated",
      });
    } catch (error) {
      console.error("Error updating feedback status:", error);
      toast({
        title: "Error",
        description: "Failed to update feedback status",
        variant: "destructive",
      });
    } finally {
      setIsResponding(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "high": return "secondary";
      case "normal": return "outline";
      case "low": return "outline";
      default: return "outline";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "contact": return <Mail className="h-4 w-4" />;
      case "bug": return <AlertCircle className="h-4 w-4" />;
      case "feature": return <MessageCircle className="h-4 w-4" />;
      default: return <MessageCircle className="h-4 w-4" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "unread": return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case "read": return <Eye className="h-4 w-4 text-yellow-500" />;
      case "responded": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  // Mobile-optimized filters component
  const FiltersContent = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search messages, users..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="responded">Responded</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Category</label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="contact">Contact Us</SelectItem>
              <SelectItem value="bug">Bug Report</SelectItem>
              <SelectItem value="feature">Feature Request</SelectItem>
              <SelectItem value="ui">UI/UX</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Priority</label>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="urgent">Urgent</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const unreadCount = feedbackMessages.filter(msg => msg.status === "unread").length;
  const urgentCount = feedbackMessages.filter(msg => msg.priority === "urgent").length;
  const contactCount = feedbackMessages.filter(msg => msg.category === "contact").length;

  return (
    <div className={`space-y-4 lg:space-y-6 ${className}`}>
      {/* Header - Mobile Optimized */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl lg:text-2xl font-bold">Messages & Feedback</h2>
          <p className="text-sm text-muted-foreground">
            Manage user messages and feedback
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {contactCount > 0 && (
            <Badge variant="default" className="text-xs">
              {contactCount} contact{contactCount !== 1 ? "s" : ""}
            </Badge>
          )}
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {unreadCount} unread
            </Badge>
          )}
          {urgentCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {urgentCount} urgent
            </Badge>
          )}
        </div>
      </div>

      <FeedbackMetricsOverview {...metrics} />

      {/* Mobile Filters */}
      <div className="flex items-center gap-2 lg:hidden">
        <Sheet open={isMobileFiltersOpen} onOpenChange={setIsMobileFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="flex-1">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[400px]">
            <SheetHeader>
              <SheetTitle>Filter Messages</SheetTitle>
              <SheetDescription>
                Filter and search through messages
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <FiltersContent />
            </div>
          </SheetContent>
        </Sheet>
        
        <div className="relative flex-2">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Desktop Filters */}
      <Card className="hidden lg:block">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FiltersContent />
        </CardContent>
      </Card>

      {/* Messages List - Mobile Optimized */}
      <div className="space-y-3">
        {filteredMessages.length === 0 ? (
          <Card>
            <CardContent className="p-6 lg:p-8 text-center">
              <MessageCircle className="h-8 lg:h-12 w-8 lg:w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No messages found.</p>
            </CardContent>
          </Card>
        ) : (
          filteredMessages.map((message) => (
            <Card 
              key={message.id} 
              className={`transition-all hover:shadow-md ${
                message.status === "unread" ? "border-primary/20 bg-primary/5" : ""
              }`}
            >
              <CardHeader className="pb-2 lg:pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {getStatusIcon(message.status)}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getCategoryIcon(message.category)}
                        <CardTitle className="text-sm lg:text-base truncate">
                          {message.category === "contact" ? "Contact Message" : 
                           `${message.category.charAt(0).toUpperCase() + message.category.slice(1)} Feedback`}
                        </CardTitle>
                      </div>
                      
                      {/* User Info - Mobile Optimized */}
                      <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-4 text-xs lg:text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span className="font-medium">
                            {message.user_first_name && message.user_last_name 
                              ? `${message.user_first_name} ${message.user_last_name}`
                              : message.user_email}
                          </span>
                        </div>
                        {message.user_company && (
                          <div className="flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            <span className="truncate">{message.user_company}</span>
                          </div>
                        )}
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>{formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}</span>
                            </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col lg:flex-row items-end lg:items-center gap-1 lg:gap-2">
                    <Badge variant={getPriorityColor(message.priority)} className="text-xs">
                      {message.priority.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground mb-3 lg:mb-4 line-clamp-2 lg:line-clamp-3">
                  {message.message}
                </p>
                
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <a 
                      href={`mailto:${message.user_email}`}
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Mail className="h-3 w-3" />
                      {message.user_email}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateFeedbackStatus(message.id, "read")}
                      disabled={message.status === "read" || message.status === "responded"}
                      className="text-xs"
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Mark Read
                    </Button>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedMessage(message)}
                          className="text-xs"
                        >
                          <Reply className="h-3 w-3 mr-1" />
                          Reply
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl lg:max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            {getCategoryIcon(message.category)}
                            Message Details
                          </DialogTitle>
                        </DialogHeader>
                        {selectedMessage && (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-4">
                              {/* User Details Card */}
                              <Card>
                                <CardHeader className="pb-3">
                                  <CardTitle className="text-base flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    User Information
                                  </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-3">
                                  <div className="grid grid-cols-1 gap-2 text-sm">
                                    <div>
                                      <span className="font-medium">Name: </span>
                                      {selectedMessage.user_first_name && selectedMessage.user_last_name 
                                        ? `${selectedMessage.user_first_name} ${selectedMessage.user_last_name}`
                                        : "Not provided"}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">Email: </span>
                                      <a 
                                        href={`mailto:${selectedMessage.user_email}`}
                                        className="text-primary hover:underline flex items-center gap-1"
                                      >
                                        {selectedMessage.user_email}
                                        <ExternalLink className="h-3 w-3" />
                                      </a>
                                    </div>
                                    {selectedMessage.user_company && (
                                      <div>
                                        <span className="font-medium">Company: </span>
                                        {selectedMessage.user_company}
                                      </div>
                                    )}
                                    {selectedMessage.user_phone_number && (
                                      <div>
                                        <span className="font-medium">Phone: </span>
                                        {selectedMessage.user_phone_number}
                                      </div>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                              
                              {/* Message Details */}
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">Category: </span>
                                  {selectedMessage.category}
                                </div>
                                <div>
                                  <span className="font-medium">Priority: </span>
                                  {selectedMessage.priority}
                                </div>
                                <div>
                                  <span className="font-medium">Status: </span>
                                  {selectedMessage.status}
                                </div>
                                <div>
                                  <span className="font-medium">Date: </span>
                                  {new Date(selectedMessage.created_at).toLocaleDateString()}
                                </div>
                              </div>
                              
                              {selectedMessage.page_url && (
                                <div className="text-sm">
                                  <span className="font-medium">Page: </span>
                                  <a 
                                    href={selectedMessage.page_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline inline-flex items-center gap-1"
                                  >
                                    {selectedMessage.page_url}
                                    <ExternalLink className="h-3 w-3" />
                                  </a>
                                </div>
                              )}
                              
                              <div>
                                <span className="font-medium text-sm">Message:</span>
                                <div className="mt-2 p-3 bg-muted rounded-md text-sm">
                                  {selectedMessage.message}
                                </div>
                              </div>
                              
                              {selectedMessage.admin_response && (
                                <div>
                                  <span className="font-medium text-sm">Previous Response:</span>
                                  <div className="mt-2 p-3 bg-primary/10 rounded-md text-sm">
                                    {selectedMessage.admin_response}
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Your Response:</label>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setShowTemplates(!showTemplates)}
                                >
                                  Templates
                                </Button>
                              </div>
                              
                              {showTemplates && (
                                <div className="border rounded-lg p-4 bg-muted/50">
                                  <FeedbackResponseTemplates onSelectTemplate={setAdminResponse} />
                                </div>
                              )}
                              
                              <Textarea
                                value={adminResponse}
                                onChange={(e) => setAdminResponse(e.target.value)}
                                placeholder="Enter your response... (This will be sent via email)"
                                rows={8}
                                className="min-h-[200px]"
                              />
                              
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => updateFeedbackStatus(selectedMessage.id, "responded", adminResponse)}
                                  disabled={isResponding || !adminResponse.trim()}
                                  className="flex-1"
                                >
                                  {isResponding ? (
                                    <>
                                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                      Sending...
                                    </>
                                  ) : (
                                    <>
                                      <Send className="h-4 w-4 mr-2" />
                                      Send Response
                                    </>
                                  )}
                                </Button>
                              </div>
                              
                              <p className="text-xs text-muted-foreground">
                                Response will be sent directly to {selectedMessage.user_email}
                              </p>
                            </div>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}