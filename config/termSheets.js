// Term Sheet Content Configuration
// This file contains the different term sheet content based on project type

const termSheets = {
  solar: String.raw`
SOLAR PROJECT TERM SHEET

Project Type: Solar Energy Development
Investment Structure: {{investment_structure}}
Project Capacity: {{project_capacity}} MW
Expected ROI: {{expected_roi}}%
Development Timeline: {{development_timeline}} months

Key Terms:
- Technology: Photovoltaic Solar Panels
- Grid Connection: {{grid_connection_type}}
- Power Purchase Agreement: {{ppa_details}}
- Environmental Impact: {{environmental_impact}}
- Financing Structure: {{financing_structure}}

Development Phases:
1. Site Assessment and Feasibility Study
2. Permitting and Environmental Review
3. Engineering and Design
4. Construction and Installation
5. Commissioning and Grid Connection

Risk Factors:
- Weather and seasonal variations
- Regulatory changes
- Grid interconnection challenges
- Technology performance risks

Financial Projections:
- Initial Investment: \${{initial_investment}}
- Annual Revenue: \${{annual_revenue}}
- Payback Period: {{payback_period}} years
- Net Present Value: \${{npv}}
`,

  carbon_capture: String.raw`
CARBON CAPTURE PROJECT TERM SHEET

Project Type: Carbon Capture and Storage
Technology: {{capture_technology}}
Capture Capacity: {{capture_capacity}} tons CO2/year
Storage Method: {{storage_method}}
Project Duration: {{project_duration}} years

Key Terms:
- Capture Technology: {{capture_technology_details}}
- Storage Location: {{storage_location}}
- Carbon Credits: {{carbon_credits}} credits/year
- Monitoring System: {{monitoring_system}}
- Verification Protocol: {{verification_protocol}}

Development Phases:
1. Site Characterization and Assessment
2. Technology Selection and Design
3. Regulatory Approval and Permitting
4. Construction and Installation
5. Operations and Monitoring

Risk Factors:
- Geological storage risks
- Technology performance
- Regulatory compliance
- Carbon credit market volatility

Financial Projections:
- Initial Investment: \${{initial_investment}}
- Annual Carbon Credit Revenue: \${{carbon_credit_revenue}}
- Operating Costs: \${{operating_costs}}
- Break-even Point: {{breakeven_point}} years
`,

  construction: String.raw`
CONSTRUCTION PROJECT TERM SHEET

Project Type: Sustainable Construction Development
Building Type: {{building_type}}
Total Square Footage: {{square_footage}} sq ft
Green Certification Target: {{certification_target}}
Construction Timeline: {{construction_timeline}} months

Key Terms:
- Sustainable Materials: {{sustainable_materials}}
- Energy Efficiency Rating: {{energy_rating}}
- Water Conservation Features: {{water_features}}
- Renewable Energy Integration: {{renewable_integration}}
- Waste Reduction Plan: {{waste_reduction}}

Development Phases:
1. Design and Planning
2. Permitting and Approvals
3. Site Preparation
4. Construction
5. Final Inspection and Certification

Sustainability Features:
- LEED/BREEAM Certification: {{certification_level}}
- Energy Performance: {{energy_performance}}
- Water Efficiency: {{water_efficiency}}
- Indoor Environmental Quality: {{indoor_quality}}

Financial Projections:
- Total Project Cost: \${{total_project_cost}}
- Estimated Savings: \${{estimated_savings}}/year
- ROI Timeline: {{roi_timeline}} years
- Property Value Increase: {{value_increase}}%
`,

  bridge: String.raw`
BRIDGE FINANCING TERM SHEET

Financing Type: Bridge/Interim Financing
Loan Amount: \${{loan_amount}}
Interest Rate: {{interest_rate}}%
Term Length: {{term_length}} months
Purpose: {{financing_purpose}}

Key Terms:
- Loan-to-Value Ratio: {{ltv_ratio}}%
- Interest Payment: {{interest_payment_schedule}}
- Collateral: {{collateral_description}}
- Personal Guarantees: {{personal_guarantees}}
- Exit Strategy: {{exit_strategy}}

Conditions Precedent:
- Environmental due diligence
- Property appraisal
- Title insurance
- Insurance coverage
- Legal documentation

Fees and Costs:
- Origination Fee: {{origination_fee}}%
- Legal Fees: \${{legal_fees}}
- Appraisal Costs: \${{appraisal_costs}}
- Other Closing Costs: \${{closing_costs}}

Financial Projections:
- Monthly Payment: \${{monthly_payment}}
- Total Interest Cost: \${{total_interest}}
- Balloon Payment: \${{balloon_payment}}
- Prepayment Options: {{prepayment_terms}}
`,

  working_capital: String.raw`
WORKING CAPITAL TERM SHEET

Financing Type: Working Capital Line of Credit
Credit Limit: \${{credit_limit}}
Interest Rate: {{interest_rate}}% (Variable)
Term: {{term_length}} months
Draw Period: {{draw_period}} months

Key Terms:
- Advance Rate: {{advance_rate}}% of eligible receivables
- Minimum Monthly Interest: \${{minimum_interest}}
- Collateral: {{collateral_description}}
- Financial Covenants: {{financial_covenants}}
- Reporting Requirements: {{reporting_requirements}}

Eligible Collateral:
- Accounts Receivable: {{ar_eligibility}}
- Inventory: {{inventory_eligibility}}
- Equipment: {{equipment_eligibility}}

Fees and Costs:
- Setup Fee: \${{setup_fee}}
- Monthly Management Fee: \${{monthly_fee}}
- Audit Fee: \${{audit_fee}}
- Wire Transfer Fees: \${{wire_fees}}

Usage Guidelines:
- Maximum Draw: {{max_draw}}% of credit line
- Repayment Terms: {{repayment_terms}}
- Renewal Options: {{renewal_options}}
- Early Termination: {{termination_terms}}
`,

  predevelopment: String.raw`
PRE-DEVELOPMENT FINANCING TERM SHEET

Financing Type: Pre-Development Capital
Funding Amount: \${{funding_amount}}
Project Stage: {{project_stage}}
Development Timeline: {{development_timeline}} months
Success Fee Structure: {{success_fee}}%

Key Terms:
- Use of Funds: {{use_of_funds}}
- Milestone Payments: {{milestone_structure}}
- Equity Participation: {{equity_participation}}%
- Development Rights: {{development_rights}}
- Exit Mechanisms: {{exit_mechanisms}}

Development Milestones:
1. Site Control and Due Diligence
2. Environmental and Technical Studies
3. Permitting and Approvals
4. Financial Modeling and Structuring
5. Construction Financing Arrangement

Risk Allocation:
- Development Risk: {{development_risk}}
- Permitting Risk: {{permitting_risk}}
- Market Risk: {{market_risk}}
- Technology Risk: {{technology_risk}}

Financial Structure:
- Initial Disbursement: \${{initial_disbursement}}
- Milestone Funding: \${{milestone_funding}}
- Contingency Reserve: \${{contingency_reserve}}
- Expected Return: {{expected_return}}%
`
};

module.exports = termSheets;