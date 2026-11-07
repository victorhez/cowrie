//! mock-usdc: a NEP-141 test token with 6 decimals and a capped public faucet,
//! so every demo and test is reproducible. TEST TOKEN ONLY: it has no value.

use near_contract_standards::fungible_token::metadata::{FungibleTokenMetadata, FungibleTokenMetadataProvider, FT_METADATA_SPEC};
use near_contract_standards::fungible_token::{FungibleToken, FungibleTokenCore, FungibleTokenResolver};
use near_contract_standards::storage_management::{StorageBalance, StorageBalanceBounds, StorageManagement};
use near_sdk::json_types::U128;
use near_sdk::{near, require, AccountId, BorshStorageKey, NearToken, PanicOnDefault, PromiseOrValue};

const FAUCET_CAP: u128 = 10_000 * 1_000_000; // 10,000 mock-usdc per account, lifetime

#[derive(BorshStorageKey)]
#[near(serializers = [borsh])]
enum Key {
    Token,
    Minted,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    token: FungibleToken,
    minted: near_sdk::store::LookupMap<AccountId, u128>,
}

#[near]
impl Contract {
    #[init]
    pub fn new() -> Self {
        Self { token: FungibleToken::new(Key::Token), minted: near_sdk::store::LookupMap::new(Key::Minted) }
    }

    /// Public faucet: mints up to 10,000 mock-usdc per account over its lifetime.
    /// Registers the account for storage if needed (the contract pays; testnet only).
    pub fn faucet(&mut self, account_id: AccountId, amount: U128) {
        let already = self.minted.get(&account_id).copied().unwrap_or(0);
        require!(already + amount.0 <= FAUCET_CAP, "faucet cap reached for this account");
        if !self.token.accounts.contains_key(&account_id) {
            self.token.internal_register_account(&account_id);
        }
        self.token.internal_deposit(&account_id, amount.0);
        self.minted.insert(account_id, already + amount.0);
    }

    /// Registers an account without a deposit (testnet convenience).
    pub fn register(&mut self, account_id: AccountId) {
        if !self.token.accounts.contains_key(&account_id) {
            self.token.internal_register_account(&account_id);
        }
    }
}

#[near]
impl FungibleTokenCore for Contract {
    #[payable]
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        // receivers are auto-registered so payouts never fail on storage
        if !self.token.accounts.contains_key(&receiver_id) {
            self.token.internal_register_account(&receiver_id);
        }
        self.token.ft_transfer(receiver_id, amount, memo)
    }

    #[payable]
    fn ft_transfer_call(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>, msg: String) -> PromiseOrValue<U128> {
        if !self.token.accounts.contains_key(&receiver_id) {
            self.token.internal_register_account(&receiver_id);
        }
        self.token.ft_transfer_call(receiver_id, amount, memo, msg)
    }

    fn ft_total_supply(&self) -> U128 {
        self.token.ft_total_supply()
    }

    fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        self.token.ft_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenResolver for Contract {
    #[private]
    fn ft_resolve_transfer(&mut self, sender_id: AccountId, receiver_id: AccountId, amount: U128) -> U128 {
        let (used, _burned) = self.token.internal_ft_resolve_transfer(&sender_id, receiver_id, amount);
        used.into()
    }
}

#[near]
impl StorageManagement for Contract {
    #[payable]
    fn storage_deposit(&mut self, account_id: Option<AccountId>, registration_only: Option<bool>) -> StorageBalance {
        self.token.storage_deposit(account_id, registration_only)
    }

    #[payable]
    fn storage_withdraw(&mut self, amount: Option<NearToken>) -> StorageBalance {
        self.token.storage_withdraw(amount)
    }

    #[payable]
    fn storage_unregister(&mut self, force: Option<bool>) -> bool {
        self.token.storage_unregister(force)
    }

    fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        self.token.storage_balance_bounds()
    }

    fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.token.storage_balance_of(account_id)
    }
}

#[near]
impl FungibleTokenMetadataProvider for Contract {
    fn ft_metadata(&self) -> FungibleTokenMetadata {
        FungibleTokenMetadata {
            spec: FT_METADATA_SPEC.to_string(),
            name: "Mock USDC (test token)".to_string(),
            symbol: "mUSDC".to_string(),
            icon: None,
            reference: None,
            reference_hash: None,
            decimals: 6,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{accounts, VMContextBuilder};
    use near_sdk::testing_env;

    #[test]
    fn faucet_mints_and_is_capped() {
        testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(0)).build());
        let mut c = Contract::new();
        c.faucet(accounts(1), U128(5_000_000_000));
        assert_eq!(c.ft_balance_of(accounts(1)).0, 5_000_000_000);
        assert_eq!(c.ft_metadata().decimals, 6);
    }

    #[test]
    #[should_panic(expected = "faucet cap")]
    fn faucet_cap_holds() {
        testing_env!(VMContextBuilder::new().predecessor_account_id(accounts(0)).build());
        let mut c = Contract::new();
        c.faucet(accounts(1), U128(10_000_000_000));
        c.faucet(accounts(1), U128(1));
    }
}
