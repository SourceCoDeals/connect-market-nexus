import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, TrendingUp, Settings, Target, DollarSign, Users } from 'lucide-react';
import { RichTextDisplay } from '@/components/ui/rich-text-display';

interface BusinessTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  preview: string;
  content: string;
  industry?: string[];
}

const ENHANCED_BUSINESS_TEMPLATES: BusinessTemplate[] = [
  // SaaS & Technology Templates
  {
    id: 'saas-growth',
    name: 'SaaS Growth Story',
    description: 'Perfect for software companies with recurring revenue',
    category: 'saas',
    icon: <TrendingUp className="h-4 w-4" />,
    preview: 'ARR Growth • Customer Metrics • Product Roadmap',
    industry: ['Software', 'Technology', 'SaaS'],
    content: `
<h2>SaaS Business Overview</h2>
<p>Established software-as-a-service platform with strong recurring revenue and growth trajectory.</p>

<h3>Key Metrics & Performance</h3>
<table>
<thead>
<tr><th>Metric</th><th>Current</th><th>Growth Rate</th></tr>
</thead>
<tbody>
<tr><td>Annual Recurring Revenue (ARR)</td><td>$[ARR]</td><td>[%] YoY</td></tr>
<tr><td>Monthly Recurring Revenue (MRR)</td><td>$[MRR]</td><td>[%] MoM</td></tr>
<tr><td>Customer Count</td><td>[#]</td><td>[%] YoY</td></tr>
<tr><td>Average Contract Value (ACV)</td><td>$[ACV]</td><td>[%] YoY</td></tr>
</tbody>
</table>

<h3>Product & Market Position</h3>
<ul>
<li><strong>Product Differentiation:</strong> Unique features and competitive advantages</li>
<li><strong>Market Penetration:</strong> Total addressable market and current market share</li>
<li><strong>Customer Segments:</strong> Primary verticals and use cases</li>
<li><strong>Technology Stack:</strong> Modern, scalable architecture</li>
</ul>

<h3>Growth Drivers</h3>
<ol>
<li><strong>Product Development:</strong> Feature expansion and new modules</li>
<li><strong>Market Expansion:</strong> Geographic and vertical expansion opportunities</li>
<li><strong>Customer Success:</strong> High retention rates and expansion revenue</li>
<li><strong>Sales & Marketing:</strong> Proven go-to-market strategy</li>
</ol>

<blockquote>
<p><strong>Customer Retention Rate:</strong> [%] with strong product-market fit and sticky user engagement.</p>
</blockquote>

<h3>Investment Highlights</h3>
<p>Predictable recurring revenue model with high-margin scalability and significant growth potential in expanding market.</p>
    `.trim()
  },
  
  // Manufacturing & Industrial Templates
  {
    id: 'manufacturing-excellence',
    name: 'Manufacturing Excellence',
    description: 'For established manufacturing and industrial businesses',
    category: 'manufacturing',
    icon: <Settings className="h-4 w-4" />,
    preview: 'Operations • Facilities • Supply Chain • Quality',
    industry: ['Manufacturing', 'Industrial', 'Production'],
    content: `
<h2>Manufacturing Business Overview</h2>
<p>Well-established manufacturing operation with proven processes, quality systems, and strong market position.</p>

<h3>Operational Excellence</h3>
<ul>
<li><strong>Production Capacity:</strong> [Units/Year] with [%] current utilization</li>
<li><strong>Quality Certifications:</strong> ISO 9001, industry-specific standards</li>
<li><strong>Manufacturing Facilities:</strong> [Location] with [sq ft] of production space</li>
<li><strong>Equipment & Technology:</strong> Modern machinery with regular maintenance schedules</li>
</ul>

<h3>Supply Chain & Logistics</h3>
<table>
<thead>
<tr><th>Component</th><th>Details</th><th>Performance</th></tr>
</thead>
<tbody>
<tr><td>Supplier Network</td><td>[#] qualified suppliers</td><td>[%] on-time delivery</td></tr>
<tr><td>Inventory Management</td><td>JIT/Lean principles</td><td>[Days] inventory turnover</td></tr>
<tr><td>Distribution Network</td><td>[#] distribution centers</td><td>[%] fill rate</td></tr>
</tbody>
</table>

<h3>Market Position & Customers</h3>
<ul>
<li><strong>Market Share:</strong> [%] of addressable market in core segments</li>
<li><strong>Customer Base:</strong> [#] active customers with [%] repeat business</li>
<li><strong>Product Portfolio:</strong> [#] SKUs across [#] product categories</li>
<li><strong>Competitive Advantages:</strong> Cost leadership, quality, or differentiation</li>
</ul>

<h3>Growth Opportunities</h3>
<ol>
<li><strong>Capacity Expansion:</strong> Additional production lines or facilities</li>
<li><strong>Product Innovation:</strong> New product development and R&D investments</li>
<li><strong>Market Expansion:</strong> New geographic markets or customer segments</li>
<li><strong>Operational Efficiency:</strong> Automation and process improvements</li>
</ol>

<blockquote>
<p><strong>Quality Metrics:</strong> [%] defect rate with continuous improvement culture and lean manufacturing principles.</p>
</blockquote>
    `.trim()
  },

  // Service Business Templates
  {
    id: 'professional-services',
    name: 'Professional Services',
    description: 'For consulting, agency, and professional service firms',
    category: 'services',
    icon: <Users className="h-4 w-4" />,
    preview: 'Team • Clients • Services • Growth',
    industry: ['Consulting', 'Agency', 'Professional Services'],
    content: `
<h2>Professional Services Firm</h2>
<p>Established professional services firm with deep expertise, strong client relationships, and proven service delivery.</p>

<h3>Service Portfolio & Expertise</h3>
<ul>
<li><strong>Core Services:</strong> Primary service offerings and specializations</li>
<li><strong>Industry Focus:</strong> Target industries and vertical expertise</li>
<li><strong>Service Delivery:</strong> Methodology and quality assurance processes</li>
<li><strong>Intellectual Property:</strong> Proprietary frameworks and tools</li>
</ul>

<h3>Team & Capabilities</h3>
<table>
<thead>
<tr><th>Level</th><th>Count</th><th>Utilization</th></tr>
</thead>
<tbody>
<tr><td>Partners/Principals</td><td>[#]</td><td>[%]</td></tr>
<tr><td>Senior Consultants</td><td>[#]</td><td>[%]</td></tr>
<tr><td>Consultants</td><td>[#]</td><td>[%]</td></tr>
<tr><td>Support Staff</td><td>[#]</td><td>[%]</td></tr>
</tbody>
</table>

<h3>Client Portfolio & Relationships</h3>
<ul>
<li><strong>Client Base:</strong> [#] active clients with [%] retention rate</li>
<li><strong>Client Concentration:</strong> Top 10 clients represent [%] of revenue</li>
<li><strong>Contract Types:</strong> Mix of retainer, project, and success-based fees</li>
<li><strong>Average Project Value:</strong> $[Amount] with [Month] average duration</li>
</ul>

<h3>Financial Performance</h3>
<ul>
<li><strong>Revenue per Employee:</strong> $[Amount] with strong productivity metrics</li>
<li><strong>Gross Margins:</strong> [%] with efficient service delivery</li>
<li><strong>Billing Rates:</strong> $[Rate]/hour average across service lines</li>
<li><strong>Accounts Receivable:</strong> [Days] DSO with strong collection processes</li>
</ul>

<h3>Growth Strategy</h3>
<ol>
<li><strong>Service Expansion:</strong> New service lines and capability development</li>
<li><strong>Geographic Growth:</strong> Market expansion and new office locations</li>
<li><strong>Team Building:</strong> Strategic hiring and talent development</li>
<li><strong>Technology Investment:</strong> Tools and platforms for efficiency</li>
</ol>

<blockquote>
<p><strong>Client Satisfaction:</strong> [%] client satisfaction score with strong referral pipeline and repeat business.</p>
</blockquote>
    `.trim()
  },

  // E-commerce Templates
  {
    id: 'ecommerce-brand',
    name: 'E-commerce Brand',
    description: 'For online retail and direct-to-consumer brands',
    category: 'ecommerce',
    icon: <DollarSign className="h-4 w-4" />,
    preview: 'Sales Channels • Brand • Logistics • Growth',
    industry: ['E-commerce', 'Retail', 'Consumer Goods'],
    content: `
<h2>E-commerce Brand Overview</h2>
<p>Successful direct-to-consumer brand with strong online presence, efficient operations, and growth momentum.</p>

<h3>Sales Performance & Channels</h3>
<table>
<thead>
<tr><th>Channel</th><th>Revenue %</th><th>Growth Rate</th></tr>
</thead>
<tbody>
<tr><td>Own Website</td><td>[%]</td><td>[%] YoY</td></tr>
<tr><td>Amazon</td><td>[%]</td><td>[%] YoY</td></tr>
<tr><td>Other Marketplaces</td><td>[%]</td><td>[%] YoY</td></tr>
<tr><td>Retail Partners</td><td>[%]</td><td>[%] YoY</td></tr>
</tbody>
</table>

<h3>Brand & Marketing</h3>
<ul>
<li><strong>Brand Positioning:</strong> Unique value proposition and brand differentiation</li>
<li><strong>Customer Acquisition:</strong> Digital marketing strategy and CAC metrics</li>
<li><strong>Social Media Presence:</strong> [#] followers across platforms with [%] engagement</li>
<li><strong>Content Marketing:</strong> SEO strategy and organic traffic growth</li>
</ul>

<h3>Operations & Fulfillment</h3>
<ul>
<li><strong>Inventory Management:</strong> [Days] inventory turnover with demand forecasting</li>
<li><strong>Fulfillment Strategy:</strong> In-house vs. 3PL with [%] same-day shipping</li>
<li><strong>Customer Service:</strong> Multi-channel support with [%] satisfaction rating</li>
<li><strong>Returns Process:</strong> [%] return rate with streamlined reverse logistics</li>
</ul>

<h3>Customer Metrics</h3>
<table>
<thead>
<tr><th>Metric</th><th>Value</th><th>Benchmark</th></tr>
</thead>
<tbody>
<tr><td>Customer Acquisition Cost (CAC)</td><td>$[Amount]</td><td>Industry avg: $[Amount]</td></tr>
<tr><td>Customer Lifetime Value (LTV)</td><td>$[Amount]</td><td>LTV:CAC = [Ratio]</td></tr>
<tr><td>Repeat Purchase Rate</td><td>[%]</td><td>Target: [%]</td></tr>
<tr><td>Average Order Value (AOV)</td><td>$[Amount]</td><td>[%] YoY growth</td></tr>
</tbody>
</table>

<h3>Growth Opportunities</h3>
<ol>
<li><strong>Product Line Extension:</strong> New products and category expansion</li>
<li><strong>International Expansion:</strong> Cross-border e-commerce opportunities</li>
<li><strong>Subscription Model:</strong> Recurring revenue stream development</li>
<li><strong>Wholesale Channel:</strong> B2B sales and retail partnerships</li>
</ol>

<blockquote>
<p><strong>Customer Reviews:</strong> [Rating]/5 stars with [#]+ verified reviews and strong brand loyalty metrics.</p>
</blockquote>
    `.trim()
  },

  // Investment & Financial Templates
  {
    id: 'financial-services',
    name: 'Financial Services',
    description: 'For investment firms, financial advisors, and fintech',
    category: 'financial',
    icon: <Target className="h-4 w-4" />,
    preview: 'AUM • Performance • Compliance • Growth',
    industry: ['Financial Services', 'Investment Management', 'Fintech'],
    content: `
<h2>Financial Services Business</h2>
<p>Established financial services firm with strong track record, regulatory compliance, and growth opportunities.</p>

<h3>Business Model & Services</h3>
<ul>
<li><strong>Primary Services:</strong> Core offering and value proposition</li>
<li><strong>Target Markets:</strong> Client segments and market focus</li>
<li><strong>Revenue Model:</strong> Fee structure and recurring revenue streams</li>
<li><strong>Competitive Position:</strong> Market differentiation and advantages</li>
</ul>

<h3>Financial Performance</h3>
<table>
<thead>
<tr><th>Metric</th><th>Current Year</th><th>Growth</th></tr>
</thead>
<tbody>
<tr><td>Assets Under Management</td><td>$[Amount]</td><td>[%] YoY</td></tr>
<tr><td>Fee Revenue</td><td>$[Amount]</td><td>[%] YoY</td></tr>
<tr><td>Client Count</td><td>[#]</td><td>[%] YoY</td></tr>
<tr><td>Average Account Size</td><td>$[Amount]</td><td>[%] YoY</td></tr>
</tbody>
</table>

<h3>Regulatory & Compliance</h3>
<ul>
<li><strong>Licensing:</strong> Current registrations and regulatory status</li>
<li><strong>Compliance Framework:</strong> Policies, procedures, and oversight</li>
<li><strong>Risk Management:</strong> Risk assessment and mitigation strategies</li>
<li><strong>Audit History:</strong> Clean regulatory examinations and reporting</li>
</ul>

<h3>Technology & Operations</h3>
<ul>
<li><strong>Technology Platform:</strong> Core systems and digital capabilities</li>
<li><strong>Data Security:</strong> Cybersecurity measures and data protection</li>
<li><strong>Operational Efficiency:</strong> Process automation and cost management</li>
<li><strong>Scalability:</strong> Capacity for growth and expansion</li>
</ul>

<h3>Growth Strategy</h3>
<ol>
<li><strong>Client Acquisition:</strong> Marketing and business development initiatives</li>
<li><strong>Service Expansion:</strong> New products and service offerings</li>
<li><strong>Geographic Growth:</strong> Market expansion opportunities</li>
<li><strong>Strategic Partnerships:</strong> Alliances and distribution channels</li>
</ol>

<blockquote>
<p><strong>Performance Track Record:</strong> [%] client retention with consistent investment performance and strong fiduciary standards.</p>
</blockquote>
    `.trim()
  }
];

