
-- Fix: Re-create mirror trigger on remarketing_buyer_contacts
DROP TRIGGER IF EXISTS trg_mirror_rbc_to_contacts ON public.remarketing_buyer_contacts;
CREATE TRIGGER trg_mirror_rbc_to_contacts
  AFTER INSERT ON public.remarketing_buyer_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.mirror_rbc_to_contacts();
