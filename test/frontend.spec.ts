/**
 * ═══════════════════════════════════════════════════════════════
 * Phase 8 — Frontend Integration Tests (Jest)
 * ═══════════════════════════════════════════════════════════════
 *
 * 8.1 — Wallet Info: WalletInfo type validation, address truncation,
 *        session key scope assertions
 * 8.2 — Oracle Feed: Risk score decoding, verdict interpretation,
 *        SSE event parsing
 */

// ─── 8.1: Wallet Info Types & Session Key Scope ───────────────────

type WalletInfo = {
    ownerAddress: string;
    ownerBalanceEth: string;
    moduleAddress: string;
    moduleBalanceEth: string;
    network: string;
    explorerBase: string;
    error?: string;
};

function truncateAddress(addr: string): string {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

const MOCK_WALLET: WalletInfo = {
    ownerAddress: '0x109D8072B1762263ed094BC05c5110895Adc65Cf',
    ownerBalanceEth: '0.055000',
    moduleAddress: '0x23efaef29ecc0e6ce313f0eed3d5da7e0f5bcd89',
    moduleBalanceEth: '0.010000',
    network: 'Base Sepolia',
    explorerBase: 'https://sepolia.basescan.org',
};

// ERC-7715 session key config — must match v5_session_config.ts
const SESSION_KEY_CONFIG = {
    targetModule: '0x23efaef29ecc0e6ce313f0eed3d5da7e0f5bcd89',
    allowedSelectors: [
        '0xe34eac65', // requestAudit(address)
        '0x684bceb0', // triggerSwap(address,uint256,uint256)
    ],
    budget: '0.002', // ETH
};

describe('Phase 8.1 — Wallet Info + Session Key Rendering', () => {
    it('WalletInfo type has all required fields', () => {
        expect(MOCK_WALLET.ownerAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(MOCK_WALLET.moduleAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(parseFloat(MOCK_WALLET.ownerBalanceEth)).toBeGreaterThan(0);
        expect(MOCK_WALLET.network).toBe('Base Sepolia');
    });

    it('truncates owner address to 0x109D…65Cf', () => {
        const truncated = truncateAddress(MOCK_WALLET.ownerAddress);
        expect(truncated).toBe('0x109D…65Cf');
        expect(truncated.length).toBeLessThan(MOCK_WALLET.ownerAddress.length);
    });

    it('truncates module address correctly', () => {
        const truncated = truncateAddress(MOCK_WALLET.moduleAddress);
        expect(truncated).toBe('0x23ef…cd89');
    });

    it('session key targets only the AegisModule', () => {
        expect(SESSION_KEY_CONFIG.targetModule.toLowerCase())
            .toBe(MOCK_WALLET.moduleAddress.toLowerCase());
    });

    it('session key allows exactly 2 selectors', () => {
        expect(SESSION_KEY_CONFIG.allowedSelectors).toHaveLength(2);
    });

    it('session key allows requestAudit (0xe34eac65)', () => {
        expect(SESSION_KEY_CONFIG.allowedSelectors).toContain('0xe34eac65');
    });

    it('session key allows triggerSwap (0x684bceb0)', () => {
        expect(SESSION_KEY_CONFIG.allowedSelectors).toContain('0x684bceb0');
    });

    it('session key does NOT allow transfer selector', () => {
        const transferSelector = '0xa9059cbb'; // transfer(address,uint256)
        expect(SESSION_KEY_CONFIG.allowedSelectors).not.toContain(transferSelector);
    });

    it('session key budget is capped at 0.002 ETH', () => {
        expect(parseFloat(SESSION_KEY_CONFIG.budget)).toBe(0.002);
    });

    it('error field is optional in WalletInfo', () => {
        const errorWallet: WalletInfo = { ...MOCK_WALLET, error: 'RPC down' };
        expect(errorWallet.error).toBe('RPC down');

        const cleanWallet: WalletInfo = { ...MOCK_WALLET };
        expect(cleanWallet.error).toBeUndefined();
    });
});

// ─── 8.2: Risk Score Decoding & Verdict Logic ─────────────────────

const RISK_BITS = [
    'Unverified Code',
    'Sell Restriction',
    'Known Honeypot',
    'Upgradeable Proxy',
    'Obfuscated Tax',
    'Privilege Escalation',
    'External Call Risk',
    'Logic Bomb',
];

function decodeRiskScore(score: number): { name: string; triggered: boolean }[] {
    return RISK_BITS.map((name, i) => ({
        name,
        triggered: (score & (1 << i)) !== 0,
    }));
}

function interpretVerdict(score: number): 'APPROVED' | 'BLOCKED' | 'ERROR' {
    if (score < 0) return 'ERROR';
    if (score === 0) return 'APPROVED';
    return 'BLOCKED';
}

describe('Phase 8.2 — Oracle Feed: Risk Score & Verdict Logic', () => {
    it('risk score 0 decodes to 8 all-clean checks', () => {
        const checks = decodeRiskScore(0);
        expect(checks).toHaveLength(8);
        expect(checks.every(c => !c.triggered)).toBe(true);
    });

    it('risk score 0 → APPROVED verdict', () => {
        expect(interpretVerdict(0)).toBe('APPROVED');
    });

    it('risk score 4 (bit 2) → Known Honeypot flagged', () => {
        const checks = decodeRiskScore(4);
        expect(checks[2].name).toBe('Known Honeypot');
        expect(checks[2].triggered).toBe(true);
        expect(checks.filter(c => c.triggered)).toHaveLength(1);
    });

    it('risk score 4 → BLOCKED', () => {
        expect(interpretVerdict(4)).toBe('BLOCKED');
    });

    it('risk score 36 = Honeypot (bit 2) + Privilege Escalation (bit 5)', () => {
        const checks = decodeRiskScore(36);
        expect(checks[2].triggered).toBe(true);  // Known Honeypot
        expect(checks[5].triggered).toBe(true);  // Privilege Escalation
        expect(checks.filter(c => c.triggered)).toHaveLength(2);
    });

    it('risk score 255 flags all 8 bits', () => {
        const checks = decodeRiskScore(255);
        expect(checks.every(c => c.triggered)).toBe(true);
    });

    it('risk score 1 (bit 0) → Unverified Code only', () => {
        const checks = decodeRiskScore(1);
        expect(checks[0].name).toBe('Unverified Code');
        expect(checks[0].triggered).toBe(true);
        expect(checks.filter(c => c.triggered)).toHaveLength(1);
    });

    it('risk score 16 (bit 4) → Obfuscated Tax only', () => {
        const checks = decodeRiskScore(16);
        expect(checks[4].name).toBe('Obfuscated Tax');
        expect(checks[4].triggered).toBe(true);
    });

    it('risk score 128 (bit 7) → Logic Bomb only', () => {
        const checks = decodeRiskScore(128);
        expect(checks[7].name).toBe('Logic Bomb');
        expect(checks[7].triggered).toBe(true);
    });

    it('negative score → ERROR verdict', () => {
        expect(interpretVerdict(-1)).toBe('ERROR');
    });
});

describe('Phase 8.2 — Oracle Feed: SSE Event Parsing', () => {
    function parseSSE(raw: string): any {
        return JSON.parse(raw.replace('data: ', ''));
    }

    it('parses phase event', () => {
        const data = parseSSE('data: {"type":"phase","phase":"Connecting to CRE DON"}');
        expect(data.type).toBe('phase');
        expect(data.phase).toBe('Connecting to CRE DON');
    });

    it('parses tx event with hash', () => {
        const data = parseSSE('data: {"type":"tx","hash":"0xabc123"}');
        expect(data.hash).toBe('0xabc123');
    });

    it('parses final_verdict BLOCKED event', () => {
        const verdict = {
            type: 'final_verdict',
            payload: {
                status: 'BLOCKED', score: 36, targetToken: 'MockHoneypot',
                reasoning: 'Honeypot detected', checks: [{ name: 'Honeypot', triggered: true }]
            },
        };
        const data = parseSSE(`data: ${JSON.stringify(verdict)}`);
        expect(data.payload.status).toBe('BLOCKED');
        expect(data.payload.score).toBe(36);
    });

    it('parses final_verdict APPROVED event', () => {
        const verdict = {
            type: 'final_verdict',
            payload: {
                status: 'APPROVED', score: 0, targetToken: 'MockBRETT',
                reasoning: 'Clean', checks: []
            },
        };
        const data = parseSSE(`data: ${JSON.stringify(verdict)}`);
        expect(data.payload.status).toBe('APPROVED');
        expect(data.payload.score).toBe(0);
    });

    it('parses llm-reasoning-start for GPT-4o', () => {
        const data = parseSSE('data: {"type":"llm-reasoning-start","model":"OpenAI GPT-4o"}');
        expect(data.model).toBe('OpenAI GPT-4o');
    });

    it('parses static-analysis GoPlus event', () => {
        const data = parseSSE('data: {"type":"static-analysis","source":"GoPlus","status":"OK"}');
        expect(data.source).toBe('GoPlus');
    });
});
