import type { AdventureDefinitionIdentity, AdventureObjective } from '../../schema/adventure';
import type { ErrorCard } from '../../schema/error-card';
import type {
  PlayJsonValue,
  PlayJournalEntry,
  PlayMembers,
  PlayPackIdentity,
  PlayRngState,
  PlaySessionSnapshot,
  PlaySettlementReceipt,
} from '../../schema/play-session';
import type { RuntimeEvent } from '../events';
import type { EncounterCommand, EncounterSessionView } from '../play/session';

export type RewardRoll = {
  readonly tableId: string;
  readonly value: PlayJsonValue;
  readonly rngBefore: PlayRngState;
  readonly rngAfter: PlayRngState;
  readonly result:
    { readonly kind: 'item'; readonly itemId: string; readonly qty: number } | { readonly kind: 'no-item' };
};
export type RewardReceipt = {
  readonly receiptId: string;
  readonly adventureId: string;
  readonly definitionHash: string;
  readonly claimId: string;
  readonly nodeId: string;
  readonly rewardId: string;
  readonly revision: number;
  readonly eligibleMemberIds: readonly string[];
  readonly recipientMemberId: string | null;
  readonly xpPerMember: number;
  readonly grants: readonly { readonly memberId: string; readonly itemId: string; readonly qty: number }[];
  readonly beforeMembersHash: string;
  readonly afterMembersHash: string;
};
export type RewardState = {
  readonly claimId: string;
  readonly adventureId: string;
  readonly nodeId: string;
  readonly rewardId: string;
  readonly eligibleMemberIds: readonly string[];
  readonly xpPerMember: number;
  readonly stagedRevision: number;
  readonly roll: RewardRoll | null;
} & ({ readonly status: 'pending' } | { readonly status: 'claimed'; readonly receipt: RewardReceipt });
export type AdventureSnapshot = {
  readonly kind: 'adventure';
  readonly snapshotVersion: 1;
  readonly pack: PlayPackIdentity;
  readonly definition: AdventureDefinitionIdentity;
  readonly adventureId: string;
  readonly revision: number;
  readonly seed: string;
  readonly nodeId: string;
  readonly phase: 'exploration' | 'encounter' | 'reward-pending' | 'completed' | 'defeated' | 'abandoned';
  readonly visitedNodeIds: readonly string[];
  readonly resolvedNodeIds: readonly string[];
  readonly choiceTrail: readonly {
    readonly nodeId: string;
    readonly choiceId: string;
    readonly toNodeId: string;
    readonly revision: number;
  }[];
  readonly restedNodeIds: readonly string[];
  readonly members: PlayMembers;
  readonly activeEncounter: PlaySessionSnapshot | null;
  readonly encounterReceipts: readonly { readonly nodeId: string; readonly receipt: PlaySettlementReceipt }[];
  readonly rng: {
    readonly generation: PlayRngState;
    readonly play: PlayRngState;
    readonly rewards: PlayRngState;
    readonly director: PlayRngState;
  };
  readonly rewards: readonly RewardState[];
  readonly sequence: number;
  readonly journal: readonly PlayJournalEntry[];
  readonly encounterEventCursor: number;
  readonly director: {
    readonly policy: { readonly id: string; readonly version: number };
    readonly decisions: number;
    readonly stalledSteps: number;
    readonly lastMechanicalHash: string | null;
  };
  readonly narrationAck: number;
};
export type AdventureCommand = {
  readonly adventureId: string;
  readonly expectedRevision: number;
} & (
  | { readonly type: 'choose'; readonly nodeId: string; readonly choiceId: string }
  | { readonly type: 'abandon' }
  | { readonly type: 'ack-narration'; readonly throughSequence: number }
  | {
      readonly type: 'claim-reward';
      readonly nodeId: string;
      readonly rewardId: string;
      readonly claimId: string;
      readonly recipientMemberId?: string;
    }
  | { readonly type: 'rest'; readonly nodeId: string }
  | {
      readonly type: 'prepare';
      readonly nodeId: string;
      readonly memberId: string;
      readonly spellId: string;
      readonly slotIndex?: number;
    }
  | {
      readonly type: 'equip';
      readonly nodeId: string;
      readonly memberId: string;
      readonly itemId: string;
      readonly slot: string;
    }
  | { readonly type: 'unequip'; readonly nodeId: string; readonly memberId: string; readonly slot: string }
  | { readonly type: 'use-item'; readonly nodeId: string; readonly memberId: string; readonly itemId: string }
  | {
      readonly type: 'encounter';
      readonly encounterId: string;
      readonly command: Exclude<EncounterCommand, { readonly type: 'next' }>;
    }
);
export type AdventureView = {
  readonly adventureId: string;
  readonly revision: number;
  readonly phase: AdventureSnapshot['phase'];
  readonly nodeId: string;
  readonly objective: AdventureObjective;
  readonly members: EncounterSessionView['members'];
  readonly combat: EncounterSessionView['combat'] | null;
  readonly choices: readonly {
    readonly choiceId: string;
    readonly text: string;
    readonly toNodeId: string;
    readonly available: boolean;
    readonly reason: ErrorCard | null;
  }[];
  readonly pendingRewards: readonly Pick<
    RewardState,
    'claimId' | 'nodeId' | 'rewardId' | 'eligibleMemberIds' | 'roll'
  >[];
  readonly availableCommands: readonly AdventureCommand['type'][];
  readonly journalSequence: number;
  readonly narrationAck: number;
};
export type AdventureCommandResult =
  | {
      readonly ok: true;
      readonly revision: number;
      readonly events: readonly PlayJournalEntry[];
      readonly view: AdventureView;
      readonly receipt?: RewardReceipt;
    }
  | {
      readonly ok: false;
      readonly revision: number;
      readonly errors: readonly ErrorCard[];
      readonly events: readonly [];
      readonly view: AdventureView;
    };
export interface Adventure {
  view(): AdventureView;
  dispatch(command: AdventureCommand): AdventureCommandResult;
  serialize(): AdventureSnapshot;
}

export type SoloResult = {
  readonly reason:
    | 'awaiting-player'
    | 'awaiting-choice'
    | 'completed'
    | 'defeated'
    | 'abandoned'
    | 'budget-exhausted'
    | 'stalled';
  readonly stepsUsed: number;
  readonly events: readonly PlayJournalEntry[];
  readonly view: AdventureView;
};

export type NarrationMessage = {
  readonly messageId: string;
  readonly sequence: number;
  readonly templateId: string | null;
  readonly event: RuntimeEvent;
  readonly text: string;
};
