//! cowrie-circle: one contract holding many savings circles, keyed by id.
//!
//! Funds are NEP-141 tokens. Members deposit through `ft_transfer_call` with a JSON
//! message: join, contribute or prepay. Payouts go out with `ft_transfer`.
//! After a circle starts nobody, including the creator, can move funds except through
//! the rules in `engine.rs`. The contract has no admin withdrawal.
//!
//! v1 limits (documented in docs/CONTRACTS.md): at most 12 members per circle on-chain
//! (the engine supports 24; the cap keeps `finish` inside one transaction's gas), and
//! outgoing `ft_transfer`s are fire-and-forget (a failed transfer to an unregistered
//! account is not retried).

pub mod engine;

use engine::{Circle, Params, Status};
use near_sdk::json_types::U128;
use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::store::IterableMap;
use near_sdk::{
    env, ext_contract, near, require, AccountId, BorshStorageKey, Gas, NearToken, PanicOnDefault, Promise,
    PromiseError, PromiseOrValue,
};

const MAX_ONCHAIN_MEMBERS: u32 = 12;
const GAS_FT_TRANSFER: Gas = Gas::from_tgas(8);
const GAS_MINT: Gas = Gas::from_tgas(10);
const GAS_VIEW_CB: Gas = Gas::from_tgas(15);

#[ext_contract(ext_ft)]
pub trait ExtFt {
    fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>);
}

#[ext_contract(ext_credential)]
pub trait ExtCredential {
    fn credential_count(&self, account_id: AccountId) -> u32;
    fn mint(&mut self, circle: String, member: AccountId, rounds: u32, on_time: u32, defaults: u32);
}

#[derive(BorshStorageKey)]
#[near(serializers = [borsh])]
enum Key {
    Circles,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    circles: IterableMap<u64, Circle>,
    next_id: u64,
    credential: Option<AccountId>,
}

#[derive(Deserialize)]
#[serde(crate = "near_sdk::serde", tag = "action", rename_all = "lowercase")]
enum Msg {
    Join { circle: u64 },
    Contribute { circle: u64, round: u32 },
    Prepay { circle: u64 },
}

#[derive(Serialize)]
#[serde(crate = "near_sdk::serde")]
pub struct CircleSummary {
    pub id: u64,
    pub name: String,
    pub creator: String,
    pub status: Status,
    pub members: u32,
    pub joined: u32,
    pub current_round: Option<u32>,
}

fn emit(kind: &str, data: &str) {
    env::log_str(&format!(
        "EVENT_JSON:{{\"standard\":\"cowrie\",\"version\":\"1.0.0\",\"event\":\"{}\",\"data\":{}}}",
        kind, data
    ));
}

fn now() -> u64 {
    env::block_timestamp() / 1_000_000_000
}

#[near]
impl Contract {
    /// `credential` is the soulbound credential contract. It may be unset in tests;
    /// then no credential discounts apply and nothing is minted.
    #[init]
    pub fn new(credential: Option<AccountId>) -> Self {
        Self { circles: IterableMap::new(Key::Circles), next_id: 1, credential }
    }

    // ------------------------------------------------------------------ create

    pub fn create_circle(
        &mut self,
        name: String,
        token: AccountId,
        members: u32,
        contribution: U128,
        period_secs: u64,
        grace_secs: u64,
        collateral_pct: u8,
        reserve_bps: u32,
        tip_cap: U128,
        random_order: bool,
        min_credentials: u32,
        discount_pct: u8,
    ) -> u64 {
        require!(members <= MAX_ONCHAIN_MEMBERS, "v1 supports at most 12 members on-chain");
        require!(name.len() <= 80, "name too long");
        let params = Params {
            members,
            contribution: contribution.0,
            period_secs,
            grace_secs,
            collateral_pct,
            reserve_bps,
            tip_cap: tip_cap.0,
            random_order,
            min_credentials,
            discount_pct,
        };
        let id = self.next_id;
        let seed = u64::from_le_bytes(env::random_seed()[0..8].try_into().unwrap());
        let c = Circle::new(id, name, env::predecessor_account_id().to_string(), token.to_string(), params, seed)
            .unwrap_or_else(|e| env::panic_str(&e));
        self.circles.insert(id, c);
        self.next_id += 1;
        emit("created", &format!("{{\"id\":{},\"creator\":\"{}\"}}", id, env::predecessor_account_id()));
        id
    }

    // ----------------------------------------------------------------- deposits

