#!/bin/bash
# Lighthouse on every live page, phone (slow 4G, default) and desktop. Read-only.
LH=/home/user/nova/ui-ux-audit/node_modules/.bin/lighthouse
export CHROME_PATH=/opt/pw-browsers/chromium
B=https://khaliha-mashawy.pages.dev
OUT=results/round2/lighthouse
declare -A P=([home]=/ [menu-ashry]=/branch/ashry [menu-tagamoa]=/branch/tagamoa [checkout]=/branch/ashry/checkout [track]=/track [order]=/order/01 [admin]=/admin [notfound]=/nope)
for name in "${!P[@]}"; do
  for form in mobile desktop; do
    extra=""; [ $form = desktop ] && extra="--preset=desktop"
    timeout 200 $LH "$B${P[$name]}" --quiet $extra --chrome-flags="--headless=new --no-sandbox" --output json --output html --output-path "$OUT/$name-$form" >/dev/null 2>&1
    echo "$name-$form done"
  done
done
