import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, payload } = req.body;

    if (action === 'getBusinessInsights') {
      const { context } = payload;
      const prompt = `
        Based on the following business context:
        Sector: ${context.sector}
        Industry: ${context.industry}
        Objective: ${context.objective}
        Business Problem: ${context.problem}
        Key KPIs: ${context.kpis}

        Generate a detailed analysis in JSON format with the following structure:
        {
          "executiveSummary": "string",
          "initialHypotheses": ["string"],
          "analyticalObjectives": ["string"],
          "potentialBusinessDecisions": ["string"]
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING },
              initialHypotheses: { type: Type.ARRAY, items: { type: Type.STRING } },
              analyticalObjectives: { type: Type.ARRAY, items: { type: Type.STRING } },
              potentialBusinessDecisions: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["executiveSummary", "initialHypotheses", "analyticalObjectives", "potentialBusinessDecisions"]
          }
        }
      });
      return res.status(200).json(JSON.parse(response.text || "{}"));
    }

    if (action === 'getClusterInterpretation') {
      const { context, clustering, datasetSummary } = payload;
      const prompt = `
        Context: ${context.objective} in ${context.industry}.
        Data Summary: ${datasetSummary}
        
        Clustering Method: ${clustering.method} with K=${clustering.k}.
        Variables Used: ${clustering.variables.join(", ")}
        Centroids Data (normalized): ${JSON.stringify(clustering.centroids)}
        These centroids represent the average profile of each cluster.

        Task: Analyze the centroids to name and describe each cluster uniquely. 
        Return a JSON array of objects, one per cluster:
        {
          "clusterIndex": number,
          "name": "Creative business name based on centroid characteristics",
          "description": "Short behavioral description explaining WHY this name was chosen based on data",
          "insights": ["Specific insight about this group's behavior", "Potential opportunity found in the centroid data"],
          "recommendations": ["Strategy for Growth", "Specific improvement action for this group", "How to mitigate their weaknesses"],
          "color": "Tailwind color name like 'blue', 'emerald', 'amber', 'rose', 'purple'"
        }
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                clusterIndex: { type: Type.NUMBER },
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                insights: { type: Type.ARRAY, items: { type: Type.STRING } },
                recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                color: { type: Type.STRING }
              },
              required: ["clusterIndex", "name", "description", "insights", "recommendations", "color"]
            }
          }
        }
      });
      return res.status(200).json(JSON.parse(response.text || "[]"));
    }

    if (action === 'generateFinalReport') {
      const { context, dataset, clustering, insights } = payload;
      const prompt = `
        Generate a very detailed professional Markdown report for a clustering analysis.
        Business Context: ${JSON.stringify(context)}
        Dataset: ${dataset.dimensions.rows} rows analyzed.
        Methodology: ${clustering.method} with ${clustering.scaler} normalization.
        Clusters profiles: ${JSON.stringify(insights)}

        The report MUST be comprehensive and use advanced business Spanish (Castilian/LatAm professional).
        Structure:
        1. # Informe Ejecutivo de Segmentación Estratégica: ${context.industry}
        2. ## Resumen Gerencial (Highlighting the main transformation)
        3. ## Metodología y Calidad de Datos
        4. ## Perfilamiento Detallado de Segmentos
           - For each cluster: Use a table or structured list showing Name, Dominant Characteristics (referencing the centroids), and Strategic Value.
        5. ## Matriz de Recomendaciones de Mejora
           - A section dedicated to "Acciones de Mejora" with a table showing: Grupo | Plan de Acción | KPI de Éxito.
        6. ## Conclusiones Estratégicas

        Use bolding, lists, and tables. Make it look like it was written by a top-tier consulting firm.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });
      return res.status(200).json({ text: response.text || "" });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
