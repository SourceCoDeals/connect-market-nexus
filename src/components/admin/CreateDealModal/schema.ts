import * as z from 'zod/v3';

// Schema
export const createDealSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  description: z.string().max(2000).optional(),
  stage_id: z.string().uuid('Please select a stage'),
  listing_id: z.string().uuid('Please select a listing'),
  contact_name: z.string().min(1, 'Contact name is required').max(100),
  contact_email: z.string().email('Invalid email').max(255),
  contact_company: z.string().max(150).optional(),
  contact_phone: z.string().max(50).optional(),
  contact_role: z.string().max(100).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  value: z.number().min(0).optional(),
  probability: z.number().min(0).max(100).optional(),
  expected_close_date: z.date().optional(),
  assigned_to: z.union([z.string().uuid(), z.literal('')]).optional(),
});

export type CreateDealFormData = z.infer<typeof createDealSchema>;

export interface CreateDealModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefilledStageId?: string;
  onDealCreated?: (dealId: string) => void;
}

export interface DuplicateDeal {
  id: string;
  title: string;
  contact_name: string | null;
  created_at: string | null;
}
