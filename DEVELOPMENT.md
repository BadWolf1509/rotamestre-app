# 🚀 RotaMestre - Development Guide

## 🛠️ Development Setup with Edge DevTools

### Quick Start

The development server is already running on port **8081**. You can access it at:
- **URL**: http://localhost:8081
- **Edge DevTools**: Press `F12` to open

### Available Tools

#### 1. DevTools Panel (Web Only)
A floating debug panel is available at the bottom-left corner of the screen when running in development mode.

**Features:**
- 🐛 **Debug Button** (red): Click to expand the panel
- 📍 **Route Navigation**: Quick links to all major routes
- ⚡ **Performance Actions**: Clear cache, force reload, toggle offline mode
- 👤 **Quick Login**: Login as motorista or gestor for testing
- 📊 **Performance Metrics**: Memory usage, network status, current route

**Keyboard Shortcuts:**
- `Ctrl+Shift+D`: Toggle Debug Panel (detailed performance metrics)
- `F12`: Open Edge DevTools
- `Ctrl+R`: Reload page
- `Ctrl+Shift+I`: Open Developer Tools

#### 2. Console Enhancements

All console logs are enhanced with:
- ⏰ Timestamps
- 🎨 Color coding
- 📊 Performance metrics
- 🌐 Network request logging

**Custom Console Commands:**
```javascript
// Show performance metrics
rotamestre.performance()

// Clear all cache
rotamestre.clearCache()

// Toggle debug mode
rotamestre.toggleDebug()

// Show available routes
rotamestre.routes()
```

#### 3. Performance Monitoring

The app includes comprehensive performance monitoring:
- **Screen Load Times**: Automatically tracked for each screen
- **API Response Times**: All API calls are monitored
- **Memory Usage**: Real-time memory monitoring with warnings
- **Network Status**: Online/offline detection with automatic sync

#### 4. Development Features

##### Dynamic Re-routing
- Real-time traffic monitoring
- Route optimization algorithms
- Visual optimization alerts

##### Android Widget
- Home screen widget for route progress
- Quick actions without opening app
- Real-time updates

##### Performance Optimizations
- Lazy loading components
- Image optimization and caching
- Virtualized lists for large datasets
- Request batching
- Offline mode support

### Project Structure

```
rotamestre-app/
├── src/
│   ├── components/       # UI Components
│   │   ├── OptimizedImage.tsx
│   │   ├── OptimizedList.tsx
│   │   ├── PerformanceSettings.tsx
│   │   └── DevOverlay.tsx
│   ├── services/         # Business Logic
│   │   ├── dynamicRerouting.ts
│   │   ├── performanceOptimizer.ts
│   │   └── locationTracking.ts
│   ├── hooks/           # Custom Hooks
│   │   └── usePerformance.ts
│   ├── config/          # Configuration
│   │   └── devtools.ts
│   └── lib/            # Utilities
│       └── utils.ts
├── android/            # Android Native Code
│   └── app/src/main/java/br/tec/rotamestre/
│       └── widget/    # Android Widget Implementation
└── scripts/           # Development Scripts
    └── dev-edge.bat  # Start dev server with Edge
```

### Testing Routes

#### Motorista (Driver) Routes
- `/motorista` - Home dashboard
- `/motorista/mapa` - Map view
- `/motorista/checkpoints` - Stop list
- `/motorista/historico` - History
- `/motorista/configuracoes` - Settings

#### Gestor (Manager) Routes
- `/gestor` - Dashboard
- `/gestor/rotas` - Routes management
- `/gestor/motoristas` - Drivers management
- `/unidade` - Unit management
- `/perfil` - Profile

### Environment Variables

```env
EXPO_PUBLIC_SUPABASE_URL=https://xezslsyxjivunmhhyxtd.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_key_here
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_maps_key
NODE_ENV=development
DEBUG=*
```

### Performance Tips

1. **Use OptimizedImage** for all images:
```tsx
import { OptimizedImage } from '@/components/OptimizedImage';

<OptimizedImage
  source={{ uri: imageUrl }}
  width={200}
  height={200}
  priority="high"
/>
```

2. **Use OptimizedList** for large lists:
```tsx
import { OptimizedList } from '@/components/OptimizedList';

<OptimizedList
  data={items}
  renderItem={renderItem}
  keyExtractor={(item) => item.id}
  type="flash" // Best performance
/>
```

3. **Use Performance Hooks**:
```tsx
import { usePerformance } from '@/hooks/usePerformance';

const {
  metrics,
  optimizedApiCall,
  deferOperation
} = usePerformance({ screenName: 'MyScreen' });
```

### Debugging with Edge DevTools

#### Network Tab
- Monitor all API requests
- Check response times
- Inspect request/response headers
- View payload data

#### Console Tab
- Enhanced logging with timestamps
- Performance warnings
- Custom debug commands
- Error stack traces

#### Performance Tab
- Record performance profiles
- Analyze rendering performance
- Find memory leaks
- Optimize animations

#### Elements Tab
- Inspect component tree
- Modify styles in real-time
- Debug layout issues
- Test responsive design

### Common Issues & Solutions

#### Issue: Slow performance
**Solution**: Open DevTools (F12) → Performance tab → Record → Reproduce issue → Stop → Analyze

#### Issue: API errors
**Solution**: Check Network tab for failed requests, Console for error details

#### Issue: Memory leaks
**Solution**: Use Performance Monitor (Ctrl+Shift+D), check for increasing memory usage

#### Issue: Component not updating
**Solution**: Use React DevTools extension to inspect props and state

### VSCode Integration

Launch configurations are available in `.vscode/launch.json`:
- **RotaMestre - Edge DevTools**: Launch with auto-open DevTools
- **Attach to Edge**: Attach to existing Edge instance
- **Debug Metro**: Debug the Metro bundler
- **Full Stack Debug**: Launch both browser and Metro debugging

### Scripts

```bash
# Start development server
npm run web

# Start with specific port
npm run web -- --port 8081

# Start with Edge DevTools
./scripts/dev-edge.bat

# Clear cache and restart
npm run web -- --clear
```

### Best Practices

1. **Always test in Edge DevTools** during development
2. **Monitor performance metrics** regularly
3. **Use the Debug Panel** for quick navigation
4. **Check Console** for warnings and errors
5. **Profile performance** before deploying
6. **Test offline mode** for resilience
7. **Use lazy loading** for better initial load
8. **Batch API requests** when possible
9. **Optimize images** with the OptimizedImage component
10. **Use virtualized lists** for large datasets

### Support

- **Documentation**: `/docs` folder
- **Issues**: Check console and DevTools
- **Performance**: Use built-in monitoring tools
- **Edge DevTools**: https://docs.microsoft.com/en-us/microsoft-edge/devtools-guide-chromium/

---

**Happy Coding! 🚀**

Remember: The DevTools are your friend. Use them wisely!