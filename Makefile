build:
	npx blueprint build

test:
	npx blueprint test

publish:
	npm publish --access public

gen_vanity:
	npx blueprint run --testnet --tonconnect addr_vanity &
	npx blueprint run --testnet --tonconnect addr_vanity &
	npx blueprint run --testnet --tonconnect addr_vanity &
	npx blueprint run --testnet --tonconnect addr_vanity &
	npx blueprint run --testnet --tonconnect addr_vanity &
	npx blueprint run --testnet --tonconnect addr_vanity &
	npx blueprint run --testnet --tonconnect addr_vanity &

	wait