    /// NEP-141 receiver. msg is JSON: {"action":"join","circle":1},
    /// {"action":"contribute","circle":1,"round":0} or {"action":"prepay","circle":1}.
    /// Returns the amount NOT used (0 when accepted). A panic refunds everything.
    pub fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> PromiseOrValue<U128> {
        let m: Msg = near_sdk::serde_json::from_str(&msg).unwrap_or_else(|_| env::panic_str("bad_msg"));
        let token = env::predecessor_account_id();
        match m {
            Msg::Join { circle } => {
                let c = self.circles.get(&circle).unwrap_or_else(|| env::panic_str("no_circle"));
                require!(c.token == token.as_str(), "wrong_token");
                require!(c.status == Status::Open, "not_open");
                match &self.credential {
                    Some(cred) if c.params.min_credentials > 0 && c.params.collateral_pct > 0 => {
                        PromiseOrValue::Promise(
                            ext_credential::ext(cred.clone())
                                .with_static_gas(Gas::from_tgas(5))
                                .credential_count(sender_id.clone())
                                .then(
                                    Self::ext(env::current_account_id())
                                        .with_static_gas(GAS_VIEW_CB)
                                        .on_join_count(circle, sender_id, amount),
                                ),
                        )
                    }
                    _ => PromiseOrValue::Value(self.do_join(circle, &sender_id, amount.0, 0)),
                }
            }
            Msg::Contribute { circle, round } => {
                let c = self.circles.get_mut(&circle).unwrap_or_else(|| env::panic_str("no_circle"));
                require!(c.token == token.as_str(), "wrong_token");
                c.contribute(sender_id.as_str(), round, amount.0).unwrap_or_else(|e| env::panic_str(&e));
                emit("contributed", &format!("{{\"circle\":{},\"member\":\"{}\",\"round\":{},\"amount\":\"{}\"}}", circle, sender_id, round, amount.0));
                PromiseOrValue::Value(U128(0))
            }
            Msg::Prepay { circle } => {
                let c = self.circles.get_mut(&circle).unwrap_or_else(|| env::panic_str("no_circle"));
                require!(c.token == token.as_str(), "wrong_token");
                c.prepay(sender_id.as_str(), amount.0).unwrap_or_else(|e| env::panic_str(&e));
                emit("prepaid", &format!("{{\"circle\":{},\"member\":\"{}\",\"amount\":\"{}\"}}", circle, sender_id, amount.0));
                PromiseOrValue::Value(U128(0))
            }
        }
    }

    #[private]
    pub fn on_join_count(
        &mut self,
        circle: u64,
        sender: AccountId,
        amount: U128,
        #[callback_result] count: Result<u32, PromiseError>,
    ) -> U128 {
        let creds = count.unwrap_or(0);
        self.do_join(circle, &sender, amount.0, creds)
    }

    /// Returns the unused amount: 0 on success, the full amount when the join is refused.
    fn do_join(&mut self, circle: u64, sender: &AccountId, amount: u128, creds: u32) -> U128 {
        let Some(c) = self.circles.get_mut(&circle) else { return U128(amount) };
        if c.status != Status::Open || c.collateral_required(creds) != amount {
            return U128(amount);
        }
        if c.join(sender.as_str(), creds).is_err() {
            return U128(amount);
        }
        emit("joined", &format!("{{\"circle\":{},\"member\":\"{}\",\"collateral\":\"{}\"}}", circle, sender, amount));
        if c.members.len() as u32 == c.params.members {
            c.start(now(), None).unwrap_or_else(|e| env::panic_str(&e));
            emit("started", &format!("{{\"circle\":{},\"order\":{}}}", circle, near_sdk::serde_json::to_string(&c.order).unwrap()));
        }
        U128(0)
    }

    // -------------------------------------------------------------- circle actions

    pub fn leave(&mut self, circle: u64) {
        let who = env::predecessor_account_id();
        let c = self.circles.get_mut(&circle).unwrap_or_else(|| env::panic_str("no_circle"));
        let t = c.leave(who.as_str()).unwrap_or_else(|e| env::panic_str(&e));
        let token: AccountId = c.token.parse().unwrap();
        emit("left", &format!("{{\"circle\":{},\"member\":\"{}\"}}", circle, who));
        Self::pay(&token, t);
    }

