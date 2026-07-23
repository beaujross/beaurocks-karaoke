import { REACTION_CATALOG } from './reactionCatalog';

export const REACTION_COSTS = Object.freeze(Object.fromEntries(REACTION_CATALOG.map((reaction) => [reaction.id, reaction.pointCost])));
