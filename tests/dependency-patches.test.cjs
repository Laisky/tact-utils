const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const req = createRequire(path.join(process.env.TACT_DEPENDENCY_ROOT || path.resolve(__dirname, '..'), 'package.json'));

test('multipart boundaries retain independent entropy when Math.random repeats', () => {
    const FormData = req('form-data');
    const original = Math.random;
    try {
        Math.random = () => 0.125;
        const first = new FormData();
        const second = new FormData();
        first.append('message', 'hello');
        second.append('message', 'world');
        assert.notEqual(first.getBoundary(), second.getBoundary());
        assert.match(first.getBuffer().toString(), /name="message"/);
        assert.match(first.getBuffer().toString(), /hello/);
    } finally {
        Math.random = original;
    }
});

test('YAML prototype keys remain data and executable tags are rejected', () => {
    const yaml = req('js-yaml');
    const parse = yaml.load || yaml.safeLoad;
    const value = parse('__proto__:\n  marker: polluted\nmessage: hello\n');
    assert.equal(Object.getPrototypeOf(value), Object.prototype);
    assert.equal(Object.hasOwn(value, '__proto__'), true);
    assert.equal(Object.prototype.marker, undefined);
    assert.equal(value.message, 'hello');
    assert.throws(() => yaml.safeLoad('!!js/function "function () { return 1; }"'));
});

test('Babel preserves executable code and source mapping', () => {
    const result = req('@babel/core').transformSync('const answer = 6 * 7; answer;', {
        configFile: false,
        babelrc: false,
        sourceMaps: true,
        filename: 'example.js',
    });
    assert.equal(require('node:vm').runInNewContext(result.code), 42);
    assert.ok(result.map.sources.some((source) => source.endsWith('example.js')));
});

test('browser queries return usable Chrome targets', () => {
    const browserslist = req('browserslist');
    const targets = browserslist('last 2 Chrome versions');
    assert.equal(targets.length, 2);
    assert.ok(targets.every((target) => /^chrome [0-9]+$/.test(target)));
});
