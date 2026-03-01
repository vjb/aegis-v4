import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * /api/decompile?address=0x...
 * 
 * Calls the Heimdall decompiler Docker microservice to decompile
 * EVM bytecode for a given contract address. Returns the decompiled
 * Solidity-like pseudocode.
 * 
 * The Heimdall service runs at localhost:3001 inside the aegis-decompiler container.
 */
export async function GET(req: NextRequest) {
    const address = req.nextUrl.searchParams.get('address');
    if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
        return NextResponse.json({ error: 'Invalid address. Provide a valid 0x... EVM address.' }, { status: 400 });
    }

    try {
        // Check if Heimdall decompiler service is running
        const healthCheck = await Promise.race([
            fetch('http://localhost:3001/health'),
            new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]) as Response;

        if (!healthCheck.ok) {
            return NextResponse.json({
                error: 'Heimdall decompiler service is not responding',
                hint: 'Run: docker compose up --build -d aegis-decompiler',
                status: 'offline'
            }, { status: 503 });
        }

        // Call the decompiler service
        const res = await Promise.race([
            fetch(`http://localhost:3001/decompile?address=${address}`),
            new Promise<Response>((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000))
        ]) as Response;

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json({
                error: data.error || 'Decompilation failed',
                address,
                status: 'error'
            }, { status: res.status });
        }

        return NextResponse.json({
            address,
            status: 'success',
            decompiled: data.decompiled || data.output || '',
            functions: data.functions || [],
            storage: data.storage || [],
            warnings: data.warnings || [],
            isProxy: data.isProxy || false,
            timestamp: new Date().toISOString(),
        });

    } catch (err: any) {
        if (err.message === 'timeout') {
            return NextResponse.json({
                error: 'Heimdall decompiler timed out (30s limit)',
                address,
                status: 'timeout'
            }, { status: 504 });
        }

        return NextResponse.json({
            error: `Decompiler error: ${err.message}`,
            address,
            status: 'error'
        }, { status: 500 });
    }
}
