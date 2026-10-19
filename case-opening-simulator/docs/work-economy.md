# Work Economy

Work is cooldown-limited early-game income. Reward modifiers from upgrades and the skill tree multiply the figures below; reducer-side finite caps and one completion transaction prevent repeated claims.

| Job | Base reward | Cooldown | Maximum base reward per cooldown minute |
| --- | ---: | ---: | ---: |
| Poop Cleaning | $10.00 | 3 minutes | $3.33/minute |
| Sort Boxes | $20.00 | 20 minutes | $1.00/minute |
| Precision Strike | $9.10–$18.90 | 8 minutes | $1.14–$2.36/minute |
| Memory Circuit | $12.60–$23.40 | 15 minutes | $0.84–$1.56/minute |

Precision Strike uses five timing attempts and maps accuracy into a capped 0.65×–1.35× performance multiplier. Memory Circuit uses three sequences of 3, 4, and 5 signals and maps recalled steps into a capped 0.70×–1.30× multiplier. The target/sequence changes every run. Cooldowns and job statistics are persisted in save schema v30. Existing v29 saves receive zeroed new statistics and keep all previous inventory and pattern identity.

These rates are intended to help a new player recover from low balance without outperforming case/inventory progression or passive automation over time. The final deterministic early/mid/late audit retained the amounts and cooldowns; results and system-wide multiplier bounds are recorded in `economy-balance.md`.
