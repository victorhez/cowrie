//! cowrie-credential: soulbound savings-history credentials.
//!
//! NEP-171 style read interface (`nft_token`, `nft_tokens_for_owner`, `nft_supply_for_owner`,
//! `nft_total_supply`, `nft_metadata`) with transfers permanently disabled. Only the
//! registered minter (the circle contract) can mint. Each credential records the circle,
//! rounds, on-time count and defaults of one member.

use near_sdk::json_types::U128;
use near_sdk::serde::Serialize;
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{env, near, require, AccountId, BorshStorageKey, PanicOnDefault};

#[derive(BorshStorageKey)]
#[near(serializers = [borsh])]
enum Key {
    Tokens,
    ByOwner,
}

#[derive(Clone)]
#[near(serializers = [borsh, json])]
pub struct Credential {
    pub token_id: String,
    pub owner_id: AccountId,
    pub circle: String,
    pub rounds: u32,
    pub on_time: u32,
    pub defaults: u32,
    pub issued_at: u64,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct NftToken {
    pub token_id: String,
    pub owner_id: AccountId,
    pub metadata: TokenMetadata,
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct TokenMetadata {
    pub title: String,
    pub description: String,
    pub extra: String,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    minter: AccountId,
    owner: AccountId,
    tokens: IterableMap<String, Credential>,
    by_owner: LookupMap<AccountId, Vec<String>>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(minter: AccountId) -> Self {
        Self {
            minter,
            owner: env::predecessor_account_id(),
            tokens: IterableMap::new(Key::Tokens),
            by_owner: LookupMap::new(Key::ByOwner),
        }
    }

    /// The owner can point the credential at a new circle contract (needed once, after deploy).
    pub fn set_minter(&mut self, minter: AccountId) {
        require!(env::predecessor_account_id() == self.owner, "owner only");
        self.minter = minter;
    }

    /// Only the registered minter can call this. Minting is the only way a credential exists.
    pub fn mint(&mut self, circle: String, member: AccountId, rounds: u32, on_time: u32, defaults: u32) {
        require!(env::predecessor_account_id() == self.minter, "only the registered circle contract can mint");
        let token_id = format!("{}:{}", circle, member);
        require!(!self.tokens.contains_key(&token_id), "already minted");
        let c = Credential {
            token_id: token_id.clone(),
            owner_id: member.clone(),
            circle,
            rounds,
            on_time,
            defaults,
            issued_at: env::block_timestamp() / 1_000_000_000,
        };
        self.tokens.insert(token_id.clone(), c);
        let mut v = self.by_owner.get(&member).cloned().unwrap_or_default();
        v.push(token_id);
        self.by_owner.insert(member, v);
    }

    /// Soulbound: transfers are disabled for everyone, forever.
    #[payable]
    pub fn nft_transfer(&mut self, receiver_id: AccountId, token_id: String, approval_id: Option<u64>, memo: Option<String>) {
        let _ = (receiver_id, token_id, approval_id, memo);
        env::panic_str("soulbound: credentials cannot be transferred");
    }

    pub fn nft_total_supply(&self) -> U128 {
        U128(self.tokens.len() as u128)
    }

    pub fn nft_supply_for_owner(&self, account_id: AccountId) -> U128 {
        U128(self.by_owner.get(&account_id).map(|v| v.len()).unwrap_or(0) as u128)
    }

    pub fn nft_token(&self, token_id: String) -> Option<NftToken> {
        self.tokens.get(&token_id).map(Self::to_nft)
    }

    pub fn nft_tokens_for_owner(&self, account_id: AccountId, from_index: Option<U128>, limit: Option<u64>) -> Vec<NftToken> {
        let from = from_index.map(|x| x.0 as usize).unwrap_or(0);
        let limit = limit.unwrap_or(50) as usize;
        self.by_owner
            .get(&account_id)
            .map(|ids| ids.iter().skip(from).take(limit).filter_map(|id| self.tokens.get(id)).map(Self::to_nft).collect())
            .unwrap_or_default()
    }

    // ---------------------------------------------------------- Cowrie extensions

    pub fn credential_count(&self, account_id: AccountId) -> u32 {
        self.by_owner.get(&account_id).map(|v| v.len() as u32).unwrap_or(0)
    }

    pub fn credentials_of(&self, account_id: AccountId) -> Vec<Credential> {
        self.by_owner
            .get(&account_id)
            .map(|ids| ids.iter().filter_map(|id| self.tokens.get(id)).cloned().collect())
            .unwrap_or_default()
    }

    /// Cowrie Score 0..1000. Formula in docs/RULES.md, identical to cowrieScore() in the TypeScript engine.
    pub fn score(&self, account_id: AccountId) -> u32 {
        let creds = self.credentials_of(account_id);
        score_of(creds.iter().map(|c| (c.rounds, c.on_time, c.defaults)))
    }

    pub fn minter(&self) -> AccountId {
        self.minter.clone()
    }

    fn to_nft(c: &Credential) -> NftToken {
        NftToken {
            token_id: c.token_id.clone(),
            owner_id: c.owner_id.clone(),
            metadata: TokenMetadata {
                title: format!("Cowrie credential: circle {}", c.circle),
                description: "Non-transferable record of a completed savings circle".to_string(),
                extra: format!("{{\"rounds\":{},\"on_time\":{},\"defaults\":{}}}", c.rounds, c.on_time, c.defaults),
            },
        }
    }
}

/// score = round(1000 * max(0, 0.7*rate + 0.3*volume - penalty)), integer-only
/// so the contract and the TypeScript engine agree without floating point drift.
pub fn score_of(creds: impl Iterator<Item = (u32, u32, u32)>) -> u32 {
    let (mut rounds, mut on_time, mut defaults, mut any) = (0u64, 0u64, 0u64, false);
    for (r, o, d) in creds {
        rounds += r as u64;
        on_time += o as u64;
        defaults += d as u64;
        any = true;
    }
    if !any || rounds == 0 {
        return 0;
    }
    // work in 1e6 fixed point
    let rate = on_time * 1_000_000 / rounds;
    let volume = (rounds * 1_000_000 / 30).min(1_000_000);
    let penalty = (defaults * 100_000).min(500_000);
    let v = (700_000 * rate + 300_000 * volume) / 1_000_000;
    let v = v.saturating_sub(penalty);
    ((v * 1000 + 500_000) / 1_000_000) as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    fn ctx(pred: AccountId) -> VMContextBuilder {
        let mut b = VMContextBuilder::new();
        b.predecessor_account_id(pred);
        b
    }

    #[test]
    fn only_minter_mints_and_transfers_are_disabled() {
        testing_env!(ctx(accounts(0)).build());
        let mut c = Contract::new(accounts(1));
        testing_env!(ctx(accounts(1)).build());
        c.mint("7".into(), accounts(2), 5, 5, 0);
        assert_eq!(c.credential_count(accounts(2)), 1);
        assert_eq!(c.score(accounts(2)), 750); // 0.7 * 1 + 0.3 * (5/30) = 0.75
    }

    #[test]
    #[should_panic(expected = "only the registered circle contract can mint")]
    fn others_cannot_mint() {
        testing_env!(ctx(accounts(0)).build());
        let mut c = Contract::new(accounts(1));
        testing_env!(ctx(accounts(3)).build());
        c.mint("7".into(), accounts(2), 5, 5, 0);
    }

    #[test]
    #[should_panic(expected = "soulbound")]
    fn transfer_always_fails() {
        testing_env!(ctx(accounts(0)).build());
        let mut c = Contract::new(accounts(1));
        testing_env!(ctx(accounts(2)).build());
        c.nft_transfer(accounts(3), "x".into(), None, None);
    }

    #[test]
    fn score_matches_formula() {
        assert_eq!(score_of(std::iter::empty()), 0);
        // three clean 10-round circles: rate 1, volume 1 -> 1000
        assert_eq!(score_of(vec![(10, 10, 0); 3].into_iter()), 1000);
        // 3 circles, 21/30 on time, 3 defaults: 0.7*0.7 + 0.3*1 - 0.3 = 0.49 -> 490
        assert_eq!(score_of(vec![(10, 7, 1); 3].into_iter()), 490);
    }
}
