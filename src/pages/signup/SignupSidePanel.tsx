import { Card, CardContent } from '@/components/ui/card';
import type { SignupSidePanelProps } from './types';

export const SignupSidePanel = ({ bradDaughertyImage, sfcLogo }: SignupSidePanelProps) => {
  return (
    <div className="space-y-8 pr-8">
      {/* Welcome Header */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          Welcome to SourceCo
        </h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Stop wasting time on unqualified opportunities. Access pre-vetted businesses with verified
          financials and motivated sellers ready to transact.
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Join our network of acquirers who source deals directly from owners, before they go to
          brokers or public listings.
        </p>
      </div>

      {/* Testimonial */}
      <Card className="bg-background/80 border border-border/50 shadow-sm">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-full overflow-hidden bg-muted flex-shrink-0">
              <img
                src={bradDaughertyImage}
                alt="Brad Daughterty"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="space-y-2 flex-1 relative">
              <blockquote className="text-xs text-foreground leading-relaxed italic">
                "SourceCo's technology-driven sourcing process consistently delivered a robust
                pipeline of qualified opportunities, resulting in multiple LOIs and a closed deal
                with more to come."
              </blockquote>
              <div className="space-y-0.5">
                <div className="text-xs font-medium text-foreground">Brad Daughterty</div>
                <div className="text-[11px] text-muted-foreground">
                  CFO,{' '}
                  <a
                    href="https://sportsfacilities.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    Sports Facilities Companies
                  </a>
                </div>
              </div>
              <div className="absolute bottom-0 right-0">
                <img
                  src={sfcLogo}
                  alt="Sports Facilities Companies"
                  className="h-5 w-auto opacity-60"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Value Props */}
      <div className="space-y-2 text-xs text-muted-foreground">
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
          <span>Break free from broker gatekeepers</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
          <span>Connect directly with motivated sellers</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
          <span>Transform reactive to proactive sourcing</span>
        </div>
      </div>
    </div>
  );
};
