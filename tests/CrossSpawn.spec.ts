import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
const spawn = require('cross-spawn');

describe('cross-spawn dependency compatibility on the local runtime', () => {
    it('preserves argument boundaries, Unicode and a working directory containing spaces', () => {
        const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'tact spawn '));
        const args = ['value with spaces', '"quoted"', 'semi;colon', '$(not-command)', '世界'];
        try {
            const result = spawn.sync(
                process.execPath,
                [
                    '-e',
                    'process.stdout.write(JSON.stringify({args: process.argv.slice(1), cwd: process.cwd()}))',
                    ...args,
                ],
                { cwd: folder, encoding: 'utf8' },
            );
            expect(result.error).toBeNull();
            expect(result.status).toBe(0);
            expect(JSON.parse(result.stdout)).toEqual({ args, cwd: folder });
        } finally {
            fs.rmdirSync(folder);
        }
    });

    it('preserves asynchronous exit status and stderr', async () => {
        const result = await new Promise<{ code: number | null; stderr: string }>((resolve, reject) => {
            const child = spawn(process.execPath, [
                '-e',
                'process.stderr.write("fixture failure"); process.exitCode = 7',
            ]);
            let stderr = '';
            child.stderr.on('data', (data: Buffer) => {
                stderr += data.toString();
            });
            child.on('error', reject);
            child.on('close', (code: number | null) => resolve({ code, stderr }));
        });
        expect(result).toEqual({ code: 7, stderr: 'fixture failure' });
    });

    it('reports a missing executable as ENOENT without invoking a shell', () => {
        const result = spawn.sync('tact-fixture-executable-that-does-not-exist-20261011', [], { encoding: 'utf8' });
        expect(result.error.code).toBe('ENOENT');
        expect(result.stdout).toBeNull();
    });
});
