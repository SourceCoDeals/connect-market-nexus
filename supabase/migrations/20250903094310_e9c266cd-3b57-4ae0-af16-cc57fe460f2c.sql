-- Harden functions: set stable search_path
CREATE OR REPLACE FUNCTION calculate_deal_buyer_priority(deal_row deals)
RETURNS INTEGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  score INTEGER := 0;
  value_score INTEGER := 0;
  probability_score INTEGER := 0;
  urgency_score INTEGER := 0;
BEGIN
  CASE 
    WHEN deal_row.value >= 10000000 THEN value_score := 40;
    WHEN deal_row.value >= 5000000 THEN value_score := 30;
    WHEN deal_row.value >= 1000000 THEN value_score := 20;
    WHEN deal_row.value >= 500000 THEN value_score := 10;
    ELSE value_score := 5;
  END CASE;

  probability_score := LEAST(30, deal_row.probability * 30 / 100);

  CASE deal_row.priority
    WHEN 'urgent' THEN urgency_score := 30;
    WHEN 'high' THEN urgency_score := 20;
    WHEN 'medium' THEN urgency_score := 10;
    ELSE urgency_score := 5;
  END CASE;

  score := value_score + probability_score + urgency_score;

  IF deal_row.nda_status = 'signed' THEN score := score + 5; END IF;
  IF deal_row.fee_agreement_status = 'signed' THEN score := score + 5; END IF;

  RETURN score;
END;
$$;

CREATE OR REPLACE FUNCTION update_deal_buyer_priority_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.buyer_priority_score := calculate_deal_buyer_priority(NEW);
  RETURN NEW;
END;
$$;