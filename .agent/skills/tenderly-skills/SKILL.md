---
name: tenderly-skills
description: Tenderly Virtual TestNet smart contract verification with Foundry. Trigger when verifying contracts on Tenderly, setting up verifier URLs, configuring foundry.toml for Tenderly, or troubleshooting verification issues.
---

# Tenderly Skills

Reference material for deploying, verifying, and testing smart contracts on Tenderly Virtual TestNets using Foundry.

## When to Use

- **Deploying + verifying** contracts on Tenderly Virtual TestNets via `forge create` or `forge script`
- **Configuring `foundry.toml`** for Tenderly verification (`cbor_metadata`, `[etherscan]` section)
- **Building verifier URLs** from Virtual TestNet RPC URLs (`$RPC_URL/verify`)
- **Troubleshooting** verification failures (public vs private, proxy contracts)
- **Funding accounts** via `tenderly_setBalance` RPC method
- **Creating or resetting** Virtual TestNets (VNet lifecycle management)
- **Propagating env vars** to sub-projects after VNet creation

## Reference Files

| File | Topic |
|------|-------|
| [tenderly-verification.txt](tenderly-verification.txt) | Complete Tenderly verification guide — Foundry commands, URL formats, foundry.toml config, FAQ |

## Project References (Aegis-Specific)

| File | Topic |
|------|-------|
| [new_tenderly_testnet.ps1](../../scripts/new_tenderly_testnet.ps1) | Full VNet creation workflow — creates VNet, deploys contracts, funds wallets, propagates env vars to `standalone-agent/`, `cre-node/`, and frontend |
| [demo_end_to_end.ps1](../../scripts/demo_end_to_end.ps1) | End-to-end demo script running CRE oracle + BYOA tests on Tenderly VNet |
| [DEMO_SCENARIOS.md](../../docs/DEMO_SCENARIOS.md) | Demo scenarios with expected Tenderly transaction outputs |

## Quick Reference

### Verifier URL Format
```
# Virtual TestNets
VERIFIER_URL=$TENDERLY_VIRTUAL_TESTNET_RPC_URL/verify
```

### Required foundry.toml Config
```toml
[profile.default]
cbor_metadata = true

[etherscan]
unknown_chain = { key = "TENDERLY_ACCESS_KEY", chain = CHAIN_ID, url = "${TENDERLY_VIRTUAL_TESTNET_RPC_URL}/verify" }
```

### Deploy + Verify (One Command)
```bash
forge create ContractName \
  --rpc-url $TENDERLY_VIRTUAL_TESTNET_RPC_URL \
  --private-key $PRIVATE_KEY \
  --verify \
  --verifier custom \
  --verifier-url $TENDERLY_VERIFIER_URL
```

### Fund an Account on VNet
```bash
cast rpc tenderly_setBalance $ADDRESS 0x21E19E0C9BAB2400000 --rpc-url $RPC_URL
```

### VNet Lifecycle
1. Create VNet via Tenderly dashboard or API
2. Run `new_tenderly_testnet.ps1` to deploy contracts + configure env
3. Run `demo_end_to_end.ps1` to verify full flow
