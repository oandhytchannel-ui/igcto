/**
 * AI Provider Abstraction Interface.
 * Isolates specific AI model integrations behind a clean, swapable contract.
 */

export interface AIModelOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

export interface AIProvider {
  /**
   * Generates a conversational text response based on the input prompt.
   */
  generateText(prompt: string, options?: AIModelOptions): Promise<string>;

  /**
   * Generates a structured response parsing into a JSON object matching an optional validation.
   */
  generateStructuredJSON<T>(prompt: string, options?: AIModelOptions): Promise<T>;

  /**
   * Returns metadata about the provider (e.g. name, model version).
   */
  getProviderMetadata(): { providerName: string; modelName: string };
}
