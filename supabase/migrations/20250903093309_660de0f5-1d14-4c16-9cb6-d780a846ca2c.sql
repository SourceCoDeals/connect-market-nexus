-- Enhanced Deal Stages with Automation Rules
UPDATE deal_stages SET automation_rules = '{
  "auto_move_conditions": {
    "nda_signed": {"next_stage": "information_sent"},
    "fee_agreement_signed": {"next_stage": "due_diligence"},  
    "loi_received": {"next_stage": "loi_submitted"},
    "contract_signed": {"next_stage": "under_contract"}
  },
  "required_documents": ["nda"],
  "stage_requirements": {
    "min_deal_value": 50000,
    "required_probability": 30
  }
}' WHERE name = 'Qualified';

UPDATE deal_stages SET automation_rules = '{
  "auto_move_conditions": {
    "fee_agreement_signed": {"next_stage": "due_diligence"}
  },
  "required_documents": ["nda", "fee_agreement"],
  "stage_requirements": {
    "required_probability": 40
  }
}' WHERE name = 'Information Sent';

UPDATE deal_stages SET automation_rules = '{
  "auto_move_conditions": {
    "loi_received": {"next_stage": "loi_submitted"}
  },
  "required_documents": ["nda", "fee_agreement", "due_diligence_package"],
  "stage_requirements": {
    "required_probability": 60
  }
}' WHERE name = 'Due Diligence';

UPDATE deal_stages SET automation_rules = '{
  "auto_move_conditions": {
    "contract_signed": {"next_stage": "under_contract"}
  },
  "required_documents": ["nda", "fee_agreement", "loi"],
  "stage_requirements": {
    "required_probability": 80
  }
}' WHERE name = 'LOI Submitted';

-- Add buyer priority scoring field to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS buyer_priority_score INTEGER DEFAULT 0;

-- Create function to calculate buyer priority score
CREATE OR REPLACE FUNCTION calculate_deal_buyer_priority(deal_row deals)
RETURNS INTEGER AS $$
DECLARE
  score INTEGER := 0;
  value_score INTEGER := 0;
  probability_score INTEGER := 0;
  urgency_score INTEGER := 0;
BEGIN
  -- Deal value scoring (0-40 points)
  CASE 
    WHEN deal_row.value >= 10000000 THEN value_score := 40;
    WHEN deal_row.value >= 5000000 THEN value_score := 30;
    WHEN deal_row.value >= 1000000 THEN value_score := 20;
    WHEN deal_row.value >= 500000 THEN value_score := 10;
    ELSE value_score := 5;
  END CASE;
  
  -- Probability scoring (0-30 points)
  probability_score := LEAST(30, deal_row.probability * 30 / 100);
  
  -- Priority/urgency scoring (0-30 points)
  CASE deal_row.priority
    WHEN 'urgent' THEN urgency_score := 30;
    WHEN 'high' THEN urgency_score := 20;
    WHEN 'medium' THEN urgency_score := 10;
    ELSE urgency_score := 5;
  END CASE;
  
  score := value_score + probability_score + urgency_score;
  
  -- Bonus points for signed documents
  IF deal_row.nda_status = 'signed' THEN score := score + 5; END IF;
  IF deal_row.fee_agreement_status = 'signed' THEN score := score + 5; END IF;
  
  RETURN score;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update buyer priority score
CREATE OR REPLACE FUNCTION update_deal_buyer_priority_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.buyer_priority_score := calculate_deal_buyer_priority(NEW);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_deal_priority_trigger
  BEFORE INSERT OR UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_deal_buyer_priority_score();

-- Update existing deals with priority scores
UPDATE deals SET buyer_priority_score = calculate_deal_buyer_priority(deals.*);