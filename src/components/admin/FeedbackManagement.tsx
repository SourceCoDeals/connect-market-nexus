import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MessageCircle, Clock, CheckCircle2, AlertCircle, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface FeedbackMessage {
  id: string;
  message: string;
  category: string;
  priority: string;
  status: string;
  page_url: string | null;
  user_agent: string | null;
  admin_response: string | null;
  created_at: string;
  updated_at: string;
  user_id: string;
  admin_id: string | null;
}

interface FeedbackManagementProps {
  className?: string;
}

export function FeedbackManagement({ className }: FeedbackManagementProps) {
  const [feedbackMessages, setFeedbackMessages] = useState<FeedbackMessage[]>([]);
  const [filteredMessages, setFilteredMessages] = useState<FeedbackMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<FeedbackMessage | null>(null);
  const [adminResponse, setAdminResponse] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

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
  }, [feedbackMessages, statusFilter, categoryFilter, priorityFilter]);

  const fetchFeedbackMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("feedback_messages")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFeedbackMessages(data || []);
    } catch (error) {
      console.error("Error fetching feedback messages:", error);
    } finally {
      setIsLoading(false);
    }
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
        })
        .eq("id", messageId);

      if (error) throw error;
      
      await fetchFeedbackMessages();
      setSelectedMessage(null);
      setAdminResponse("");
    } catch (error) {
      console.error("Error updating feedback status:", error);
    } finally {
      setIsResponding(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "bg-red-100 text-red-800 border-red-200";
      case "high": return "bg-orange-100 text-orange-800 border-orange-200";
      case "normal": return "bg-blue-100 text-blue-800 border-blue-200";
      case "low": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "unread": return <MessageCircle className="h-4 w-4 text-blue-500" />;
      case "read": return <Clock className="h-4 w-4 text-yellow-500" />;
      case "responded": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const unreadCount = feedbackMessages.filter(msg => msg.status === "unread").length;
  const urgentCount = feedbackMessages.filter(msg => msg.priority === "urgent").length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Feedback Management</h2>
          <p className="text-muted-foreground">
            Manage user feedback and suggestions
          </p>
        </div>
        <div className="flex items-center gap-4">
          {unreadCount > 0 && (
            <Badge variant="destructive" className="text-sm">
              {unreadCount} unread
            </Badge>
          )}
          {urgentCount > 0 && (
            <Badge variant="destructive" className="text-sm">
              {urgentCount} urgent
            </Badge>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="bug">Bug Report</SelectItem>
                  <SelectItem value="feature">Feature Request</SelectItem>
                  <SelectItem value="ui">UI/UX</SelectItem>
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
        </CardContent>
      </Card>

      {/* Feedback Messages */}
      <div className="space-y-4">
        {filteredMessages.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No feedback messages found.</p>
            </CardContent>
          </Card>
        ) : (
          filteredMessages.map((message) => (
            <Card 
              key={message.id} 
              className={`cursor-pointer transition-all hover:shadow-md ${
                message.status === "unread" ? "border-blue-200 bg-blue-50/50" : ""
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(message.status)}
                    <div>
                      <CardTitle className="text-lg">
                        {message.category.charAt(0).toUpperCase() + message.category.slice(1)} Feedback
                      </CardTitle>
                      <CardDescription>
                        {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                        {message.page_url && (
                          <span className="ml-2 text-xs">
                            • {new URL(message.page_url).pathname}
                          </span>
                        )}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="outline" 
                      className={getPriorityColor(message.priority)}
                    >
                      {message.priority.toUpperCase()}
                    </Badge>
                    <Badge variant="outline">
                      {message.status.toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                  {message.message}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateFeedbackStatus(message.id, "read")}
                      disabled={message.status === "read" || message.status === "responded"}
                    >
                      Mark as Read
                    </Button>
                    
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setSelectedMessage(message)}
                        >
                          View Details
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Feedback Details</DialogTitle>
                        </DialogHeader>
                        {selectedMessage && (
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <strong>Category:</strong> {selectedMessage.category}
                              </div>
                              <div>
                                <strong>Priority:</strong> {selectedMessage.priority}
                              </div>
                              <div>
                                <strong>Status:</strong> {selectedMessage.status}
                              </div>
                              <div>
                                <strong>Date:</strong> {new Date(selectedMessage.created_at).toLocaleDateString()}
                              </div>
                            </div>
                            
                            {selectedMessage.page_url && (
                              <div>
                                <strong>Page:</strong> {selectedMessage.page_url}
                              </div>
                            )}
                            
                            <div>
                              <strong>Message:</strong>
                              <p className="mt-2 p-3 bg-gray-50 rounded-md">
                                {selectedMessage.message}
                              </p>
                            </div>
                            
                            {selectedMessage.admin_response && (
                              <div>
                                <strong>Admin Response:</strong>
                                <p className="mt-2 p-3 bg-blue-50 rounded-md">
                                  {selectedMessage.admin_response}
                                </p>
                              </div>
                            )}
                            
                            <div className="space-y-3">
                              <label className="text-sm font-medium">Admin Response:</label>
                              <Textarea
                                value={adminResponse}
                                onChange={(e) => setAdminResponse(e.target.value)}
                                placeholder="Enter your response..."
                                rows={3}
                              />
                              <Button
                                onClick={() => updateFeedbackStatus(selectedMessage.id, "responded", adminResponse)}
                                disabled={isResponding || !adminResponse.trim()}
                                className="w-full"
                              >
                                {isResponding ? "Responding..." : "Send Response"}
                              </Button>
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