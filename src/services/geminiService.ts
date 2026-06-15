import { GoogleGenAI, Type } from "@google/genai";
import { BusinessData, SearchParams } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function scrapeBusinesses(params: SearchParams, batchSize: number = 20): Promise<BusinessData[]> {
  const { category, country, state, city } = params;
  const location = city ? `${city}, ${state}, ${country}` : `${state}, ${country}`;
  
  const prompt = `Find ${batchSize} real, unique businesses in the category "${category}" located in "${location}". 
  Provide a diverse list. For each business, extract:
  - Name of Organisation
  - Business Category
  - Country
  - State
  - City
  - Name of a key Person (e.g. Owner, Manager, Director)
  - Contact Number (Phone)
  - Email address
  - Physical Address
  - Website URL
  
  Only return real, verifiable businesses. If you cannot find a specific field, leave it null. 
  Ensure the data is accurate and structured correctly.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              category: { type: Type.STRING },
              country: { type: Type.STRING },
              state: { type: Type.STRING },
              city: { type: Type.STRING },
              contactPerson: { type: Type.STRING, nullable: true },
              phone: { type: Type.STRING, nullable: true },
              email: { type: Type.STRING, nullable: true },
              address: { type: Type.STRING, nullable: true },
              website: { type: Type.STRING, nullable: true },
            },
            required: ["name", "category", "country", "state", "city"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];
    
    const data = JSON.parse(text);
    return data.map((item: any, index: number) => ({
      ...item,
      id: `${Date.now()}-${index}`,
    }));
  } catch (error) {
    console.error("Error scraping businesses:", error);
    throw error;
  }
}
