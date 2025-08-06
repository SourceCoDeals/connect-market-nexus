-- Re-enable the deal alerts trigger now that we've fixed the data format issue
CREATE TRIGGER trigger_deal_alerts
  AFTER INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_deal_alerts();