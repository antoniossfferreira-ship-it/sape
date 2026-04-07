'use server';
/**
 * @fileOverview This flow identifies gaps between a user's self-assessed and expected competency levels
 * and generates personalized course recommendations from a catalog, including explanations for each recommendation.
 *
 * - generatePersonalizedCourseRecommendations - The main function to generate course recommendations.
 * - GeneratePersonalizedCourseRecommendationsInput - The input type for the recommendation function.
 * - GeneratePersonalizedCourseRecommendationsOutput - The return type for the recommendation function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const CompetencyInputSchema = z.object({
  id: z.string().describe('The unique identifier for the competency.'),
  name: z.string().describe('The name of the competency.'),
  currentLevel: z.number().min(1).max(3).describe('The user\'s current self-assessed level for this competency (1-3).'),
  expectedLevel: z.number().min(1).max(3).describe('The expected level for this competency (1-3).'),
});

const CourseCatalogInputSchema = z.object({
  id: z.string().describe('The unique identifier for the course.'),
  name: z.string().describe('The name of the course.'),
  description: z.string().describe('A brief description of the course.'),
  link: z.string().url().describe('The URL to access more information or enroll in the course.'),
  competencyIds: z.array(z.string()).describe('An array of competency IDs that this course helps to develop.'),
  workApplication: z.string().optional().describe('Practical application of the course content in the daily work context.'),
  microActions: z.array(z.string()).optional().describe('Small, actionable steps the user can take immediately (microlearning).'),
  andragogyTags: z.array(z.string()).optional().describe('Tags related to adult learning principles.'),
  gapRationaleTemplate: z.string().optional().describe('A template or base text to explain why this course addresses the gap.'),
});

export const GeneratePersonalizedCourseRecommendationsInputSchema = z.object({
  competencies: z.array(CompetencyInputSchema).describe('The user\'s self-assessed and expected competency levels.'),
  courses: z.array(CourseCatalogInputSchema).describe('The catalog of available courses, including their associated competencies.'),
});
export type GeneratePersonalizedCourseRecommendationsInput = z.infer<typeof GeneratePersonalizedCourseRecommendationsInputSchema>;

const RecommendationOutputSchema = z.object({
  competencyId: z.string().describe('The ID of the competency for which the course is recommended.'),
  competencyName: z.string().describe('The name of the competency.'),
  expectedLevel: z.number().min(1).max(3).describe('The expected level for this competency.'),
  currentLevel: z.number().min(1).max(3).describe('The user\'s current self-assessed level for this competency.'),
  gap: z.number().describe('The difference between expected and current level (expected - current).'),
  courseId: z.string().describe('The ID of the recommended course.'),
  courseName: z.string().describe('The name of the recommended course.'),
  courseDescription: z.string().describe('A brief description of the recommended course.'),
  courseLink: z.string().url().describe('The URL to the recommended course.'),
  explanation: z.string().describe('A brief explanation of why this course is recommended for this specific competency gap.'),
  workApplication: z.string().optional().describe('How to apply this specifically in the workplace.'),
  microActions: z.array(z.string()).optional().describe('Actionable micro-steps.'),
});

export const GeneratePersonalizedCourseRecommendationsOutputSchema = z.object({
  recommendations: z.array(RecommendationOutputSchema).describe('A list of personalized course recommendations.'),
});
export type GeneratePersonalizedCourseRecommendationsOutput = z.infer<typeof GeneratePersonalizedCourseRecommendationsOutputSchema>;

const personalizedCourseRecommendationsPrompt = ai.definePrompt({
  name: 'personalizedCourseRecommendationsPrompt',
  input: { schema: GeneratePersonalizedCourseRecommendationsInputSchema },
  output: { schema: GeneratePersonalizedCourseRecommendationsOutputSchema },
  prompt: `You are an expert career counselor specializing in professional development for university administrative staff. Your goal is to help users identify competency gaps and recommend relevant courses from a given catalog.

Here are the user's current and expected competency levels:
{{#each competencies}}
  - Competency ID: {{id}}, Name: {{name}}, Current Level: {{currentLevel}}, Expected Level: {{expectedLevel}}
{{/each}}

Here is the catalog of available courses:
{{#each courses}}
  - Course ID: {{id}}, Name: {{name}}, Description: {{description}}, Link: {{link}}, Addresses Competencies: {{#each competencyIds}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}
  {{#if workApplication}}- Work Application: {{workApplication}}{{/if}}
  {{#if microActions}}- Micro-actions: {{#each microActions}}{{this}}{{#unless @last}}, {{/unless}}{{/each}}{{/if}}
{{/each}}

Analyze the user's competencies. For each competency where the current level is below the expected level (i.e., there is a gap), identify suitable courses from the catalog that can help address this gap.
For each recommendation, provide a brief, clear explanation. If the course has a workApplication or microActions, include them or adapt them in the response to make it more relevant to adult learning (andragogy).

Provide the recommendations in a structured JSON format as described by the output schema.`,
});

const generatePersonalizedCourseRecommendationsFlow = ai.defineFlow(
  {
    name: 'generatePersonalizedCourseRecommendationsFlow',
    inputSchema: GeneratePersonalizedCourseRecommendationsInputSchema,
    outputSchema: GeneratePersonalizedCourseRecommendationsOutputSchema,
  },
  async (input) => {
    const { output } = await personalizedCourseRecommendationsPrompt(input);
    return output!;
  }
);

export async function generatePersonalizedCourseRecommendations(
  input: GeneratePersonalizedCourseRecommendationsInput
): Promise<GeneratePersonalizedCourseRecommendationsOutput> {
  return generatePersonalizedCourseRecommendationsFlow(input);
}
