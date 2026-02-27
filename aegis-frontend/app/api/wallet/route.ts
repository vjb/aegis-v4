import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createPublicClient, http, getAddress, formatEther } from 'viem';
import { defineChain } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

export const dynamic = 'force-dynamic';

const aegisTenderly = defineChain({
    id: 73578453,
    name: 'Aegis Tenderly VNet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [] } },
});

export async function GET() {
    try {
        const envPath = path.resolve(process.cwd(), '../.env');
        if (!fs.existsSync(envPath)) throw new Error('.env not found');

        const env: Record<string, string> = {};
        fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
            const [k, ...rest] = line.split('=');
            if (k && rest.length) env[k.trim()] = rest.join('=').trim();
        });

        let pk = env.PRIVATE_KEY || '';
        if (!pk.startsWith('0x')) pk = `0x${pk}`;

        const account = privateKeyToAccount(pk as `0x${string}`);
        const ownerAddress = account.address;

        const publicClient = createPublicClient({
            chain: aegisTenderly,
            transport: http(env.TENDERLY_RPC_URL),
        });

        const [ownerBal, moduleBal] = await Promise.all([
            publicClient.getBalance({ address: ownerAddress }),
            publicClient.getBalance({ address: getAddress(env.AEGIS_MODULE_ADDRESS) }).catch(() => BigInt(0)),
        ]);

        const tenderlyId = env.TENDERLY_TESTNET_UUID || env.TENDERLY_RPC_URL.match(/\/([0-9a-f-]{36})$/i)?.[1] || '';

        return NextResponse.json({
            ownerAddress,
            ownerBalanceEth: parseFloat(formatEther(ownerBal)).toFixed(6),
            moduleAddress: env.AEGIS_MODULE_ADDRESS,
            moduleBalanceEth: parseFloat(formatEther(moduleBal)).toFixed(6),
            network: 'Base VNet (Tenderly)',
            explorerBase: tenderlyId ? `https://dashboard.tenderly.co/aegis/project/testnet/${tenderlyId}` : '',
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
