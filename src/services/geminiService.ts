import { BusinessContext, ClusteringOutput, DatasetInfo } from "../types";

export async function getBusinessInsights(context: BusinessContext) {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getBusinessInsights', payload: { context } })
  });
  if (!response.ok) throw new Error('Failed to fetch business insights');
  return response.json();
}

export async function getClusterInterpretation(
  context: BusinessContext, 
  clustering: ClusteringOutput,
  datasetSummary: string
) {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getClusterInterpretation', payload: { context, clustering, datasetSummary } })
  });
  if (!response.ok) throw new Error('Failed to fetch cluster interpretation');
  return response.json();
}

export async function generateFinalReport(
  context: BusinessContext,
  dataset: DatasetInfo,
  clustering: ClusteringOutput,
  insights: any
) {
  const response = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'generateFinalReport', payload: { context, dataset, clustering, insights } })
  });
  if (!response.ok) throw new Error('Failed to generate final report');
  const data = await response.json();
  return data.text;
}
