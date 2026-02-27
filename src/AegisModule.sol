// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import { ERC7579ExecutorBase } from "modulekit/Modules.sol";
import { IERC7579Account } from "modulekit/Accounts.sol";
import { ModeLib } from "modulekit/accounts/common/lib/ModeLib.sol";
import { ExecutionLib } from "modulekit/accounts/erc7579/lib/ExecutionLib.sol";

/**
 * @title AegisModule V4 — ERC-7579 AI Security Firewall Executor
 * @notice An ERC-7579 Type-2 Executor Module that installs onto a Smart Account
 *         (e.g., Safe) and acts as a zero-custody AI security gateway.
 *
 *         Architecture:
 *           AI Agent (Session Key / UserOp) → Smart Account → AegisModule
 *             → emits AuditRequested → Chainlink CRE DON audits token
 *             → onReport(tradeId, 0) → clears token → triggerSwap()
 *             → executeFromExecutor() → Smart Account executes Uniswap swap
 *
 *         This module holds ZERO funds. All capital stays in the Smart Account.
 *
 * @dev Inherits ERC7579ExecutorBase from rhinestone/modulekit.
 *      Caller of triggerSwap must be the installed Smart Account itself
 *      (routed via the ERC-4337 entrypoint through a session key UserOp).
 */
contract AegisModule is ERC7579ExecutorBase {
    // ─── Trade Request State ──────────────────────────────────────────────
    struct TradeRequest {
        address targetToken;
        bool exists;
    }

    mapping(uint256 => TradeRequest) public tradeRequests;
    uint256 public nextTradeId;

    // ─── Clearance State (one-shot per audit cycle) ───────────────────────
    mapping(address => bool) public isApproved;

    // ─── Access Control ───────────────────────────────────────────────────
    // The Chainlink KeystoneForwarder — the ONLY address permitted to call onReport().
    address public immutable keystoneForwarder;

    // ─── Default Firewall Config (JSON) ───────────────────────────────────
    string public firewallConfig =
        '{"maxTax":5,"blockProxies":true,"strictLogic":true,"blockHoneypots":true}';

    // ─── Events ───────────────────────────────────────────────────────────
    event AuditRequested(
        uint256 indexed tradeId,
        address indexed user,
        address indexed targetToken,
        string firewallConfig
    );
    event ClearanceUpdated(address indexed token, bool approved);
    event ClearanceDenied(address indexed token, uint256 riskScore);
    event SwapTriggered(address indexed targetToken, uint256 amount);

    // ─── Errors ───────────────────────────────────────────────────────────
    error NotKeystoneForwarder();
    error NoPendingRequest();
    error TokenNotCleared();
    error InvalidToken();

    // ─── Constructor ──────────────────────────────────────────────────────
    constructor(address _keystoneForwarder) {
        keystoneForwarder = _keystoneForwarder;
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  ERC-7579 MODULE LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════

    /// @notice Called when the module is installed on a Smart Account.
    function onInstall(bytes calldata /*data*/) external override { }

    /// @notice Called when the module is uninstalled from a Smart Account.
    function onUninstall(bytes calldata /*data*/) external override { }

    /// @notice Returns whether this module is initialized for a given Smart Account.
    function isInitialized(address /*smartAccount*/) external pure returns (bool) {
        return true;
    }

    /// @notice Module type check — declares this is a Type-2 Executor.
    function isModuleType(uint256 typeID) external pure override returns (bool) {
        return typeID == TYPE_EXECUTOR;
    }

    /// @notice Module name.
    function name() external pure returns (string memory) {
        return "AegisModule";
    }

    /// @notice Module version.
    function version() external pure returns (string memory) {
        return "4.0.0";
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  STEP 1 — SUBMIT TRADE INTENT
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice The AI Agent submits a trade intent for a target token.
     *         The vault's owner-set firewallConfig is emitted so the CRE DON can apply it.
     * @param _token The ERC-20 token the agent wants to buy.
     * @return tradeId The ID of this audit request (used to match the oracle callback).
     */
    function requestAudit(address _token) external returns (uint256 tradeId) {
        if (_token == address(0)) revert InvalidToken();

        tradeId = nextTradeId++;
        tradeRequests[tradeId] = TradeRequest({ targetToken: _token, exists: true });

        emit AuditRequested(tradeId, msg.sender, _token, firewallConfig);
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  STEP 2 — ORACLE REPORT CALLBACK
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Called by the Chainlink KeystoneForwarder when the CRE DON has rendered
     *         its verdict. A riskScore of 0 means the token is CLEARED.
     *         Any non-zero riskScore means DENIED.
     * @param tradeId The ID of the trade request being resolved.
     * @param riskScore 8-bit risk matrix from the oracle (0 = safe, >0 = flagged).
     */
    function onReport(uint256 tradeId, uint256 riskScore) external {
        if (msg.sender != keystoneForwarder) revert NotKeystoneForwarder();

        TradeRequest memory req = tradeRequests[tradeId];
        if (!req.exists) revert NoPendingRequest();

        delete tradeRequests[tradeId]; // Prevent replay

        if (riskScore == 0) {
            isApproved[req.targetToken] = true;
            emit ClearanceUpdated(req.targetToken, true);
        } else {
            emit ClearanceDenied(req.targetToken, riskScore);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    //  STEP 3 — JIT SWAP EXECUTION
    // ═══════════════════════════════════════════════════════════════════════

    /**
     * @notice Called by the AI Agent (via a session key UserOp) to execute the swap.
     *         Requires prior clearance from the oracle.
     *         Uses executeFromExecutor() to command the Smart Account — this module
     *         holds ZERO funds of its own.
     *
     * @dev The Smart Account (msg.sender) is the caller here, as the session key
     *      routes the UserOp through the account's execute(), which delegates to this
     *      executor. The actual swap target address and calldata would be encoded
     *      in production; here we encode a placeholder call that can be tested.
     *
     * @param _token The target token address (must be cleared by oracle).
     * @param _amount The amount of ETH (in wei) to spend from the Smart Account.
     */
    function triggerSwap(address _token, uint256 _amount) external {
        if (!isApproved[_token]) revert TokenNotCleared();

        // Consume clearance BEFORE external call (CEI — prevents replay attacks)
        isApproved[_token] = false;

        emit SwapTriggered(_token, _amount);

        // Command the Smart Account to execute the swap.
        // In production this would be a Uniswap V3 exactInputSingle() calldata.
        // The Smart Account (msg.sender) calls executeFromExecutor() on itself.
        bytes memory executionData = ExecutionLib.encodeSingle(
            _token,   // call target (token / router in production)
            _amount,  // ETH value to send
            ""        // calldata (swap params in production)
        );

        IERC7579Account(msg.sender).executeFromExecutor(
            ModeLib.encodeSimpleSingle(),
            executionData
        );
    }
}
