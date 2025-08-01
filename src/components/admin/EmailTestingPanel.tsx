import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

import { Upload, TestTube, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

export const EmailTestingPanel = () => {
  const { toast } = useToast();

  const testAttachments = () => {
    // Create a test PDF blob
    const testPdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj

4 0 obj
<<
/Length 44
>>
stream
BT
/F1 12 Tf
72 720 Td
(Test PDF for SourceCo) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f 
0000000010 00000 n 
0000000079 00000 n 
0000000173 00000 n 
0000000301 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
395
%%EOF`;

    const blob = new Blob([testPdfContent], { type: 'application/pdf' });
    const file = new File([blob], 'test-fee-agreement.pdf', { type: 'application/pdf' });
    
    console.log('🧪 Created test PDF file:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });

    // Test base64 encoding
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      // Debug log removed
      
      // Test decoding
      try {
        const base64Data = result.split(',')[1];
        const decoded = atob(base64Data);
        // Debug log removed
      } catch (error) {
        console.error('❌ Base64 decode test failed:', error);
      }
    };
    reader.readAsDataURL(file);

    toast({
      title: "🧪 Test PDF Generated",
      description: "Check console for attachment test results",
    });
  };


  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TestTube className="h-5 w-5" />
          Email System Testing Panel
        </CardTitle>
        <CardDescription>
          Test and fix SourceCo email system components
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <div>
              <h4 className="font-medium">Logo Embedding</h4>
              <p className="text-sm text-muted-foreground">
                Logo automatically embedded as base64 in emails
              </p>
            </div>
          </div>
          <span className="text-sm text-green-600 font-medium">Active</span>
        </div>

        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <TestTube className="h-4 w-4 text-blue-600" />
            <div>
              <h4 className="font-medium">PDF Attachment Test</h4>
              <p className="text-sm text-muted-foreground">
                Generate test PDF and validate attachment processing
              </p>
            </div>
          </div>
          <Button onClick={testAttachments} variant="outline" size="sm">
            <TestTube className="h-4 w-4 mr-2" />
            Test PDF
          </Button>
        </div>

        <div className="p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Status Summary</h4>
          <ul className="text-sm space-y-1">
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Premium SourceCo branding implemented
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              Black/gold email template design
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Logo embedding: Active (base64 + fallback attachment)
            </li>
            <li className="flex items-center gap-2">
              <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
              PDF attachments: Enhanced validation
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};