import { GoogleGenAI, Type } from "@google/genai";
import mime from "mime";
import { writeFile } from "fs";

function saveBinaryFile(fileName: string, content: Buffer) {
  writeFile(fileName, content, "utf8", (err) => {
    if (err) {
      console.error(`Error writing file ${fileName}:`, err);
      return;
    }
    console.log(`File ${fileName} saved to file system.`);
  });
}

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
});

export async function nanobanana(prompt: string, imageBuffer: Buffer) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-image-preview",
    config: {
      responseModalities: ["IMAGE"],
    },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `${prompt}`,
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: imageBuffer.toString("base64"),
            },
          },
        ],
      },
    ],
  });

  for (const part of response.candidates?.[0]?.content?.parts ?? []) {
    if (part.text) {
      console.log(part.text);
    } else if (part.inlineData) {
      const imageData = part.inlineData.data as string;
      return {
        type: "image",
        base64ImageData: imageData,
        contentType: part.inlineData.mimeType,
      };
    }
  }
  return { type: "text", data: response.text };
}

export async function generatePosesFromImage(
  buffer: Buffer,
  mimeType: string,
  numPoses: number
) {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Analyze the attached image and create ${numPoses} sequential poses for a smooth stop-motion animation. 

For the character/object in the image:
1. Identify the main subject and its current pose/position
2. Create a natural progression of poses that would work well for stop-motion
3. Consider realistic movement constraints and physics
4. Ensure each pose flows logically to the next
5. Include subtle variations in positioning, rotation, and expression if applicable

Each pose should be described clearly with specific details about:
- Body position and posture
- Limb placement and angles
- Facial expression (if visible)
- Any prop or object positioning
- Direction of movement or gaze

Make the poses suitable for creating engaging, fluid stop-motion animation.`,
          },
          {
            inlineData: {
              mimeType,
              data: buffer.toString("base64"),
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction:
        "You are an expert stop-motion animator with deep knowledge of animation principles, character movement, and physics. When analyzing images, you understand how to break down complex movements into frame-by-frame poses that create smooth, believable animation. You consider factors like anticipation, squash and stretch, timing, and natural motion arcs. Your pose descriptions are precise, actionable, and optimized for stop-motion production workflows.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            pose: {
              type: Type.STRING,
              description: "A single pose for the character.",
            },
          },
          required: ["pose"],
        },
      },
    },
  });

  console.log(response);
  return response.text;
}

export async function generatePosesFromImageBuffer(
  buffer: Buffer,
  mimeType: string,
  numPoses: number
) {
  return generatePosesFromImage(buffer, mimeType, numPoses);
}

export async function generatePosesFromImageUrl(
  imageUrl: string,
  numPoses: number
) {
  // Fetch the image data from the URL
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
  }
  const imageBuffer = await imageResponse.arrayBuffer();
  const buffer = Buffer.from(imageBuffer);
  const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";

  return generatePosesFromImage(buffer, mimeType, numPoses);
}
