import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Edit3, Eye, RotateCcw, Save, Phone, Calendar } from 'lucide-react';
import { useAdminSignature } from '@/hooks/admin/use-admin-signature';
import { SignatureSetupWarning } from './SignatureSetupWarning';

interface EditableSignatureProps {
  onSignatureChange?: (html: string, text: string) => void;
  showInline?: boolean;
}

export function EditableSignature({ onSignatureChange, showInline = false }: EditableSignatureProps) {
  const { signature, isLoading, updateSignature, resetToDefault, isUpdating } = useAdminSignature();
  const [isEditing, setIsEditing] = useState(false);
  const [htmlSignature, setHtmlSignature] = useState('');
  const [textSignature, setTextSignature] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [calendlyUrl, setCalendlyUrl] = useState('');

  useEffect(() => {
    if (signature) {
      setHtmlSignature(signature.signature_html);
      setTextSignature(signature.signature_text);
      setPhoneNumber((signature as any).phone_number || '');
      setCalendlyUrl((signature as any).calendly_url || '');
      onSignatureChange?.(signature.signature_html, signature.signature_text);
    }
  }, [signature, onSignatureChange]);

  const handleSave = () => {
    updateSignature({
      signature_html: htmlSignature,
      signature_text: textSignature,
      phone_number: phoneNumber,
      calendly_url: calendlyUrl
    });
    setIsEditing(false);
    onSignatureChange?.(htmlSignature, textSignature);
  };

  const handleReset = () => {
    resetToDefault();
    setIsEditing(false);
  };

  const handleCancel = () => {
    if (signature) {
      setHtmlSignature(signature.signature_html);
      setTextSignature(signature.signature_text);
      setPhoneNumber((signature as any).phone_number || '');
      setCalendlyUrl((signature as any).calendly_url || '');
    }
    setIsEditing(false);
  };

  const isSignatureIncomplete = () => {
    if (!signature || signature.isDefault) return true;
    const hasPlaceholders = signature.signature_text.includes('[Your') || 
                           signature.signature_html.includes('[Your');
    return hasPlaceholders;
  };

  if (isLoading) {
    return <div className="animate-pulse h-32 bg-muted/10 rounded"></div>;
  }

  if (showInline && !isEditing) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Email Signature</span>
            {signature?.isDefault && <Badge variant="outline" className="text-xs">Default</Badge>}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEditing(true)}
            className="h-8 px-2"
          >
            <Edit3 className="h-3 w-3" />
            Edit
          </Button>
        </div>
        <div className="text-sm border rounded p-2 bg-muted/5">
          <pre className="whitespace-pre-wrap text-sm">{signature?.signature_text || ''}</pre>
        </div>
      </div>
    );
  }

  if (!isEditing && showInline) {
    return null;
  }

  return (
    <Card className={showInline ? "" : "w-full"}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Email Signature</CardTitle>
            {signature?.isDefault && <Badge variant="outline">Default</Badge>}
          </div>
          {!isEditing && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
              >
                <Edit3 className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={isUpdating}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <SignatureSetupWarning 
          isIncomplete={isSignatureIncomplete()} 
          onEdit={() => setIsEditing(true)} 
        />
        
        {isEditing ? (
          <>
            <div className="space-y-4 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Phone Number
                  </Label>
                  <Input
                    id="phone"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="(555) 123-4567 - Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="calendly" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Calendly URL
                  </Label>
                  <Input
                    id="calendly"
                    value={calendlyUrl}
                    onChange={(e) => setCalendlyUrl(e.target.value)}
                    placeholder="https://calendly.com/your-name/30min - Optional"
                  />
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <Label htmlFor="signature">Signature Content</Label>
              <Textarea
                id="signature"
                value={textSignature}
                onChange={(e) => setTextSignature(e.target.value)}
                placeholder="John Smith&#10;Chief Executive Officer&#10;john.smith@sourcecodeals.com&#10;(555) 123-4567&#10;https://calendly.com/john-smith/30min"
                className="min-h-32 font-mono text-sm"
              />
              <div className="border rounded p-3 bg-muted/5">
                <div className="text-xs text-muted-foreground mb-2">Preview:</div>
                <pre className="whitespace-pre-wrap text-sm">{textSignature}</pre>
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={isUpdating}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                Save Signature
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isUpdating}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-3">
            <div className="border rounded p-3 bg-muted/5">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Current Signature</span>
              </div>
              <pre className="whitespace-pre-wrap text-sm">{signature?.signature_text || ''}</pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}