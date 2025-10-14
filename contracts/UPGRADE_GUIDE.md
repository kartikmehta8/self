# Upgrade Guide: Governance Upgrade + PCR0 Migration

## Prerequisites

1. Set environment variables in `.env`:
```bash
CELO_RPC_URL=https://forno.celo.org
CELO_PRIVATE_KEY=<deployer_private_key>
CRITICAL_GOVERNANCE_ADDRESS=<critical_multisig_address>
STANDARD_GOVERNANCE_ADDRESS=<standard_multisig_address>
```

2. Ensure deployer is current owner of all contracts

## Step 1: Run All Tests

```bash
# Test governance upgrade (18 state variables verified)
forge test --match-contract UpgradeToAccessControlTest --fork-url $CELO_RPC_URL -vv

# Test PCR0 migration (7 PCR0 values)
forge test --match-contract MigratePCR0ManagerTest --fork-url $CELO_RPC_URL -vv
```

**Expected**: Both tests pass with "PASSED" output

## Step 2: Dry Run (Simulation)

```bash
# Simulate governance upgrade
forge script script/UpgradeToAccessControl.s.sol:UpgradeToAccessControl \
  --fork-url $CELO_RPC_URL \
  -vvv

# Simulate PCR0 migration
forge script script/MigratePCR0Manager.s.sol:MigratePCR0Manager \
  --fork-url $CELO_RPC_URL \
  -vvv
```

**Verify**:
- No revert messages
- Gas estimates reasonable
- Correct multisig addresses shown
- All 7 PCR0 values listed

## Step 3: Execute on Mainnet

```bash
# Execute governance upgrade
forge script script/UpgradeToAccessControl.s.sol:UpgradeToAccessControl \
  --rpc-url $CELO_RPC_URL \
  --private-key $CELO_PRIVATE_KEY \
  --broadcast \
  --verify \
  -vvv

# Execute PCR0 migration
forge script script/MigratePCR0Manager.s.sol:MigratePCR0Manager \
  --rpc-url $CELO_RPC_URL \
  --private-key $CELO_PRIVATE_KEY \
  --broadcast \
  --verify \
  -vvv
```

## Step 4: Verify Deployment

```bash
# Check governance roles
cast call 0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF \
  "hasRole(bytes32,address)" \
  $(cast keccak "CRITICAL_ROLE") \
  $CRITICAL_GOVERNANCE_ADDRESS \
  --rpc-url $CELO_RPC_URL

# Check PCR0 values migrated (example)
cast call <NEW_PCR0_MANAGER_ADDRESS> \
  "allowedPCR0s(bytes48)" \
  0x000000000000000000ce66ff35f33ce989ca93409f200e37c5074052a3f84e0d3b8d8fce5b1cb2ba4a9fc86e27f32e2a \
  --rpc-url $CELO_RPC_URL
```

**Expected**:
- Role check returns `true`
- PCR0 check returns `true`

## Contracts Upgraded

- IdentityVerificationHubImplV2: `0xe57F4773bd9c9d8b6Cd70431117d353298B9f5BF`
- IdentityRegistryImplV1 (Passport): `0x37F5CB8cB1f6B00aa768D8aA99F1A9289802A968`
- IdentityRegistryIdCardImplV1: `0xeAD1E6Ec29c1f3D33a0662f253a3a94D189566E1`
- IdentityRegistryAadhaarImplV1: `0xd603Fa8C8f4694E8DD1DcE1f27C0C3fc91e32Ac4`

## Rollback

If issues occur, the multisigs can:
1. Deploy previous implementation versions
2. Use `upgradeTo()` to revert (requires `CRITICAL_ROLE`)
