import { fetchApiJson } from './http';

export interface AiAnalysisSummary {
  total_records: number;
  warehouse_issues: number;
  receiving_issues: number;
  complaints: number;
  open_records: number;
  unassigned_records: number;
}

export interface KeyCount {
  key: string;
  count: number;
}

export interface WordCount {
  word: string;
  count: number;
}

export interface RepeatOrder {
  order_id: string;
  count: number;
}

export interface MonthCount {
  month: string;
  count: number;
}

export interface AiAnalysisPatterns {
  warehouse_categories: KeyCount[];
  receiving_types: KeyCount[];
  complaint_types: KeyCount[];
  assigned_departments: KeyCount[];
  repeat_component_pn: KeyCount[];
  repeat_supplier: KeyCount[];
  repeat_finish_good: KeyCount[];
  repeat_orders: RepeatOrder[];
  warehouse_top_words: WordCount[];
  receiving_top_words: WordCount[];
  complaint_top_words: WordCount[];
}

export interface AiAnalysisTimeline {
  warehouse_issues: MonthCount[];
  receiving_issues: MonthCount[];
  complaints: MonthCount[];
}

export interface AiAnalysisResponse {
  ok: boolean;
  generated_at: string;
  used_openai: boolean;
  local_analysis: {
    engine: string;
    summary: AiAnalysisSummary;
    patterns: AiAnalysisPatterns;
    timeline: AiAnalysisTimeline;
    insights: string[];
    warnings: string[];
    recommended_actions: string[];
  };
  ai_analysis: Record<string, unknown> | null;
}

export async function getAdminAiAnalysis(): Promise<AiAnalysisResponse> {
  return fetchApiJson<AiAnalysisResponse>('/admin/ai-analysis');
}
