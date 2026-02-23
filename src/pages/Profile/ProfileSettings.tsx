import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MultiSelect } from "@/components/ui/multi-select";
import { Switch } from "@/components/ui/switch";
import {
  DEPLOYING_CAPITAL_OPTIONS,
  DEAL_SIZE_BAND_OPTIONS,
  INTEGRATION_PLAN_OPTIONS,
  CORPDEV_INTENT_OPTIONS,
  DISCRETION_TYPE_OPTIONS,
  COMMITTED_EQUITY_BAND_OPTIONS,
  EQUITY_SOURCE_OPTIONS,
  DEPLOYMENT_TIMING_OPTIONS,
  SEARCH_TYPE_OPTIONS,
  ACQ_EQUITY_BAND_OPTIONS,
  FINANCING_PLAN_OPTIONS,
  SEARCH_STAGE_OPTIONS,
  ON_BEHALF_OPTIONS,
  BUYER_ROLE_OPTIONS,
  OWNER_TIMELINE_OPTIONS,
  INDIVIDUAL_FUNDING_SOURCE_OPTIONS,
  USES_BANK_FINANCE_OPTIONS,
  MAX_EQUITY_TODAY_OPTIONS,
} from "@/lib/signup-field-options";
import { DEAL_SIZE_RANGES } from "@/lib/currency-ranges";
import type { ProfileSettingsProps } from "./types";

