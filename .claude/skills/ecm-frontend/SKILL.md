# ecm-frontend

Use for all React frontend tasks on ECM-AI-OS — components, pages, routing. HashRouter paths use `/#/route`. Tailwind CSS v4, lucide-react icons, apiFetch() for API calls.

## Structure
- `frontend/src/components/` — 37 component directories
- `frontend/src/context/` — AuthContext, SidebarContext, ThemeContext
- `frontend/src/utils/api.js` — API fetch wrapper

## Patterns
- HashRouter: `/#/dashboard`, `/#/settings`, `/#/billing`
- apiFetch() handles auth token injection + brand_id header
- Tailwind CSS v4 with `@tailwindcss/vite` plugin
- Context providers wrap app in main.jsx

## Commands
```bash
cd frontend && npm run dev     # Vite dev server
cd frontend && npm run build   # Production build
```

## Gotchas
- Brand in frontend is "DenMatrix" (public-facing), not "ECM"
- SidebarContext controls navigation state
- AuthContext exposes onboarding_complete and is_super_admin
- Billing page uses Razorpay — webhook HMAC must be verified server-side
