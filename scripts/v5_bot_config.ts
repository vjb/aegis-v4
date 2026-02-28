/**
 * V5 Bot Config — Pure Call Builders for ERC-4337 UserOperations
 *
 * In V5, the AI Agent no longer calls AegisModule directly via EOA tx.
 * Instead, it submits ERC-4337 UserOperations via the Safe Smart Account.
 *
 * The `calls` array passed to sendUserOperation is automatically wrapped
 * by permissionless into Safe.execute() calldata. The UserOp sender is the
 * Safe, so AegisModule sees msg.sender = Safe (which is subscribed as agent).
 *
 * Session key signing (SmartSessionMode.USE) is applied in the actual
 * sendUserOperation call in bot.ts — these builders are pure/testable.
 */

import {
    encodeFunctionData,
    parseEther,
    getAddress,
    type Address,
    type Hex,
} from "viem";

// ts-jest + viem CJS overload workaround: explicit type cast resolves the
// TypeScript 4.x inference issue with 'as const' ABIs in CJS module context.
type EncodeFn = (params: { abi: readonly any[]; functionName: string; args?: readonly any[] }) => Hex;
const encode = encodeFunctionData as unknown as EncodeFn;

// ─── AegisModule V4 ABI — only the functions the agent needs ──────────────
export const AEGIS_MODULE_ABI = [
    {
        name: "requestAudit",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [{ name: "_token", type: "address" }],
        outputs: [{ name: "tradeId", type: "uint256" }],
    },
    {
        name: "triggerSwap",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "_token", type: "address" },
            { name: "_amountIn", type: "uint256" },
            { name: "_amountOutMinimum", type: "uint256" },
        ],
        outputs: [],
    },
] as const;

// ─── Call Object Type (passed to sendUserOperation({ calls: [...] })) ──────
export type UserOpCall = {
    to: Address;
    data: Hex;
    value: bigint;
};

/**
 * Builds the call object for AegisModule.requestAudit(token).
 * This goes in the `calls` array of sendUserOperation.
 * permissionless wraps it in Safe.execute() automatically.
 *
 * Important: value = 0n — no ETH attached. The module's treasury pays for swaps.
 */
export function buildV5RequestAuditCall(
    moduleAddress: Address,
    tokenAddress: Address
): UserOpCall {
    return {
        to: getAddress(moduleAddress),
        data: encode({
            abi: AEGIS_MODULE_ABI,
            functionName: "requestAudit",
            args: [getAddress(tokenAddress)],
        }),
        value: BigInt(0),
    };
}

/**
 * Builds the call object for AegisModule.triggerSwap(token, amountIn, minOut).
 * amountOutMinimum = 1 by default (non-zero required by contract).
 */
export function buildV5TriggerSwapCall(
    moduleAddress: Address,
    tokenAddress: Address,
    amountIn: bigint,
    amountOutMinimum = BigInt(1)
): UserOpCall {
    return {
        to: getAddress(moduleAddress),
        data: encode({
            abi: AEGIS_MODULE_ABI,
            functionName: "triggerSwap",
            args: [getAddress(tokenAddress), amountIn, amountOutMinimum],
        }),
        value: BigInt(0),
    };
}
