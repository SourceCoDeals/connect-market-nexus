-- Allow buyers to read their own firm's agreement status
CREATE POLICY "Users can view their own firm agreement"
  ON public.firm_agreements
  FOR SELECT
  USING (
    id IN (
      SELECT firm_id FROM public.firm_members WHERE user_id = auth.uid()
    )
  );