    pub fn cancel(&mut self, circle: u64) {
        let who = env::predecessor_account_id();
        let c = self.circles.get_mut(&circle).unwrap_or_else(|| env::panic_str("no_circle"));
        let t = c.cancel(who.as_str()).unwrap_or_else(|e| env::panic_str(&e));
        let token: AccountId = c.token.parse().unwrap();
        emit("cancelled", &format!("{{\"circle\":{}}}", circle));
        Self::pay(&token, t);
    }

    /// Anyone can settle once everyone has paid or the deadline plus grace has passed.
    pub fn settle(&mut self, circle: u64) {
        let caller = env::predecessor_account_id();
        let c = self.circles.get_mut(&circle).unwrap_or_else(|| env::panic_str("no_circle"));
        let (events, t) = c.settle(caller.as_str(), now()).unwrap_or_else(|e| env::panic_str(&e));
        let token: AccountId = c.token.parse().unwrap();
        for e in events {
            emit(e.kind, &e.data);
        }
        Self::pay(&token, t);
    }

    /// Anyone can finish after the last round. Returns funds and mints credentials.
    pub fn finish(&mut self, circle: u64) {
        let c = self.circles.get_mut(&circle).unwrap_or_else(|| env::panic_str("no_circle"));
        let (t, mints) = c.finish().unwrap_or_else(|e| env::panic_str(&e));
        require!(!t.is_empty() || !mints.is_empty(), "already_finished");
        let token: AccountId = c.token.parse().unwrap();
        let cid = c.id;
        emit("finished", &format!("{{\"circle\":{}}}", cid));
        Self::pay(&token, t);
        if let Some(cred) = self.credential.clone() {
            for m in mints {
                let _ = ext_credential::ext(cred.clone()).with_static_gas(GAS_MINT).mint(
                    cid.to_string(),
                    m.member.parse().unwrap(),
                    m.rounds,
                    m.on_time,
                    m.defaults,
                );
                emit("credential_minted", &format!("{{\"circle\":{},\"member\":\"{}\"}}", cid, m.member));
            }
        }
    }

    /// Creator-approved seat transfer after the circle starts.
    pub fn transfer_seat(&mut self, circle: u64, from: AccountId, to: AccountId) {
        let by = env::predecessor_account_id();
        let c = self.circles.get_mut(&circle).unwrap_or_else(|| env::panic_str("no_circle"));
        c.transfer_seat(from.as_str(), to.as_str(), by.as_str()).unwrap_or_else(|e| env::panic_str(&e));
        emit("seat_transferred", &format!("{{\"circle\":{},\"from\":\"{}\",\"to\":\"{}\"}}", circle, from, to));
    }

    // ----------------------------------------------------------------------- views

    pub fn get_circle(&self, circle: u64) -> Option<Circle> {
        self.circles.get(&circle).cloned()
    }

    pub fn list_circles(&self, from_index: Option<u64>, limit: Option<u64>) -> Vec<CircleSummary> {
        let from = from_index.unwrap_or(0) as usize;
        let limit = limit.unwrap_or(20).min(100) as usize;
        self.circles
            .iter()
            .skip(from)
            .take(limit)
            .map(|(id, c)| CircleSummary {
                id: *id,
                name: c.name.clone(),
                creator: c.creator.clone(),
                status: c.status,
                members: c.params.members,
                joined: c.members.len() as u32,
                current_round: c.current_round().map(|i| c.rounds[i].index),
            })
            .collect()
    }

    pub fn collateral_required(&self, circle: u64, credentials: u32) -> U128 {
        let c = self.circles.get(&circle).unwrap_or_else(|| env::panic_str("no_circle"));
        U128(c.collateral_required(credentials))
    }

    pub fn can_settle(&self, circle: u64) -> bool {
        self.circles.get(&circle).map(|c| c.can_settle(now())).unwrap_or(false)
    }

    pub fn conserved(&self, circle: u64) -> bool {
        self.circles.get(&circle).map(|c| c.conserved()).unwrap_or(false)
    }

    pub fn credential_contract(&self) -> Option<AccountId> {
        self.credential.clone()
    }

    // --------------------------------------------------------------------- helpers

    /// Fires one ft_transfer per payment. They are independent receipts: NEAR does not allow a
    /// function to return a joint promise, and nothing needs to wait on them.
    fn pay(token: &AccountId, transfers: Vec<engine::Transfer>) {
        for t in transfers {
            let _ = ext_ft::ext(token.clone())
                .with_attached_deposit(NearToken::from_yoctonear(1))
                .with_static_gas(GAS_FT_TRANSFER)
                .ft_transfer(t.to.parse().unwrap(), U128(t.amount), None);
        }
    }
}
