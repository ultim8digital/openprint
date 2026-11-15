import { z } from 'zod';
import { currencies, technologies, materials } from './types.js';

export const email = z.string().trim().toLowerCase().email().max(254);
export const password = z
  .string()
  .min(12, 'Use at least 12 characters / Минимум 12 символов')
  .max(128);
export const registration = z.object({ name: z.string().trim().min(2).max(80), email, password });
export const login = z.object({ email, password: z.string().min(1).max(128) });
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const money = z.number().int().min(1).max(100_000_000);
export const profileInput = z
  .object({
    name: text(2, 100),
    kind: z.enum(['studio', 'engineer', 'both']),
    city: text(2, 80),
    description: text(30, 3000),
    technologies: z.array(z.enum(technologies)).min(1).max(technologies.length),
    materials: z.array(z.enum(materials)).min(1).max(materials.length),
    website: z
      .string()
      .trim()
      .max(300)
      .refine(
        (v) =>
          !v ||
          (/^https:\/\//i.test(v) &&
            (() => {
              try {
                const u = new URL(v);
                return !u.username && !u.password;
              } catch {
                return false;
              }
            })()),
        'Use an HTTPS website',
      ),
    lat: z.number().min(-85).max(85).nullable().default(null),
    lng: z.number().min(-180).max(180).nullable().default(null),
    remote: z.boolean().default(false),
  })
  .refine((v) => (v.lat === null) === (v.lng === null), 'Provide both coordinates');
export const jobInput = z
  .object({
    title: text(5, 120),
    description: text(30, 6000),
    kind: z.enum(['print', 'design', 'repair']),
    city: text(2, 80),
    technology: z.enum(['Any', ...technologies]),
    material: z.enum(materials),
    quantity: z.number().int().min(1).max(10000),
    currency: z.enum(currencies),
    budget: money.nullable(),
    deadline: z
      .string()
      .max(10)
      .refine(
        (v) =>
          !v ||
          (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
            !Number.isNaN(Date.parse(v)) &&
            new Date(v).toISOString().slice(0, 10) === v &&
            v >= new Date().toISOString().slice(0, 10)),
        'Choose a future date',
      ),
    visibility: z.enum(['public', 'direct']),
    target_profile_id: z.string().uuid().nullable().default(null),
    file_id: z.string().uuid().nullable().default(null),
  })
  .refine(
    (v) => (v.visibility === 'public' ? !v.target_profile_id : !!v.target_profile_id),
    'Choose a workshop for a direct request',
  )
  .refine(
    (v) =>
      v.technology === 'Any' ||
      v.material === 'Any' ||
      !(
        (v.technology === 'SLA' && !['Resin'].includes(v.material)) ||
        (v.technology === 'FDM' &&
          !['PLA', 'PETG', 'ABS', 'ASA', 'TPU', 'Nylon'].includes(v.material)) ||
        (v.technology === 'SLS' && !['Nylon'].includes(v.material))
      ),
    'Material does not match technology',
  );
export const offerInput = z.object({
  price: money,
  days: z.number().int().min(1).max(365),
  note: text(10, 2000),
});
export const messageInput = z.object({ body: text(1, 4000) });

/** Parse two-decimal currency input without rounding a floating point multiplication. */
export function minorUnits(value: string): number | null {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(normalized))
    throw new Error('Enter a valid amount / Введите сумму с двумя знаками после запятой');
  const [whole, fraction = ''] = normalized.split('.');
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (amount < 1 || amount > 100_000_000)
    throw new Error('Amount is out of range / Сумма вне допустимого диапазона');
  return amount;
}
