use anchor_lang::prelude::*;
use mpl_candy_machine_core::CandyMachine;

use crate::state::{CandyGuard, CandyGuardData, GuardSet, GuardType, DATA_OFFSET};

use unchecked_account::UncheckedAccount;

pub mod unchecked_account {
    //! Explicit wrapper for AccountInfo types to emphasize
    //! that no checks are performed

    use anchor_lang::error::ErrorCode;
    use anchor_lang::{Accounts, AccountsExit, Key, Result, ToAccountInfos, ToAccountMetas};
    use solana_program::account_info::AccountInfo;
    use solana_program::instruction::AccountMeta;
    use solana_program::pubkey::Pubkey;
    use std::collections::BTreeSet;
    use std::ops::Deref;

    /// Explicit wrapper for AccountInfo types to emphasize
    /// that no checks are performed
    #[derive(Debug, Clone)]
    pub struct UncheckedAccount<'info>(&'info AccountInfo<'info>);

    impl<'info> UncheckedAccount<'info> {
        pub fn try_from(acc_info: &'info AccountInfo<'info>) -> Self {
            Self(acc_info)
        }

        pub fn account_info(&self) -> &'info AccountInfo<'info> {
            self.0
        }
    }

    impl<'info, B> Accounts<'info, B> for UncheckedAccount<'info> {
        fn try_accounts(
            _program_id: &Pubkey,
            accounts: &mut &'info [AccountInfo<'info>],
            _ix_data: &[u8],
            _bumps: &mut B,
            _reallocs: &mut BTreeSet<Pubkey>,
        ) -> Result<Self> {
            if accounts.is_empty() {
                return Err(ErrorCode::AccountNotEnoughKeys.into());
            }
            let account = &accounts[0];
            *accounts = &accounts[1..];
            Ok(UncheckedAccount(account))
        }
    }

    impl<'info> ToAccountMetas for UncheckedAccount<'info> {
        fn to_account_metas(&self, is_signer: Option<bool>) -> Vec<AccountMeta> {
            let is_signer = is_signer.unwrap_or(self.is_signer);
            let meta = match self.is_writable {
                false => AccountMeta::new_readonly(*self.key, is_signer),
                true => AccountMeta::new(*self.key, is_signer),
            };
            vec![meta]
        }
    }

    impl<'info> ToAccountInfos<'info> for UncheckedAccount<'info> {
        fn to_account_infos(&self) -> Vec<AccountInfo<'info>> {
            vec![self.0.clone()]
        }
    }

    impl<'info> AccountsExit<'info> for UncheckedAccount<'info> {}

    impl<'info> AsRef<AccountInfo<'info>> for UncheckedAccount<'info> {
        fn as_ref(&self) -> &AccountInfo<'info> {
            self.0
        }
    }

    impl<'info> Deref for UncheckedAccount<'info> {
        type Target = AccountInfo<'info>;

        fn deref(&self) -> &Self::Target {
            self.0
        }
    }

    impl<'info> Key for UncheckedAccount<'info> {
        fn key(&self) -> Pubkey {
            *self.0.key
        }
    }
}

/// Route the transaction to the specified guard. This instruction allows the use of
/// empty candy guard and candy machine accounts and it is up to individual guard
/// instructions to validate whether the instruction can be executed or not.
pub fn route<'c, 'info>(
    ctx: Context<'_, '_, 'c, 'info, Route<'info>>,
    args: RouteArgs,
    label: Option<String>,
) -> Result<()>
where
    'c: 'info,
{
    // checks if the candy guard account is not empty

    let candy_guard_account = if ctx.accounts.candy_guard.as_ref().data_is_empty() {
        None
    } else {
        let account: Account<CandyGuard> =
            Account::try_from(ctx.accounts.candy_guard.account_info())?;
        Some(account)
    };

    // checks if the candy machine account is not empty

    let candy_machine_account = if ctx.accounts.candy_machine.as_ref().data_is_empty() {
        None
    } else {
        let account: Account<CandyMachine> =
            Account::try_from(ctx.accounts.candy_machine.account_info())?;
        Some(Box::new(account))
    };

    // retrieve the active guard set

    let guard_set = if let Some(account) = &candy_guard_account {
        let account_info = account.to_account_info();
        let data = account_info.data.borrow();
        // loads the active guard set
        let guard_set = CandyGuardData::active_set(&data[DATA_OFFSET..], label)?;

        Some(guard_set)
    } else {
        None
    };

    let route_context = RouteContext {
        candy_guard: candy_guard_account,
        candy_machine: candy_machine_account,
        guard_set,
    };

    GuardSet::route(&ctx, route_context, args)?;

    Ok(())
}

/// Withdraw the rent SOL from the candy guard account.
#[derive(Accounts)]
#[instruction(args: RouteArgs)]
pub struct Route<'info> {
    /// CHECK: account constraints checked in instruction
    pub candy_guard: UncheckedAccount<'info>,
    /// CHECK: account constraints checked in instruction
    #[account(mut)]
    pub candy_machine: UncheckedAccount<'info>,
    #[account(mut)]
    pub payer: Signer<'info>,
}

/// Arguments for a route transaction.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct RouteArgs {
    /// The target guard type.
    pub guard: GuardType,
    /// Arguments for the guard instruction.
    pub data: Vec<u8>,
}

/// Struct to hold references to candy guard and candy machine
/// accounts, if present.
pub struct RouteContext<'info> {
    /// The candy guard account.
    pub candy_guard: Option<Account<'info, CandyGuard>>,
    /// The candy machine account.
    pub candy_machine: Option<Box<Account<'info, CandyMachine>>>,
    // The active guard set.
    pub guard_set: Option<Box<GuardSet>>,
}