const TEMPLATE_CATEGORIES = [
  { id: 'all', name: 'All Templates', icon: <Building2 className="h-4 w-4" /> },
  { id: 'saas', name: 'SaaS & Tech', icon: <TrendingUp className="h-4 w-4" /> },
  { id: 'manufacturing', name: 'Manufacturing', icon: <Settings className="h-4 w-4" /> },
  { id: 'services', name: 'Professional Services', icon: <Users className="h-4 w-4" /> },
  { id: 'ecommerce', name: 'E-commerce', icon: <DollarSign className="h-4 w-4" /> },
  { id: 'financial', name: 'Financial Services', icon: <Target className="h-4 w-4" /> },
];

interface EnhancedBusinessTemplatesProps {
  onSelectTemplate: (content: string) => void;
  className?: string;
}

export function EnhancedBusinessTemplates({ onSelectTemplate, className }: EnhancedBusinessTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [previewTemplate, setPreviewTemplate] = useState<BusinessTemplate | null>(null);

  const filteredTemplates = selectedCategory === 'all' 
    ? ENHANCED_BUSINESS_TEMPLATES 
    : ENHANCED_BUSINESS_TEMPLATES.filter(template => template.category === selectedCategory);

  return (
    <div className={className}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Professional Business Templates</h3>
        <p className="text-sm text-muted-foreground">
          Industry-specific templates designed for professional business listings with structured content and key metrics.
        </p>
      </div>

      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-6">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
          {TEMPLATE_CATEGORIES.map((category) => (
            <TabsTrigger 
              key={category.id} 
              value={category.id}
              className="flex items-center gap-1 text-xs"
            >
              {category.icon}
              <span className="hidden sm:inline">{category.name}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="group cursor-pointer hover:shadow-md transition-all duration-200">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-md text-primary">
                    {template.icon}
                  </div>
                  <div>
                    <CardTitle className="text-base">{template.name}</CardTitle>
                    <CardDescription className="text-sm mt-1">
                      {template.description}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {template.category.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-xs text-muted-foreground mb-3">
                {template.preview}
              </div>
              {template.industry && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {template.industry.map((industry) => (
                    <Badge key={industry} variant="outline" className="text-xs">
                      {industry}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setPreviewTemplate(template)}
                >
                  Preview
                </Button>
                <Button 
                  size="sm" 
                  className="flex-1"
                  onClick={() => onSelectTemplate(template.content)}
                >
                  Use Template
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {previewTemplate && (
        <div className="mt-6 p-4 border rounded-lg bg-card">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold">{previewTemplate.name} Preview</h4>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => setPreviewTemplate(null)}
            >
              Close
            </Button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <RichTextDisplay content={previewTemplate.content} />
          </div>
          <div className="mt-4 pt-4 border-t">
            <Button 
              onClick={() => {
                onSelectTemplate(previewTemplate.content);
                setPreviewTemplate(null);
              }}
            >
              Use This Template
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}