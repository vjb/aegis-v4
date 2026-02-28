import { NextResponse } from 'next/server';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const output = execSync('docker inspect --format="{{.State.Running}}" aegis-oracle-node 2>&1', {
            timeout: 3000,
            encoding: 'utf8',
        }).trim();
        const running = output.includes('true');
        return NextResponse.json({ running, container: 'aegis-oracle-node' });
    } catch {
        return NextResponse.json({ running: false, container: 'aegis-oracle-node' });
    }
}
