# Dependency patch acceptance

Use Node 22 (qualified locally on 22.7.0), then install both package trees with their frozen Yarn lockfiles:

~~~sh
yarn install --frozen-lockfile
yarn --cwd web/sample install --frozen-lockfile
yarn test:dependencies
~~~

The nine offline behavior tests cover multipart boundary entropy, safe YAML parsing, Babel code/source mappings, SystemJS exports, browser target queries, a fixture-only local HTTP redirect, URI resolution, generated identifiers, PostCSS and source-map positions. The root four also run as fast CI units. The sample tests require its separate package installation.

Controlled old-dependency failures reproduce repeated multipart boundaries under deterministic Math.random in both trees, and YAML prototype mutation in the root tree. Fixture syntax and cross-VM array identity errors were corrected as test harness issues, without application changes.

Run compiler and full contract regressions locally in series, plus the sample build from its package directory:

~~~sh
yarn build HelloWorld
yarn build Sample
yarn test --runInBand
yarn --cwd web/sample build
~~~

The full existing suite has 46 passing tests and 18 unchanged skips. No wallet transaction, production deployment or external service is exercised. The original frontend and contract sources are preserved.
