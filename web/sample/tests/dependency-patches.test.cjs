const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const req = createRequire(
    path.join(process.env.TACT_WEB_DEPENDENCY_ROOT || path.resolve(__dirname, '..'), 'package.json'),
);

test('sample multipart boundaries retain independent entropy', () => {
    const FormData = req('form-data');
    const original = Math.random;
    try {
        Math.random = () => 0.125;
        assert.notEqual(new FormData().getBoundary(), new FormData().getBoundary());
    } finally {
        Math.random = original;
    }
});

test('Axios posts fixture data and follows a local 303 redirect as GET', async () => {
    const http = require('node:http');
    const requests = [];
    const server = http.createServer((request, response) => {
        let body = '';
        request.on('data', (chunk) => (body += chunk));
        request.on('end', () => {
            requests.push({ method: request.method, url: request.url, body });
            if (request.url === '/submit') {
                response.writeHead(303, { location: '/result' });
                response.end();
            } else {
                response.setHeader('Content-Type', 'application/json');
                response.end(JSON.stringify({ message: 'accepted' }));
            }
        });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
        const response = await req('axios').post(
            'http://127.0.0.1:' + server.address().port + '/submit',
            { message: 'hello' },
            { proxy: false, timeout: 3000 },
        );
        assert.deepEqual(response.data, { message: 'accepted' });
        assert.deepEqual(
            requests.map((request) => request.method),
            ['POST', 'GET'],
        );
        assert.deepEqual(JSON.parse(requests[0].body), { message: 'hello' });
        assert.equal(requests[1].body, '');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
});

test('SystemJS transform retains named module exports', () => {
    const result = req('@babel/core').transformSync('export const answer = 42;', {
        configFile: false,
        babelrc: false,
        plugins: [req('@babel/plugin-transform-modules-systemjs')],
    });
    const exports = {};
    const System = {
        register(dependencies, factory) {
            assert.equal(dependencies.length, 0);
            factory((name, value) => (exports[name] = value)).execute();
        },
    };
    require('node:vm').runInNewContext(result.code, { System });
    assert.equal(exports.answer, 42);
});

test('browser query, URI resolution and generated identifiers remain usable', () => {
    assert.ok(req('browserslist')('last 1 Chrome version')[0].startsWith('chrome '));
    assert.equal(req('fast-uri').resolve('https://example.test/a/b', '../c'), 'https://example.test/c');
    const nanoid = req('nanoid');
    const ids = Array.from({ length: 32 }, () => nanoid.nanoid(21));
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(ids.every((id) => /^[A-Za-z0-9_-]{21}$/.test(id)));
});

test('PostCSS rewrites declarations and source maps retain original positions', async () => {
    const result = await req('postcss')([
        {
            postcssPlugin: 'fixture-color',
            Declaration(declaration) {
                if (declaration.prop === 'color') declaration.value = 'blue';
            },
        },
    ]).process('.message { color: red; }', { from: 'message.css' });
    assert.match(result.css, /color: blue/);
    const { SourceMapGenerator, SourceMapConsumer } = req('source-map-js');
    const generator = new SourceMapGenerator({ file: 'output.js' });
    generator.addMapping({ generated: { line: 1, column: 0 }, original: { line: 3, column: 2 }, source: 'input.js' });
    const consumer = new SourceMapConsumer(generator.toString());
    assert.deepEqual(consumer.originalPositionFor({ line: 1, column: 0 }), {
        source: 'input.js',
        line: 3,
        column: 2,
        name: null,
    });
});
