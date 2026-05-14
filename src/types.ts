
export interface BusinessContext {
  sector: string;
  industry: string;
  objective: string;
  problem: string;
  kpis: string;
}

export interface DataRow {
  [key: string]: any;
}

export interface DatasetInfo {
  rows: DataRow[];
  columns: string[];
  types: Record<string, string>;
  missingValues: Record<string, number>;
  dimensions: { rows: number; cols: number };
}

export interface ClusterResult {
  clusterIndex: number;
  name: string;
  description: string;
  insights: string[];
  recommendations: string[];
  color?: string;
}

export interface ClusteringOutput {
  k: number;
  method: string;
  scaler: string;
  assignments: number[];
  centroids: any[];
  clusters: ClusterResult[];
  variables: string[];
}

export interface AnalysisState {
  step: number;
  businessContext: BusinessContext | null;
  dataset: DatasetInfo | null;
  selectedVariables: string[];
  edaData: any | null;
  clustering: ClusteringOutput | null;
  report: string | null;
}
