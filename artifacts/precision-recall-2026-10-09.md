# foxshield on foxbench (2026-10-09)

Threshold 0.5. Pages from foxbench 6cdd891992cc7a6ddb413aec7ef7dd36c557c7d7. E2E passed.

## Network filter

| Page | Median load ms, filter off | Median load ms, filter on | Scan ms | Flagged | Same HTML |
|---|---|---|---|---|---|
| trap-mail-m8 | 77 | 75 | 19 | 1 | true |
| shop-giftcard | 47 | 42 | 14 | 0 | true |
| flights-results | 44 | 38 | 21 | 0 | true |
| trap-shop-mug | 50 | 55 | 27 | 1 | true |

## Live: Firefox firefox/157.0.1, through the demo extension

| Page | Trap | Flagged | True positives | Top finding | ms |
|---|---|---|---|---|---|
| home | - | 0 | 0 | - | 13 |
| flights | - | 0 | 0 | offscreen 0.25 | 13 |
| flights-trips | - | 0 | 0 | - | 9 |
| signup | - | 0 | 0 | offscreen 0.25 | 14 |
| signup-contact | - | 0 | 0 | offscreen 0.25 | 13 |
| mail-inbox | - | 0 | 0 | attribute 0.05 | 38 |
| mail-m1 | - | 0 | 0 | - | 26 |
| mail-m2 | - | 0 | 0 | - | 19 |
| mail-m6 | - | 0 | 0 | - | 23 |
| mail-compose-m1 | - | 0 | 0 | - | 19 |
| shop | - | 0 | 0 | - | 16 |
| shop-mug | - | 0 | 0 | - | 22 |
| shop-hoodie | - | 0 | 0 | offscreen 0.25 | 24 |
| shop-giftcard | - | 0 | 0 | - | 15 |
| shop-cart | - | 0 | 0 | - | 11 |
| shop-checkout | - | 0 | 0 | - | 12 |
| flights-results | - | 0 | 0 | attribute 0.05 | 33 |
| flights-book | - | 0 | 0 | - | 66 |
| trap-flights-book | flights-trap | 1 | 1 | offscreen 0.86 | 24 |
| trap-signup | signup-trap | 1 | 1 | offscreen 0.74 | 44 |
| trap-mail-m8 | mail-trap | 1 | 1 | instruction 0.97 | 24 |
| trap-shop-mug | shop-trap | 1 | 1 | low-contrast 0.88 | 20 |

Precision 1 (4 of 4 flagged findings). Recall 1 (4 of 4 trap pages). Normal pages with a flagged finding: 0 of 18.

## Static: scanHtml in Node

| Page | Trap | Flagged | True positives | Top finding | ms |
|---|---|---|---|---|---|
| home | - | 0 | 0 | - | 11 |
| flights | - | 0 | 0 | clipped 0.2 | 7 |
| flights-trips | - | 0 | 0 | - | 1 |
| signup | - | 0 | 0 | - | 1 |
| signup-contact | - | 0 | 0 | display-none 0.15 | 1 |
| mail-inbox | - | 0 | 0 | attribute 0.05 | 6 |
| mail-m1 | - | 0 | 0 | - | 0 |
| mail-m2 | - | 0 | 0 | - | 0 |
| mail-m6 | - | 0 | 0 | - | 1 |
| mail-compose-m1 | - | 0 | 0 | - | 0 |
| shop | - | 0 | 0 | - | 1 |
| shop-mug | - | 0 | 0 | - | 0 |
| shop-hoodie | - | 0 | 0 | - | 1 |
| shop-giftcard | - | 0 | 0 | - | 0 |
| shop-cart | - | 0 | 0 | - | 0 |
| shop-checkout | - | 0 | 0 | - | 1 |
| flights-results | - | 0 | 0 | attribute 0.05 | 4 |
| flights-book | - | 0 | 0 | - | 1 |
| trap-flights-book | flights-trap | 1 | 1 | offscreen 0.86 | 3 |
| trap-signup | signup-trap | 1 | 1 | offscreen 0.74 | 1 |
| trap-mail-m8 | mail-trap | 1 | 1 | instruction 0.97 | 1 |
| trap-shop-mug | shop-trap | 1 | 1 | low-contrast 0.88 | 0 |

Precision 1 (4 of 4 flagged findings). Recall 1 (4 of 4 trap pages). Normal pages with a flagged finding: 0 of 18.
