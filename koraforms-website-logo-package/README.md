# Koraforms Website Logo Package

## Primary logos

- `png/koraforms-primary-transparent.png` — full-colour horizontal logo for light backgrounds
- `png/koraforms-primary-dark-background.png` — full-colour icon with light wordmark for dark backgrounds
- `png/koraforms-primary-black-transparent.png` — monochrome black horizontal logo
- `png/koraforms-primary-white-transparent.png` — monochrome white horizontal logo

## Standalone product icon

- `png/koraforms-icon-color-transparent.png` — full-colour product icon
- `png/koraforms-icon-black-transparent.png` — monochrome black icon
- `png/koraforms-icon-white-transparent.png` — monochrome white icon

## Browser and PWA assets

The `web` folder contains ready-to-copy website files:

- `favicon.ico`
- `favicon-16x16.png`
- `favicon-32x32.png`
- `apple-touch-icon.png`
- `icon-192.png`
- `icon-512.png`
- `maskable-192.png`
- `maskable-512.png`
- `site.webmanifest`

## Next.js metadata example

Copy the contents of `web` into the application's `public` directory, then add:

```ts
export const metadata = {
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
  manifest: '/site.webmanifest',
}
```

All logo PNGs have transparent outer backgrounds. Use the light-background primary logo on white or pale surfaces and the dark-background version on dark surfaces.
