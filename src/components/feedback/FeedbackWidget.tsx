import { useState } from "react";
import { MessageCircle, X, Send, CheckCircle2, Mail, Bug, Lightbulb, MessageSquare, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useEnhancedFeedback } from "@/hooks/use-enhanced-feedback";
import { useAuth } from "@/context/AuthContext";

interface FeedbackWidgetProps {
  className?: string;
}

export function FeedbackWidget({ className }: FeedbackWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<string>("contact");
  const [priority, setPriority] = useState<string>("normal");
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const { submitFeedback, isLoading } = useEnhancedFeedback();
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
      setCategory("contact");
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
      {/* Floating Contact Button */}
      <Button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 z-50 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground rounded-full w-14 h-14 p-0 group ${className}`}
        aria-label="Contact Us"
      >
        <MessageCircle className="h-6 w-6 group-hover:scale-110 transition-transform duration-200" />
      </Button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm md:items-center">
          <Card className="w-full max-w-lg mx-auto animate-slide-up md:animate-scale-in">
            <CardHeader className="relative bg-gradient-to-r from-primary/5 to-primary/10 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClose}
                className="absolute right-2 top-2 h-8 w-8 p-0 hover:bg-primary/10"
              >
                <X className="h-4 w-4" />
              </Button>
              
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {user?.email || "Guest"}
                  </span>
                </div>
              </div>
              
              <CardTitle className="flex items-center gap-2 text-xl">
                <MessageSquare className="h-5 w-5 text-primary" />
                Get in Touch
              </CardTitle>
              <CardDescription>
                Send us a message, report bugs, or share feature ideas
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
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Quick Action Buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={category === "contact" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCategory("contact")}
                      className="flex flex-col items-center gap-1 h-auto py-3"
                    >
                      <Mail className="h-4 w-4" />
                      <span className="text-xs">Contact Us</span>
                    </Button>
                    <Button
                      type="button"
                      variant={category === "bug" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCategory("bug")}
                      className="flex flex-col items-center gap-1 h-auto py-3"
                    >
                      <Bug className="h-4 w-4" />
                      <span className="text-xs">Bug Report</span>
                    </Button>
                    <Button
                      type="button"
                      variant={category === "feature" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCategory("feature")}
                      className="flex flex-col items-center gap-1 h-auto py-3"
                    >
                      <Lightbulb className="h-4 w-4" />
                      <span className="text-xs">Idea</span>
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Type</label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="contact">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4" />
                              Contact Us
                            </div>
                          </SelectItem>
                          <SelectItem value="bug">
                            <div className="flex items-center gap-2">
                              <Bug className="h-4 w-4" />
                              Bug Report
                            </div>
                          </SelectItem>
                          <SelectItem value="feature">
                            <div className="flex items-center gap-2">
                              <Lightbulb className="h-4 w-4" />
                              Feature Request
                            </div>
                          </SelectItem>
                          <SelectItem value="ui">UI/UX Feedback</SelectItem>
                          <SelectItem value="general">General</SelectItem>
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
                    <label className="text-sm font-medium">
                      Your Message *
                      {category === "contact" && (
                        <span className="text-xs text-muted-foreground ml-2">
                          (We'll respond via email)
                        </span>
                      )}
                    </label>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder={
                        category === "contact" 
                          ? "How can we help you today? We'll get back to you soon..." 
                          : category === "bug"
                          ? "Describe the issue you encountered. Include steps to reproduce if possible..."
                          : category === "feature"
                          ? "What feature would you like to see? How would it help you..."
                          : "Tell us what's on your mind..."
                      }
                      rows={5}
                      className="resize-none min-h-[120px]"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      {category === "contact" 
                        ? "Our team will respond to your message within 24 hours."
                        : "Be specific and detailed to help us understand better."
                      }
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
                      className="flex-1 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          {category === "contact" ? "Send Message" : "Send Feedback"}
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