export function ProfileSettings({
  formData,
  onInputChange,
  onSelectChange,
  onSetFormData,
}: ProfileSettingsProps) {
  return (
    <>
      {formData.buyer_type === "privateEquity" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="deploying_capital_now">Capital Deployment Status</Label>
            <Select value={formData.deploying_capital_now || ""} onValueChange={(value) => onSelectChange(value, "deploying_capital_now")}>
              <SelectTrigger><SelectValue placeholder="Select deployment status" /></SelectTrigger>
              <SelectContent>
                {DEPLOYING_CAPITAL_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="portfolio_company_addon">Portfolio Company Add-on (Optional)</Label>
            <Input id="portfolio_company_addon" name="portfolio_company_addon" value={formData.portfolio_company_addon || ""} onChange={onInputChange} placeholder="Which portfolio company would this be an add-on to?" />
          </div>
        </>
      )}

      {formData.buyer_type === "corporate" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="owning_business_unit">Owning Business Unit / Brand (Optional)</Label>
            <Input id="owning_business_unit" name="owning_business_unit" value={formData.owning_business_unit || ""} onChange={onInputChange} placeholder="Which business unit would own this acquisition?" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deal_size_band">Deal Size (EV)</Label>
            <Select value={formData.deal_size_band || ""} onValueChange={(value) => onSelectChange(value, "deal_size_band")}>
              <SelectTrigger><SelectValue placeholder="Select deal size range" /></SelectTrigger>
              <SelectContent>
                {DEAL_SIZE_BAND_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="integration_plan">Integration Plan (Optional)</Label>
            <MultiSelect
              options={INTEGRATION_PLAN_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
              selected={Array.isArray(formData.integration_plan) ? formData.integration_plan : (formData.integration_plan ? [formData.integration_plan] : [])}
              onSelectedChange={(values) => onSelectChange(values, "integration_plan")}
              placeholder="Select integration approaches"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="corpdev_intent">Speed/Intent (Optional)</Label>
            <Select value={formData.corpdev_intent || ""} onValueChange={(value) => onSelectChange(value, "corpdev_intent")}>
              <SelectTrigger><SelectValue placeholder="Select your current intent" /></SelectTrigger>
              <SelectContent>
                {CORPDEV_INTENT_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="buyer_org_url">Organization URL</Label>
            <Input id="buyer_org_url" name="buyer_org_url" value={formData.buyer_org_url || ""} onChange={onInputChange} placeholder="https://company.com" />
          </div>
        </>
      )}

      {formData.buyer_type === "familyOffice" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="discretion_type">Decision Authority</Label>
            <Select value={formData.discretion_type || ""} onValueChange={(value) => onSelectChange(value, "discretion_type")}>
              <SelectTrigger><SelectValue placeholder="Select decision authority" /></SelectTrigger>
              <SelectContent>
                {DISCRETION_TYPE_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="permanent_capital" checked={formData.permanent_capital || false} onCheckedChange={(checked) => onSelectChange(checked, "permanent_capital")} />
            <Label htmlFor="permanent_capital">Permanent Capital</Label>
          </div>
        </>
      )}

      {formData.buyer_type === "independentSponsor" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="committed_equity_band">Committed Equity</Label>
            <Select value={formData.committed_equity_band || ""} onValueChange={(value) => onSelectChange(value, "committed_equity_band")}>
              <SelectTrigger><SelectValue placeholder="Select committed equity range" /></SelectTrigger>
              <SelectContent>
                {COMMITTED_EQUITY_BAND_OPTIONS.map((option) => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="equity_source">Equity Source</Label>
            <MultiSelect
              options={EQUITY_SOURCE_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
              selected={Array.isArray(formData.equity_source) ? formData.equity_source : (formData.equity_source ? [formData.equity_source] : [])}
              onSelectedChange={(values) => onSelectChange(values, "equity_source")}
              placeholder="Select equity sources..."
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deployment_timing">Deployment Timing</Label>
            <Select value={formData.deployment_timing || ""} onValueChange={(value) => onSelectChange(value, "deployment_timing")}>
              <SelectTrigger><SelectValue placeholder="Select deployment timing" /></SelectTrigger>
              <SelectContent>
                {DEPLOYMENT_TIMING_OPTIONS.map((option) => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="flex_subxm_ebitda" checked={formData.flex_subxm_ebitda || false} onCheckedChange={(checked) => onSelectChange(checked, "flex_subxm_ebitda")} />
            <Label htmlFor="flex_subxm_ebitda">Flexible on sub-$1M EBITDA targets</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="backers_summary">Backers Summary</Label>
            <Input id="backers_summary" name="backers_summary" value={formData.backers_summary || ""} onChange={onInputChange} placeholder="e.g., Smith Capital; Oak Family Office" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="deal_structure_preference">Deal Structure Preference</Label>
            <Input id="deal_structure_preference" name="deal_structure_preference" value={formData.deal_structure_preference || ""} onChange={onInputChange} placeholder="e.g., Majority control" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="target_deal_size">Target Deal Size Range</Label>
            <Select
              value={formData.target_deal_size_min && formData.target_deal_size_max
                ? DEAL_SIZE_RANGES.find(r => {
                    const parts = r.value.split(' - ');
                    const minParts = parts[0]?.replace(/[^0-9]/g, '');
                    const maxParts = parts[1]?.replace(/[^0-9]/g, '');
                    const expectedMin = minParts ? parseInt(minParts) * 1000000 : 0;
                    const expectedMax = maxParts ? parseInt(maxParts) * 1000000 : 0;
                    return formData.target_deal_size_min === expectedMin && formData.target_deal_size_max === expectedMax;
                  })?.value || ""
                : ""}
              onValueChange={(value) => {
                const range = DEAL_SIZE_RANGES.find(r => r.value === value);
                if (range) {
                  const parts = range.value.split(' - ');
                  const min = parts[0]?.replace(/[^0-9]/g, '');
                  const max = parts[1]?.replace(/[^0-9]/g, '');
                  onSetFormData(prev => ({
                    ...prev,
                    target_deal_size_min: min ? parseInt(min) * 1000000 : undefined,
                    target_deal_size_max: max ? parseInt(max) * 1000000 : undefined
                  }));
                }
              }}
            >
              <SelectTrigger><SelectValue placeholder="Select deal size range" /></SelectTrigger>
              <SelectContent>
                {DEAL_SIZE_RANGES.map((range) => (<SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {formData.buyer_type === "searchFund" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="search_type">Search Type</Label>
            <Select value={formData.search_type || ""} onValueChange={(value) => onSelectChange(value, "search_type")}>
              <SelectTrigger><SelectValue placeholder="Select search type" /></SelectTrigger>
              <SelectContent>
                {SEARCH_TYPE_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="acq_equity_band">Equity Available for Acquisition at Close</Label>
            <Select value={formData.acq_equity_band || ""} onValueChange={(value) => onSelectChange(value, "acq_equity_band")}>
              <SelectTrigger><SelectValue placeholder="Select equity available" /></SelectTrigger>
              <SelectContent>
                {ACQ_EQUITY_BAND_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="financing_plan">Financing Plan</Label>
            <MultiSelect
              options={FINANCING_PLAN_OPTIONS.map(opt => ({ value: opt.value, label: opt.label }))}
              selected={Array.isArray(formData.financing_plan) ? formData.financing_plan : (formData.financing_plan ? [formData.financing_plan] : [])}
              onSelectedChange={(values) => onSelectChange(values, "financing_plan")}
              placeholder="Select all that apply"
            />
          </div>
          <div className="flex items-center space-x-2">
            <Switch id="flex_sub2m_ebitda" checked={formData.flex_sub2m_ebitda || false} onCheckedChange={(checked) => onSelectChange(checked, "flex_sub2m_ebitda")} />
            <Label htmlFor="flex_sub2m_ebitda">Flexible on size? (can pursue less than $2M EBITDA)</Label>
          </div>
          <div className="space-y-2">
            <Label htmlFor="search_stage">Stage of Search (Optional)</Label>
            <Select value={formData.search_stage || ""} onValueChange={(value) => onSelectChange(value, "search_stage")}>
              <SelectTrigger><SelectValue placeholder="Select current stage" /></SelectTrigger>
              <SelectContent>
                {SEARCH_STAGE_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="anchor_investors_summary">Anchor Investors / Committed Backers (Optional)</Label>
            <Input id="anchor_investors_summary" name="anchor_investors_summary" value={formData.anchor_investors_summary || ""} onChange={onInputChange} placeholder="e.g., XYZ Capital; ABC Family Office" />
          </div>
        </>
      )}

      {formData.buyer_type === "advisor" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="on_behalf_of_buyer">Are you inquiring on behalf of a capitalized buyer with discretion?</Label>
            <Select value={formData.on_behalf_of_buyer || ""} onValueChange={(value) => onSelectChange(value, "on_behalf_of_buyer")}>
              <SelectTrigger><SelectValue placeholder="Select yes or no" /></SelectTrigger>
              <SelectContent>
                {ON_BEHALF_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          {formData.on_behalf_of_buyer === "yes" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="buyer_role">Buyer Role</Label>
                <Select value={formData.buyer_role || ""} onValueChange={(value) => onSelectChange(value, "buyer_role")}>
                  <SelectTrigger><SelectValue placeholder="Select buyer role" /></SelectTrigger>
                  <SelectContent>
                    {BUYER_ROLE_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="buyer_org_url">Buyer Organization Website</Label>
                <Input id="buyer_org_url" name="buyer_org_url" value={formData.buyer_org_url || ""} onChange={onInputChange} placeholder="https://example.com" />
              </div>
            </>
          )}
          <div className="space-y-2">
            <Label htmlFor="mandate_blurb">Mandate in One Line (140 chars max, Optional)</Label>
            <Textarea id="mandate_blurb" name="mandate_blurb" value={formData.mandate_blurb || ""} onChange={onInputChange} placeholder="Brief description of your mandate or focus" maxLength={140} />
          </div>
        </>
      )}

      {formData.buyer_type === "businessOwner" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="owner_intent">Why are you here? (140 chars max)</Label>
            <Textarea id="owner_intent" name="owner_intent" value={formData.owner_intent || ""} onChange={onInputChange} placeholder="e.g., Valuation, Open to intros" maxLength={140} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="owner_timeline">Timeline (Optional)</Label>
            <Select value={formData.owner_timeline || ""} onValueChange={(value) => onSelectChange(value, "owner_timeline")}>
              <SelectTrigger><SelectValue placeholder="Select timeline" /></SelectTrigger>
              <SelectContent>
                {OWNER_TIMELINE_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {formData.buyer_type === "individual" && (
        <>
          <div className="space-y-2">
            <Label htmlFor="funding_source">Funding Source</Label>
            <Select value={formData.funding_source || ""} onValueChange={(value) => onSelectChange(value, "funding_source")}>
              <SelectTrigger><SelectValue placeholder="Select funding source" /></SelectTrigger>
              <SelectContent>
                {INDIVIDUAL_FUNDING_SOURCE_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="uses_bank_finance">Will you use SBA/bank financing?</Label>
            <Select value={formData.uses_bank_finance || ""} onValueChange={(value) => onSelectChange(value, "uses_bank_finance")}>
              <SelectTrigger><SelectValue placeholder="Select yes, no, or not sure" /></SelectTrigger>
              <SelectContent>
                {USES_BANK_FINANCE_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="max_equity_today_band">Max Equity You Can Commit Today (Optional)</Label>
            <Select value={formData.max_equity_today_band || ""} onValueChange={(value) => onSelectChange(value, "max_equity_today_band")}>
              <SelectTrigger><SelectValue placeholder="Select equity range" /></SelectTrigger>
              <SelectContent>
                {MAX_EQUITY_TODAY_OPTIONS.map(option => (<SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </>
  );
}
