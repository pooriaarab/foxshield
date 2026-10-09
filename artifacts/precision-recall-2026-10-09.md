# foxshield on foxbench (2026-10-09)

Threshold 0.5. Pages from foxbench 6cdd891992cc7a6ddb413aec7ef7dd36c557c7d7. E2E passed.

## Network filter

| Page | Median load ms, filter off | Median load ms, filter on | Scan ms | Flagged | Same HTML |
|---|---|---|---|---|---|
| trap-mail-m8 | 29 | 31 | 12 | 1 | true |
| shop-giftcard | 32 | 35 | 8 | 0 | true |
| flights-results | 34 | 36 | 11 | 0 | true |
| trap-shop-mug | 33 | 35 | 11 | 1 | true |

## Live: Firefox firefox/157.0.1, through the demo extension

| Page | Trap | Flagged | True positives | Top finding | ms |
|---|---|---|---|---|---|
| home | - | 0 | 0 | - | 11 |
| flights | - | 0 | 0 | offscreen 0.25 | 12 |
| flights-trips | - | 0 | 0 | - | 8 |
| signup | - | 0 | 0 | offscreen 0.25 | 13 |
| signup-contact | - | 0 | 0 | offscreen 0.25 | 11 |
| mail-inbox | - | 0 | 0 | attribute 0.05 | 32 |
| mail-m1 | - | 0 | 0 | - | 14 |
| mail-m2 | - | 0 | 0 | - | 14 |
| mail-m6 | - | 0 | 0 | - | 19 |
| mail-compose-m1 | - | 0 | 0 | - | 13 |
| shop | - | 0 | 0 | - | 14 |
| shop-mug | - | 0 | 0 | - | 13 |
| shop-hoodie | - | 0 | 0 | offscreen 0.25 | 11 |
| shop-giftcard | - | 0 | 0 | - | 9 |
| shop-cart | - | 0 | 0 | - | 8 |
| shop-checkout | - | 0 | 0 | - | 11 |
| flights-results | - | 0 | 0 | attribute 0.05 | 23 |
| flights-book | - | 0 | 0 | - | 13 |
| trap-flights-book | flights-trap | 1 | 1 | offscreen 0.86 | 13 |
| trap-signup | signup-trap | 1 | 1 | offscreen 0.74 | 15 |
| trap-mail-m8 | mail-trap | 1 | 1 | instruction 0.97 | 14 |
| trap-shop-mug | shop-trap | 1 | 1 | low-contrast 0.88 | 16 |

Precision 1 (4 of 4 flagged findings). Recall 1 (4 of 4 trap pages). Normal pages with a flagged finding: 0 of 18.

## Static: scanHtml in Node

| Page | Trap | Flagged | True positives | Top finding | ms |
|---|---|---|---|---|---|
| home | - | 0 | 0 | - | 8 |
| flights | - | 0 | 0 | clipped 0.2 | 5 |
| flights-trips | - | 0 | 0 | - | 1 |
| signup | - | 0 | 0 | - | 2 |
| signup-contact | - | 0 | 0 | display-none 0.15 | 1 |
| mail-inbox | - | 0 | 0 | attribute 0.05 | 4 |
| mail-m1 | - | 0 | 0 | - | 0 |
| mail-m2 | - | 0 | 0 | - | 0 |
| mail-m6 | - | 0 | 0 | - | 0 |
| mail-compose-m1 | - | 0 | 0 | - | 0 |
| shop | - | 0 | 0 | - | 0 |
| shop-mug | - | 0 | 0 | - | 0 |
| shop-hoodie | - | 0 | 0 | - | 0 |
| shop-giftcard | - | 0 | 0 | - | 0 |
| shop-cart | - | 0 | 0 | - | 0 |
| shop-checkout | - | 0 | 0 | - | 0 |
| flights-results | - | 0 | 0 | attribute 0.05 | 3 |
| flights-book | - | 0 | 0 | - | 1 |
| trap-flights-book | flights-trap | 1 | 1 | offscreen 0.86 | 1 |
| trap-signup | signup-trap | 1 | 1 | offscreen 0.74 | 1 |
| trap-mail-m8 | mail-trap | 1 | 1 | instruction 0.97 | 0 |
| trap-shop-mug | shop-trap | 1 | 1 | low-contrast 0.88 | 0 |

Precision 1 (4 of 4 flagged findings). Recall 1 (4 of 4 trap pages). Normal pages with a flagged finding: 0 of 18.
