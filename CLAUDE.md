# 📱 RotaMestre App - Context

**Purpose:** Mobile/Web app for route optimization
**Stack:** React Native + Expo 54
**Status:** ✅ MVP in Production (v1.0)
**URL:** https://app.rotamestre.tec.br

---

## 🎯 What This App Does

**Users:**

1. **Gestor** (Manager) - Creates routes, assigns drivers, monitors execution
2. **Motorista** (Driver) - Receives routes, navigates to stops, marks completion

**Core Flow:**

1. Gestor logs in → Creates route with stops → Assigns to motorista
2. System optimizes route order (OSRM - free routing engine)
3. Motorista sees route → Navigates to each stop → Marks complete + uploads photo proof

### ✅ Migration Complete (2025-12-06)

**Motorista home screen updated to advanced version:**

- **`/motorista/inicio`** - Main screen with state machine, CameraUpload, PiP, NavigationMode
- **`/motorista/checkpoints`** - Detailed list of stops with swipe actions

**Key Features Added:**

- 6-state adaptive UI (no-route, pending, active, last-stop, ready-to-complete, completed)
- Camera upload modal for delivery proof photos
- Swipe gestures for stop completion
- Picture-in-Picture map overlay
- Navigation mode with auto-advance
- Real-time location tracking and route optimization

---

## 🛠️ Tech Stack (Specific to App)

### Framework

- React Native 0.81.5
- Expo 54 (SDK 54)
- TypeScript 5.9
- Expo Router 6 (file-based routing)

### Key Libraries

- **Maps (Web):** MapLibre GL JS + OpenFreeMap tiles (FREE!)
- **Maps (Mobile):** MapLibre Native + Carto/OSM raster tiles (FREE!)
- **Geocoding:** Photon API (komoot.io - FREE!)
- **Routing:** OSRM (FREE!) via googleMapsService wrapper
- **Forms:** react-hook-form + zod
- **Storage:** @react-native-async-storage/async-storage
- **Camera:** expo-camera + expo-image-picker
- **Navigation Apps:** expo-linking (Waze, Google Maps, Apple Maps)

### Backend

- Supabase Client 2.45.0 (uses ANON_KEY, respects RLS)
- PostgreSQL database
- Supabase Auth (JWT tokens)
- Supabase Storage (delivery photos)

### Design System

- Unistyles (design tokens)
- Custom fonts: Viga (headings), Nunito Sans (body)
- Design tokens: `src/lib/design-tokens.ts`
- Component library: `src/components/`

---

## 📂 Project Structure

```
rotamestre-app/
├── app/                    # Expo Router screens (file-based routing)
│   ├── (auth)/            # Auth screens (login, register)
│   ├── gestor/            # Manager screens
│   │   ├── dashboard.tsx
│   │   ├── criar-rota.tsx
│   │   ├── historico.tsx
│   │   └── motoristas.tsx
│   └── motorista/         # Driver screens
│       ├── rotas.tsx
│       └── checkpoints.tsx
├── src/
│   ├── components/        # Reusable components
│   │   ├── AppButton.tsx
│   │   ├── AppCard.tsx
│   │   ├── AddressAutocomplete.tsx
│   │   ├── CameraUpload.tsx
│   │   ├── DataTable.tsx
│   │   └── ...
│   ├── lib/               # Utilities and helpers
│   │   ├── supabase.ts    # Supabase client
│   │   ├── design-tokens.ts
│   │   ├── navigation.ts  # GPS navigation helper
│   │   └── storage.ts     # AsyncStorage helper
│   └── hooks/             # Custom hooks
│       ├── useResponsive.ts
│       └── useAuth.ts
├── assets/                # Images, fonts, icons
├── metro.config.js        # Custom config (Supabase Realtime fix)
└── app.json              # Expo configuration
```

---

## 🎨 Design System

### Colors (Design Tokens)

```typescript
import { colors, spacing, typography } from '@/lib/design-tokens';

// Primary: Orange (#FF8C42)
// Secondary: Blue (#4A90E2)
// Success: Green (#2ECC71)
// See design-tokens.ts for full palette
```

### Responsive Breakpoints

```typescript
import { useResponsive } from '@/hooks/useResponsive';

const { isMobile, isTablet, isDesktop, width } = useResponsive();

// Mobile: < 768px
// Tablet: 768-1023px
// Desktop: ≥ 1024px
```

### Components

13 reusable components in `src/components/`:

