[![tests](https://github.com/yacooba/crowdsale/actions/workflows/unit-tests.yml/badge.svg)](https://github.com/yacooba/crowdsale/actions)
[![codecov](https://codecov.io/gh/Yacooba/crowdsale/branch/main/graph/badge.svg?token=QadEglgSqU)](https://codecov.io/gh/Yacooba/crowdsale)

# Yacooba Crowdsale

# Requirements

`NodeJs >= 14`

## Env Variables

(ask Carlos)

```
COINMARKETCAP_API_KEY
INFURA_API_KEY
```

## Compile Contracts

`npm run compile`

## Run Tests

`npm test`

## Solidity Style Guide ([See more](https://solidity.readthedocs.io/en/latest/style-guide.html))

Functions and declarations must be grouped according to their visibility and ordered in this fashion:

- Storage
- Events
- Constructor
- Fallback/Receive function (if exists)
- External
- Public
- Internal
- Private

Functions and variables naming:

- All internal/private functions and variables (unless constants) should be camelCase and preceded by an underscore (\_).
- Constants should be UPPER_CASE and snake_case.
- Function params should be camelCase and followed by an underscore (\_) if theres a name collision with a local/state variable.

Require messages:

- Should be concise and have the abbreviation of the contract followed by the reason. (e.g "EP: start date must be in the future")

Comments:

- Follow [NatSec Format](https://solidity.readthedocs.io/en/v0.5.8/natspec-format.html)
