import { createApp } from "../src/server/app.js";

// Initialize the Express app asynchronously
const appPromise = createApp();

// Export the Vercel serverless handler
export default async function handler(req: any, res: any) {
  const app = await appPromise;
  return app(req, res);
}
