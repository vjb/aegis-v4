// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import { Test } from "forge-std/Test.sol";
import { RhinestoneModuleKit, ModuleKitHelpers, AccountInstance } from "modulekit/ModuleKit.sol";
import { MODULE_TYPE_EXECUTOR } from "modulekit/accounts/common/interfaces/IERC7579Module.sol";
import { AegisModule } from "src/AegisModule.sol";

/**
 * @title AegisModuleTest
 * @notice TDD test suite for the AegisModule ERC-7579 Executor.
 *         Tests are written BEFORE implementation (Global Directive 1).
 *
 *         Execution model:
 *           1. Agent calls requestAudit(token) → emits AuditRequested
 *           2. Chainlink CRE DON calls onReport(tradeId, 0) → isApproved[token] = true
 *           3. Agent calls triggerSwap(token, amount) → module calls executeFromExecutor on SA
 */
contract AegisModuleTest is RhinestoneModuleKit, Test {
    using ModuleKitHelpers for *;

    // ─── State ────────────────────────────────────────────────
    AccountInstance internal instance;
    AegisModule internal aegisModule;

    // ─── Actors ───────────────────────────────────────────────
    address internal agent;
    address internal keystoneForwarder;

    // ─── Token placeholders ───────────────────────────────────
    address internal constant SAFE_TOKEN = address(0xdead);
    address internal constant RISKY_TOKEN = address(0xbad);

    // ─── Events to test for ───────────────────────────────────
    event AuditRequested(
        uint256 indexed tradeId,
        address indexed user,
        address indexed targetToken,
        string firewallConfig
    );
    event ClearanceUpdated(address indexed token, bool approved);
    event ClearanceDenied(address indexed token, uint256 riskScore);

    // ─────────────────────────────────────────────────────────
    function setUp() public {
        init();

        agent = makeAddr("agent");
        keystoneForwarder = makeAddr("keystoneForwarder");

        // Deploy AegisModule with keystoneForwarder address
        aegisModule = new AegisModule(keystoneForwarder);
        vm.label(address(aegisModule), "AegisModule");

        // Create a modular Smart Account and install AegisModule as Executor
        instance = makeAccountInstance("AegisVault");
        vm.deal(address(instance.account), 10 ether);
        instance.installModule({
            moduleTypeId: MODULE_TYPE_EXECUTOR,
            module: address(aegisModule),
            data: ""
        });
    }

    // ─────────────────────────────────────────────────────────
    // 1. requestAudit emits AuditRequested
    // ─────────────────────────────────────────────────────────
    function test_requestAudit_emitsEvent() public {
        vm.prank(agent);

        vm.expectEmit(true, true, true, false, address(aegisModule));
        emit AuditRequested(0, agent, SAFE_TOKEN, "");

        uint256 tradeId = aegisModule.requestAudit(SAFE_TOKEN);
        assertEq(tradeId, 0, "First trade ID should be 0");
    }

    // ─────────────────────────────────────────────────────────
    // 2. onReport with riskScore=0 sets isApproved[token] = true
    // ─────────────────────────────────────────────────────────
    function test_onReport_grantsClearance() public {
        // Setup: agent requests audit first
        vm.prank(agent);
        uint256 tradeId = aegisModule.requestAudit(SAFE_TOKEN);

        // CRE DON delivers a clean verdict
        vm.expectEmit(true, false, false, true, address(aegisModule));
        emit ClearanceUpdated(SAFE_TOKEN, true);

        vm.prank(keystoneForwarder);
        aegisModule.onReport(tradeId, 0);

        assertTrue(aegisModule.isApproved(SAFE_TOKEN), "Token should be approved after clean report");
    }

    // ─────────────────────────────────────────────────────────
    // 3. onReport with riskScore>0 emits ClearanceDenied and does NOT approve
    // ─────────────────────────────────────────────────────────
    function test_onReport_deniedDoesNotApprove() public {
        vm.prank(agent);
        uint256 tradeId = aegisModule.requestAudit(RISKY_TOKEN);

        // Honeypot detected — riskScore bit 2 set
        vm.expectEmit(true, false, false, true, address(aegisModule));
        emit ClearanceDenied(RISKY_TOKEN, 4);

        vm.prank(keystoneForwarder);
        aegisModule.onReport(tradeId, 4);

        assertFalse(aegisModule.isApproved(RISKY_TOKEN), "Risky token should NOT be approved");
    }

    // ─────────────────────────────────────────────────────────
    // 4. onReport reverts if caller is not keystoneForwarder
    // ─────────────────────────────────────────────────────────
    function test_onReport_revertsIfNotForwarder() public {
        vm.prank(agent);
        uint256 tradeId = aegisModule.requestAudit(SAFE_TOKEN);

        vm.prank(agent); // not the forwarder
        vm.expectRevert();
        aegisModule.onReport(tradeId, 0);
    }

    // ─────────────────────────────────────────────────────────
    // 5. triggerSwap reverts if token is not cleared
    // ─────────────────────────────────────────────────────────
    function test_triggerSwap_revertsIfNotCleared() public {
        vm.prank(agent);
        vm.expectRevert();
        aegisModule.triggerSwap(SAFE_TOKEN, 1 ether);
    }

    // ─────────────────────────────────────────────────────────
    // 6. triggerSwap succeeds after clearance and calls executeFromExecutor
    //    (uses ModuleKit's exec helper to simulate the full AA loop)
    // ─────────────────────────────────────────────────────────
    function test_triggerSwap_executesFromExecutorAfterClearance() public {
        // Step 1: Register a trade request
        vm.prank(agent);
        uint256 tradeId = aegisModule.requestAudit(SAFE_TOKEN);

        // Step 2: Deliver clean report
        vm.prank(keystoneForwarder);
        aegisModule.onReport(tradeId, 0);

        // Confirm clearance was granted
        assertTrue(aegisModule.isApproved(SAFE_TOKEN));

        // Step 3: Execute the swap via the executor
        // We use ModuleKit's instance.exec() to simulate EntryPoint → Account → Executor
        instance.exec({
            target: address(aegisModule),
            value: 0,
            callData: abi.encodeWithSelector(AegisModule.triggerSwap.selector, SAFE_TOKEN, 1 ether)
        });

        // After execution, clearance should be consumed (reset to false — anti-replay)
        assertFalse(aegisModule.isApproved(SAFE_TOKEN), "Clearance should reset after swap");
    }

    // ─────────────────────────────────────────────────────────
    // 7. Trade ID auto-increments with each requestAudit
    // ─────────────────────────────────────────────────────────
    function test_tradeId_increments() public {
        vm.startPrank(agent);
        uint256 id0 = aegisModule.requestAudit(SAFE_TOKEN);
        uint256 id1 = aegisModule.requestAudit(RISKY_TOKEN);
        vm.stopPrank();

        assertEq(id0, 0);
        assertEq(id1, 1);
    }
}
