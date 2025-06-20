// Google Docs Template IDs Configuration
// Updated: 2025-06-20 with new template URLs

const TEMPLATE_IDS = {
  // Standard Documents
  MNDA: '1WLIM6zo6KkXvdwvJNVwcjr5aItjK6uBH0tP9di2xSyI',
  POA: '1Fo3k4YiCddpxbcKJM7hO4OSgEBDKGvmSpK-36I9e17I',
  PROJECT_OVERVIEW: '1cCE6f7BPUQL-aL7rUh-bjGUPUY5zJZhG_EF3fyZ638s',
  FORM_ID: '1ycDXjy9ffxn0hoK1M_wXM9kCyxlOQY8HOOJrmx8oMrs',

  // Term Sheets by Project Type
  TERM_SHEETS: {
    BRIDGE: '1iuofWttgMe3-JukJfaXJ8GpjZpJyLSspANGEwWpe09Q',
    CONSTRUCTION: '1elelqh7wwqHgFg5rsfPRM6BHnqLqmmlgzjlpXm122mk',
    PRE_DEV: '14489OIl7NHRt1zPCGrLBa4va1_5P9atYH7pZyzsF8EU',
    PERMANENT_DEBT: '1F6rXTUrexAiPjtMobeLn1RjM8Vy01cjb6blgpW-z8HI',
    OTHER: '1rrVvc5KIq0uz7NZv7_Ytu8h1dcgimAq_v_13Z7Kx9AM',
    // Legacy IDs for reference - can be removed after verification
    WORKING_CAPITAL: '1MZ1W52MApg4-Vv6NHdk9atomByH7VYQ5WfSCxQyGtqw',
    CONSTRUCTION_PLUS: '128EYSDnvbDiiUvQNgLotuG4PzE4L3NXTwv-c94T9fbM',
  }
};

// Phase 2 Template IDs for regulatory documents
const PHASE_2_TEMPLATE_IDS = {
  FORM_C: process.env.FORM_C_TEMPLATE_ID || 'your_form_c_template_id_here',
  PROJECT_SUMMARY: process.env.PROJECT_SUMMARY_TEMPLATE_ID || 'your_project_summary_template_id_here',
  CERTIFICATION_STATEMENT: process.env.CERTIFICATION_STATEMENT_TEMPLATE_ID || 'your_certification_statement_template_id_here',
  PROJECT_CARD: process.env.PROJECT_CARD_TEMPLATE_ID || 'your_project_card_template_id_here',
  FILING_FORM_C: process.env.FILING_FORM_C_TEMPLATE_ID || 'your_filing_form_c_template_id_here'
};

// Project Type Configuration for consistent mapping
const PROJECT_TYPE_CONFIG = {
  'working capital': { id: 'WORKING_CAPITAL', key: 'working_capital', name: 'Working Capital' },
  'pre-development': { id: 'PRE_DEV', key: 'predevelopment', name: 'Pre-Development' },
  'pre-dev': { id: 'PRE_DEV', key: 'predevelopment', name: 'Pre-Development' },
  'predevelopment': { id: 'PRE_DEV', key: 'predevelopment', name: 'Pre-Development' },
  'construction plus': { id: 'CONSTRUCTION_PLUS', key: 'construction_plus', name: 'Construction Plus' },
  'construction': { id: 'CONSTRUCTION', key: 'construction', name: 'Construction' },
  'bridge': { id: 'BRIDGE', key: 'bridge', name: 'Bridge' },
  'permanent debt': { id: 'PERMANENT_DEBT', key: 'permanent_debt', name: 'Permanent Debt' },
  'other': { id: 'OTHER', key: 'other', name: 'Other' },
};

module.exports = {
  TEMPLATE_IDS,
  PHASE_2_TEMPLATE_IDS,
  PROJECT_TYPE_CONFIG
};