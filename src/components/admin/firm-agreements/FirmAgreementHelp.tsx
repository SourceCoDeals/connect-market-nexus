import { HelpCircle, Info, CheckCircle, AlertTriangle, Users, Building2, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function FirmAgreementHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <HelpCircle className="h-4 w-4 mr-2" />
          Help & Documentation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Firm Agreement Tracking - Help & Troubleshooting
          </DialogTitle>
          <DialogDescription>
            Learn how firm agreement tracking works and troubleshoot common issues
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Overview */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>How It Works</AlertTitle>
            <AlertDescription>
              Firm agreement tracking automatically groups users by company and manages NDA/Fee Agreement signatures at the firm level. When you update a firm's agreement status, it syncs to all members, connection requests, and deals automatically.
            </AlertDescription>
          </Alert>

          {/* FAQ Accordion */}
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="matching">
              <AccordionTrigger className="text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  How are users matched to firms?
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-3">
                <p>Users are automatically matched to firms using three methods:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>
                    <strong>Normalized Company Name:</strong> Company names are normalized to match variations like "Google Inc." vs "Google LLC" vs "Google"
                  </li>
                  <li>
                    <strong>Email Domain:</strong> Extracted from user email (@company.com)
                  </li>
                  <li>
                    <strong>Website Domain:</strong> From user profile if provided
                  </li>
                </ol>
                <p className="pt-2">
                  This happens automatically when:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>A new user registers</li>
                  <li>An existing user updates their company name</li>
                  <li>An inbound lead is converted to a connection request</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sync">
              <AccordionTrigger className="text-sm font-medium">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  What happens when I update a firm's agreement?
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-3">
                <p>When you toggle a firm's Fee Agreement or NDA, the following happens automatically:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>
                    <strong>All firm members' profiles</strong> are updated with the new status and timestamp
                  </li>
                  <li>
                    <strong>All connection requests</strong> from those members are updated
                  </li>
                  <li>
                    <strong>All deals</strong> linked to those connection requests are updated
                  </li>
                  <li>
                    <strong>Logs are created</strong> tracking who made the change and when
                  </li>
                </ol>
                <p className="pt-2">
                  This ensures complete consistency across the entire platform. You don't need to update individual users.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="new-members">
              <AccordionTrigger className="text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  What about new users who join an existing firm?
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-3">
                <p>New users automatically inherit their firm's agreement status:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>User registers with company name "Acme Capital"</li>
                  <li>System finds existing firm "Acme Capital" (or creates new one)</li>
                  <li>User is linked to the firm automatically</li>
                  <li><strong>If the firm has signed agreements, the new user inherits them immediately</strong></li>
                  <li>Any connection requests they create will show correct status</li>
                </ol>
                <Alert className="mt-3">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    This prevents new members from appearing "unsigned" when their firm has already signed agreements.
                  </AlertDescription>
                </Alert>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="leads">
              <AccordionTrigger className="text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  How do inbound leads match to firms?
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-3">
                <p>Inbound leads are matched by email domain:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Lead comes in with email "john@acme.com"</li>
                  <li>When converted to connection request, system extracts domain "@acme.com"</li>
                  <li>Looks up firms with matching email_domain or website_domain</li>
                  <li>If found, inherits the firm's agreement status automatically</li>
                  <li>Deal created from the request shows correct status</li>
                </ol>
                <p className="pt-2">
                  This works for:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Manual lead creation</li>
                  <li>Bulk lead imports</li>
                  <li>API/webhook lead submissions</li>
                </ul>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="troubleshooting">
              <AccordionTrigger className="text-sm font-medium">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Troubleshooting: User not linked to firm
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-3">
                <p>If a user isn't automatically linked to their firm:</p>
                
                <div className="space-y-3 pt-2">
                  <div>
                    <p className="font-medium text-foreground">Check 1: Company Name</p>
                    <ul className="list-disc pl-5 space-y-1 mt-1">
                      <li>User must have "Company Name" filled in their profile</li>
                      <li>Company name should match firm's primary name (variations are normalized)</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-foreground">Check 2: Email Domain</p>
                    <ul className="list-disc pl-5 space-y-1 mt-1">
                      <li>User's email domain should match firm's email_domain or website_domain</li>
                      <li>Example: user@acme.com should match firm with domain "acme.com"</li>
                    </ul>
                  </div>

                  <div>
                    <p className="font-medium text-foreground">Manual Fix:</p>
                    <ul className="list-disc pl-5 space-y-1 mt-1">
                      <li>Use "Link User to Firm" tool in the top toolbar</li>
                      <li>Enter user email and select the firm</li>
                      <li>System will link them and sync agreement status immediately</li>
                    </ul>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="merging">
              <AccordionTrigger className="text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Merging duplicate firms
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-3">
                <p>If you have duplicate firms (e.g., "Google" and "Google Inc."):</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Click "Merge Firms" in the top toolbar</li>
                  <li>Select source firm (will be deleted) and target firm (will keep all members)</li>
                  <li>Review the agreement status comparison</li>
                  <li><strong>All source members will inherit target firm's agreement status</strong></li>
                  <li>Logs are transferred, and all related data is updated</li>
                </ol>
                <Alert className="mt-3" variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Warning</AlertTitle>
                  <AlertDescription>
                    If source and target firms have different agreement statuses, the source members will adopt the target's status. This may change their agreement state.
                  </AlertDescription>
                </Alert>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="bulk-actions">
              <AccordionTrigger className="text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Sending agreements to entire firm
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground space-y-3">
                <p>To send Fee Agreement or NDA to all firm members at once:</p>
                <ol className="list-decimal pl-5 space-y-2">
                  <li>Find the firm in the table</li>
                  <li>Click the "..." menu in the Actions column</li>
                  <li>Select "Send Fee Agreement" or "Send NDA"</li>
                  <li>Choose whether to send to all members or just one signer</li>
                  <li>Emails are sent in batch and logged individually</li>
                </ol>
                <p className="pt-2">
                  The system will show you how many emails were sent successfully and any failures.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {/* Best Practices */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <h4 className="font-medium text-sm flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Best Practices
            </h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Always update agreements at the firm level, not individual users</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Use the search to find firms by name, domain, or member name/email</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Merge duplicate firms to maintain data consistency</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Use bulk email actions to send agreements to entire firms efficiently</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Check the expandable member list to verify all users are properly linked</span>
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
