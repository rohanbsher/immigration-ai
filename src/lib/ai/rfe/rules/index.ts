import { commonRules } from './common-rules';
import { h1bRules } from './h1b-rules';
import { i130Rules } from './i130-rules';
import { i485Rules } from './i485-rules';
import { i140Rules } from './i140-rules';
import type { RFERule } from '../types';
import type { VisaType } from '@/types';

/** All registered rules. */
export const ALL_RULES: RFERule[] = [
  ...commonRules,
  ...h1bRules,
  ...i130Rules,
  ...i485Rules,
  ...i140Rules,
];

/**
 * Get rules applicable to a specific visa type.
 */
export function getRulesForVisaType(visaType: VisaType): RFERule[] {
  return ALL_RULES.filter((rule) => rule.visaTypes.includes(visaType));
}
