import { GoogleGenAI, Type } from "@google/genai";

export interface AIPriceEstimate {
  low: number;
  mid: number;
  high: number;
  explanation: string;
}

export interface AITraitSuggestion {
  suggestion: string;
}

export interface AICollectionSummary {
  summary: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const aiService = {
  async getPriceEstimate(nftData: any): Promise<AIPriceEstimate> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `As an AI NFT analyst, estimate a price range for this Sui Genesis NFT.
        Traits: ${JSON.stringify(nftData.traits)}
        Rarity Score: ${nftData.rarityScore}
        Recent Sales Data: ${JSON.stringify(nftData.recentSales)}
        Current Floor Price: ${nftData.floorPrice} SUI
        
        Return a JSON object with: low (number), mid (number), high (number), explanation (string).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              low: { type: Type.NUMBER },
              mid: { type: Type.NUMBER },
              high: { type: Type.NUMBER },
              explanation: { type: Type.STRING },
            },
            required: ["low", "mid", "high", "explanation"],
          },
        },
      });

      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("AI Price Estimation failed:", error);
      throw new Error("AI Price Estimation failed");
    }
  },

  async getTraitSuggestion(distributionData: any): Promise<AITraitSuggestion> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `As an AI NFT advisor, suggest which traits a collector should look for based on this distribution: ${JSON.stringify(distributionData.distribution)}. Explain why in a conversational paragraph.
        Return a JSON object with: suggestion (string).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              suggestion: { type: Type.STRING },
            },
            required: ["suggestion"],
          },
        },
      });

      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("AI Trait Suggestion failed:", error);
      throw new Error("AI Trait Suggestion failed");
    }
  },

  async getCollectionSummary(metrics: any): Promise<AICollectionSummary> {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `As an AI collection analyst, provide a brief health summary of this NFT collection based on these metrics: ${JSON.stringify(metrics)}. Focus on holder conviction and price momentum.
        Return a JSON object with: summary (string).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
            },
            required: ["summary"],
          },
        },
      });

      return JSON.parse(response.text || "{}");
    } catch (error) {
      console.error("AI Collection Summary failed:", error);
      throw new Error("AI Collection Summary failed");
    }
  },
};
