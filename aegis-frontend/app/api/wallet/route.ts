import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { createPublicClient, http, getAddress, formatEther } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

export const dynamic = 'force-dynamic';

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

        const rpc = env.BASE_SEPOLIA_RPC_URL || env.TENDERLY_RPC_URL || 'https://sepolia.base.org';
        const account = privateKeyToAccount(pk as `0x${string}`);
        const ownerAddress = account.address;

        const publicClient = createPublicClient({
            chain: baseSepolia,
            transport: http(rpc),
        });

        const [ownerBal, moduleBal] = await Promise.all([
            publicClient.getBalance({ address: ownerAddress }),
            publicClient.getBalance({ address: getAddress(env.AEGIS_MODULE_ADDRESS) }).catch(() => BigInt(0)),
        ]);

        return NextResponse.json({
            ownerAddress,
            ownerBalanceEth: parseFloat(formatEther(ownerBal)).toFixed(6),
            moduleAddress: env.AEGIS_MODULE_ADDRESS,
            moduleBalanceEth: parseFloat(formatEther(moduleBal)).toFixed(6),
            network: 'Base Sepolia (84532)',
            explorerBase: `https://sepolia.basescan.org`,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
