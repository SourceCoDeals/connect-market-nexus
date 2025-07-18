import { useState } from "react";
import { MessageCircle, X, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFeedback } from "@/hooks/use-feedback";
import { useAuth } from "@/context/AuthContext";

interface FeedbackWidgetProps {
  className?: string;
}

export function FeedbackWidget({ className }: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [priority, setPriority] = useState<string>("normal");
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const { submitFeedback, isLoading } = useFeedback();
  const { user } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) return;

    try {
      await submitFeedback({
        message: message.trim(),
        category: category as any,
        priority: priority as any,
        pageUrl: window.location.href,
        userAgent: navigator.userAgent,
      });
      
      setIsSubmitted(true);
      setMessage("");
      setCategory("general");
      setPriority("normal");
      
      // Auto-close after success
      setTimeout(() => {
        setIsSubmitted(false);
        setIsOpen(false);
      }, 2000);
    } catch (error) {
      console.error("Error submitting feedback:", error);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsSubmitted(false);
  };

  if (!user) {
    return null; // Don't show feedback widget for unauthenticated users
  }

  return (
    <>
      {/* Floating Feedback Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 shadow-lg hover:shadow-xl transition-all duration-300 bg-slate-900 hover:bg-slate-800 text-white rounded-full w-14 h-14 p-0 ${className}`}
        aria-label="Send Feedback"
      >
        <MessageCircle className="h-6 w-6" />
      </Button>

      {/* Feedback Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md mx-auto animate-scale-in">
            <CardHeader className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="absolute right-2 top-2 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
              
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5" />
                Send Feedback
              </CardTitle>
              <CardDescription>
                Help us improve by sharing your thoughts and suggestions
              </CardDescription>
            </CardHeader>

            <CardContent>
              {isSubmitted ? (
                <div className="text-center py-8 animate-fade-in">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-green-700 mb-2">Thank you!</h3>
                  <p className="text-sm text-muted-foreground">
                    Your feedback has been submitted successfully. We appreciate your input!
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Category</label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
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
                      <Select value={priority} onValueChange={setPriority}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="w-2 h-2 p-0 bg-green-500"></Badge>
                              Low
                            </div>
                          </SelectItem>
                          <SelectItem value="normal">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="w-2 h-2 p-0 bg-blue-500"></Badge>
                              Normal
                            </div>
                          </SelectItem>
                          <SelectItem value="high">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="w-2 h-2 p-0 bg-orange-500"></Badge>
                              High
                            </div>
                          </SelectItem>
                          <SelectItem value="urgent">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="w-2 h-2 p-0 bg-red-500"></Badge>
                              Urgent
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Your Message *</label>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us what's on your mind..."
                      rows={4}
                      className="resize-none"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Be specific and detailed to help us understand your feedback better.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleClose}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={!message.trim() || isLoading}
                      className="flex-1 bg-slate-900 hover:bg-slate-800"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Feedback
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}