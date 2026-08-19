import { mr001 } from "@/core/recovery/rules/mr001";
import { mr002 } from "@/core/recovery/rules/mr002";
import { mr003 } from "@/core/recovery/rules/mr003";
import type { RecoveryRule } from "@/core/recovery/types";

/** The versioned, MVP-approved recovery rules. Order is deterministic. */
export const RECOVERY_RULES: readonly RecoveryRule[] = [mr001, mr002, mr003];

export { mr001, mr002, mr003 };
