import { generatePosesFromImageBuffer, nanobanana } from "@/lib/ai";
import { uploadToBlob } from "@/lib/blob";
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 800;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const image = formData.get("image") as File | null;

  if (!image) {
    return NextResponse.json({ error: "No image provided" }, { status: 400 });
  }

  // Create a streaming response
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      try {
        // Upload the image to blob storage
        // const uploadResult = await uploadToBlob(image);
        // console.log("Upload result:", uploadResult);

        const buffer = Buffer.from(await image.arrayBuffer());
        const poses = await generatePosesFromImageBuffer(buffer, image.type, 12);

        // Stream the poses array after generation
        const posesData =
          JSON.stringify({ type: "poses", data: poses }) +
          "\n---CHUNK_END---\n";
        controller.enqueue(encoder.encode(posesData));

        // Parse poses as JSON
        const posesJson = JSON.parse(poses ?? "[]");

        if (Array.isArray(posesJson)) {
          for (const pose of posesJson) {
            const prompt = `Transform the character/object in the attached image to match this specific pose for stop-motion animation:

${pose.pose}

Requirements:
- Maintain the same character/object identity and visual style
- Apply the pose description precisely while keeping proportions realistic
- Preserve lighting and background elements from the original
- Ensure the transformation looks natural and suitable for frame-by-frame animation
- Keep image quality high and details sharp for stop-motion production

Generate a clean, production-ready frame that matches the pose description exactly.`;

            // Generate nanobanana response
            const nanobananaResult = await nanobanana(prompt, buffer);
            if (nanobananaResult.type === "image") {
              const resultData =
                JSON.stringify({
                  type: "nanobanana",
                  data: {
                    type: "image",
                    base64ImageData: nanobananaResult.base64ImageData,
                    contentType: nanobananaResult.contentType,
                  },
                }) + "\n---CHUNK_END---\n";
              controller.enqueue(encoder.encode(resultData));
            }
          }
        }

        // End the stream
        const endData =
          JSON.stringify({ type: "complete", data: "Processing finished" }) +
          "\n---CHUNK_END---\n";
        controller.enqueue(encoder.encode(endData));
        controller.close();
      } catch (error) {
        console.error("Error in streaming:", error);
        const errorData =
          JSON.stringify({
            type: "error",
            data: error instanceof Error ? error.message : "Unknown error",
          }) + "\n---CHUNK_END---\n";
        controller.enqueue(encoder.encode(errorData));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/json",
      "Transfer-Encoding": "chunked",
    },
  });
}