- **AppButton, AppCard, AppInput** - Basic UI
- **AddressAutocomplete** - Photon geocoding autocomplete (FREE!)
- **CameraUpload** - Photo capture/upload
- **DataTable** - Responsive table/cards
- **GestorSidebar** - Desktop sidebar navigation
- **ResponsiveContainer** - Max-width container
- **MapaWebMapLibre** - Web map component (MapLibre + OpenFreeMap)
- **MapaRN** - Mobile map component (MapLibre Native + raster tiles)

---

## 🔑 Key Features Implemented

### Gestor Features

- ✅ Dashboard with statistics cards
- ✅ Responsive layout (sidebar desktop, bottom tabs mobile)
- ✅ Create route with address autocomplete (Photon API - FREE!)
- ✅ Route optimization (OSRM - FREE!)
- ✅ Assign route to motorista
- ✅ View route history (DataTable)
- ✅ Manage motoristas (CRUD)
- ✅ View delivery proof photos

### Motorista Features

- ✅ View assigned routes
- ✅ See stops in optimized order
- ✅ Navigate to stop (Waze, Google Maps, Apple Maps)
- ✅ Mark stop complete/skip
- ✅ Upload delivery proof photo
- ✅ Photo compression (<500KB)

---

## 🗺️ Maps & Geocoding (100% FREE!)

### Migration Complete (Jan/2025)

All Google APIs replaced with free open-source alternatives:

- **Cost savings:** ~$350/month eliminated!
- **No API keys required** for maps (public tiles)

### Services Used

1. **Photon API** (komoot.io) - Address autocomplete & geocoding
   - Debounced (500ms)
   - Returns coordinates directly (no session tokens needed)
   - OpenStreetMap data (excellent for Brazil)
   - File: `src/lib/photon.ts`

2. **OSRM** - Route optimization & directions
   - `optimize: true` reorders stops
   - Returns total distance/duration
   - Turn-by-turn directions
   - File: `src/lib/google.ts` (wrapper, uses OSRM backend)

3. **MapLibre GL JS** - Web maps
   - Uses OpenFreeMap tiles (FREE!)
   - Style: `https://tiles.openfreemap.org/styles/liberty/style.json`
   - File: `src/components/MapaWebMapLibre.tsx`

4. **MapLibre Native** - Mobile maps
   - Raster style (Carto Voyager)
   - Style: `src/lib/maplibre.ts`
   - Files: `src/components/MapaRN.tsx`, `src/components/MapaMobile.tsx`

### Key Files

- `src/lib/photon.ts` - Geocoding service
- `src/components/AddressAutocomplete.tsx` - Uses Photon
- `src/components/MapaWebMapLibre.tsx` - Web map component
- `src/components/MapaRN.tsx` - Mobile map component
- `src/lib/navigation.ts` - GPS navigation helper

---

## 📱 Navigation Integration

**File:** `src/lib/navigation.ts`

Opens external navigation apps from the app:

```typescript
import { openNavigation } from '@/lib/navigation';

// Mobile: Shows menu (Waze, Google Maps, Apple Maps)
// Web: Opens Google Maps in new tab
await openNavigation(latitude, longitude);
```

**Platforms:**

- iOS: ActionSheet with Waze/Google Maps/Apple Maps
- Android: Alert with Waze/Google Maps
- Web: Opens google.com/maps in new tab

---

## 📸 Photo Upload

**File:** `src/components/CameraUpload.tsx`

```typescript
<CameraUpload
  onPhotoTaken={(uri) => console.log('Photo:', uri)}
/>
```

**Features:**

- Camera or gallery picker
- Automatic compression (<500KB)
- Upload to Supabase Storage bucket `fotos-entrega`
- Preview before upload
- Returns public URL

---

## 🔐 Authentication & Security

### User Roles

- `gestor` - Manager (creates routes, manages team)
- `motorista` - Driver (executes routes)

### RLS (Row Level Security)

- Users can only access data for their `unidade_id`
- Gestores can CRUD routes for their unit
- Motoristas can view routes assigned to them, update stop status

### Auth Flow

```typescript
import { supabase } from '@/lib/supabase';

// Login
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password,
});

// Check session
const {
  data: { session },
} = await supabase.auth.getSession();

// Logout
await supabase.auth.signOut();
```

---

## 🎯 Code Patterns

### Supabase Queries

```typescript
// ✅ Good: Proper error handling, typed result
const { data: rotas, error } = await supabase
  .from('rotas')
  .select('*, motorista:usuarios(nome), paradas(*)')
  .eq('unidade_id', unidadeId)
  .order('created_at', { ascending: false });

if (error) {
  console.error('Failed to fetch routes:', error);
  Alert.alert('Erro', 'Não foi possível carregar as rotas');
  return;
}
```

