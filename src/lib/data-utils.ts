
import { kmeans } from 'ml-kmeans';

export function calculateCorrelation(data: any[], keys: string[]) {
  const n = data.length;
  const matrix: number[][] = [];

  for (let i = 0; i < keys.length; i++) {
    matrix[i] = [];
    for (let j = 0; j < keys.length; j++) {
      if (i === j) {
        matrix[i][j] = 1;
        continue;
      }
      
      const x = data.map(d => Number(d[keys[i]]) || 0);
      const y = data.map(d => Number(d[keys[j]]) || 0);
      
      const muX = x.reduce((a, b) => a + b, 0) / n;
      const muY = y.reduce((a, b) => a + b, 0) / n;
      
      let num = 0;
      let denX = 0;
      let denY = 0;
      
      for (let k = 0; k < n; k++) {
        const dx = x[k] - muX;
        const dy = y[k] - muY;
        num += dx * dy;
        denX += dx * dx;
        denY += dy * dy;
      }
      
      matrix[i][j] = num / Math.sqrt(denX * denY);
    }
  }
  return matrix;
}

export function normalizeData(data: any[], keys: string[], method: 'standard' | 'minmax') {
  const result = data.map(d => ({ ...d }));
  
  keys.forEach(key => {
    const vals = data.map(d => Number(d[key]) || 0);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length);
    
    result.forEach((d, i) => {
      if (method === 'minmax') {
        d[key] = max === min ? 0 : (Number(d[key]) - min) / (max - min);
      } else {
        d[key] = std === 0 ? 0 : (Number(d[key]) - mean) / std;
      }
    });
  });
  
  return result;
}

export function performClustering(data: any[], keys: string[], k: number) {
  const vectors = data.map(d => keys.map(k => Number(d[k]) || 0));
  const res = kmeans(vectors, k, {});
  
  return {
    assignments: res.clusters,
    centroids: res.centroids.map((c: any) => {
      const obj: any = {};
      const centroidValues = Array.isArray(c) ? c : c.centroid;
      keys.forEach((key, i) => {
        obj[key] = centroidValues[i];
      });
      return obj;
    }),
    k
  };
}
