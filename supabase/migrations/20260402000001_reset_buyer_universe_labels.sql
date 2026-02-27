-- Reset all buyer_universe fields so labels regenerate with the corrected prompt.
-- The previous prompt produced geography-leading labels (e.g. "Pacific NW Home Services Add-On")
-- instead of specific service/product type labels (e.g. "Window & Door Installation Add-On").
UPDATE listings
SET buyer_universe_label = NULL,
    buyer_universe_description = NULL,
    buyer_universe_generated_at = NULL
WHERE buyer_universe_generated_at IS NOT NULL;