### Responsive Layouts

```typescript
import { useResponsive } from '@/hooks/useResponsive';

export default function Screen() {
  const { isMobile, isDesktop } = useResponsive();

  return (
    <View>
      {isDesktop ? (
        <DesktopLayout />
      ) : (
        <MobileLayout />
      )}
    </View>
  );
}
```

### Form Validation

```typescript
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  titulo: z.string().min(1, 'Título obrigatório'),
  motorista_id: z.string().uuid('Selecione um motorista'),
});

const {
  control,
  handleSubmit,
  formState: { errors },
} = useForm({
  resolver: zodResolver(schema),
});
```

---

## 🚨 Known Issues & Fixes

### 1. Metro Bundler: async-require error

**Fixed in:** `metro.config.js`

```javascript
resolver: {
  unstable_enablePackageExports: true,
}
```

### 2. MapLibre Native error on web build

**Solution:** Don't import Maps components in web-only code
**Example:** Moved `rota-backup.tsx` out of `app/` folder

### 3. Supabase Storage CORS

**Solution:** Bucket `fotos-entrega` is set to public
**Check:** Supabase Dashboard → Storage → fotos-entrega → Policies

---

## 🧪 Testing

**Current:** Jest + React Native Testing Library (285+ suites, 5490+ tests passing, ~74% line coverage). See [docs/TESTING.md](./docs/TESTING.md) for commands, layout, and caveats.

**Pre-release manual smoke checklist:**

- [ ] Gestor can create route with autocomplete
- [ ] Route is optimized (stops reordered)
- [ ] Motorista sees assigned routes
- [ ] Navigation opens external app
- [ ] Photo upload works (<500KB)
- [ ] Responsive layouts work (mobile/tablet/desktop)

---

## 🚀 Build & Deploy

### Development

```bash
npm start              # Start Expo dev server
npm run web           # Web only (port 8081)
npm run android       # Android (needs emulator)
npm run type-check    # TypeScript validation
```

### Web Build (Production)

```bash
npm run build:web     # Creates .expo/web/
vercel --prod         # Deploy to Vercel
```

### Mobile Build

```bash
# Android APK
eas build --platform android --profile preview

# iOS (not yet configured)
```

---

## 📊 Current Status

**MVP:** 110% Complete ✅

- All core features implemented
- Responsive design (mobile + desktop)
- Production ready

**Phase 2 status (2026-05-11):**

- ✅ **CSV export** for routes (gestor) — `src/hooks/gestao-rotas/routeExport.ts` with mobile share (expo-sharing) + web download
- 🟡 **Real-time driver tracking** — writer at `src/services/locationTracking.ts` + hook `useMotoristaTracking` done; mobile renders the marker; gestor web integration pending (covered by audit-improvement-bundle Phase 3)
- 🟡 **Push notifications** — `src/lib/notifications.ts` library + `app.config.js` projectId configured; token registration on login pending (covered by audit-improvement-bundle Phase 2)
- ❌ **XLSX/PDF export** — pending (`xlsx`/`pdfmake` libraries not yet added; audit-improvement-bundle Phase 7)
- ❌ **Real-time GPS history visualization** — not started

---

## 🔗 Related Files

**Must read when working on:**

- Auth: `src/lib/supabase.ts`, `src/hooks/useAuth.ts`
- Maps (Web): `src/components/MapaWebMapLibre.tsx`, `src/components/MapaAdapter.tsx`
- Maps (Mobile): `src/components/MapaRN.tsx`, `src/components/MapaMobile.tsx`
- Geocoding: `src/lib/photon.ts`, `src/components/AddressAutocomplete.tsx`
- Routing/Directions: `src/lib/google.ts` (OSRM wrapper)
- Forms: Any file using `react-hook-form` + `zod`
- Navigation: `app/**/*.tsx` (Expo Router file-based)
- Design: `src/lib/design-tokens.ts`, `src/components/`

**Reference:**

- Root `CLAUDE.md` - Global project context
- Root `.claude/stack.md` - Full tech stack details
- Root `.claude/troubleshooting.md` - Common errors

---

## 💡 Development Tips

1. **Responsive design:** Always use `useResponsive()` hook
2. **Forms:** Always validate with Zod schemas
3. **Supabase:** Always handle errors explicitly
4. **TypeScript:** Strict mode enabled, avoid `any`
5. **Testing:** Test on multiple screen sizes (use responsive mode)

---

**For detailed architecture and decisions, see:** `.claude/project-context.md` (archived - read only if needed)
