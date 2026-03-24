import { z } from 'zod';

export const businessSchema = z.object({
  name: z.string().min(1, 'Business name is required').max(100),
  template: z.enum([
    'ecommerce', 'freelance', 'saas', 'retail',
    'content-creator', 'professional', 'custom',
  ], { required_error: 'Select a business type' }),
  industry: z.string().optional(),
  locale: z.string().min(1, 'Language is required'),
  currency: z.string().min(1, 'Currency is required'),
  timezone: z.string().min(1, 'Timezone is required'),
});

export const teamMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['owner', 'operator', 'marketer', 'finance', 'viewer']),
});

export const teamSchema = z.array(teamMemberSchema);

export function validateStep(step: number, data: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (step) {
    case 0: {
      const result = businessSchema.safeParse(data);
      if (!result.success) {
        result.error.errors.forEach((e) => errors.push(e.message));
      }
      break;
    }
    case 1: {
      // Team is optional — no required validation
      break;
    }
    case 2:
    case 3:
    case 4:
      // Agents, ERP, Integrations — all optional toggles
      break;
    case 5:
      // Review step — no additional validation
      break;
  }

  return { valid: errors.length === 0, errors };
}
