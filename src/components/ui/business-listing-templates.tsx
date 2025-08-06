import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface BusinessTemplate {
  id: string;
  name: string;
  description: string;
  preview: string;
  content: string;
}

const BUSINESS_TEMPLATES: BusinessTemplate[] = [
  {
    id: 'professional',
    name: 'Professional Overview',
    description: 'Clean, structured format for corporate presentations',
    preview: 'Business Overview • Market Position • Growth Opportunities',
    content: `
<h2>Business Overview</h2>
<p>Provide a compelling summary of the business, including its core mission and value proposition.</p>

<h3>Key Highlights</h3>
<ul>
<li>Market position and competitive advantages</li>
<li>Revenue growth trajectory</li>
<li>Key assets and intellectual property</li>
<li>Management team expertise</li>
</ul>

<h3>Financial Performance</h3>
<p>Summarize the financial health and performance metrics of the business.</p>

<h3>Growth Opportunities</h3>
<p>Outline potential expansion areas and strategic initiatives for future growth.</p>

<blockquote>
<p>"Key differentiator or unique selling proposition that sets this business apart."</p>
</blockquote>
    `.trim()
  },
  {
    id: 'investment-focused',
    name: 'Investment Opportunity',
    description: 'Structured for private equity and investment buyers',
    preview: 'Investment Thesis • Market Analysis • Value Creation',
    content: `
<h2>Investment Thesis</h2>
<p>Clear investment rationale and opportunity summary for potential buyers.</p>

<h3>Market Analysis</h3>
<ul>
<li>Total addressable market size</li>
<li>Market growth trends and drivers</li>
<li>Competitive landscape analysis</li>
<li>Regulatory environment</li>
</ul>

<h3>Financial Highlights</h3>
<p>Key financial metrics and performance indicators that matter to investors.</p>

<h3>Value Creation Opportunities</h3>
<ol>
<li><strong>Operational Improvements:</strong> Process optimization and efficiency gains</li>
<li><strong>Market Expansion:</strong> Geographic or product line extensions</li>
<li><strong>Strategic Initiatives:</strong> Technology investments and digital transformation</li>
</ol>

<h3>Management Team</h3>
<p>Brief overview of key management personnel and their track record.</p>
    `.trim()
  },
  {
    id: 'operational',
    name: 'Operational Excellence',
    description: 'Focus on operations, processes, and day-to-day business',
    preview: 'Operations • Processes • Team • Infrastructure',
    content: `
<h2>Operational Overview</h2>
<p>Comprehensive look at how the business operates and delivers value to customers.</p>

<h3>Core Operations</h3>
<ul>
<li>Primary business processes and workflows</li>
<li>Production capabilities and capacity</li>
<li>Quality control and standards</li>
<li>Supply chain and vendor relationships</li>
</ul>

<h3>Team & Culture</h3>
<p>Overview of the organizational structure and company culture.</p>

<h3>Systems & Infrastructure</h3>
<ul>
<li>Technology stack and digital capabilities</li>
<li>Physical assets and facilities</li>
<li>Operational metrics and KPIs</li>
</ul>

<h3>Customer Base</h3>
<p>Analysis of customer segments, retention rates, and relationship quality.</p>

<blockquote>
<p>"Operational efficiency metrics or customer satisfaction highlights."</p>
</blockquote>
    `.trim()
  },
  {
    id: 'growth-story',
    name: 'Growth Story',
    description: 'Emphasizes growth potential and scaling opportunities',
    preview: 'Growth Metrics • Expansion Plans • Future Vision',
    content: `
<h2>Growth Story</h2>
<p>Compelling narrative about the business's growth journey and future potential.</p>

<h3>Historical Growth</h3>
<ul>
<li>Revenue growth over the past 3-5 years</li>
<li>Market share expansion</li>
<li>Customer base growth</li>
<li>Product or service evolution</li>
</ul>

<h3>Growth Drivers</h3>
<ol>
<li><strong>Market Trends:</strong> Favorable industry dynamics</li>
<li><strong>Competitive Position:</strong> Sustainable advantages</li>
<li><strong>Innovation Pipeline:</strong> New products or services</li>
<li><strong>Operational Leverage:</strong> Scalability opportunities</li>
</ol>

<h3>Expansion Opportunities</h3>
<p>Detailed analysis of potential growth avenues and strategic options.</p>

<h3>Investment Requirements</h3>
<p>Capital needs and expected returns for growth initiatives.</p>

<blockquote>
<p>"Vision statement or ambitious but achievable growth target."</p>
</blockquote>
    `.trim()
  }
];

interface BusinessListingTemplatesProps {
  onSelectTemplate: (content: string) => void;
  className?: string;
}

export function BusinessListingTemplates({ onSelectTemplate, className }: BusinessListingTemplatesProps) {
  return (
    <div className={className}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">Professional Templates</h3>
        <p className="text-sm text-muted-foreground">
          Choose a template to get started with a professional listing structure.
        </p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {BUSINESS_TEMPLATES.map((template) => (
          <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{template.name}</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    {template.description}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Template
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xs text-muted-foreground mb-3">
                {template.preview}
              </div>
              <Button 
                size="sm" 
                variant="outline" 
                className="w-full"
                onClick={() => onSelectTemplate(template.content)}
              >
                Use Template
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}