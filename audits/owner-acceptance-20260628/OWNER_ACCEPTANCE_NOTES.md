# Owner Acceptance Notes - 2026-06-28

Scope: owner-facing acceptance pass across home, buy, vehicle detail, sell intake, dealer workbench, dealer valuation, and admin workbench.

## Steps Checked

1. Home page
   - Health: good.
   - Evidence: `01-home-viewport.png`.
   - Notes: brand, navigation, buy/sell entry points, and sign-out state are clear.

2. Buy page inventory
   - Health: mostly good.
   - Evidence: `02-buy-viewport.png`.
   - Notes: search/filter bar is prominent, inventory cards show price, payment, year, KM, region, and Details & order.

3. Vehicle detail / order drawer
   - Health: good.
   - Evidence: `03-vehicle-detail-viewport.png`.
   - Notes: buyer can review price, photos, vehicle details, finance estimate, and contact dealer.

4. Sell page intake
   - Health: good.
   - Evidence: `04-sell-viewport.png`.
   - Notes: form starts cleanly with VIN/year-make-model paths. Browser title was updated to match AutoSwitch Canada.

5. Dealer workbench
   - Health: good for manager account.
   - Evidence: `05-dealer-viewport.png`.
   - Notes: owner/manager sees dashboard, queue, updates, tasks, inventory, and admin entry.

6. Dealer manual valuation
   - Health: fixed during this pass.
   - Evidence: `06-dealer-valuation-disabled-button-local.png`.
   - Notes: found that the hidden/empty valuation state could show an enabled-looking `Enter VIN first` button online. Fixed state syncing and disabled styling locally.

7. Admin workbench
   - Health: good.
   - Evidence: `07-admin-viewport.png`.
   - Notes: owner sees lead updates, dashboard totals, Up Sheets, inventory, settings, and dealer portal navigation.

## Fix Applied

- Dealer valuation button state now re-syncs on page restore and lookup mode changes.
- Dealer valuation form now updates button state on any input change, not only VIN-specific changes.
- Disabled form buttons now look disabled instead of red/actionable.
- Dealer page asset version was updated to force fresh `app.js` and `styles.css`.
- Old HuanChe browser titles were renamed to AutoSwitch Canada on sell and login pages.

## Remaining Owner Notes

- Buyer page detail drawer is functional, but the details are modal-based rather than a shareable vehicle URL. That is acceptable for MVP, but a mature marketplace usually benefits from shareable vehicle detail URLs.
- Full-page screenshots with sticky headers can look repeated; viewport screenshots are the accepted evidence for this pass.
