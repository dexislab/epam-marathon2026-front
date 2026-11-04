# Homework QA checklist

## Mock backend

No login needed, works on any level. The `?demo` query 
param activates the mock login as Owner of `demo-reservation`:

```
http://localhost:4200/reservations/demo-reservation/group-order?demo
```

## Real backend

Level 3 (requires actual login and a real reservationId):

```
http://localhost:4200/reservations/<your-reservationId>/group-order
```

---

**Setup flow** (do this first to get a real `reservationId`)

1. `http://localhost:4200` — register or log in as a Customer
2. Book a table for 2+ guests → note the `reservationId` from the confirmation URL or invite link
3. Copy the `/join/…` invite link
4. Open it in a second browser / incognito tab → log in as a different user → pick dishes → confirm cart
5. Back in your main browser, open your own guest pre-order page and add dishes too → confirm cart

---

**Pages to hit**

| What | URL |
|---|---|
| Owner Review screen | `http://localhost:4200/reservations/<reservationId>/group-order` |
| Guest join flow (second browser) | `http://localhost:4200/join/<token>` |
| 404 error state | `http://localhost:4200/reservations/nonexistent-id/group-order` |

---

**What to verify on the Owner Review screen**

**Initial load**
- Header shows correct address, date, time range, guest count
- "Collecting pre-orders" badge
- Each participant card shows name, dish list, subtotal
- Your own card shows "My Pre-Order"
- Grand Total reflects only submitted carts (not the API `total`)
- "Updated at HH:mm:ss" shown, Refresh button visible

**Background sync**
- In the guest browser, confirm a cart → wait up to 15 s → owner screen updates without page reload
- "Updated at" timestamp changes after each refresh

**Manual Refresh**
- Click "Refresh" → data reloads immediately, timestamp updates

**Pending warning**
- While any guest hasn't submitted → yellow banner "N participants hasn't submitted…"

**Submit Pre-Order**
- Button disabled when no confirmed carts exist
- Click → confirmation modal opens
- Click "Cancel" → modal closes, nothing changes
- Click "Submit" → button shows "Submitting…", then success toast, badge changes 
  to "Sent to Restaurant", Submit button disappears, polling stops

**Remove Guest**
- "Remove Guest" button appears next to each guest card (not on "My Pre-Order")
- Click → modal shows guest name + warning text
- Confirm → guest card disappears, totals recalculate from server response
- After Submit — "Remove Guest" buttons are gone

**Error states**
- Go `http://localhost:4200/reservations/nonexistent-id/group-order` → "Group reservation not found"
- Kill the network (DevTools → Offline) 
  after load → wait 15 s → "Couldn't refresh. Showing data from…" appears, existing cards stay visible
- Restore network → click Refresh → data returns, "Updated at" resets

