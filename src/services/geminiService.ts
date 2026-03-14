import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Recipe {
  id: string;
  title: string;
  description: string;
  ingredients: string[];
  steps: string[];
  cookingTime: string;
  servingSize: string;
  tips: string[];
  category: string;
  imageUrl?: string;
}

const recipeSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "The name of the Kenyan dish." },
    description: { type: Type.STRING, description: "A brief description of the dish." },
    ingredients: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of ingredients with quantities.",
    },
    steps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "5-7 simple step-by-step cooking instructions.",
    },
    cookingTime: { type: Type.STRING, description: "Estimated cooking time (e.g., '30 mins')." },
    servingSize: { type: Type.STRING, description: "Estimated serving size (e.g., '2-4 people')." },
    tips: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "1-3 quick cooking tips.",
    },
    category: {
      type: Type.STRING,
      description: "Category of the dish (e.g., Breakfast, Lunch, Dinner, Snacks, Street food).",
    },
  },
  required: ["title", "description", "ingredients", "steps", "cookingTime", "servingSize", "tips", "category"],
};

export async function generateRecipeByDish(dishName: string): Promise<Recipe> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a simple, quick Kenyan recipe for: ${dishName}. Keep the steps concise (5-7 steps).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: recipeSchema,
      systemInstruction: "You are an expert Kenyan chef. Provide authentic, easy-to-follow recipes for Kenyan cuisine.",
    },
  });

  const data = JSON.parse(response.text || "{}");
  return { ...data, id: crypto.randomUUID() };
}

export async function generateRecipeByIngredients(ingredients: string): Promise<Recipe> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `I have these ingredients: ${ingredients}. Suggest a Kenyan meal I can cook and provide the recipe. Keep the steps concise (5-7 steps).`,
    config: {
      responseMimeType: "application/json",
      responseSchema: recipeSchema,
      systemInstruction: "You are an expert Kenyan chef. Suggest authentic Kenyan meals based on available ingredients and provide easy-to-follow recipes.",
    },
  });

  const data = JSON.parse(response.text || "{}");
  return { ...data, id: crypto.randomUUID() };
}

export async function generateRecipeImage(dishName: string, description: string): Promise<string | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts: [
          {
            text: `A professional, appetizing food photography shot of ${dishName}, a Kenyan dish. ${description}. High quality, well-lit, delicious, served on a beautiful plate.`,
          },
        ],
      },
    });

    if (response.candidates && response.candidates.length > 0) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType || "image/png"};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
}
